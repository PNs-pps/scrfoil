import React, { useState } from 'react';
import { FoilRoll, FoilPattern, FoilWidth } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS } from '../utils/soFormatter';
import { round2 } from '../utils/formatters';
import { X, PlusCircle, Layers, Calendar, Hash, FileText } from 'lucide-react';

interface AddFoilModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFoil: (newRoll: Omit<FoilRoll, 'id' | 'createdAt' | 'remainingMeters' | 'usedMeters' | 'ngMeters' | 'status'>) => void;
}

export const AddFoilModal: React.FC<AddFoilModalProps> = ({
  isOpen,
  onClose,
  onAddFoil,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const [lotNumber, setLotNumber] = useState('');
  const [rollNumber, setRollNumber] = useState('01');
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

  if (!isOpen) return null;

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

    onAddFoil({
      lotNumber: lotNumber.trim().toUpperCase(),
      rollNumber: rollNumber.trim(),
      width: finalWidth,
      pattern: finalPattern,
      totalMeters: finalMeters,
      dateReceived: dateReceived || today,
      notes: notes.trim(),
    });

    // Reset form
    setLotNumber('');
    setRollNumber('01');
    setTotalMeters(1000);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        id="modal-add-foil"
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Row 1: Lot & Roll Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  placeholder="เช่น LOT-6909-C1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-mono uppercase"
                />
              </div>
            </div>

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
                  placeholder="เช่น 01, 02 หรือ R-10"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-mono"
                />
              </div>
            </div>
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
                        ? 'border-amber-500 bg-amber-50 text-slate-950 ring-1 ring-amber-500'
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
              <button
                type="button"
                onClick={() => setIsCustomPattern(!isCustomPattern)}
                className="text-xs text-amber-700 hover:text-amber-800 underline cursor-pointer"
              >
                {isCustomPattern ? 'เลือกลายมาตรฐาน' : 'ระบุลายอื่น'}
              </button>
            </div>

            {!isCustomPattern ? (
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
                          ? 'border-amber-500 bg-amber-50 text-slate-950 font-semibold ring-1 ring-amber-500 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-3 h-3 rounded-full border border-slate-300 shrink-0 ${
                          p.value === 'ขาว' ? 'bg-white' :
                          p.value === 'ดำ' ? 'bg-slate-900' :
                          p.value === 'ลายไม่อ่อน' ? 'bg-amber-200' :
                          p.value === 'ลายไม้เข้ม' ? 'bg-amber-800' :
                          p.value === 'เทา' ? 'bg-slate-400' :
                          'bg-rose-300'
                        }`} />
                        <span className="truncate">{p.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                value={customPatternVal}
                onChange={(e) => setCustomPatternVal(e.target.value)}
                placeholder="ระบุลายฟอยล์ เช่น ลายหินอ่อน, เงินเงา"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
              />
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              * ลายมาตรฐาน: ขาว, ดำ, ลายไม่อ่อน, ลายไม้เข้ม (ลายไม่เข้า), เทา, กลับบัว (กลีบบัว)
            </p>
          </div>

          {/* Row 4: Total Meters & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-total-meters" className="block text-xs font-semibold text-slate-700 mb-1">
                จำนวนเมตรลูกเต็ม (เมตร) <span className="text-rose-500">*</span>
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
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              + บันทึกเพิ่มฟอยล์
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
