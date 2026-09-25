import React, { useMemo, useState } from 'react';
import {
  X,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Save,
  RefreshCw,
  Search,
  RotateCcw,
  Filter,
} from 'lucide-react';
import { FoilRoll, CycleCountLine, CycleCountSession } from '../types';
import { formatMeters, round2 } from '../utils/formatters';
import { STANDARD_PATTERNS, STANDARD_WIDTHS, normalizePattern } from '../utils/soFormatter';
import { getPatternStyle } from '../utils/patternStyles';

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

  // Search / filters
  const [searchQuery, setSearchQuery] = useState('');
  const [lotQuery, setLotQuery] = useState('');
  const [selectedWidth, setSelectedWidth] = useState<string>('all');
  const [selectedPattern, setSelectedPattern] = useState<string>('all');

  const availableWidths = useMemo(() => {
    const set = new Set<number>();
    activeRolls.forEach((r) => set.add(Number(r.width)));
    const fromData = Array.from(set).sort((a, b) => a - b);
    return fromData.length > 0 ? fromData : [...STANDARD_WIDTHS];
  }, [activeRolls]);

  const availablePatterns = useMemo(() => {
    const set = new Set<string>();
    activeRolls.forEach((r) => set.add(normalizePattern(r.pattern)));
    const fromData = Array.from(set).sort();
    if (fromData.length > 0) return fromData;
    return STANDARD_PATTERNS.map((p) => p.value);
  }, [activeRolls]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(lotQuery.trim()) ||
    selectedWidth !== 'all' ||
    selectedPattern !== 'all' ||
    filterVarianceOnly;

  const clearFilters = () => {
    setSearchQuery('');
    setLotQuery('');
    setSelectedWidth('all');
    setSelectedPattern('all');
    setFilterVarianceOnly(false);
  };

  // All lines (for save) — always from full active set
  const allLines: CycleCountLine[] = useMemo(
    () =>
      activeRolls.map((r) => {
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
      }),
    [activeRolls, physicalMap, reasonMap, adjustMap]
  );

  const varianceLines = useMemo(
    () => allLines.filter((l) => Math.abs(l.variance) > 0.001),
    [allLines]
  );

  const missingReasons = useMemo(
    () => varianceLines.filter((l) => !l.reason),
    [varianceLines]
  );

  // Filtered display lines
  const displayLines = useMemo(() => {
    return allLines.filter((l) => {
      if (filterVarianceOnly && Math.abs(l.variance) <= 0.001) return false;

      if (selectedWidth !== 'all') {
        if (String(l.width) !== selectedWidth && Number(l.width) !== Number(selectedWidth)) {
          return false;
        }
      }

      if (selectedPattern !== 'all') {
        if (normalizePattern(String(l.pattern)) !== normalizePattern(selectedPattern)) {
          return false;
        }
      }

      if (lotQuery.trim()) {
        const q = lotQuery.toLowerCase().trim();
        if (!l.lotNumber.toLowerCase().includes(q)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hay = `${l.lotNumber} ${l.rollNumber} ${l.pattern} ${l.width}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [allLines, filterVarianceOnly, selectedWidth, selectedPattern, lotQuery, searchQuery]);

  if (!isOpen) return null;

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
        lines: allLines,
        createdAt: new Date().toISOString(),
        completedAt: complete ? new Date().toISOString() : undefined,
      };
      const applyAdjustments =
        complete && allLines.some((l) => l.adjusted && Math.abs(l.variance) > 0.001);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header — โทนเดียวกับแอป */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold leading-tight truncate">
                ตรวจนับสต๊อกประจำเดือน (Cycle Count)
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                เปรียบเทียบยอดระบบ vs ของจริง · บันทึก Variance และเหตุผล
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 disabled:opacity-40 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Session meta */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                งวด (YYYY-MM)
              </label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                ผู้ตรวจนับ
              </label>
              <input
                type="text"
                value={countedBy}
                onChange={(e) => setCountedBy(e.target.value)}
                placeholder="ชื่อผู้ตรวจนับ"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                หมายเหตุงวด
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุงวดนี้ (ถ้ามี)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Search + Filters — สไตล์เดียวกับหน้าม้วนฟอยล์ */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-white shrink-0 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* ค้นหาทั่วไป */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา ล็อต / เบอร์ / ลาย..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 focus:bg-white"
              />
            </div>
            {/* Lot No. */}
            <div className="relative sm:w-40">
              <input
                type="text"
                value={lotQuery}
                onChange={(e) => setLotQuery(e.target.value)}
                placeholder="Lot No."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 focus:bg-white"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ล้างค้นหา
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              <Filter className="w-3 h-3" />
              กรอง
            </span>

            {/* หน้ากว้าง */}
            <select
              value={selectedWidth}
              onChange={(e) => setSelectedWidth(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            >
              <option value="all">หน้ากว้างทั้งหมด</option>
              {availableWidths.map((w) => (
                <option key={w} value={String(w)}>
                  {w} มม.
                </option>
              ))}
            </select>

            {/* ท้องลาย */}
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            >
              <option value="all">ท้องลายทั้งหมด</option>
              {availablePatterns.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* เฉพาะส่วนต่าง */}
            <button
              type="button"
              onClick={() => setFilterVarianceOnly((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                filterVarianceOnly
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {filterVarianceOnly
                ? `ส่วนต่าง (${varianceLines.length})`
                : `ทั้งหมด (${allLines.length})`}
            </button>

            <span className="text-[11px] text-slate-400 ml-auto font-mono">
              แสดง {displayLines.length}/{allLines.length} ม้วน
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 min-h-0">
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-slate-100/90 text-slate-600 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="text-left px-3 py-2.5 font-bold whitespace-nowrap">ล็อต / เบอร์</th>
                  <th className="text-left px-3 py-2.5 font-bold whitespace-nowrap">ลาย · หน้า</th>
                  <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">ยอดระบบ</th>
                  <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">นับจริง</th>
                  <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">ส่วนต่าง</th>
                  <th className="text-left px-3 py-2.5 font-bold whitespace-nowrap">เหตุผล (ถ้าต่าง)</th>
                  <th className="text-center px-3 py-2.5 font-bold whitespace-nowrap">ปรับยอด</th>
                </tr>
              </thead>
              <tbody>
                {displayLines.map((line) => {
                  const hasVar = Math.abs(line.variance) > 0.001;
                  const style = getPatternStyle(String(line.pattern));
                  return (
                    <tr
                      key={line.rollId}
                      className={`border-t border-slate-100 transition-colors ${
                        hasVar ? 'bg-amber-50/70 hover:bg-amber-50' : 'bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        <span className="text-slate-900">{line.lotNumber}</span>
                        <span className="text-slate-400 mx-0.5">#</span>
                        <span className="text-amber-700">{line.rollNumber}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${style.badgeClass || 'bg-slate-100 border-slate-200'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dotClass || 'bg-slate-400'}`} />
                          {line.pattern}
                        </span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="font-mono text-slate-600">{line.width} มม.</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 tabular-nums">
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
                          className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-right font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold tabular-nums ${
                          hasVar
                            ? line.variance > 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {hasVar ? (line.variance > 0 ? '+' : '') + formatMeters(line.variance) : '—'}
                      </td>
                      <td className="px-3 py-2 min-w-[140px]">
                        {hasVar ? (
                          <input
                            type="text"
                            disabled={!canEdit || isSubmitting}
                            value={reasonMap[line.rollId] || ''}
                            onChange={(e) =>
                              setReasonMap((prev) => ({ ...prev, [line.rollId]: e.target.value }))
                            }
                            placeholder="เช่น เสียหาย / นับผิด / ตัดลืมบันทึก"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
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
                            className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
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
                    <td colSpan={7} className="px-3 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Search className="w-8 h-8 opacity-40" />
                        <p className="font-semibold text-slate-600 text-sm">ไม่พบม้วนที่ตรงเงื่อนไข</p>
                        <p className="text-[11px] text-slate-400">ลองเปลี่ยนตัวกรอง หรือกดล้างค้นหา</p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            ล้างค้นหา
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ม้วนทั้งหมด <strong className="text-slate-800 font-mono">{allLines.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              มีส่วนต่าง <strong className="text-slate-800 font-mono">{varianceLines.length}</strong> ม้วน
            </span>
            {missingReasons.length > 0 && (
              <span className="text-rose-600 font-semibold">
                ยังไม่ระบุเหตุผล {missingReasons.length} ม้วน
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors"
          >
            ปิด
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !canEdit}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
          >
            {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            บันทึกแบบร่าง
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || !canEdit}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 shadow-xs active:scale-[0.98] transition-all"
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ClipboardList className="w-3.5 h-3.5" />
            )}
            บันทึกเสร็จสิ้น
            {varianceLines.some((l) => l.adjusted) ? ' + ปรับยอด' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
