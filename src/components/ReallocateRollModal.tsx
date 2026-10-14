import React, { useState } from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { formatMeters } from '../utils/formatters';
import { calculateRollReservationMetrics } from '../utils/reservationHelpers';
import { FoilStatusTube } from './FoilStatusTube';
import { X, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ReallocateRollModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StockCutRecord | null;
  availableRolls: FoilRoll[];
  existingRecords?: StockCutRecord[];
  onConfirmReallocate: (recordId: string, newRollId: string) => Promise<void> | void;
}

export const ReallocateRollModal: React.FC<ReallocateRollModalProps> = ({
  isOpen,
  onClose,
  record,
  availableRolls,
  existingRecords = [],
  onConfirmReallocate,
}) => {
  const [selectedNewRollId, setSelectedNewRollId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterSameSpec, setFilterSameSpec] = useState(true);

  if (!isOpen || !record) return null;

  const currentRoll = availableRolls.find((r) => r.id === record.foilId);
  const totalMetersNeeded = (Number(record.usedMeters) || 0) + (Number(record.ngMeters) || 0);

  // กรองม้วนเป้าหมายที่เป็นไปได้ (ไม่เอาม้วนเดิม)
  const candidateRolls = availableRolls.filter((r) => {
    if (r.id === record.foilId) return false;
    if (r.status === 'depleted') return false;
    if (filterSameSpec) {
      return (
        Number(r.width) === Number(record.width) &&
        r.pattern === record.pattern
      );
    }
    return true;
  });

  const selectedNewRoll = availableRolls.find((r) => r.id === selectedNewRollId);
  const selectedNewRollMetrics = selectedNewRoll
    ? calculateRollReservationMetrics(selectedNewRoll, existingRecords)
    : null;

  const hasEnoughMeters = selectedNewRollMetrics
    ? selectedNewRollMetrics.projectedRemainingMeters >= totalMetersNeeded
    : false;

  const handleSubmit = async () => {
    if (!selectedNewRollId) return;
    try {
      setIsSubmitting(true);
      await onConfirmReallocate(record.id, selectedNewRollId);
      onClose();
    } catch (err) {
      console.error('Error reallocating roll:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">เปลี่ยนม้วนฟอยล์สำหรับ SO</h3>
              <p className="text-xs text-slate-500 font-mono">
                SO: <span className="font-bold text-slate-800">{record.soNumber}</span> · ยอดที่ใช้: {formatMeters(totalMetersNeeded)} ม.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* ม้วนเดิมในปัจจุบัน */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              ม้วนฟอยล์ปัจจุบันที่ผูกไว้
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  LOT {record.lotNumber} #{record.rollNumber}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  (กว้าง {record.width} มม. · ลาย{record.pattern})
                </span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                ผูกยอดจอง {formatMeters(totalMetersNeeded)} ม.
              </span>
            </div>
            {currentRoll && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <FoilStatusTube roll={currentRoll} records={existingRecords} size="sm" showStats={false} showLabels={true} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-center text-slate-400">
            <ArrowRight className="w-5 h-5" />
          </div>

          {/* เลือกม้วนใหม่ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800">
                เลือกม้วนฟอยล์ใหม่ที่ต้องการย้ายไป:
              </label>
              <label className="text-xs text-slate-600 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterSameSpec}
                  onChange={(e) => setFilterSameSpec(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                เฉพาะสเปกเดียวกัน (กว้าง {record.width} / {record.pattern})
              </label>
            </div>

            {candidateRolls.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ไม่พบม้วนอื่นที่ตรงตามเงื่อนไข (ลองปลดตัวเลือกสเปกเดียวกัน)</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {candidateRolls.map((r) => {
                  const rMetrics = calculateRollReservationMetrics(r, existingRecords);
                  const isSufficient = rMetrics.projectedRemainingMeters >= totalMetersNeeded;
                  const isSelected = selectedNewRollId === r.id;

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedNewRollId(r.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/40'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="targetRoll"
                            checked={isSelected}
                            onChange={() => setSelectedNewRollId(r.id)}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                              LOT {r.lotNumber} #{r.rollNumber}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-1.5 font-sans">
                              (กว้าง {r.width} · {r.pattern})
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-xs font-mono font-bold ${isSufficient ? 'text-emerald-700' : 'text-rose-600'}`}>
                            ว่าง {formatMeters(rMetrics.projectedRemainingMeters)} ม.
                          </span>
                          {!isSufficient && (
                            <span className="block text-[10px] text-rose-500">
                              (เมตรไม่พอ)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2">
                        <FoilStatusTube roll={r} records={existingRecords} size="sm" showStats={false} showLabels={true} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* สรุปผลลัพธ์ม้วนใหม่ */}
          {selectedNewRoll && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>พร้อมย้ายยอดจอง {formatMeters(totalMetersNeeded)} ม. เข้าม้วน LOT {selectedNewRoll.lotNumber} #{selectedNewRoll.rollNumber}</span>
              </div>
              <p className="text-emerald-800 text-[11px]">
                ระบบจะคืนยอดจองให้ม้วนเดิมอัตโนมัติ และหลอดสถานะจะคำนวณใหม่ทันที
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!selectedNewRollId || isSubmitting}
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 transition-colors shadow-xs flex items-center gap-1.5"
          >
            {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันเปลี่ยนม้วนฟอยล์'}
          </button>
        </div>
      </div>
    </div>
  );
};
