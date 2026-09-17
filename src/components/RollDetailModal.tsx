import React from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { X, Layers, Scissors, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';
import { formatMeters } from '../utils/formatters';

interface RollDetailModalProps {
  roll: FoilRoll | null;
  records: StockCutRecord[];
  onClose: () => void;
  onOpenCutForThisRoll: (rollId: string) => void;
}

export const RollDetailModal: React.FC<RollDetailModalProps> = ({
  roll,
  records,
  onClose,
  onOpenCutForThisRoll,
}) => {
  if (!roll) return null;

  const rollRecords = records.filter(r => r.foilId === roll.id);
  const percentLeft = roll.totalMeters > 0 ? Math.round((roll.remainingMeters / roll.totalMeters) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
      <div 
        id="modal-roll-detail"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                ประวัติการตัด: ล็อต {roll.lotNumber} #{roll.rollNumber}
              </h2>
              <p className="text-xs text-slate-300">
                ลาย {roll.pattern} | หน้ากว้าง {roll.width} มม.
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Roll Stats Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <span className="text-[11px] text-slate-500 block">เมตรลูกเต็ม</span>
                <span className="font-mono font-bold text-slate-900 text-base">
                  {formatMeters(roll.totalMeters)} ม.
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">ผลิตจริงสะสม</span>
                <span className="font-mono font-bold text-blue-700 text-base">
                  {formatMeters(roll.usedMeters)} ม.
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">NG เสียสะสม</span>
                <span className="font-mono font-bold text-rose-600 text-base">
                  {formatMeters(roll.ngMeters)} ม.
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">คงเหลือปัจจุบัน</span>
                <span className="font-mono font-bold text-emerald-700 text-base">
                  {formatMeters(roll.remainingMeters)} ม.
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>สัดส่วนคงเหลือในม้วน</span>
                <span className="font-bold text-slate-800 font-mono">{percentLeft}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    roll.remainingMeters <= 0 ? 'bg-slate-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percentLeft}%` }}
                />
              </div>
            </div>

            {roll.notes && (
              <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                <strong className="text-slate-700">หมายเหตุรับเข้า:</strong> {roll.notes}
              </div>
            )}
          </div>

          {/* Cuts History for this roll */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-amber-600" />
                บันทึกการตัดของม้วนนี้ ({rollRecords.length} ครั้ง)
              </h3>
              {roll.remainingMeters > 0 && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenCutForThisRoll(roll.id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>ตัดสต๊อกม้วนนี้</span>
                </button>
              )}
            </div>

            {rollRecords.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                ยังไม่มีการตัดสต๊อกสำหรับม้วนนี้ (ม้วนเต็ม)
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">รหัส SO</th>
                      <th className="p-2.5 text-right">ตัดใช้</th>
                      <th className="p-2.5 text-right">NG</th>
                      <th className="p-2.5 text-right">คงเหลือ</th>
                      <th className="p-2.5">วันที่ใช้</th>
                      <th className="p-2.5">ผู้บันทึก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rollRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-amber-800">
                          {r.soNumber}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                          {formatMeters(r.usedMeters)} ม.
                        </td>
                        <td className="p-2.5 text-right font-mono text-rose-600">
                          {r.ngMeters > 0 ? `${formatMeters(r.ngMeters)} ม.` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                          {formatMeters(r.remainingAfter)} ม.
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {r.usageDate}
                        </td>
                        <td className="p-2.5 text-slate-700 truncate max-w-[120px]">
                          {r.recordedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
