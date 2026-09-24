import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FoilRoll, StockCutRecord, FoilWidth, WIDTH_SPECIFICATIONS } from '../types';
import { getCurrentThaiYearBE2Digits, getCurrentMonth2Digits, normalizePattern } from '../utils/soFormatter';
import { getRecentOperators, saveRecentOperator } from '../utils/storage';
import { formatMeters, round2 } from '../utils/formatters';
import {
  X, Scissors, AlertTriangle, AlertCircle, User, Calendar, PlusCircle, Trash2, Clock
} from 'lucide-react';

interface CutOrderItem {
  id: string;
  cutType: 'so' | 'non_so';
  soNumber: string;
  productionRound: string;
  isSilverSide?: boolean;
  isWhiteSide?: boolean;
  nonSoReasonType: string;
  branchName: string;
  customNonSoReason: string;
  usedMeters: string;
  ngMeters: string;
  notes: string;
}

interface CutStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableRolls: FoilRoll[];
  existingRecords?: StockCutRecord[];
  preselectedRollId?: string | null;
  initialCutMode?: 'so' | 'non_so';
  onConfirmCut?: (record: Omit<StockCutRecord, 'id' | 'createdAt'>) => Promise<void> | void;
  onConfirmCutBatch: (records: Omit<StockCutRecord, 'id' | 'createdAt'>[]) => Promise<void> | void;
}

export const CutStockModal: React.FC<CutStockModalProps> = ({
  isOpen,
  onClose,
  availableRolls,
  existingRecords = [],
  preselectedRollId,
  initialCutMode = 'so',
  onConfirmCut,
  onConfirmCutBatch,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultSoPrefix = `so${getCurrentThaiYearBE2Digits()}${getCurrentMonth2Digits()}`;

  const [selectedFoilId, setSelectedFoilId] = useState<string>('');
  const [filterWidth, setFilterWidth] = useState<string>('all');
  const [filterPattern, setFilterPattern] = useState<string>('all');
  const [usageDate, setUsageDate] = useState<string>(today);
  const [recordedDate, setRecordedDate] = useState<string>(today);
  const [recordedBy, setRecordedBy] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const createEmptyOrder = (index: number, mode: 'so' | 'non_so' = 'so'): CutOrderItem => ({
    id: `order-item-${Date.now()}-${index}`,
    cutType: mode,
    soNumber: mode === 'so' ? defaultSoPrefix : '',
    productionRound: '',
    isSilverSide: false,
    isWhiteSide: false,
    nonSoReasonType: 'สาขายืม',
    branchName: '',
    customNonSoReason: '',
    usedMeters: '',
    ngMeters: '0',
    notes: '',
  });

  const [orders, setOrders] = useState<CutOrderItem[]>([createEmptyOrder(1, initialCutMode === 'non_so' ? 'non_so' : 'so')]);
  const recentOperators = getRecentOperators();
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpening) {
      setOrders([createEmptyOrder(1, initialCutMode === 'non_so' ? 'non_so' : 'so')]);
      setError(null);
      if (preselectedRollId) {
        const found = availableRolls.find(r => r.id === preselectedRollId);
        if (found) {
          setSelectedFoilId(found.id);
          setFilterWidth(String(found.width));
          setFilterPattern(normalizePattern(found.pattern));
        }
      } else if (availableRolls.length > 0) {
        const firstActive = availableRolls.find(r => r.remainingMeters > 0) || availableRolls[0];
        setSelectedFoilId(firstActive.id);
        setFilterWidth(String(firstActive.width));
        setFilterPattern(normalizePattern(firstActive.pattern));
      }
      if (!recordedBy && recentOperators.length > 0) setRecordedBy(recentOperators[0]);
    }
  }, [isOpen, preselectedRollId, initialCutMode, availableRolls, recordedBy, recentOperators]);

  const candidateRolls = useMemo(() => {
    return availableRolls.filter(r =>
      (filterWidth === 'all' || String(r.width) === filterWidth) &&
      (filterPattern === 'all' || normalizePattern(r.pattern) === normalizePattern(filterPattern))
    );
  }, [availableRolls, filterWidth, filterPattern]);

  const currentRoll = useMemo(() => availableRolls.find(r => r.id === selectedFoilId) || candidateRolls[0] || null, [selectedFoilId, candidateRolls, availableRolls]);
  const remainingBefore = currentRoll ? currentRoll.remainingMeters : 0;

  const handleUpdateOrder = (orderId: string, updates: Partial<CutOrderItem>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
  };

  const orderCalculations = orders.map((order) => {
    const numUsed = round2(Math.abs(parseFloat(order.usedMeters) || 0));
    const numNg = round2(Math.abs(parseFloat(order.ngMeters) || 0));
    const total = round2(numUsed + numNg);

    let identifier = order.cutType === 'so' ? order.soNumber.trim() : (order.customNonSoReason.trim() || order.nonSoReasonType);
    if (order.productionRound) {
        identifier += ` (${order.productionRound})`;
    }
    return { numUsed, numNg, total, identifier };
  });

  const totalDeductedAll = round2(orderCalculations.reduce((sum, item) => sum + item.total, 0));
  const remainingAfter = Math.max(0, round2(remainingBefore - totalDeductedAll));
  const isOverCut = totalDeductedAll > remainingBefore;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentRoll) return setError('กรุณาเลือกม้วนฟอยล์');
    if (!recordedBy.trim()) return setError('กรุณาระบุชื่อผู้บันทึก');
    if (totalDeductedAll <= 0) return setError('ต้องมียอดตัดใช้งานมากกว่า 0 เมตร');
    if (isOverCut) return setError('ไม่สามารถตัดเกินยอดคงเหลือปัจจุบันได้');

    if (isNaN(totalDeductedAll) || remainingAfter === null || isNaN(remainingAfter)) {
        return setError('พบข้อผิดพลาดในการคำนวณตัวเลข กรุณาตรวจสอบยอดตัดอีกครั้ง');
    }

    saveRecentOperator(recordedBy.trim());
    let currentBalance = remainingBefore;
    const batchRecords: Omit<StockCutRecord, 'id' | 'createdAt'>[] = [];

    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i];
      const calc = orderCalculations[i];
      const remAfterThis = Math.max(0, round2(currentBalance - calc.total));

      batchRecords.push({
        foilId: currentRoll.id,
        lotNumber: currentRoll.lotNumber,
        rollNumber: currentRoll.rollNumber,
        width: currentRoll.width,
        pattern: currentRoll.pattern,
        isSilverSide: !!ord.isSilverSide,
        isWhiteSide: !!ord.isWhiteSide,
        soNumber: calc.identifier,
        cutType: ord.cutType,
        nonSoReason: ord.cutType === 'non_so' ? ord.notes : '',
        usedMeters: calc.numUsed,
        ngMeters: calc.numNg,
        totalDeducted: calc.total,
        remainingBefore: currentBalance,
        remainingAfter: remAfterThis,
        usageDate: usageDate || today,
        recordedDate: recordedDate || today,
        recordedBy: recordedBy.trim(),
        notes: ord.notes.trim(),
      });
      currentBalance = remAfterThis;
    }

    setIsSubmitting(true);
    try {
      if (onConfirmCutBatch) {
        await onConfirmCutBatch(batchRecords);
      } else if (onConfirmCut) {
        for (const record of batchRecords) {
          await onConfirmCut(record);
        }
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">

        <div className="px-5 py-4 bg-amber-500 text-slate-900 flex justify-between items-center">
            <h2 className="font-bold text-lg flex items-center gap-2"><Scissors className="w-5 h-5"/> ตัดสต๊อกฟอยล์</h2>
            <button onClick={onClose} className="p-1 hover:bg-black/10 rounded"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 font-bold text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4"/> {error}
              </div>
            )}

            {/* Roll Selection */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold mb-2">เลือกม้วนที่จะตัด</label>
                <select value={selectedFoilId} onChange={(e) => setSelectedFoilId(e.target.value)} className="w-full p-2 border rounded-lg bg-white font-mono font-bold">
                    {candidateRolls.map(r => (
                        <option key={r.id} value={r.id} disabled={r.remainingMeters <= 0}>
                            ล็อต {r.lotNumber} #{r.rollNumber} - เหลือ {formatMeters(r.remainingMeters)} ม.
                        </option>
                    ))}
                </select>
            </div>

            {/* Orders */}
            {orders.map((order, idx) => (
                <div key={order.id} className="p-4 border rounded-xl space-y-3 relative">
                    <div className="font-bold text-sm text-slate-800 border-b pb-2 flex justify-between items-center">
                      <span>ใบสั่งซื้อ / รายการที่ {idx + 1}</span>
                      {orders.length > 1 && (
                        <button type="button" onClick={() => setOrders(orders.filter(o => o.id !== order.id))} className="text-rose-500 hover:text-rose-700">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1">รหัส SO</label>
                            <input type="text" value={order.soNumber} onChange={e => handleUpdateOrder(order.id, {soNumber: e.target.value})} className="w-full p-2 border rounded-lg font-mono font-bold" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> รอบการผลิต (ตัวเลือก)</label>
                            <select value={order.productionRound} onChange={e => handleUpdateOrder(order.id, {productionRound: e.target.value})} className="w-full p-2 border rounded-lg bg-white">
                                <option value="">ไม่ระบุรอบ</option>
                                <option value="รอบเช้า">รอบเช้า</option>
                                <option value="รอบบ่าย">รอบบ่าย</option>
                                <option value="รอบโอที (OT)">รอบโอที (OT)</option>
                                <option value="ผลิตเสริม">ผลิตเสริม</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-emerald-700">ใช้จริง (เมตร)</label>
                            <input type="number" step="0.01" min="0" value={order.usedMeters} onChange={e => handleUpdateOrder(order.id, {usedMeters: e.target.value})} className="w-full p-2 border border-emerald-300 bg-emerald-50 rounded-lg font-bold font-mono text-lg" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-rose-700">NG เสีย (เมตร)</label>
                            <input type="number" step="0.01" min="0" value={order.ngMeters} onChange={e => handleUpdateOrder(order.id, {ngMeters: e.target.value})} className="w-full p-2 border border-rose-300 bg-rose-50 rounded-lg font-bold font-mono text-lg" />
                        </div>
                    </div>
                </div>
            ))}

            <button type="button" onClick={() => setOrders([...orders, createEmptyOrder(orders.length + 1)])} className="w-full py-2 border border-dashed border-amber-400 bg-amber-50 text-amber-800 font-bold rounded-lg text-xs flex justify-center items-center gap-1">
                <PlusCircle className="w-4 h-4"/> เพิ่มรายการ SO ตัดต่อจากม้วนนี้
            </button>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5"/> ชื่อผู้บันทึก</label>
                    <input type="text" value={recordedBy} onChange={e => setRecordedBy(e.target.value)} className="w-full p-2 border rounded-lg" required />
                </div>
                <div>
                    <label className="block text-xs font-bold mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> วันที่</label>
                    <input type="date" value={usageDate} onChange={e => setUsageDate(e.target.value)} className="w-full p-2 border rounded-lg font-mono" required />
                </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-900 text-white p-3 rounded-xl grid grid-cols-3 text-center text-xs items-center">
                <div>
                    <span className="block text-slate-400">คงเหลือเดิม</span>
                    <span className="font-bold text-sm">{formatMeters(remainingBefore)} ม.</span>
                </div>
                <div>
                    <span className="block text-slate-400">ตัดออกรวม</span>
                    <span className="font-bold text-amber-400 text-sm">-{formatMeters(totalDeductedAll)} ม.</span>
                </div>
                <div className={isOverCut ? "text-rose-400" : "text-emerald-400"}>
                    <span className="block text-slate-400 flex justify-center items-center gap-1">
                      คงเหลือสุทธิ {isOverCut && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                    </span>
                    <span className="font-bold text-base">{formatMeters(remainingAfter)} ม.</span>
                </div>
            </div>
        </form>

        <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">ยกเลิก</button>
            <button onClick={handleSubmit} disabled={isSubmitting || isOverCut} className="px-6 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg disabled:opacity-50 flex items-center gap-2">
                {isSubmitting ? 'กำลังบันทึก...' : `ยืนยันตัดสต๊อก ${formatMeters(totalDeductedAll)} ม.`}
            </button>
        </div>
      </div>
    </div>
  );
};
