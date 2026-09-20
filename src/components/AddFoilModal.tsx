import React, { useState, useMemo } from 'react';
import { FoilRoll, FoilPattern, FoilWidth } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS } from '../utils/soFormatter';
import { round2 } from '../utils/formatters';
import { X, PlusCircle, Layers, Calendar, Hash, FileText, Copy, ListPlus } from 'lucide-react';

interface AddFoilModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFoil: (newRoll: Omit<FoilRoll, 'id' | 'createdAt' | 'remainingMeters' | 'usedMeters' | 'ngMeters' | 'status'>) => void;
  onAddMultipleFoils?: (newRolls: Omit<FoilRoll, 'id' | 'createdAt' | 'remainingMeters' | 'usedMeters' | 'ngMeters' | 'status'>[]) => void;
}

export const AddFoilModal: React.FC<AddFoilModalProps> = ({
  isOpen,
  onClose,
  onAddFoil,
  onAddMultipleFoils,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  // Tab: single roll vs multi-roll batch
  const [addMode, setAddMode] = useState<'single' | 'multi'>('single');

  // Common Fields
  const [lotNumber, setLotNumber] = useState('');
  const [width, setWidth] = useState<FoilWidth>(850);
  const [isCustomWidth, setIsCustomWidth] = useState(false);
  const [customWidthVal, setCustomWidthVal] = useState('');

  const [pattern, setPattern] = useState<FoilPattern>('ขาว');
  const [isCustomPattern, setIsCustomPattern] = useState(false);
  const [customPatternVal, setCustomPatternVal] = useState('');

  const [totalMeters, setTotalMeters] = useState<number | ''>(1000);
  const [dateReceived, setDateReceived] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Single Roll State
  const [rollNumber, setRollNumber] = useState('01');

  // Multi-Roll State
  const [multiInputMode, setMultiInputMode] = useState<'range' | 'custom'>('range');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(4);
  const [padZero, setPadZero] = useState<boolean>(true); // e.g. '01', '02' vs '1', '2'
  const [customRollNumbersText, setCustomRollNumbersText] = useState('1, 2, 3, 4');

  // Parse multi roll numbers
  const parsedMultiRollNumbers = useMemo<string[]>(() => {
    if (addMode !== 'multi') return [];

    if (multiInputMode === 'range') {
      const start = Math.max(1, Math.min(rangeStart, rangeEnd));
      const end = Math.max(start, Math.min(rangeStart > rangeEnd ? rangeStart : rangeEnd, start + 49)); // cap at 50 per batch
      const numbers: string[] = [];
      for (let i = start; i <= end; i++) {
        if (padZero) {
          numbers.push(String(i).padStart(2, '0'));
        } else {
          numbers.push(String(i));
        }
      }
      return numbers;
    } else {
      // Split by comma, space, or newline
      const tokens = customRollNumbersText
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      // Deduplicate while preserving order
      return Array.from(new Set(tokens)).slice(0, 50);
    }
  }, [addMode, multiInputMode, rangeStart, rangeEnd, padZero, customRollNumbersText]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!lotNumber.trim()) {
      setError('กรุณาระบุเลขล็อต');
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

    const finalMeters = round2(Number(totalMeters));
    if (!finalMeters || finalMeters <= 0) {
      setError('กรุณาระบุจำนวนเมตรลูกเต็มให้ถูกต้อง (มากกว่า 0)');
      return;
    }

    if (addMode === 'single') {
      if (!rollNumber.trim()) {
        setError('กรุณาระบุเบอร์ม้วน');
        return;
      }

      onAddFoil({
        lotNumber: lotNumber.trim().toUpperCase(),
        rollNumber: rollNumber.trim(),
        width: finalWidth,
        pattern: finalPattern,
        totalMeters: finalMeters,
        dateReceived: dateReceived || today,
        notes: notes.trim(),
      });
    } else {
      // Multi-roll batch
      if (parsedMultiRollNumbers.length === 0) {
        setError('กรุณาระบุเบอร์ม้วนที่ต้องการเพิ่ม (อย่างน้อย 1 เบอร์)');
        return;
      }

      const newRollsPayload = parsedMultiRollNumbers.map((rNum) => ({
        lotNumber: lotNumber.trim().toUpperCase(),
        rollNumber: rNum,
        width: finalWidth,
        pattern: finalPattern,
        totalMeters: finalMeters,
        dateReceived: dateReceived || today,
        notes: notes.trim(),
      }));

      if (onAddMultipleFoils) {
        onAddMultipleFoils(newRollsPayload);
      } else {
        newRollsPayload.forEach((nr) => onAddFoil(nr));
      }
    }

    // Reset and close
    setLotNumber('');
    setRollNumber('01');
    setTotalMeters(1000);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div 
        id="modal-add-foil"
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                เพิ่มฟอยล์รับเข้าสต๊อก
              </h2>
              <p className="text-xs text-slate-300">
                บันทึกม้วนฟอยล์ลูกเต็มสำหรับหลังคา PU Foam เมทัลชีท
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setAddMode('single')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              addMode === 'single'
                ? 'border-amber-500 text-slate-900 font-bold bg-white -mb-px rounded-t-lg border-t border-x border-t-slate-200 border-x-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span>เพิ่มม้วนเดี่ยว (Single Roll)</span>
          </button>

          <button
            type="button"
            onClick={() => setAddMode('multi')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              addMode === 'multi'
                ? 'border-amber-500 text-slate-900 font-bold bg-white -mb-px rounded-t-lg border-t border-x border-t-slate-200 border-x-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListPlus className="w-4 h-4 text-emerald-600" />
            <span>เพิ่มทีละหลายลูก (ล็อตเดียวกัน เบอร์ 1, 2, 3...)</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded">ใหม่</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Row 1: Lot Number & Roll Number(s) */}
          <div className="space-y-3">
            <div>
              <label htmlFor="input-lot-number" className="block text-xs font-semibold text-slate-700 mb-1">
                เลขล็อต (Lot Number) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-lot-number"
                  type="text"
                  required
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="เช่น LOT-6909 หรือ LOT-6909-C1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-mono uppercase font-bold"
                />
              </div>
            </div>

            {/* Single Roll Input */}
            {addMode === 'single' ? (
              <div>
                <label htmlFor="input-roll-number" className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์ม้วน (Roll No.) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="input-roll-number"
                    type="text"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="เช่น 01, 02 หรือ 1, 2"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
            ) : (
              /* Multi-Roll Batch Selector */
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <ListPlus className="w-4 h-4 text-amber-600" />
                    <span>ระบุเบอร์ม้วนในล็อตนี้ (เช่น เบอร์ 1, 2, 3, 4)</span>
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setMultiInputMode('range')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        multiInputMode === 'range' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ระบุช่วง (1 ถึง N)
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setMultiInputMode('custom')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        multiInputMode === 'custom' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      พิมพ์คั่นจุลภาค (1, 2, 3)
                    </button>
                  </div>
                </div>

                {multiInputMode === 'range' ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-center">
                      <div>
                        <label className="block text-[11px] text-slate-600 font-medium mb-1">
                          เบอร์เริ่มต้น
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={rangeStart}
                          onChange={(e) => setRangeStart(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-sm font-bold text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 font-medium mb-1">
                          ถึงเบอร์สิ้นสุด
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={rangeEnd}
                          onChange={(e) => setRangeEnd(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-sm font-bold text-center"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 pt-4 flex items-center">
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={padZero}
                            onChange={(e) => setPadZero(e.target.checked)}
                            className="rounded accent-amber-500"
                          />
                          <span>เติม 0 นำหน้า (01, 02)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">
                      กรอกรายการเบอร์ม้วน (คั่นด้วยจุลภาค เช่น 1, 2, 3, 4 หรือ 01, 02, 03, 04)
                    </label>
                    <input
                      type="text"
                      value={customRollNumbersText}
                      onChange={(e) => setCustomRollNumbersText(e.target.value)}
                      placeholder="1, 2, 3, 4, 5"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-sm"
                    />
                  </div>
                )}

                {/* Live Preview of Rolls to be Created */}
                <div className="pt-2 border-t border-amber-200/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-700">
                      ตัวอย่างม้วนที่จะถูกเพิ่ม ({parsedMultiRollNumbers.length} ม้วน):
                    </span>
                    <span className="text-amber-800 font-mono font-bold">
                      รวม {((Number(totalMeters) || 0) * parsedMultiRollNumbers.length).toLocaleString()} เมตร
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white rounded-lg border border-amber-200">
                    {parsedMultiRollNumbers.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">ยังไม่ได้ระบุเบอร์ม้วน</span>
                    ) : (
                      parsedMultiRollNumbers.map((rNum) => (
                        <span
                          key={rNum}
                          className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950 font-mono font-bold text-xs"
                        >
                          {lotNumber ? `${lotNumber} ` : ''}#{rNum}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Width Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                หน้ากว้าง (Width มม.) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomWidth(!isCustomWidth)}
                className="text-xs text-amber-700 hover:text-amber-800 underline cursor-pointer"
              >
                {isCustomWidth ? 'เลือกขนาดมาตรฐาน' : 'ระบุขนาดอื่น'}
              </button>
            </div>

            {!isCustomWidth ? (
              <div className="grid grid-cols-4 gap-2">
                {STANDARD_WIDTHS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWidth(w)}
                    className={`py-2 px-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer font-mono text-center ${
                      width === w
                        ? 'border-amber-500 bg-amber-50 text-slate-950 ring-1 ring-amber-500 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {w} มม.
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="number"
                value={customWidthVal}
                onChange={(e) => setCustomWidthVal(e.target.value)}
                placeholder="ระบุหน้ากว้าง เช่น 920"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-mono"
              />
            )}
          </div>

          {/* Row 3: Pattern Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                ลายฟอยล์ (Pattern) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                (กำหนดเฉพาะ 6 ชนิด)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STANDARD_PATTERNS.map((p) => {
                const isSelected = pattern === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPattern(p.value)}
                    className={`p-2 rounded-lg border text-xs font-medium text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-slate-950 font-bold ring-1 ring-amber-500 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${
                        p.value === 'ขาว' ? 'bg-white border-slate-300' :
                        p.value === 'ดำ' ? 'bg-slate-950 border-black' :
                        p.value === 'ไม้อ่อน' ? 'bg-amber-300 border-amber-400' :
                        p.value === 'ไม้เข้ม' ? 'bg-[#78350f] border-[#451a03]' :
                        p.value === 'เทา' ? 'bg-slate-400 border-slate-500' :
                        'bg-gradient-to-tr from-slate-300 via-zinc-200 to-slate-400 border-slate-400'
                      }`} />
                      <span className="truncate">{p.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              * ชนิดท้องฟอยล์: ขาว, ดำ, ไม้อ่อน, ไม้เข้ม, เทา, กลีบบัว
            </p>
          </div>

          {/* Row 4: Total Meters & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-total-meters" className="block text-xs font-semibold text-slate-700 mb-1">
                จำนวนเมตรลูกเต็ม ({addMode === 'multi' ? 'ต่อม้วน' : 'เมตร'}) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-total-meters"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={totalMeters}
                  onChange={(e) => setTotalMeters(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="1000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-base font-bold font-mono text-slate-900"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">เมตร</span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {[1000, 2000, 2500, 3000].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTotalMeters(m)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono cursor-pointer"
                  >
                    {m}ม.
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="input-date-received" className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่รับเข้าสต๊อก
              </label>
              <div className="relative">
                <input
                  id="input-date-received"
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Notes */}
          <div>
            <label htmlFor="input-add-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              หมายเหตุ / ข้อมูลเพิ่มเติม (อุปกรณ์, ความหนาโฟม, ซัพพลายเออร์)
            </label>
            <input
              id="input-add-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น ฟอยล์ทนความร้อนสูง สำหรับ PU 25-50มม."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-mono">
              {addMode === 'multi' && (
                <span>เตรียมเพิ่ม: <strong className="text-emerald-700">{parsedMultiRollNumbers.length} ม้วน</strong></span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
              >
                {addMode === 'multi' ? (
                  <>
                    <ListPlus className="w-4 h-4 text-emerald-400" />
                    <span>+ บันทึกเพิ่ม {parsedMultiRollNumbers.length} ม้วน</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 text-amber-400" />
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
