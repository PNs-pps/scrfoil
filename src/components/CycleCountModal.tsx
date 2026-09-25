import React, { useMemo, useState } from 'react';
import { X, ClipboardList, AlertTriangle, CheckCircle2, Save, RefreshCw } from 'lucide-react';
import { FoilRoll, CycleCountLine, CycleCountSession } from '../types';
import { formatMeters, round2 } from '../utils/formatters';

interface CycleCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  rolls: FoilRoll[];
  onSaveSession: (session: CycleCountSession, applyAdjustments: boolean) => Promise<void>;
  showToast?: (text: string, type?: 'success' | 'info') => void;
  canEdit?: boolean;
}

const nowPeriod = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const CycleCountModal: React.FC<CycleCountModalProps> = ({
  isOpen,
  onClose,
  rolls,
  onSaveSession,
  showToast,
  canEdit = true,
}) => {
  const activeRolls = useMemo(
    () => rolls.filter((r) => r.status === 'active' || r.remainingMeters > 0),
    [rolls]
  );

  const [period, setPeriod] = useState(nowPeriod());
  const [countedBy, setCountedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [physicalMap, setPhysicalMap] = useState<Record<string, string>>({});
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [adjustMap, setAdjustMap] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterVarianceOnly, setFilterVarianceOnly] = useState(false);

  if (!isOpen) return null;

  const lines: CycleCountLine[] = activeRolls.map((r) => {
    const raw = physicalMap[r.id];
    const physical =
      raw === undefined || raw === ''
        ? r.remainingMeters
        : Math.max(0, Number(raw) || 0);
    const system = r.remainingMeters;
    const variance = round2(physical - system);
    return {
      rollId: r.id,
      lotNumber: r.lotNumber,
      rollNumber: r.rollNumber,
      width: r.width,
      pattern: r.pattern,
      systemRemaining: system,
      physicalCount: physical,
      variance,
      reason: reasonMap[r.id]?.trim() || undefined,
      adjusted: variance !== 0 ? Boolean(adjustMap[r.id]) : false,
    };
  });

  const varianceLines = lines.filter((l) => Math.abs(l.variance) > 0.001);
  const displayLines = filterVarianceOnly ? varianceLines : lines;
  const missingReasons = varianceLines.filter((l) => !l.reason);

  const handlePhysicalChange = (rollId: string, value: string) => {
    setPhysicalMap((prev) => ({ ...prev, [rollId]: value }));
  };

  const handleSubmit = async (complete: boolean) => {
    if (!canEdit) return;
    if (isSubmitting) return;
    setError(null);

    if (complete && missingReasons.length > 0) {
      setError(`มี ${missingReasons.length} ม้วนที่มีส่วนต่าง แต่ยังไม่ระบุเหตุผล`);
      setFilterVarianceOnly(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const session: CycleCountSession = {
        id: `cc_${period}_${Date.now()}`,
        period,
        status: complete ? 'completed' : 'draft',
        countedBy: countedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        lines,
        createdAt: new Date().toISOString(),
        completedAt: complete ? new Date().toISOString() : undefined,
      };
      const applyAdjustments =
        complete && lines.some((l) => l.adjusted && Math.abs(l.variance) > 0.001);
      await onSaveSession(session, applyAdjustments);
      showToast?.(
        complete
          ? `บันทึก Cycle Count ${period} เสร็จสิ้น${applyAdjustments ? ' และปรับยอดแล้ว' : ''}`
          : `บันทึกแบบร่าง Cycle Count ${period} แล้ว`,
        'success'
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold leading-tight">ตรวจนับสต๊อกประจำเดือน (Cycle Count)</h2>
              <p className="text-xs text-slate-300">เปรียบเทียบยอดระบบ vs ของจริง · บันทึก Variance และเหตุผล</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-end bg-slate-50">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">งวด (YYYY-MM)</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">ผู้ตรวจนับ</label>
            <input
              type="text"
              value={countedBy}
              onChange={(e) => setCountedBy(e.target.value)}
              placeholder="ชื่อผู้ตรวจนับ"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">หมายเหตุ</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="หมายเหตุงวดนี้ (ถ้ามี)"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterVarianceOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
              filterVarianceOnly
                ? 'bg-amber-500 text-slate-950 border-amber-600'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            {filterVarianceOnly ? `แสดงเฉพาะส่วนต่าง (${varianceLines.length})` : `ทั้งหมด (${lines.length})`}
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">ล็อต / เบอร์</th>
                  <th className="text-left px-3 py-2 font-semibold">ลาย · หน้า</th>
                  <th className="text-right px-3 py-2 font-semibold">ยอดระบบ</th>
                  <th className="text-right px-3 py-2 font-semibold">นับจริง</th>
                  <th className="text-right px-3 py-2 font-semibold">ส่วนต่าง</th>
                  <th className="text-left px-3 py-2 font-semibold">เหตุผล (ถ้าต่าง)</th>
                  <th className="text-center px-3 py-2 font-semibold">ปรับยอด</th>
                </tr>
              </thead>
              <tbody>
                {displayLines.map((line) => {
                  const hasVar = Math.abs(line.variance) > 0.001;
                  return (
                    <tr
                      key={line.rollId}
                      className={`border-t border-slate-100 ${hasVar ? 'bg-amber-50/60' : 'bg-white'}`}
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                        {line.lotNumber} #{line.rollNumber}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {line.pattern} · {line.width} มม.
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-800">
                        {formatMeters(line.systemRemaining)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          disabled={!canEdit || isSubmitting}
                          value={
                            physicalMap[line.rollId] !== undefined
                              ? physicalMap[line.rollId]
                              : String(line.systemRemaining)
                          }
                          onChange={(e) => handlePhysicalChange(line.rollId, e.target.value)}
                          className="w-24 px-2 py-1 rounded border border-slate-300 text-right font-mono text-xs"
                        />
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold ${
                          hasVar
                            ? line.variance > 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {hasVar ? (line.variance > 0 ? '+' : '') + formatMeters(line.variance) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {hasVar ? (
                          <input
                            type="text"
                            disabled={!canEdit || isSubmitting}
                            value={reasonMap[line.rollId] || ''}
                            onChange={(e) =>
                              setReasonMap((prev) => ({ ...prev, [line.rollId]: e.target.value }))
                            }
                            placeholder="เช่น เสียหาย / นับผิด / ตัดลืมบันทึก"
                            className="w-full min-w-[140px] px-2 py-1 rounded border border-amber-300 text-xs bg-white"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {hasVar ? (
                          <input
                            type="checkbox"
                            disabled={!canEdit || isSubmitting}
                            checked={Boolean(adjustMap[line.rollId])}
                            onChange={(e) =>
                              setAdjustMap((prev) => ({ ...prev, [line.rollId]: e.target.checked }))
                            }
                            title="ติ๊กเพื่อปรับยอดในระบบให้เท่าของจริงเมื่อบันทึกเสร็จ"
                            className="w-4 h-4 cursor-pointer"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {displayLines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      ไม่มีม้วนที่ต้องแสดง
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ม้วนทั้งหมด {lines.length}
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              มีส่วนต่าง {varianceLines.length} ม้วน
            </span>
            {missingReasons.length > 0 && (
              <span className="text-rose-600 font-semibold">
                ยังไม่ระบุเหตุผล {missingReasons.length} ม้วน
              </span>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-white flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            ปิด
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !canEdit}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5"
          >
            {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            บันทึกแบบร่าง
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || !canEdit}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5"
          >
            {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
            บันทึกเสร็จสิ้น{varianceLines.some((l) => l.adjusted) ? ' + ปรับยอด' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
