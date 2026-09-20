import React, { useState, useEffect } from 'react';
import { FoilRoll, FoilPattern, FoilWidth } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS } from '../utils/soFormatter';
import { round2, formatMeters } from '../utils/formatters';
import { X, Edit2, Save, Layers, Calendar, Hash, FileText, CheckCircle2 } from 'lucide-react';

interface EditFoilModalProps {
  isOpen: boolean;
  onClose: () => void;
  roll: FoilRoll | null;
  onSave: (updatedRoll: FoilRoll) => void;
}

export const EditFoilModal: React.FC<EditFoilModalProps> = ({
  isOpen,
  onClose,
  roll,
  onSave,
}) => {
  const [lotNumber, setLotNumber] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [width, setWidth] = useState<FoilWidth>(850);
  const [isCustomWidth, setIsCustomWidth] = useState(false);
  const [customWidthVal, setCustomWidthVal] = useState('');

  const [pattern, setPattern] = useState<FoilPattern>('ขาว');
  const [isCustomPattern, setIsCustomPattern] = useState(false);
  const [customPatternVal, setCustomPatternVal] = useState('');

  const [totalMeters, setTotalMeters] = useState<number | ''>(1000);
  const [remainingMeters, setRemainingMeters] = useState<number | ''>(1000);
  const [dateReceived, setDateReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [isZeroedOut, setIsZeroedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roll && isOpen) {
      setLotNumber(roll.lotNumber || '');
      setRollNumber(roll.rollNumber || '');

      const isStdWidth = STANDARD_WIDTHS.includes(roll.width as any);
      if (isStdWidth) {
        setWidth(roll.width);
        setIsCustomWidth(false);
        setCustomWidthVal('');
      } else {
        setIsCustomWidth(true);
        setCustomWidthVal(String(roll.width || ''));
      }

      // Normalize pattern to the 6 allowed patterns
      let initialPattern: FoilPattern = 'ขาว';
      const rawP = (roll.pattern || '').trim();
      if (rawP === 'ดำ') initialPattern = 'ดำ';
      else if (rawP === 'ไม้อ่อน'') initialPattern = 'ไม้อ่อน';
      else if (rawP === 'ไม้เข้ม') initialPattern = 'ไม้เข้ม';
      else if (rawP === 'เทา') initialPattern = 'เทา';
      else if (rawP === 'กลีบบัว') initialPattern = 'กลีบบัว';
      else initialPattern = 'ขาว';

      setPattern(initialPattern);
      setIsCustomPattern(false);
      setCustomPatternVal('');

      setTotalMeters(roll.totalMeters);
      setRemainingMeters(roll.remainingMeters);
      setDateReceived(roll.dateReceived || new Date().toISOString().slice(0, 10));
      setNotes(roll.notes || '');
      setIsZeroedOut(Boolean(roll.isZeroedOut));
      setError(null);
    }
  }, [roll, isOpen]);

  if (!isOpen || !roll) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!lotNumber.trim()) {
      setError('กรุณาระบุเลขล็อต');
      return;
    }
    if (!rollNumber.trim()) {
      setError('กรุณาระบุเบอร์ม้วน');
      return;
    }

    const finalWidth = isCustomWidth ? Number(customWidthVal) : Number(width);
    if (!finalWidth || finalWidth <= 0) {
      setError('กรุณาระบุหน้ากว้างที่ถูกต้อง');
      return;
    }

    const finalPattern = isCustomPattern ? customPatternVal.trim() : pattern;
    if (!finalPattern) {
      setError('กรุณาเลือกลายฟอยล์');
      return;
    }

    const finalTotal = round2(Number(totalMeters));
    if (isNaN(finalTotal) || finalTotal <= 0) {
      setError('ความยาวลูกเต็มต้องมากกว่า 0 เมตร');
      return;
    }

    const finalRemaining = round2(Number(remainingMeters));
    if (isNaN(finalRemaining) || finalRemaining < 0) {
      setError('ยอดคงเหลือต้องไม่ติดลบ');
      return;
    }

    const status = isZeroedOut || finalRemaining <= 0 ? 'depleted' : 'active';

    const updatedRoll: FoilRoll = {
      ...roll,
      lotNumber: lotNumber.trim(),
      rollNumber: rollNumber.trim(),
      width: finalWidth as FoilWidth,
      pattern: finalPattern as FoilPattern,
      totalMeters: finalTotal,
      remainingMeters: isZeroedOut ? 0 : finalRemaining,
      isZeroedOut,
      manualZeroedOriginalMeters: isZeroedOut
        ? roll.manualZeroedOriginalMeters || finalRemaining
        : undefined,
      dateReceived,
      notes: notes.trim(),
      status,
    };

    onSave(updatedRoll);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="modal-edit-foil"
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold shadow-xs">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-400 text-slate-950 font-bold font-mono">
                  EDIT FOIL ROLL
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {roll.lotNumber} #{roll.rollNumber}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white leading-tight mt-0.5">
                แก้ไขข้อมูลม้วนฟอยล์
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Row 1: Lot Number & Roll Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เลขล็อต (Lot Number) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="เช่น LOT2609-01"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เบอร์ม้วน (Roll Number) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="เช่น 01, 02 หรือ R01"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Row 2: Width & Pattern */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Width */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หน้ากว้าง (มม.) <span className="text-rose-500">*</span>
              </label>
              {!isCustomWidth ? (
                <div className="space-y-1.5">
                  <select
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value) as FoilWidth)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-semibold text-slate-800 text-xs sm:text-sm focus:border-blue-500 cursor-pointer"
                  >
                    {STANDARD_WIDTHS.map((w) => (
                      <option key={w} value={w}>
                        {w} มม.
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCustomWidth(true)}
                    className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  >
                    + กำหนดหน้ากว้างอื่น
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="number"
                    value={customWidthVal}
                    onChange={(e) => setCustomWidthVal(e.target.value)}
                    placeholder="เช่น 920, 1000"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs sm:text-sm focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomWidth(false);
                      setWidth(850);
                    }}
                    className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                  >
                    เลือกหน้ากว้างมาตรฐาน
                  </button>
                </div>
              )}
            </div>

            {/* Pattern */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ลายท้องฟอยล์ <span className="text-rose-500">*</span>
              </label>
              <select
                value={pattern}
                onChange={(e) => setPattern(e.target.value as FoilPattern)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-xs sm:text-sm focus:border-blue-500 cursor-pointer"
              >
                {STANDARD_PATTERNS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                (กำหนดเฉพาะ 6 ชนิด: ขาว, ดำ, ไม้อ่อน, ไม้เข้ม, เทา, กลีบบัว)
              </p>
            </div>
          </div>

          {/* Row 3: Total Meters & Remaining Meters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ความยาวลูกเต็ม (ม.) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={totalMeters}
                onChange={(e) => setTotalMeters(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs sm:text-sm focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">ความยาวเดิมตามป้ายสติกเกอร์</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ยอดคงเหลือปัจจุบัน (ม.) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                disabled={isZeroedOut}
                value={isZeroedOut ? 0 : remainingMeters}
                onChange={(e) => setRemainingMeters(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs sm:text-sm focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                สามารถปรับยอดจริงได้หากหน้างานตรวจวัดพบยอดคงเหลือต่างจากระบบ
              </span>
            </div>
          </div>

          {/* Zero-out toggle checkbox */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">ตัดสล็อตเป็น 0 (เศษเหลือน้อย)</span>
              <span className="text-[11px] text-slate-500">
                หากติ๊กถูก ม้วนนี้จะถูกตัดยอดคงเหลือเป็น 0 เมตรทันที (สถานะหมดแล้ว)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isZeroedOut}
                onChange={(e) => setIsZeroedOut(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 accent-blue-600 cursor-pointer"
              />
            </label>
          </div>

          {/* Row 4: Date Received */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              วันที่รับเข้าโรงงาน
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm font-mono focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมายเหตุเพิ่มเติม
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น ฟอยล์ชุดพิเศษ"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการแก้ไข</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
