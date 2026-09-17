import React, { useState, useEffect } from 'react';
import { FoilRoll, StockCutRecord, FoilWidth, WIDTH_SPECIFICATIONS } from '../types';
import { SOInputHelper } from './SOInputHelper';
import { getRecentOperators, saveRecentOperator } from '../utils/storage';
import { formatMeters, round2 } from '../utils/formatters';
import { 
  X, 
  Scissors, 
  AlertTriangle, 
  User, 
  Calendar, 
  Layers, 
  Building2, 
  Wrench, 
  Sparkles, 
  PlusCircle, 
  Trash2, 
  CheckCircle2,
  FileSpreadsheet
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
  onConfirmCut?: (record: Omit<StockCutRecord, 'id' | 'createdAt'>) => void;
  onConfirmCutBatch: (records: Omit<StockCutRecord, 'id' | 'createdAt'>[]) => void;
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

  const [selectedFoilId, setSelectedFoilId] = useState<string>('');
  // Step-by-step cascade filters: หน้ากว้าง, ท้องฟอยล์, เบอร์ม้วน
  const [filterWidth, setFilterWidth] = useState<string>('all');
  const [filterPattern, setFilterPattern] = useState<string>('all');

  // Common metadata
  const [usageDate, setUsageDate] = useState<string>(today);
  const [recordedDate, setRecordedDate] = useState<string>(today);
  const [recordedBy, setRecordedBy] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Multi-order list
  const createEmptyOrder = (index: number, mode: 'so' | 'non_so' = 'so'): CutOrderItem => ({
    id: `order-item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    cutType: mode,
    soNumber: '',
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

  // Pick first available roll or preselected
  useEffect(() => {
    if (isOpen) {
      setOrders([createEmptyOrder(1, initialCutMode === 'non_so' ? 'non_so' : 'so')]);
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
    }
  }, [isOpen, preselectedRollId, availableRolls, initialCutMode]);

  if (!isOpen) return null;

  // Cascade options calculation
  const availableWidths: FoilWidth[] = Array.from<FoilWidth>(new Set(availableRolls.map(r => r.width))).sort((a, b) => Number(a) - Number(b));

  const rollsFilteredByWidth = availableRolls.filter(r => 
    filterWidth === 'all' ? true : String(r.width) === filterWidth
  );
  const availablePatternsForSelectedWidth = Array.from(new Set(rollsFilteredByWidth.map(r => r.pattern)));

  const candidateRolls = rollsFilteredByWidth.filter(r =>
    filterPattern === 'all' ? true : r.pattern === filterPattern
  );

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

  // Order line management
  const handleAddOrder = () => {
    setOrders(prev => [...prev, createEmptyOrder(prev.length + 1, 'so')]);
  };

  const handleRemoveOrder = (orderId: string) => {
    if (orders.length <= 1) return;
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleUpdateOrder = (orderId: string, updates: Partial<CutOrderItem>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
  };

  // Multi-order Calculations with 0.01 precision
  const remainingBefore = currentRoll ? currentRoll.remainingMeters : 0;

  // Order totals
  const orderCalculations = orders.map((order) => {
    const numUsed = round2(parseFloat(order.usedMeters) || 0);
    const numNg = round2(parseFloat(order.ngMeters) || 0);
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

  const totalDeductedAll = round2(orderCalculations.reduce((sum, item) => sum + item.total, 0));
  const remainingAfter = round2(remainingBefore - totalDeductedAll);
  const isOverCut = remainingAfter < 0;

  const handleSubmit = (e: React.FormEvent) => {
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
        setError(`ใบสั่งซื้อที่ ${i + 1}: กรุณาระบุจำนวนเมตรที่ใช้ หรือ NG ที่เสีย (รองรับทศนิยมถึง 0.01 ม.)`);
        return;
      }
    }

    if (totalDeductedAll <= 0) {
      setError('กรุณาระบุจำนวนเมตรตัดใช้งานอย่างน้อยหนึ่งรายการ');
      return;
    }

    if (isOverCut) {
      setError(`ยอดตัดรวมทุกใบงาน (${formatMeters(totalDeductedAll)} ม.) เกินกว่ายอดคงเหลือในม้วนนี้ (${formatMeters(remainingBefore)} ม.)`);
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
      const remAfterThis = round2(remBeforeThis - calc.total);
      currentBalance = remAfterThis;

      batchRecords.push({
        foilId: currentRoll.id,
        lotNumber: currentRoll.lotNumber,
        rollNumber: currentRoll.rollNumber,
        width: currentRoll.width,
        pattern: currentRoll.pattern,
        soNumber: calc.identifier,
        cutType: ord.cutType,
        nonSoReason: ord.cutType === 'non_so' ? (ord.notes.trim() || calc.identifier) : undefined,
        usedMeters: calc.numUsed,
        ngMeters: calc.numNg,
        totalDeducted: calc.total,
        remainingBefore: remBeforeThis,
        remainingAfter: remAfterThis,
        usageDate: usageDate || today,
        recordedDate: recordedDate || today,
        recordedBy: recordedBy.trim(),
        notes: ord.notes.trim(),
      });
    }

    if (onConfirmCutBatch) {
      onConfirmCutBatch(batchRecords);
    } else if (onConfirmCut && batchRecords.length > 0) {
      batchRecords.forEach(r => onConfirmCut(r));
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div 
        id="modal-cut-stock"
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-amber-500 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950/15 border border-slate-950/20 flex items-center justify-center text-slate-950">
              <Scissors className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                ตัดสต๊อกฟอยล์หลังคา (รองรับหลายใบงาน & ทศนิยม 0.01 ม.)
              </h2>
              <p className="text-xs text-slate-900/80">
                เลือกหน้ากว้าง ท้องฟอยล์ ม้วนฟอยล์ และระบุใบสั่งซื้อที่ต้องการตัด
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Foil Selection Cascade */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                ขั้นตอนที่ 1: เลือกฟอยล์ที่ต้องการตัด (หน้ากว้าง &gt; ท้องฟอยล์ &gt; เบอร์ม้วน)
              </span>
              <span className="text-[11px] text-slate-500">
                ม้วนพร้อมตัด: {availableRolls.filter(r => r.remainingMeters > 0).length} ม้วน
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1. Width */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  1. หน้ากว้าง (มม.)
                </label>
                <select
                  value={filterWidth}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">ทั้งหมด ({availableWidths.length} ขนาด)</option>
                  {availableWidths.map(w => (
                    <option key={w} value={String(w)}>
                      {w} มม. {WIDTH_SPECIFICATIONS[w] ? `(${WIDTH_SPECIFICATIONS[w]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Pattern (ท้องฟอยล์) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  2. ท้องฟอยล์
                </label>
                <select
                  value={filterPattern}
                  onChange={(e) => handlePatternChange(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">ทั้งหมด ({availablePatternsForSelectedWidth.length} ท้อง)</option>
                  {availablePatternsForSelectedWidth.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* 3. Roll Selection */}
              <div>
                <label htmlFor="select-foil-roll" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  3. ม้วนฟอยล์ (ล็อต - เบอร์) <span className="text-rose-500">*</span>
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

            {/* Selected Roll Status Badge */}
            {currentRoll && (
              <div className="p-3 bg-white border border-amber-300 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="font-bold text-slate-900 font-mono">
                    ล็อต {currentRoll.lotNumber} #{currentRoll.rollNumber}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-700">หน้ากว้าง {currentRoll.width} มม.</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-slate-800">ท้อง: {currentRoll.pattern}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-slate-500">คงเหลือก่อนตัด:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatMeters(currentRoll.remainingMeters)}
                  </span>
                  <span className="text-slate-500 text-[11px]">ม.</span>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Multi-Order Cutting Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  ขั้นตอนที่ 2: รายการใบสั่งซื้อที่ต้องการตัดสต๊อก ({orders.length} ใบงาน)
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                * รองรับทศนิยมได้ถึง 0.01 ม. (เช่น 227.63 ม.)
              </span>
            </div>

            {/* List of Order Cards */}
            <div className="space-y-3">
              {orders.map((order, index) => {
                const orderCalc = orderCalculations[index];
                return (
                  <div 
                    key={order.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3 relative hover:border-slate-300 transition-colors"
                  >
                    {/* Order Item Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          ใบสั่งซื้อที่ {index + 1}
                        </span>
                        {order.cutType === 'so' ? (
                          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            {order.soNumber || 'รอระบุ SO'}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                            ไม่ใช้ SO ({order.nonSoReasonType})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Cut Type Toggle */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateOrder(order.id, { cutType: 'so' })}
                            className={`px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
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
                            className={`px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                              order.cutType === 'non_so'
                                ? 'bg-white text-purple-800 shadow-xs font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ไม่ใช้ SO
                          </button>
                        </div>

                        {/* Delete Order Button if > 1 order */}
                        {orders.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOrder(order.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`ลบใบสั่งซื้อที่ ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SO or Non-SO Details */}
                    {order.cutType === 'so' ? (
                      <div>
                        <SOInputHelper
                          id={`order-so-${order.id}`}
                          value={order.soNumber}
                          onChange={(val) => handleUpdateOrder(order.id, { soNumber: val })}
                          label={`รหัส SO ใบสั่งซื้อที่ ${index + 1}`}
                        />
                      </div>
                    ) : (
                      /* Non-SO Reason selector */
                      <div className="p-3 bg-purple-50/50 border border-purple-200/80 rounded-xl space-y-2.5">
                        <label className="block text-xs font-semibold text-purple-950">
                          เหตุผลการตัด (ไม่ใช้ SO)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {['สาขายืม', 'ซ่อมฟอยล์พ่นกาว', 'ทดสอบไลน์ผลิต / ตัวอย่าง', 'อื่นๆ'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleUpdateOrder(order.id, { nonSoReasonType: type })}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer ${
                                order.nonSoReasonType === type
                                  ? 'bg-purple-700 text-white border-purple-800 shadow-2xs font-semibold'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        {order.nonSoReasonType === 'สาขายืม' && (
                          <div className="pt-1 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                            <input
                              type="text"
                              value={order.branchName}
                              onChange={(e) => handleUpdateOrder(order.id, { branchName: e.target.value })}
                              placeholder="ระบุชื่อสาขาที่ยืม เช่น สาขาพัทยา, สาขานิคมฯ"
                              className="flex-1 px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                            />
                          </div>
                        )}

                        {order.nonSoReasonType === 'อื่นๆ' && (
                          <div className="pt-1 flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-purple-600 shrink-0" />
                            <input
                              type="text"
                              value={order.customNonSoReason}
                              onChange={(e) => handleUpdateOrder(order.id, { customNonSoReason: e.target.value })}
                              placeholder="ระบุเหตุผล เช่น เบิกทดลองเครื่อง, เคลมเปลี่ยนม้วน"
                              className="flex-1 px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meter Inputs: Used Meters & NG (Supports 0.01 precision) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Used Meters */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          จำนวนเมตรที่ใช้ (ม.) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={order.usedMeters}
                            onChange={(e) => handleUpdateOrder(order.id, { usedMeters: e.target.value })}
                            placeholder="เช่น 227.63"
                            required
                            className="w-full px-3 py-2 text-base font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">เมตร</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          รองรับทศนิยม 2 ตำแหน่ง (0.01 ม.)
                        </span>
                      </div>

                      {/* NG Meters */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          เศษเสีย NG (ม.)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={order.ngMeters}
                            onChange={(e) => handleUpdateOrder(order.id, { ngMeters: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-2 text-base font-bold font-mono text-rose-600 bg-white border border-slate-300 rounded-lg focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">เมตร</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          เศษชำรุด หรือหัวม้วนที่เสีย
                        </span>
                      </div>
                    </div>

                    {/* Order Notes & Subtotal */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 items-center">
                      <div className="sm:col-span-8">
                        <input
                          type="text"
                          value={order.notes}
                          onChange={(e) => handleUpdateOrder(order.id, { notes: e.target.value })}
                          placeholder="หมายเหตุ / ลอน เช่น 5 ลอน 1 นิ้ว, ใบงานเร่งด่วน, บานหน้าต่าง"
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-amber-500"
                        />
                      </div>

                      <div className="sm:col-span-4 flex items-center justify-end font-mono text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
                        <span className="text-slate-500 text-[11px] mr-1">รวมตัดใบนี้:</span>
                        <strong className="text-amber-900 font-bold">
                          {formatMeters(orderCalc.total)}
                        </strong>
                        <span className="ml-0.5 text-[11px] text-slate-500">ม.</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Button to Add Next Order (ใบสั่งซื้อที่ 2, 3...) */}
            <button
              type="button"
              onClick={handleAddOrder}
              className="w-full py-2.5 px-4 border-2 border-dashed border-amber-400/80 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-100/60 text-amber-900 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-2xs"
            >
              <PlusCircle className="w-4 h-4 text-amber-600" />
              <span>+ เพิ่มใบสั่งซื้อที่ {orders.length + 1} (เพิ่มใบงานตัดสต๊อกต่อ)</span>
            </button>
          </div>

          {/* Real-time Calculation Summary of ALL Orders */}
          <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                สรุปยอดตัดรวมทั้งสิ้น ({orders.length} ใบงาน)
              </span>
              <span className="font-mono">
                ยอดคงเหลือเดิม: <strong className="text-white">{formatMeters(remainingBefore)}</strong> ม.
              </span>
            </div>

            {/* Individual orders breakdown list if > 1 order */}
            {orders.length > 1 && (
              <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700 space-y-1 text-xs">
                {orders.map((ord, i) => {
                  const calc = orderCalculations[i];
                  return (
                    <div key={ord.id} className="flex items-center justify-between font-mono text-[11px] text-slate-300">
                      <span>
                        • ใบงานที่ {i + 1} ({calc.identifier || 'รหัส SO'}):
                      </span>
                      <span>
                        ใช้ {formatMeters(calc.numUsed)} ม. + NG {formatMeters(calc.numNg)} ม. = <strong className="text-amber-400">{formatMeters(calc.total)} ม.</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-700/80">
              <div>
                <span className="text-slate-400 text-xs block">รวมตัดออกทั้งหมด:</span>
                <div className="font-mono font-bold text-amber-400 text-xl">
                  -{formatMeters(totalDeductedAll)} <span className="text-xs font-normal text-slate-300">เมตร</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-slate-400 text-xs block">ยอดคงเหลือสุทธิหลังตัด:</span>
                <div className={`font-mono font-bold text-xl ${
                  isOverCut ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {formatMeters(remainingAfter)} <span className="text-xs font-normal text-slate-300">เมตร</span>
                </div>
              </div>
            </div>

            {isOverCut && (
              <div className="p-2.5 bg-rose-900/60 border border-rose-600 text-rose-200 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  <strong>ยอดตัดรวมเกินยอดคงเหลือในม้วน!</strong> (ขาด {formatMeters(Math.abs(remainingAfter))} ม.) กรุณาปรับลดจำนวนเมตร
                </span>
              </div>
            )}
          </div>

          {/* Common Metadata: Operator and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Operator */}
            <div>
              <label htmlFor="input-operator" className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  ชื่อผู้บันทึกการตัด <span className="text-rose-500">*</span>
                </span>
              </label>
              <input
                id="input-operator"
                type="text"
                required
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                placeholder="เช่น สมชาย, กิตติพงษ์, หัวหน้ากะ A"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:border-amber-500 text-slate-900 font-medium"
              />
              {recentOperators.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                  <span className="text-[10px] text-slate-400">เลือกเร็ว:</span>
                  {recentOperators.slice(0, 4).map((op) => (
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

            {/* Usage Date */}
            <div>
              <label htmlFor="input-usage-date" className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  วันที่ตัดใช้งาน
                </span>
              </label>
              <input
                id="input-usage-date"
                type="date"
                value={usageDate}
                onChange={(e) => setUsageDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:border-amber-500 text-slate-900 font-mono cursor-pointer"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isOverCut || totalDeductedAll <= 0}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
                isOverCut || totalDeductedAll <= 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer active:scale-[0.98]'
              }`}
            >
              <Scissors className="w-4 h-4 stroke-[2.3]" />
              <span>ยืนยันตัดสต๊อก ({orders.length} ใบงาน - รวม {formatMeters(totalDeductedAll)} ม.)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
