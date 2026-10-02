import React, { useState, useEffect } from 'react';
import { StockCutRecord, FoilRoll, FoilWidth } from '../types';
import { 
  X, 
  FileText, 
  Calendar, 
  User, 
  Scissors, 
  AlertTriangle, 
  Check, 
  Layers, 
  Info,
  Clock,
  RotateCcw
} from 'lucide-react';
import { formatMeters } from '../utils/formatters';
import { getPatternStyle } from '../utils/patternStyles';

interface EditSOCutModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StockCutRecord | null;
  roll?: FoilRoll | null;
  onSave: (updatedRecord: StockCutRecord, oldRecord: StockCutRecord) => Promise<void>;
}

export const EditSOCutModal: React.FC<EditSOCutModalProps> = ({
  isOpen,
  onClose,
  record,
  roll,
  onSave,
}) => {
  const [soNumber, setSoNumber] = useState('');
  const [cutType, setCutType] = useState<'so' | 'non_so'>('so');
  const [nonSoReason, setNonSoReason] = useState('');
  const [productionRound, setProductionRound] = useState('');
  const [usedMeters, setUsedMeters] = useState('');
  const [ngMeters, setNgMeters] = useState('0');
  const [usageDate, setUsageDate] = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [isSilverSide, setIsSilverSide] = useState(false);
  const [isWhiteSide, setIsWhiteSide] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      setSoNumber(record.soNumber || '');
      setCutType(record.cutType || 'so');
      setNonSoReason(record.nonSoReason || '');
      setProductionRound(record.productionRound || '');
      setUsedMeters(String(record.usedMeters ?? 0));
      setNgMeters(String(record.ngMeters ?? 0));
      setUsageDate(record.usageDate || record.recordedDate || (record.createdAt ? record.createdAt.slice(0, 10) : ''));
      setRecordedBy(record.recordedBy || '');
      setNotes(record.notes || '');
      setIsSilverSide(Boolean(record.isSilverSide));
      setIsWhiteSide(Boolean(record.isWhiteSide));
      setError(null);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const oldUsed = Math.abs(Number(record.usedMeters || 0));
  const oldNg = Math.abs(Number(record.ngMeters || 0));
  const oldTotal = Math.abs(Number(record.totalDeducted ?? (oldUsed + oldNg)));

  const numUsed = Math.abs(parseFloat(usedMeters) || 0);
  const numNg = Math.abs(parseFloat(ngMeters) || 0);
  const newTotal = Math.round((numUsed + numNg + Number.EPSILON) * 100) / 100;
  const delta = Math.round((newTotal - oldTotal + Number.EPSILON) * 100) / 100;

  const currentRollRemaining = Number(roll?.remainingMeters ?? record.remainingAfter ?? 0);
  const predictedRollRemaining = Math.round((Math.max(0, currentRollRemaining - delta) + Number.EPSILON) * 100) / 100;
  const isOverRemaining = delta > 0 && delta > currentRollRemaining + 0.05;

  const patternStyle = getPatternStyle(record.pattern);

  const QUICK_ROUNDS = ['รอบ 1', 'รอบ 2', 'รอบ 3', 'รอบ 4', 'รอบพิเศษ'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedSo = soNumber.trim();
    if (cutType === 'so' && !trimmedSo) {
      setError('กรุณากรอกรหัสใบสั่งตัด SO');
      return;
    }

    if (numUsed <= 0 && numNg <= 0) {
      setError('กรุณากรอกจำนวนเมตรที่ใช้จริงหรือยอด NG อย่างน้อยหนึ่งช่อง');
      return;
    }

    if (isOverRemaining) {
      setError(`ยอดตัดที่เพิ่มขึ้น (${delta.toLocaleString()} ม.) เกินกว่าสต๊อกคงเหลือในม้วน (${currentRollRemaining.toLocaleString()} ม.)`);
      return;
    }

    // Extract round number if pattern matches
    let parsedRoundNumber: number | undefined;
    const match = productionRound.match(/\d+/);
    if (match) {
      parsedRoundNumber = parseInt(match[0], 10);
    }

    const updatedRecord: StockCutRecord = {
      ...record,
      soNumber: cutType === 'so' ? trimmedSo : (nonSoReason || 'ไม่ใช้ SO'),
      cutType,
      nonSoReason: cutType === 'non_so' ? nonSoReason : undefined,
      productionRound: cutType === 'so' ? productionRound.trim() : undefined,
      roundNumber: parsedRoundNumber,
      usedMeters: numUsed,
      ngMeters: numNg,
      totalDeducted: newTotal,
      usageDate: usageDate || record.usageDate || new Date().toISOString().slice(0, 10),
      recordedBy: recordedBy.trim() || record.recordedBy || 'ช่างคุมเครื่อง',
      notes: notes.trim(),
      isSilverSide,
      isWhiteSide,
    };

    setIsSubmitting(true);
    try {
      await onSave(updatedRecord, record);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกการแก้ไข SO');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center font-bold">
              <Scissors className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>แก้ไขใบสั่งตัด SO</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/40 text-amber-150 font-mono">
                  {record.soNumber || '-'}
                </span>
              </h2>
              <p className="text-xs text-amber-200/90 font-mono">
                ล็อต {record.lotNumber} • ม้วน #{record.rollNumber} • กว้าง {record.width} มม. • {record.pattern}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switch (SO vs Non-SO) */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setCutType('so')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                cutType === 'so'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 มีรหัสใบสั่งผลิต SO
            </button>
            <button
              type="button"
              onClick={() => setCutType('non_so')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                cutType === 'non_so'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏢 ไม่ใช้ SO (ยืม/ซ่อม/เทส)
            </button>
          </div>

          {/* SO Number & Production Round */}
          {cutType === 'so' ? (
            <div className="space-y-3 p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  รหัสคำสั่งซื้อ SO <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={soNumber}
                    onChange={(e) => setSoNumber(e.target.value)}
                    placeholder="เช่น so6909297"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Production Round Section */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-700" />
                    <span>ระบุรอบการผลิตของ SO (Split Run)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    กรณี SO เดียวกันแบ่งตัดหลายครั้ง
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {QUICK_ROUNDS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setProductionRound(r)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors border ${
                        productionRound === r
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50 hover:border-amber-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                  {productionRound && (
                    <button
                      type="button"
                      onClick={() => setProductionRound('')}
                      className="px-2 py-1 text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer"
                    >
                      ล้างรอบ
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={productionRound}
                  onChange={(e) => setProductionRound(e.target.value)}
                  placeholder="เช่น รอบ 1, รอบ 2 หรือพิมพ์ระบุเอง..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-slate-700 font-bold">
                เหตุผลการตัดใช้งาน (ไม่ใช้ SO) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nonSoReason}
                onChange={(e) => setNonSoReason(e.target.value)}
                placeholder="เช่น สาขายืมไป 50 ม., ซ่อมฟอยล์พ่นกาว 20 ม."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          )}

          {/* Foil Surface Side Options */}
          <div className="flex items-center gap-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="font-semibold text-slate-700">ตัวเลือกท้องฟอยล์:</span>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={isSilverSide}
                onChange={(e) => {
                  setIsSilverSide(e.target.checked);
                  if (e.target.checked) setIsWhiteSide(false);
                }}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>ท้องเงิน</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={isWhiteSide}
                onChange={(e) => {
                  setIsWhiteSide(e.target.checked);
                  if (e.target.checked) setIsSilverSide(false);
                }}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>ท้องขาว</span>
            </label>
          </div>

          {/* Meter Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl">
              <label className="block text-emerald-950 font-bold mb-1">
                เมตรที่ใช้จริง (ลงแผ่น) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={usedMeters}
                  onChange={(e) => setUsedMeters(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg font-mono text-base font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-right"
                  required
                />
                <span className="font-semibold text-slate-500">ม.</span>
              </div>
            </div>

            <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl">
              <label className="block text-rose-950 font-bold mb-1">
                NG เสียหาย (เมตร)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={ngMeters}
                  onChange={(e) => setNgMeters(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg font-mono text-base font-bold text-rose-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-right"
                />
                <span className="font-semibold text-slate-500">ม.</span>
              </div>
            </div>
          </div>

          {/* Delta and Impact Preview Card */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
              <span className="text-slate-400">เปรียบเทียบยอดตัด:</span>
              <div className="font-mono">
                <span className="text-slate-400">เดิมตัด {formatMeters(oldTotal)} ม.</span>
                <span className="text-amber-400 mx-2">&rarr;</span>
                <span className="text-white font-bold">แก้ไขเป็น {formatMeters(newTotal)} ม.</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">ผลกระทบต่อสต๊อกม้วนฟอยล์:</span>
              <span className={`font-mono font-bold ${
                delta > 0 ? 'text-rose-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {delta > 0 ? `สต๊อกจะลดลงอีก -${formatMeters(delta)} ม.` : delta < 0 ? `คืนสต๊อกเข้าม้วน +${formatMeters(Math.abs(delta))} ม.` : 'ยอดตัดเท่าเดิม'}
              </span>
            </div>

            {roll && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                <span className="text-slate-400">คงเหลือในม้วนคาดการณ์:</span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {formatMeters(predictedRollRemaining)} ม.
                </span>
              </div>
            )}
          </div>

          {/* Date & Recorded By */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                วันที่ใช้งาน
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="date"
                  value={usageDate}
                  onChange={(e) => setUsageDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                ผู้บันทึก
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={recordedBy}
                  onChange={(e) => setRecordedBy(e.target.value)}
                  placeholder="ชื่อช่างคุมเครื่อง"
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              หมายเหตุเพิ่มเติม
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ระบุหมายเหตุหรือสาเหตุการแก้ไข (ถ้ามี)"
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isOverRemaining}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>บันทึกการแก้ไข</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
