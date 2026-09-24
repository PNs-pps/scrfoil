import React from 'react';
import { AlertTriangle, CheckCircle2, X, Wrench } from 'lucide-react';
import { IntegrityMismatch } from '../utils/integrityCheck';
import { formatMeters } from '../utils/formatters';

interface IntegrityCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  mismatches: IntegrityMismatch[];
  checkedAt: string;
  onFixRoll: (rollId: string, correctRemaining: number) => void;
  canEdit: boolean;
}

export const IntegrityCheckModal: React.FC<IntegrityCheckModalProps> = ({
  isOpen,
  onClose,
  mismatches,
  checkedAt,
  onFixRoll,
  canEdit,
}) => {
  if (!isOpen) return null;

  const isAllGood = mismatches.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {isAllGood ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900">ผลตรวจสอบความถูกต้องของสต๊อก</h2>
              <p className="text-xs text-slate-500">
                ตรวจล่าสุด: {checkedAt ? new Date(checkedAt).toLocaleString('th-TH') : '-'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {isAllGood ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-slate-700 font-semibold">ยอดคงเหลือของทุกม้วนตรงกับรายการตัด SO ทั้งหมด</p>
              <p className="text-slate-400 text-sm mt-1">ไม่พบความผิดปกติ</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-4">
                พบ <span className="font-bold text-rose-700">{mismatches.length} ม้วน</span> ที่ยอดคงเหลือไม่ตรงกับผลรวมรายการตัด SO
                (คำนวณจาก ยอดรับเข้า − ผลรวมที่ตัดจริงทุกใบ)
              </p>
              <div className="space-y-3">
                {mismatches.map((m) => (
                  <div key={m.rollId} className="border border-rose-200 bg-rose-50/60 rounded-xl p-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <div className="font-mono font-bold text-sm text-slate-900">
                        ล็อต {m.lotNumber} · #{m.rollNumber} · {m.pattern} · หน้า {m.width} มม.
                      </div>
                      <span className="text-[11px] text-slate-500">{m.recordCount} รายการตัด</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                      <div>
                        <span className="text-slate-500 text-xs">ยอดในระบบตอนนี้:</span>
                        <div className="font-bold text-slate-900">{formatMeters(m.actualRemaining)} ม.</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">ยอดที่ควรจะเป็น:</span>
                        <div className="font-bold text-emerald-700">{formatMeters(m.expectedRemaining)} ม.</div>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs">
                      {m.diff > 0 ? (
                        <span className="text-rose-700 font-semibold">ยอดในระบบสูงเกินจริงอยู่ {formatMeters(Math.abs(m.diff))} ม.</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">ยอดในระบบต่ำกว่าจริงอยู่ {formatMeters(Math.abs(m.diff))} ม.</span>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => onFixRoll(m.rollId, m.expectedRemaining)}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        ปรับยอดให้ตรง ({formatMeters(m.expectedRemaining)} ม.)
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors text-sm"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
