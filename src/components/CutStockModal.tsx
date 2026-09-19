import React, { useState, useEffect, useRef } from 'react';
import { FoilRoll, StockCutRecord, FoilWidth, WIDTH_SPECIFICATIONS } from '../types';
import { getCurrentThaiYearBE2Digits, getCurrentMonth2Digits } from '../utils/soFormatter';
import { getRecentOperators, saveRecentOperator } from '../utils/storage';
import { formatMeters, round2 } from '../utils/formatters';
import { 
  X, 
  Scissors, 
  AlertTriangle, 
  AlertCircle,
  User, 
  Calendar, 
  Layers, 
  PlusCircle, 
  Trash2, 
  CheckCircle2,
  Building2,
  Wrench
} from 'lucide-react';

interface CutOrderItem {
  id: string;
  cutType: 'so' | 'non_so';
  soNumber: string;
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
  preselectedRollId?: string | null;
  initialCutMode?: 'so' | 'non_so';
  onConfirmCut?: (record: Omit<StockCutRecord, 'id' | 'createdAt'>) => Promise<void> | void;
  onConfirmCutBatch: (records: Omit<StockCutRecord, 'id' | 'createdAt'>[]) => Promise<void> | void;
}

export const CutStockModal: React.FC<CutStockModalProps> = ({
  isOpen,
  onClose,
  availableRolls,
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

  // References to input elements for focus navigation
  const usedMetersInputRefs = useRef<{ [orderId: string]: HTMLInputElement | null }>({});
  const ngMetersInputRefs = useRef<{ [orderId: string]: HTMLInputElement | null }>({});
  const soInputRefs = useRef<{ [orderId: string]: HTMLInputElement | null }>({});

  const createEmptyOrder = (index: number, mode: 'so' | 'non_so' = 'so'): CutOrderItem => ({
    id: `order-item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    cutType: mode,
    soNumber: mode === 'so' ? defaultSoPrefix : '',
    nonSoReasonType: 'สาขายืม',
    branchName: '',
    customNonSoReason: '',
    usedMeters: '',
    ngMeters: '0',
    notes: '',
  });

  const [orders, setOrders] = useState<CutOrderItem[]>([
    createEmptyOrder(1, initialCutMode === 'non_so' ? 'non_so' : 'so')
  ]);

  const recentOperators = getRecentOperators();

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      const initMode = initialCutMode === 'non_so' ? 'non_so' : 'so';
      const initialOrder = createEmptyOrder(1, initMode);
      setOrders([initialOrder]);
      setError(null);

      if (preselectedRollId && availableRolls.some(r => r.id === preselectedRollId)) {
        const found = availableRolls.find(r => r.id === preselectedRollId);
        if (found) {
          setSelectedFoilId(found.id);
          setFilterWidth(String(found.width));
          setFilterPattern(found.pattern);
        }
      } else {
        const firstActive = availableRolls.find(r => r.remainingMeters > 0);
        if (firstActive) {
          setSelectedFoilId(firstActive.id);
          setFilterWidth(String(firstActive.width));
          setFilterPattern(firstActive.pattern);
        } else if (availableRolls.length > 0) {
          setSelectedFoilId(availableRolls[0].id);
          setFilterWidth(String(availableRolls[0].width));
          setFilterPattern(availableRolls[0].pattern);
        }
      }

      if (!recordedBy && recentOperators.length > 0) {
        setRecordedBy(recentOperators[0]);
      }

      // Auto-focus SO input on modal open
      setTimeout(() => {
        const firstId = initialOrder.id;
        const el = soInputRefs.current[firstId];
        if (el) {
          el.focus();
          // Place cursor at end so user can type the suffix immediately
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      }, 150);
    }
  }, [isOpen, preselectedRollId, availableRolls, initialCutMode]);

  if (!isOpen) return null;

  // Filter cascades
  const availableWidths: FoilWidth[] = Array.from<FoilWidth>(new Set(availableRolls.map(r => r.width)))
    .sort((a, b) => Number(a) - Number(b));

  const rollsFilteredByWidth = availableRolls.filter(r => 
    filterWidth === 'all' ? true : String(r.width) === filterWidth
  );
  const availablePatternsForSelectedWidth = Array.from(new Set(rollsFilteredByWidth.map(r => r.pattern)));

  const candidateRolls = rollsFilteredByWidth
    .filter(r => filterPattern === 'all' ? true : r.pattern === filterPattern)
    .sort((a, b) => {
      const lotComp = a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true, sensitivity: 'base' });
      if (lotComp !== 0) return lotComp;
      return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
    });

  const currentRoll = availableRolls.find(r => r.id === selectedFoilId);

  // Handlers for step-by-step selection
  const handleWidthChange = (newWidth: string) => {
    setFilterWidth(newWidth);
    const matchingRolls = availableRolls.filter(r => newWidth === 'all' || String(r.width) === newWidth);
    const validPatterns = Array.from(new Set(matchingRolls.map(r => r.pattern)));
    let nextPattern = filterPattern;
    if (filterPattern !== 'all' && !validPatterns.includes(filterPattern)) {
      nextPattern = validPatterns[0] || 'all';
      setFilterPattern(nextPattern);
    }
    const eligibleRolls = matchingRolls.filter(r => nextPattern === 'all' || r.pattern === nextPattern);
    const firstActive = eligibleRolls.find(r => r.remainingMeters > 0) || eligibleRolls[0];
    if (firstActive) {
      setSelectedFoilId(firstActive.id);
    }
  };

  const handlePatternChange = (newPattern: string) => {
    setFilterPattern(newPattern);
    const eligibleRolls = rollsFilteredByWidth.filter(r => newPattern === 'all' || r.pattern === newPattern);
    const firstActive = eligibleRolls.find(r => r.remainingMeters > 0) || eligibleRolls[0];
    if (firstActive) {
      setSelectedFoilId(firstActive.id);
    }
  };

  // Order management
  const handleAddOrder = () => {
    const newOrder = createEmptyOrder(orders.length + 1, 'so');
    setOrders(prev => [...prev, newOrder]);
    setTimeout(() => {
      const el = soInputRefs.current[newOrder.id];
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 100);
  };

  const handleRemoveOrder = (orderId: string) => {
    if (orders.length <= 1) return;
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleUpdateOrder = (orderId: string, updates: Partial<CutOrderItem>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
  };

  // Calculation logic
  const remainingBefore = currentRoll ? currentRoll.remainingMeters : 0;

  const orderCalculations = orders.map((order) => {
    const rawUsed = parseFloat(order.usedMeters);
    const rawNg = parseFloat(order.ngMeters);
    // Convert to absolute positive numbers and round to 2 decimals
    const numUsed = round2(Math.abs(isNaN(rawUsed) ? 0 : rawUsed));
    const numNg = round2(Math.abs(isNaN(rawNg) ? 0 : rawNg));
    const total = round2(numUsed + numNg);

    let identifier = '';
    if (order.cutType === 'so') {
      identifier = order.soNumber.trim().toLowerCase();
    } else {
      if (order.nonSoReasonType === 'สาขายืม') {
        const branch = order.branchName.trim() || 'สาขา';
        identifier = `สาขายืม (${branch})`;
      } else if (order.nonSoReasonType === 'ซ่อมฟอยล์พ่นกาว') {
        identifier = 'ซ่อมฟอยล์พ่นกาว';
      } else if (order.nonSoReasonType === 'ทดสอบไลน์ผลิต / ตัวอย่าง') {
        identifier = 'ทดสอบเครื่อง/ตัวอย่าง';
      } else {
        identifier = order.customNonSoReason.trim() || 'ตัดใช้งานทั่วไป (ไม่ใช้ SO)';
      }
    }

    return {
      numUsed,
      numNg,
      total,
      identifier,
    };
  });

  // Formula: remainingMeters สุทธิ = remainingMeters เดิม - (cutMeters + ngMeters)
  const totalDeductedAll = round2(orderCalculations.reduce((sum, item) => sum + item.total, 0));
  const remainingAfter = Math.max(0, round2(remainingBefore - totalDeductedAll));
  const isOverCut = totalDeductedAll > remainingBefore;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentRoll) {
      setError('กรุณาเลือกม้วนฟอยล์ที่ต้องการตัดสต๊อก');
      return;
    }

    if (!recordedBy.trim()) {
      setError('กรุณาระบุชื่อผู้บันทึก');
      return;
    }

    // Validate each order line
    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i];
      const calc = orderCalculations[i];

      if (ord.cutType === 'so' && !ord.soNumber.trim()) {
        setError(`ใบสั่งซื้อที่ ${i + 1}: กรุณากรอกรหัส SO ให้ครบถ้วน`);
        return;
      }

      if (calc.numUsed <= 0 && calc.numNg <= 0) {
        setError(`ใบสั่งซื้อที่ ${i + 1}: กรุณาระบุจำนวนเมตรที่ใช้ หรือ NG ที่เสีย`);
        return;
      }
    }

    if (totalDeductedAll <= 0) {
      setError('กรุณาระบุจำนวนเมตรตัดใช้งานอย่างน้อยหนึ่งรายการ');
      return;
    }

    // Over-cut validation: Strictly prevent submission if cutMeters + ngMeters > remainingMeters
    if (isOverCut) {
      setError('ไม่สามารถตัดเกินจำนวนคงเหลือในม้วนได้');
      return;
    }

    // Save operator to recent list
    saveRecentOperator(recordedBy.trim());

    // Build batch records with progressive remaining balances
    let currentBalance = remainingBefore;
    const batchRecords: Omit<StockCutRecord, 'id' | 'createdAt'>[] = [];

    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i];
      const calc = orderCalculations[i];
      const remBeforeThis = currentBalance;
      const remAfterThis = Math.max(0, round2(remBeforeThis - calc.total));
      currentBalance = remAfterThis;

      batchRecords.push({
        foilId: currentRoll.id,
        lotNumber: currentRoll.lotNumber,
        rollNumber: currentRoll.rollNumber,
        width: currentRoll.width,
        pattern: currentRoll.pattern,
        soNumber: calc.identifier,
        cutType: ord.cutType,
        nonSoReason: ord.cutType === 'non_so' ? (ord.notes.trim() || calc.identifier) : '',
        usedMeters: Math.abs(calc.numUsed),
        ngMeters: Math.abs(calc.numNg),
        totalDeducted: Math.abs(calc.total),
        remainingBefore: Math.max(0, remBeforeThis),
        remainingAfter: Math.max(0, remAfterThis),
        usageDate: usageDate || today,
        recordedDate: recordedDate || today,
        recordedBy: recordedBy.trim(),
        notes: ord.notes.trim(),
      });
    }

    setIsSubmitting(true);
    try {
      if (onConfirmCutBatch) {
        await onConfirmCutBatch(batchRecords);
      } else if (onConfirmCut && batchRecords.length > 0) {
        for (const r of batchRecords) {
          await onConfirmCut(r);
        }
      }
      onClose();
    } catch (err: any) {
      console.error('Cut stock batch submission failed:', err);
      // Alert/Error message as requested: "บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ"
      setError(err?.message || 'บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div 
        id="modal-cut-stock"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-amber-500 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950/15 border border-slate-950/20 flex items-center justify-center text-slate-950">
              <Scissors className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                ตัดสต็อกฟอยล์
              </h2>
              <p className="text-xs text-slate-900/80">
                หลังคาเย็นสยาม (ร่มเกล้า) • บันทึกตัดยอด SO ลงสต๊อก
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-900/70 hover:text-slate-950 p-1.5 rounded-lg hover:bg-slate-950/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-sm">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-start gap-2.5 font-medium animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-950 text-sm">{error}</p>
                {error.includes('กรุณาตรวจสอบการเชื่อมต่อ') && (
                  <p className="text-rose-800 text-[11px] leading-relaxed">
                    ระบบได้ระงับการบันทึกและไม่ได้หักสต๊อก ยอดคงเหลือเดิมยังไม่เปลี่ยนแปลง กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตหรือสถานะ Firebase แล้วลองใหม่อีกครั้ง
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 1. ส่วนเลือกม้วนฟอยล์ด้านบน */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Width Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หน้ากว้าง (มม.)
                </label>
                <select
                  value={filterWidth}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">ทุกขนาด ({availableWidths.length})</option>
                  {availableWidths.map(w => (
                    <option key={w} value={String(w)}>
                      {w} มม. {WIDTH_SPECIFICATIONS[w] ? `(${WIDTH_SPECIFICATIONS[w]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pattern Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ลายฟอยล์
                </label>
                <select
                  value={filterPattern}
                  onChange={(e) => handlePatternChange(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">ทุกลาย ({availablePatternsForSelectedWidth.length})</option>
                  {availablePatternsForSelectedWidth.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Roll Selection */}
              <div>
                <label htmlFor="select-foil-roll" className="block text-xs font-semibold text-slate-700 mb-1">
                  เลือกม้วนฟอยล์ <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-foil-roll"
                  value={selectedFoilId}
                  onChange={(e) => setSelectedFoilId(e.target.value)}
                  required
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-900 focus:border-amber-500 cursor-pointer"
                >
                  {candidateRolls.length === 0 ? (
                    <option value="">ไม่มีม้วนฟอยล์ที่ตรงเงื่อนไข</option>
                  ) : (
                    candidateRolls.map((r) => (
                      <option 
                        key={r.id} 
                        value={r.id}
                        disabled={r.remainingMeters <= 0}
                      >
                        {r.lotNumber} #{r.rollNumber} - เหลือ {formatMeters(r.remainingMeters)} ม. {r.remainingMeters <= 0 ? '(หมด)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Selected Roll Highlight Details */}
            {currentRoll && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 font-mono">
                    ล็อต {currentRoll.lotNumber} #{currentRoll.rollNumber}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-700">{currentRoll.width} มม.</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-slate-800">ลาย {currentRoll.pattern}</span>
                </div>

                <div className="flex items-center gap-2">
                  {currentRoll.remainingMeters <= 0 ? (
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold font-mono">
                      ตัดหมดแล้ว (0.00 ม.)
                    </span>
                  ) : currentRoll.remainingMeters <= 50 ? (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300 font-bold font-mono animate-pulse">
                      คงเหลือ {formatMeters(currentRoll.remainingMeters)} ม. (วิกฤต &le; 50ม. สีแดง)
                    </span>
                  ) : currentRoll.remainingMeters <= 200 ? (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold font-mono">
                      คงเหลือ {formatMeters(currentRoll.remainingMeters)} ม. (เหลือน้อย &le; 200ม. สีเหลือง)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold font-mono">
                      คงเหลือ {formatMeters(currentRoll.remainingMeters)} ม. (พร้อมใช้)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. ฟอร์มกรอก SO ตรงกลาง */}
          <div className="space-y-3">
            {orders.map((order, index) => {
              const orderCalc = orderCalculations[index];
              return (
                <div 
                  key={order.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-bold text-slate-800 text-xs">
                        ใบสั่งซื้อ {orders.length > 1 ? `#${index + 1}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Mode Toggle */}
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateOrder(order.id, { 
                              cutType: 'so',
                              soNumber: order.soNumber || defaultSoPrefix
                            });
                          }}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                            order.cutType === 'so'
                              ? 'bg-white text-slate-900 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          มีรหัส SO
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateOrder(order.id, { cutType: 'non_so' })}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                            order.cutType === 'non_so'
                              ? 'bg-white text-purple-800 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ไม่ใช้ SO
                        </button>
                      </div>

                      {orders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOrder(order.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="ลบใบสั่งซื้อนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Single Consolidated SO Input Field with Default Prefix */}
                  {order.cutType === 'so' ? (
                    <div>
                      <label 
                        htmlFor={`input-so-${order.id}`}
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        เลขที่ใบสั่งซื้อ / SO <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id={`input-so-${order.id}`}
                        ref={(el) => { soInputRefs.current[order.id] = el; }}
                        type="text"
                        tabIndex={1}
                        value={order.soNumber}
                        onChange={(e) => handleUpdateOrder(order.id, { soNumber: e.target.value.toLowerCase() })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const target = usedMetersInputRefs.current[order.id];
                            if (target) {
                              target.focus();
                              target.select();
                            }
                          }
                        }}
                        placeholder={`เช่น ${defaultSoPrefix}500`}
                        className="w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>
                  ) : (
                    /* Non-SO Reason selector */
                    <div className="p-2.5 bg-purple-50/60 border border-purple-200 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {['สาขายืม', 'ซ่อมฟอยล์พ่นกาว', 'ทดสอบไลน์ผลิต / ตัวอย่าง', 'อื่นๆ'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleUpdateOrder(order.id, { nonSoReasonType: type })}
                            className={`px-2 py-1 rounded-md border text-xs font-medium text-center transition-all cursor-pointer ${
                              order.nonSoReasonType === type
                                ? 'bg-purple-700 text-white border-purple-800 font-semibold shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      {order.nonSoReasonType === 'สาขายืม' && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                          <input
                            type="text"
                            value={order.branchName}
                            onChange={(e) => handleUpdateOrder(order.id, { branchName: e.target.value })}
                            placeholder="ระบุชื่อสาขาที่ยืม เช่น สาขาพัทยา, สาขานิคมฯ"
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg focus:border-purple-600"
                          />
                        </div>
                      )}

                      {order.nonSoReasonType === 'อื่นๆ' && (
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-purple-600 shrink-0" />
                          <input
                            type="text"
                            value={order.customNonSoReason}
                            onChange={(e) => handleUpdateOrder(order.id, { customNonSoReason: e.target.value })}
                            placeholder="ระบุเหตุผลการตัด เช่น เคลมเปลี่ยนม้วน, ตัวอย่าง"
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg focus:border-purple-600"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grid 2 Columns: จำนวนเมตรที่ใช้ & เศษเสีย NG */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label 
                        htmlFor={`input-used-${order.id}`}
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        จำนวนเมตรที่ใช้ (ม.) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id={`input-used-${order.id}`}
                          ref={(el) => { usedMetersInputRefs.current[order.id] = el; }}
                          type="number"
                          step="0.01"
                          min="0"
                          tabIndex={2}
                          value={order.usedMeters}
                          onChange={(e) => handleUpdateOrder(order.id, { usedMeters: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const target = ngMetersInputRefs.current[order.id];
                              if (target) {
                                target.focus();
                                target.select();
                              }
                            }
                          }}
                          placeholder="เช่น 150.00"
                          required
                          className="w-full px-3 py-2 text-base font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 placeholder:font-normal"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">ม.</span>
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor={`input-ng-${order.id}`}
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        เศษเสีย NG (ม.)
                      </label>
                      <div className="relative">
                        <input
                          id={`input-ng-${order.id}`}
                          ref={(el) => { ngMetersInputRefs.current[order.id] = el; }}
                          type="number"
                          step="0.01"
                          min="0"
                          tabIndex={3}
                          value={order.ngMeters}
                          onChange={(e) => handleUpdateOrder(order.id, { ngMeters: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3 py-2 text-base font-bold font-mono text-rose-600 bg-white border border-slate-300 rounded-lg focus:border-rose-400 focus:ring-1 focus:ring-rose-400 placeholder:text-slate-400 placeholder:font-normal"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">ม.</span>
                      </div>
                    </div>
                  </div>

                  {/* Note & Single Item Total */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={order.notes}
                      onChange={(e) => handleUpdateOrder(order.id, { notes: e.target.value })}
                      placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-amber-500"
                    />
                    <div className="text-right text-xs font-mono shrink-0 px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                      ตัดใบนี้: <strong className="text-slate-900">{formatMeters(orderCalc.total)}</strong> ม.
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Next Order Button */}
            <button
              type="button"
              onClick={handleAddOrder}
              className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/50 text-slate-700 hover:text-amber-900 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>+ เพิ่มใบสั่งซื้อ / SO ถัดไป</span>
            </button>
          </div>

          {/* Operator and Usage Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label htmlFor="input-operator" className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  ชื่อผู้บันทึก <span className="text-rose-500">*</span>
                </span>
              </label>
              <input
                id="input-operator"
                type="text"
                required
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                placeholder="เช่น สมชาย, ช่างคุมเครื่อง"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:border-amber-500 text-slate-900 font-medium"
              />
              {recentOperators.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                  <span className="text-[10px] text-slate-400">เลือกเร็ว:</span>
                  {recentOperators.slice(0, 3).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setRecordedBy(op)}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-600 transition-colors cursor-pointer"
                    >
                      {op}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="input-usage-date" className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  วันที่ใช้งาน
                </span>
              </label>
              <input
                id="input-usage-date"
                type="date"
                value={usageDate}
                onChange={(e) => setUsageDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:border-amber-500 text-slate-900 font-mono"
              />
            </div>
          </div>

          {/* 3. กล่องสรุปยอดคงเหลือสุทธิ + ปุ่มบันทึกด้านล่าง */}
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-800 rounded-lg">
                <span className="text-slate-400 block text-[11px]">ยอดคงเหลือเดิม</span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatMeters(remainingBefore)} <span className="text-[10px] font-normal text-slate-400">ม.</span>
                </span>
              </div>

              <div className="p-2 bg-slate-800 rounded-lg">
                <span className="text-slate-400 block text-[11px]">รวมตัดออก (ใช้+NG)</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  -{formatMeters(totalDeductedAll)} <span className="text-[10px] font-normal text-slate-400">ม.</span>
                </span>
              </div>

              <div className={`p-2 rounded-lg ${isOverCut ? 'bg-rose-950 border border-rose-600' : 'bg-slate-800'}`}>
                <span className="text-slate-400 block text-[11px]">คงเหลือสุทธิ</span>
                <span className={`font-mono font-bold text-sm ${isOverCut ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {formatMeters(remainingAfter)} <span className="text-[10px] font-normal text-slate-400">ม.</span>
                </span>
              </div>
            </div>

            {/* Over-cut Alert Message */}
            {isOverCut && (
              <div className="p-2.5 bg-rose-900/80 border border-rose-500 text-rose-200 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
                <span className="font-semibold">
                  ไม่สามารถตัดเกินจำนวนคงเหลือในม้วนได้ (ม้วนนี้เหลือ {formatMeters(remainingBefore)} ม. แต่ระบุตัดรวม {formatMeters(totalDeductedAll)} ม.)
                </span>
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isOverCut || totalDeductedAll <= 0}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs active:scale-[0.98] ${
                isSubmitting || isOverCut || totalDeductedAll <= 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  <span>กำลังบันทึกลง Firebase...</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4 stroke-[2.5]" />
                  <span>ยืนยันตัดสต๊อก ({formatMeters(totalDeductedAll)} ม.)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
