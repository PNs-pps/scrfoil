import React, { useState, useMemo } from 'react';
import { FoilRoll, FoilPattern, FoilWidth } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS } from '../utils/soFormatter';
import { round2, formatMeters } from '../utils/formatters';
import { 
  X, 
  PlusCircle, 
  Layers, 
  Calendar, 
  Hash, 
  FileText, 
  ListPlus, 
  Sparkles, 
  Trash2, 
  Plus, 
  CheckCircle2,
  PackagePlus,
  RefreshCw
} from 'lucide-react';

interface BatchRollItem {
  id: string;
  rollNumber: string;
  totalMeters: number;
}

interface AddFoilModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFoil: (newRoll: Omit<FoilRoll, 'id' | 'createdAt' | 'remainingMeters' | 'usedMeters' | 'ngMeters' | 'status'>) => void;
  onAddMultipleFoils?: (rollsData: Omit<FoilRoll, 'id' | 'createdAt' | 'remainingMeters' | 'usedMeters' | 'ngMeters' | 'status'>[]) => Promise<void>;
}

export const AddFoilModal: React.FC<AddFoilModalProps> = ({
  isOpen,
  onClose,
  onAddFoil,
  onAddMultipleFoils,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  // Tab mode: 'single' (1 ลูก) vs 'batch' (หลายลูกในล็อตเดียว)
  const [entryMode, setEntryMode] = useState<'single' | 'batch'>('batch');

  // Common shared fields
  const [lotNumber, setLotNumber] = useState('');
  const [width, setWidth] = useState<FoilWidth>(850);
  const [isCustomWidth, setIsCustomWidth] = useState(false);
  const [customWidthVal, setCustomWidthVal] = useState('');
  const [pattern, setPattern] = useState<FoilPattern>('ขาว');
  const [isCustomPattern, setIsCustomPattern] = useState(false);
  const [customPatternVal, setCustomPatternVal] = useState('');
  const [dateReceived, setDateReceived] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single roll mode fields
  const [singleRollNumber, setSingleRollNumber] = useState('01');
  const [singleTotalMeters, setSingleTotalMeters] = useState<number | ''>(1000);

  // Batch mode fields
  const [defaultMeters, setDefaultMeters] = useState<number | ''>(1000);
  const [startRangeNum, setStartRangeNum] = useState<number | ''>(1);
  const [endRangeNum, setEndRangeNum] = useState<number | ''>(10);
  const [padDigits, setPadDigits] = useState<number>(2); // 2 -> "01", 3 -> "001"
  const [quickCommaInput, setQuickCommaInput] = useState('');

  // Generated batch items
  const [batchItems, setBatchItems] = useState<BatchRollItem[]>([
    { id: '1', rollNumber: '01', totalMeters: 1000 },
    { id: '2', rollNumber: '02', totalMeters: 1000 },
    { id: '3', rollNumber: '03', totalMeters: 1000 },
    { id: '4', rollNumber: '04', totalMeters: 1000 },
    { id: '5', rollNumber: '05', totalMeters: 1000 },
  ]);

  // Batch summary metrics
  const totalBatchMeters = useMemo(() => {
    return batchItems.reduce((sum, item) => sum + (Number(item.totalMeters) || 0), 0);
  }, [batchItems]);

  // Helper to generate range
  const handleGenerateRange = () => {
    setError(null);
    const start = Number(startRangeNum);
    const end = Number(endRangeNum);
    const defM = Number(defaultMeters) || 1000;

    if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0) {
      setError('กรุณาระบุช่วงเบอร์เริ่มต้นและสิ้นสุดเป็นตัวเลขที่ถูกต้อง');
      return;
    }

    if (start > end) {
      setError('เบอร์เริ่มต้นต้องน้อยกว่าหรือเท่ากับเบอร์สิ้นสุด');
      return;
    }

    if (end - start + 1 > 100) {
      setError('สามารถสร้างได้สูงสุดครั้งละ 100 ม้วนเพื่อความเสถียรของระบบ');
      return;
    }

    const items: BatchRollItem[] = [];
    for (let i = start; i <= end; i++) {
      const formattedNum = String(i).padStart(padDigits, '0');
      items.push({
        id: `range-${i}-${Date.now()}`,
        rollNumber: formattedNum,
        totalMeters: defM,
      });
    }

    setBatchItems(items);
  };

  // Helper to parse comma / space separated roll numbers
  const handleParseCommaList = () => {
    if (!quickCommaInput.trim()) return;
    setError(null);
    const defM = Number(defaultMeters) || 1000;
    const parts = quickCommaInput.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

    if (parts.length === 0) return;

    const newItems: BatchRollItem[] = parts.map((numStr, idx) => ({
      id: `comma-${idx}-${Date.now()}`,
      rollNumber: numStr,
      totalMeters: defM,
    }));

    setBatchItems(newItems);
  };

  const handleAddSingleBatchItem = () => {
    const nextIdx = batchItems.length + 1;
    const defM = Number(defaultMeters) || 1000;
    const padded = String(nextIdx).padStart(padDigits, '0');
    setBatchItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rollNumber: padded,
        totalMeters: defM,
      }
    ]);
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateBatchItem = (id: string, updates: Partial<BatchRollItem>) => {
    setBatchItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleResetForm = () => {
    setLotNumber('');
    setSingleRollNumber('01');
    setSingleTotalMeters(1000);
    setNotes('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;
    setError(null);

    if (!lotNumber.trim()) {
      setError('กรุณาระบุเลขล็อต (Lot Number)');
      return;
    }

    const finalWidth = isCustomWidth ? Number(customWidthVal) : Number(width);
    if (!finalWidth || finalWidth <= 0) {
      setError('กรุณาระบุหน้ากว้างที่ถูกต้อง (เช่น 830, 850, 880, 900)');
      return;
    }

    const finalPattern = isCustomPattern ? customPatternVal.trim() : pattern;
    if (!finalPattern) {
      setError('กรุณาเลือกลายฟอยล์');
      return;
    }

    const trimmedLot = lotNumber.trim().toUpperCase();

    if (entryMode === 'single') {
      // Single roll submit
      if (!singleRollNumber.trim()) {
        setError('กรุณาระบุเบอร์ม้วน');
        return;
      }

      const finalMeters = round2(Number(singleTotalMeters));
      if (!finalMeters || finalMeters <= 0) {
        setError('กรุณาระบุจำนวนเมตรลูกเต็มให้ถูกต้อง (มากกว่า 0)');
        return;
      }

      setIsSubmitting(true);
      try {
        onAddFoil({
          lotNumber: trimmedLot,
          rollNumber: singleRollNumber.trim(),
          width: finalWidth,
          pattern: finalPattern,
          totalMeters: finalMeters,
          dateReceived: dateReceived || today,
          notes: notes.trim(),
        });
        handleResetForm();
        onClose();
      } catch (err: any) {
        setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึก');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Multiple / Batch rolls submit
      if (batchItems.length === 0) {
        setError('กรุณาระบุอย่างน้อย 1 ม้วนฟอยล์ในรายการ');
        return;
      }

      // Check duplicates and empty roll numbers
      const rollNumbersSeen = new Set<string>();
      for (const item of batchItems) {
        const rNum = (item.rollNumber || '').trim();
        if (!rNum) {
          setError('มีบางม้วนที่ยังไม่ได้ระบุเบอร์ม้วน กรุณาตรวจสอบ');
          return;
        }
        if (rollNumbersSeen.has(rNum)) {
          setError(`พบเบอร์ม้วนซ้ำกัน: เบอร์ #${rNum} ในล็อตเดียวกัน กรุณาแก้ไข`);
          return;
        }
        rollNumbersSeen.add(rNum);

        const m = Number(item.totalMeters);
        if (isNaN(m) || m <= 0) {
          setError(`ม้วนเบอร์ #${rNum} มีความยาวเมตรไม่ถูกต้อง (ต้องมากกว่า 0)`);
          return;
        }
      }

      const rollsPayload = batchItems.map(item => ({
        lotNumber: trimmedLot,
        rollNumber: item.rollNumber.trim(),
        width: finalWidth,
        pattern: finalPattern,
        totalMeters: round2(Number(item.totalMeters)),
        dateReceived: dateReceived || today,
        notes: notes.trim(),
      }));

      setIsSubmitting(true);
      try {
        if (onAddMultipleFoils) {
          await onAddMultipleFoils(rollsPayload);
        } else {
          // Fallback sequential
          for (const r of rollsPayload) {
            onAddFoil(r);
          }
        }
        handleResetForm();
        onClose();
      } catch (err: any) {
        setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกชุดม้วนฟอยล์');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Only check isOpen right before returning JSX
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        id="modal-add-foil"
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <PackagePlus className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                รับม้วนฟอยล์เข้าสต๊อก
              </h2>
              <p className="text-xs text-slate-300">
                ระบบจัดการสต๊อกฟอยล์ PU Foam หลังคาเหล็กเมทัลชีท
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { if (!isSubmitting) onClose(); }}
            disabled={isSubmitting}
            title={isSubmitting ? 'กำลังบันทึกข้อมูล กรุณารอสักครู่...' : undefined}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Blocking overlay while saving, to avoid a flaky-network close/refresh mid-save */}
        {isSubmitting && (
          <div className="absolute inset-0 z-10 bg-white/85 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 text-center px-6">
            <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
            <div>
              <p className="font-bold text-slate-900 text-sm">กำลังบันทึกข้อมูลลงระบบ...</p>
              <p className="text-xs text-slate-500 mt-1">กรุณาอย่าปิดหน้าต่างนี้หรือรีเฟรชหน้าเว็บ รอจนกว่าจะบันทึกสำเร็จหรือแจ้งข้อผิดพลาด</p>
            </div>
          </div>
        )}

        {/* Tab Selector: Single vs Multiple/Batch */}
        <div className="px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEntryMode('batch')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              entryMode === 'batch'
                ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ListPlus className="w-4 h-4" />
            <span>รับทีละหลายลูก (ชุดล็อต)</span>
            <span className="text-[11px] bg-slate-900/10 px-1.5 py-0.2 rounded-md font-mono">
              แนะนำ
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEntryMode('single')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              entryMode === 'single'
                ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>รับทีละ 1 ม้วน (ม้วนเดี่ยว)</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Shared Specs Card: Lot, Width, Pattern */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>ข้อมูลสเปกล็อตฟอยล์ที่รับเข้า</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Lot Number */}
              <div>
                <label htmlFor="input-lot-number" className="block text-xs font-semibold text-slate-700 mb-1">
                  เลขล็อต (Lot Number) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-lot-number"
                  type="text"
                  required
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="เช่น LOT-2609-A"
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-mono uppercase font-bold"
                />
              </div>

              {/* Width */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หน้ากว้าง (มม.) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={isCustomWidth ? 'custom' : width}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomWidth(true);
                      } else {
                        setIsCustomWidth(false);
                        setWidth(Number(e.target.value) as FoilWidth);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-amber-500 text-sm font-mono font-bold"
                  >
                    {STANDARD_WIDTHS.map((w) => (
                      <option key={w} value={w}>
                        {w} มม.
                      </option>
                    ))}
                    <option value="custom">กำหนดเอง...</option>
                  </select>
                  {isCustomWidth && (
                    <input
                      type="number"
                      value={customWidthVal}
                      onChange={(e) => setCustomWidthVal(e.target.value)}
                      placeholder="กว้าง"
                      className="w-20 px-2 py-2 bg-white rounded-lg border border-slate-300 text-sm font-mono font-bold"
                    />
                  )}
                </div>
              </div>

              {/* Pattern */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ลายฟอยล์ (ท้องฟอยล์) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={isCustomPattern ? 'custom' : pattern}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomPattern(true);
                    } else {
                      setIsCustomPattern(false);
                      setPattern(e.target.value as FoilPattern);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-amber-500 text-sm font-semibold"
                >
                  {STANDARD_PATTERNS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">กำหนดลายเอง...</option>
                </select>
                {isCustomPattern && (
                  <input
                    type="text"
                    value={customPatternVal}
                    onChange={(e) => setCustomPatternVal(e.target.value)}
                    placeholder="ระบุลายใหม่..."
                    className="w-full mt-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-medium"
                  />
                )}
              </div>
            </div>
          </div>

          {/* MODE 1: Single Roll Mode */}
          {entryMode === 'single' ? (
            <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Hash className="w-4 h-4 text-amber-600" />
                <span>ระบุเบอร์ม้วนและเมตรลูกเต็ม</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="input-single-roll" className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์ม้วน (Roll No.) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-single-roll"
                    type="text"
                    required
                    value={singleRollNumber}
                    onChange={(e) => setSingleRollNumber(e.target.value)}
                    placeholder="เช่น 01, 02 หรือ R-10"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-amber-500 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label htmlFor="input-single-meters" className="block text-xs font-semibold text-slate-700 mb-1">
                    ความยาวเมตรเต็มม้วน (เมตร) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-single-meters"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={singleTotalMeters}
                    onChange={(e) => setSingleTotalMeters(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-amber-500 text-sm font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* MODE 2: Multiple / Batch Rolls Mode */
            <div className="space-y-3.5">
              {/* Range & Comma Generator Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>สร้างเบอร์ม้วนอัตโนมัติ (เลือกวิธีที่สะดวก)</span>
                  </div>

                  {/* Default Meters for Batch */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">เมตรเริ่มต้น/ลูก:</span>
                    <input
                      type="number"
                      min="1"
                      value={defaultMeters}
                      onChange={(e) => setDefaultMeters(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-center text-xs"
                    />
                    <span className="text-slate-500">ม.</span>
                  </div>
                </div>

                {/* Method 1: Range Generator (e.g. 01 ถึง 10) */}
                <div className="bg-white p-3 rounded-lg border border-amber-200/80 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>วิธีที่ 1: กำหนดช่วงตัวเลข (เช่น เบอร์ 01 ถึง 10)</span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                      <span>รูปแบบ:</span>
                      <button
                        type="button"
                        onClick={() => setPadDigits(2)}
                        className={`px-1.5 py-0.5 rounded cursor-pointer ${
                          padDigits === 2 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        01, 02
                      </button>
                      <button
                        type="button"
                        onClick={() => setPadDigits(3)}
                        className={`px-1.5 py-0.5 rounded cursor-pointer ${
                          padDigits === 3 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        001, 002
                      </button>
                      <button
                        type="button"
                        onClick={() => setPadDigits(1)}
                        className={`px-1.5 py-0.5 rounded cursor-pointer ${
                          padDigits === 1 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        1, 2
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">จากเบอร์:</span>
                    <input
                      type="number"
                      min="1"
                      value={startRangeNum}
                      onChange={(e) => setStartRangeNum(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-center text-xs"
                    />
                    <span className="text-xs text-slate-500">ถึงเบอร์:</span>
                    <input
                      type="number"
                      min="1"
                      value={endRangeNum}
                      onChange={(e) => setEndRangeNum(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-center text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateRange}
                      className="ml-auto px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>สร้างรายการม้วน</span>
                    </button>
                  </div>
                </div>

                {/* Method 2: Comma list */}
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={quickCommaInput}
                    onChange={(e) => setQuickCommaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleParseCommaList();
                      }
                    }}
                    placeholder="วิธีที่ 2: หรือพิมพ์เบอร์คั่นด้วยจุลภาค เช่น 01, 02, 05, 08"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleParseCommaList}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    แยกเบอร์
                  </button>
                </div>
              </div>

              {/* Batch Rolls List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>รายการม้วนที่จะเพิ่มเข้าสต๊อก ({batchItems.length} ลูก)</span>
                  </div>

                  <div className="font-mono text-slate-700 text-xs">
                    ความยาวรวม: <strong className="text-amber-900 font-bold text-sm">{formatMeters(totalBatchMeters)}</strong> เมตร
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
                  {batchItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      ยังไม่มีรายการม้วนฟอยล์ กรุณากด "สร้างรายการม้วน" ด้านบน หรือกด "+ เพิ่มอีก 1 ลูก"
                    </div>
                  ) : (
                    batchItems.map((item, index) => (
                      <div key={item.id} className="px-3.5 py-2 flex items-center gap-2.5 text-xs hover:bg-slate-50/80">
                        <span className="w-6 text-center font-mono font-bold text-slate-400 text-[11px]">
                          {index + 1}.
                        </span>

                        {/* Roll Number Input */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-mono">เบอร์ #</span>
                          <input
                            type="text"
                            value={item.rollNumber}
                            onChange={(e) => handleUpdateBatchItem(item.id, { rollNumber: e.target.value })}
                            className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-center text-xs focus:border-amber-500"
                          />
                        </div>

                        {/* Length per Roll */}
                        <div className="flex items-center gap-1.5 ml-2">
                          <span className="text-slate-500">ความยาว:</span>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={item.totalMeters}
                            onChange={(e) => handleUpdateBatchItem(item.id, { totalMeters: Number(e.target.value) || 0 })}
                            className="w-24 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-right text-xs focus:border-amber-500"
                          />
                          <span className="text-slate-500 font-mono text-[11px]">ม.</span>
                        </div>

                        {/* Preview Tag */}
                        <div className="hidden sm:flex items-center gap-1 ml-auto font-mono text-[11px] text-slate-500">
                          <span>ล็อต {lotNumber || '...'}</span>
                          <span>•</span>
                          <span>{isCustomWidth ? customWidthVal : width} มม.</span>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveBatchItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-auto sm:ml-2 cursor-pointer"
                          title="ลบม้วนนี้ออกจากชุด"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddSingleBatchItem}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                    <span>+ เพิ่มอีก 1 ลูก</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchItems([])}
                    className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                  >
                    ล้างรายการทั้งหมด
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Row 4: Date Received & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label htmlFor="input-date-received" className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่รับเข้าสต๊อก
              </label>
              <input
                id="input-date-received"
                type="date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-amber-500 text-sm font-mono"
              />
            </div>

            <div>
              <label htmlFor="input-add-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเหตุเพิ่มเติม (ซัพพลายเออร์, ความหนาโฟม)
              </label>
              <input
                id="input-add-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น ฟอยล์ทนความร้อนสูง, ล็อตเข้าใหม่"
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-amber-500 text-sm"
              />
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {entryMode === 'batch' ? (
                <span>
                  จะบันทึกพร้อมกัน <strong className="text-slate-900 font-bold">{batchItems.length}</strong> ม้วน
                </span>
              ) : (
                <span>บันทึก 1 ม้วนฟอยล์</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (entryMode === 'batch' && batchItems.length === 0)}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>กำลังบันทึก...</span>
                ) : entryMode === 'batch' ? (
                  <>
                    <PackagePlus className="w-4 h-4" />
                    <span>+ บันทึกรับเข้า {batchItems.length} ลูก</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>+ บันทึกเพิ่มฟอยล์</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
