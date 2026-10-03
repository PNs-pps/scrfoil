import React, { useState, useEffect } from 'react';
import { DrumStockCardItem } from '../types';
import { X, Edit3, Trash2, Check, AlertTriangle, Layers, Calendar, Scale, Tag } from 'lucide-react';
import { round2, todayLocalYMD } from '../utils/formatters';

interface ChemicalEditDrumModalProps {
  isOpen: boolean;
  onClose: () => void;
  drumCard: DrumStockCardItem | null;
  onSaveDrum: (
    oldDrumNumber: string,
    newDrumNumber: string,
    oldChemicalName: string,
    newChemicalName: string,
    supplier?: string,
    initialKg?: number,
    receivedDate?: string
  ) => void;
  onDeleteDrum: (drumNumber: string, chemicalName: string) => void;
  showToast: (text: string, type?: 'success' | 'info') => void;
}

export const ChemicalEditDrumModal: React.FC<ChemicalEditDrumModalProps> = ({
  isOpen,
  onClose,
  drumCard,
  onSaveDrum,
  onDeleteDrum,
  showToast,
}) => {
  // ต้องเรียก hooks ก่อน return เสมอ (เดิม return ก่อน useState → React error ถ้า isOpen เปลี่ยน)
  const [drumNumber, setDrumNumber] = useState(drumCard?.drumNumber || '');
  const [chemicalName, setChemicalName] = useState(drumCard?.chemicalName || '');
  const [supplier, setSupplier] = useState(drumCard?.supplier || '');
  const [initialKg, setInitialKg] = useState<number>(drumCard?.initialKg || 210);
  const [receivedDate, setReceivedDate] = useState(drumCard?.receivedDate || todayLocalYMD());

  // เปิดถังใบอื่นต่อกันโดยไม่ unmount → รีเซ็ตฟอร์มให้ตรงกับถังที่เลือก
  useEffect(() => {
    if (!drumCard) return;
    setDrumNumber(drumCard.drumNumber);
    setChemicalName(drumCard.chemicalName);
    setSupplier(drumCard.supplier || '');
    setInitialKg(drumCard.initialKg || 210);
    setReceivedDate(drumCard.receivedDate || todayLocalYMD());
  }, [drumCard?.id, drumCard?.drumNumber, drumCard?.chemicalName, drumCard?.chemicalType]);

  if (!isOpen || !drumCard) return null;

  const isPoly = drumCard.chemicalType === 'part_a';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drumNumber.trim()) {
      showToast('กรุณาระบุหมายเลขถังน้ำยา', 'info');
      return;
    }
    if (!chemicalName.trim()) {
      showToast('กรุณาระบุชื่อของน้ำยา / ยี่ห้อ', 'info');
      return;
    }

    onSaveDrum(
      drumCard.drumNumber,
      drumNumber.trim(),
      drumCard.chemicalName,
      chemicalName.trim(),
      supplier.trim(),
      Number(initialKg) || drumCard.initialKg,
      receivedDate
    );
    showToast(`แก้ไขข้อมูลถัง "${drumNumber.trim()}" เรียบร้อยแล้ว`, 'success');
    onClose();
  };

  const handleDelete = () => {
    const hasCuts = drumCard.cuts && drumCard.cuts.length > 0;
    const warningMsg = hasCuts 
      ? `ถัง "${drumCard.drumNumber}" มีประวัติการตัดสต๊อกไปแล้ว ${drumCard.cuts.length} SO\nคุณแน่ใจหรือไม่ว่าต้องการลบถังนี้ออกจากระบบ?`
      : `คุณแน่ใจหรือไม่ว่าต้องการลบถัง "${drumCard.drumNumber}" ออกจากระบบ?`;

    if (window.confirm(warningMsg)) {
      onDeleteDrum(drumCard.drumNumber, drumCard.chemicalName);
      showToast(`ลบถังน้ำยา "${drumCard.drumNumber}" เรียบร้อย`, 'info');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${isPoly ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                แก้ไขข้อมูลถังน้ำยา ({isPoly ? 'Poly' : 'ISO'})
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {drumCard.drumNumber} • {drumCard.chemicalName}
              </p>
              {drumCard.supportedDensities && drumCard.supportedDensities.length > 0 && (
                <p className="text-[11px] text-amber-800 font-mono font-semibold mt-0.5">
                  รองรับ: {drumCard.supportedDensities.join(', ')}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              หมายเลขถังน้ำยา (Drum Number) *
            </label>
            <input
              type="text"
              required
              value={drumNumber}
              onChange={(e) => setDrumNumber(e.target.value)}
              placeholder="เช่น ถัง #A01 หรือ ถัง #101"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                ชื่อของน้ำยา / ยี่ห้อ (Chemical Name / Brand) *
              </label>
              <input
                type="text"
                required
                value={chemicalName}
                onChange={(e) => setChemicalName(e.target.value)}
                placeholder="เช่น K-Foam 32, Dow Voranol"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                ผู้จัดจำหน่าย / ซัพพลายเออร์
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="เช่น Dow, Wanhua, K-Foam"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                น้ำหนักตั้งต้นในถัง (กก.)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={initialKg}
                  onChange={(e) => setInitialKg(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  กก.
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                วันที่รับเข้า
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          {/* Current Status Info */}
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs font-mono space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>สถานะถังปัจจุบัน:</span>
              <strong className="text-slate-900">{drumCard.remainingKg} / {drumCard.initialKg} กก. ({drumCard.remainingPercent}%)</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>ตัดไปแล้วกับ:</span>
              <strong className="text-slate-900">{drumCard.cuts.length} SO (รวม -{drumCard.totalCutKg} กก.)</strong>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>ลบถังนี้</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>บันทึกการแก้ไข</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
