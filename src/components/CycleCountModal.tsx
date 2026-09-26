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
  Folder,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { FoilRoll, CycleCountLine, CycleCountSession } from '../types';
import { formatMeters, round2 } from '../utils/formatters';
import { STANDARD_PATTERNS, STANDARD_WIDTHS, normalizePattern } from '../utils/soFormatter';
import { getPatternStyle } from '../utils/patternStyles';

/** เหตุผลการนับส่วนต่าง — ใช้เป็นตัวเลือกในฟอร์ม */
export const CYCLE_COUNT_REASONS = [
  'เสียหาย / NG',
  'นับผิดพลาดรอบก่อน',
  'ตัดลืมบันทึกในระบบ',
  'บันทึกซ้ำ / ตัดเกิน',
  'พบของเพิ่ม / คืนยอด',
  'ของจริงไม่ตรงระบบ (ไม่ทราบสาเหตุ)',
  'ย้ายม้วน / สลับเบอร์',
  'อื่นๆ',
] as const;

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

  // Search / filters (คอมแพ็กต์แบบหน้าม้วนฟอยล์)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWidth, setSelectedWidth] = useState<string>('all');
  const [selectedPattern, setSelectedPattern] = useState<string>('all');
  const [collapsedWidth, setCollapsedWidth] = useState<Record<string, boolean>>({});
  const [collapsedPattern, setCollapsedPattern] = useState<Record<string, boolean>>({});

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
    selectedWidth !== 'all' ||
    selectedPattern !== 'all' ||
    filterVarianceOnly;

  const clearFilters = () => {
    setSearchQuery('');
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

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hay = `${l.lotNumber} ${l.rollNumber} ${l.pattern} ${l.width}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [allLines, filterVarianceOnly, selectedWidth, selectedPattern, searchQuery]);

  // จัดกลุ่มแบบหน้าม้วนฟอยล์: หน้ากว้าง → ท้องลาย
  const groupedFolders = useMemo(() => {
    const widthMap = new Map<string, Map<string, CycleCountLine[]>>();
    displayLines.forEach((l) => {
      const wKey = String(l.width);
      const pKey = normalizePattern(String(l.pattern));
      if (!widthMap.has(wKey)) widthMap.set(wKey, new Map());
      const pMap = widthMap.get(wKey)!;
      if (!pMap.has(pKey)) pMap.set(pKey, []);
      pMap.get(pKey)!.push(l);
    });
    return Array.from(widthMap.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([width, pMap]) => ({
        width,
        patterns: Array.from(pMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0], 'th'))
          .map(([pattern, lines]) => ({ pattern, lines })),
      }));
  }, [displayLines]);

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

        {/* แถบค้นหา/กรองแบบคอมแพ็กต์ — คล้ายหน้าม้วนฟอยล์ */}
        <div className="px-4 sm:px-5 py-2 border-b border-slate-100 bg-white shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาล็อต / เบอร์..."
                className="w-36 sm:w-44 pl-7 pr-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50 focus:bg-white"
              />
            </div>
            <select
              value={selectedWidth}
              onChange={(e) => setSelectedWidth(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">หน้ากว้างทั้งหมด</option>
              {availableWidths.map((w) => (
                <option key={w} value={String(w)}>
                  {w} มม.
                </option>
              ))}
            </select>
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">ท้องลายทั้งหมด</option>
              {availablePatterns.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFilterVarianceOnly((v) => !v)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                filterVarianceOnly
                  ? 'bg-amber-500 text-slate-950 border-amber-600'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {filterVarianceOnly ? `ส่วนต่าง (${varianceLines.length})` : `ทั้งหมด (${allLines.length})`}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                ล้าง
              </button>
            )}
            <span className="text-[10px] text-slate-400 ml-auto font-mono">
              {displayLines.length}/{allLines.length} ม้วน
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* รายการแบบโฟลเดอร์: หน้ากว้าง → ท้องลาย (เหมือนหน้าม้วนฟอยล์) */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2.5 min-h-0 space-y-2">
          {displayLines.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-40" />
              <p className="font-semibold text-slate-600 text-sm">ไม่พบม้วนที่ตรงเงื่อนไข</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  ล้างค้นหา
                </button>
              )}
            </div>
          ) : (
            groupedFolders.map(({ width, patterns }) => {
              const widthOpen = !collapsedWidth[width];
              const widthCount = patterns.reduce((s, p) => s + p.lines.length, 0);
              return (
                <div key={width} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedWidth((prev) => ({ ...prev, [width]: widthOpen }))
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-900 text-white text-left cursor-pointer"
                  >
                    {widthOpen ? (
                      <ChevronDown className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <Folder className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-sm">{width} มม.</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-1">{widthCount} ม้วน</span>
                  </button>
                  {widthOpen &&
                    patterns.map(({ pattern, lines }) => {
                      const pKey = `${width}::${pattern}`;
                      const pOpen = !collapsedPattern[pKey];
                      const style = getPatternStyle(pattern);
                      return (
                        <div key={pKey} className="border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedPattern((prev) => ({ ...prev, [pKey]: pOpen }))
                            }
                            className="w-full flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
                          >
                            {pOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style.badgeClass || 'bg-white border-slate-200'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dotClass || 'bg-slate-400'}`} />
                              {pattern}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{lines.length} ม้วน</span>
                          </button>
                          {pOpen && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs min-w-[640px]">
                                <thead className="bg-slate-100/80 text-slate-500 text-[10px]">
                                  <tr>
                                    <th className="text-left px-2.5 py-1.5 font-bold">ล็อต / เบอร์</th>
                                    <th className="text-right px-2.5 py-1.5 font-bold">ยอดระบบ</th>
                                    <th className="text-right px-2.5 py-1.5 font-bold">นับจริง</th>
                                    <th className="text-right px-2.5 py-1.5 font-bold">ส่วนต่าง</th>
                                    <th className="text-left px-2.5 py-1.5 font-bold">เหตุผล</th>
                                    <th className="text-center px-2.5 py-1.5 font-bold">ปรับ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lines.map((line) => {
                                    const hasVar = Math.abs(line.variance) > 0.001;
                                    return (
                                      <tr
                                        key={line.rollId}
                                        className={`border-t border-slate-50 ${
                                          hasVar ? 'bg-amber-50/60' : 'bg-white'
                                        }`}
                                      >
                                        <td className="px-2.5 py-1.5 font-mono font-semibold whitespace-nowrap">
                                          {line.lotNumber}
                                          <span className="text-slate-400">#</span>
                                          <span className="text-amber-700">{line.rollNumber}</span>
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
                                          {formatMeters(line.systemRemaining)}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right">
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
                                            onChange={(e) =>
                                              handlePhysicalChange(line.rollId, e.target.value)
                                            }
                                            className="w-20 px-1.5 py-1 rounded border border-slate-200 text-right font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                                          />
                                        </td>
                                        <td
                                          className={`px-2.5 py-1.5 text-right font-mono font-bold tabular-nums ${
                                            hasVar
                                              ? line.variance > 0
                                                ? 'text-emerald-700'
                                                : 'text-rose-700'
                                              : 'text-slate-300'
                                          }`}
                                        >
                                          {hasVar
                                            ? (line.variance > 0 ? '+' : '') +
                                              formatMeters(line.variance)
                                            : '—'}
                                        </td>
                                        <td className="px-2.5 py-1.5 min-w-[130px]">
                                          {hasVar ? (
                                            <select
                                              disabled={!canEdit || isSubmitting}
                                              value={reasonMap[line.rollId] || ''}
                                              onChange={(e) =>
                                                setReasonMap((prev) => ({
                                                  ...prev,
                                                  [line.rollId]: e.target.value,
                                                }))
                                              }
                                              className={`w-full px-1.5 py-1 rounded border text-[11px] cursor-pointer ${
                                                reasonMap[line.rollId]
                                                  ? 'border-amber-300 bg-white'
                                                  : 'border-rose-300 bg-rose-50/50'
                                              }`}
                                            >
                                              <option value="">— เลือก —</option>
                                              {CYCLE_COUNT_REASONS.map((r) => (
                                                <option key={r} value={r}>
                                                  {r}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <span className="text-slate-300">—</span>
                                          )}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-center">
                                          {hasVar ? (
                                            <input
                                              type="checkbox"
                                              disabled={!canEdit || isSubmitting}
                                              checked={Boolean(adjustMap[line.rollId])}
                                              onChange={(e) =>
                                                setAdjustMap((prev) => ({
                                                  ...prev,
                                                  [line.rollId]: e.target.checked,
                                                }))
                                              }
                                              className="w-3.5 h-3.5 cursor-pointer accent-amber-500"
                                            />
                                          ) : (
                                            <span className="text-slate-300">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ทั้งหมด <strong className="font-mono text-slate-800">{allLines.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              ส่วนต่าง <strong className="font-mono text-slate-800">{varianceLines.length}</strong>
            </span>
            {missingReasons.length > 0 && (
              <span className="text-rose-600 font-semibold">
                ยังไม่ระบุเหตุผล {missingReasons.length}
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
