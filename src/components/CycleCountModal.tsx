import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FoilRoll, CycleCountRecord } from '../types';
import {
  X,
  ClipboardCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  History,
  User,
  Calendar,
  Wrench,
  Info,
  GitCompare,
  Trash2,
} from 'lucide-react';
import { formatMeters } from '../utils/formatters';
import { getRecentOperators, saveRecentOperator } from '../utils/storage';
import { THAI_MONTHS, getCurrentThaiYearBE2Digits, getCurrentMonth2Digits } from '../utils/soFormatter';

interface CycleCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  rolls: FoilRoll[];
  canEdit: boolean;
  onSaveSession: (entries: CycleCountRecord[]) => Promise<void>;
  onApplyAdjustment?: (entry: CycleCountRecord) => Promise<void>;
  onLoadHistory: () => Promise<CycleCountRecord[]>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onFetchFreshRemaining: (
    rollIds: string[]
  ) => Promise<Record<string, { remainingMeters: number; isZeroedOut: boolean; status?: string } | null>>;
}

interface CountRow {
  rollId: string;
  physicalMeters: string; // kept as text while typing
  reason: string;
  counted: boolean; // has the operator actually entered something for this row
}

const today = () => new Date().toISOString().split('T')[0];

export const CycleCountModal: React.FC<CycleCountModalProps> = ({
  isOpen,
  onClose,
  rolls,
  canEdit,
  onSaveSession,
  onApplyAdjustment,
  onLoadHistory,
  onDeleteEntry,
  onDeleteSession,
  onFetchFreshRemaining,
}) => {
  const [activeView, setActiveView] = useState<'count' | 'history' | 'compare'>('count');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<Record<string, CountRow>>({});
  const [recordedBy, setRecordedBy] = useState<string>(() => getRecentOperators()[0] || '');
  const [countedAt, setCountedAt] = useState<string>(today());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedEntries, setLastSavedEntries] = useState<CycleCountRecord[] | null>(null);
  const [applyingRollId, setApplyingRollId] = useState<string | null>(null);
  const [appliedRollIds, setAppliedRollIds] = useState<Set<string>>(new Set());

  // History tab state
  const [history, setHistory] = useState<CycleCountRecord[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Compare tab state: pick two sessions from history to compare
  const [compareSessionA, setCompareSessionA] = useState<string>('');
  const [compareSessionB, setCompareSessionB] = useState<string>('');

  const recentOperators = useMemo(() => getRecentOperators(), []);

  // Reset per-session state every time the modal is (re)opened, so a
  // previous count's success banner, entered numbers, or search filter
  // don't linger and confuse the operator on the next visit. History/compare
  // data is intentionally left cached (cheap to keep, avoids a re-fetch).
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (isOpening) {
      setActiveView('count');
      setSearchQuery('');
      setRows({});
      setCountedAt(today());
      setIsSubmitting(false);
      setError(null);
      setLastSavedEntries(null);
      setApplyingRollId(null);
      setAppliedRollIds(new Set());
      setRecordedBy(getRecentOperators()[0] || '');
    }
  }, [isOpen]);

  const filteredRolls = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? rolls.filter(
          (r) =>
            r.lotNumber.toLowerCase().includes(q) ||
            r.rollNumber.toLowerCase().includes(q) ||
            String(r.pattern || '').toLowerCase().includes(q)
        )
      : rolls;
    return [...list].sort((a, b) => a.lotNumber.localeCompare(b.lotNumber) || a.rollNumber.localeCompare(b.rollNumber));
  }, [rolls, searchQuery]);

  const getRow = (rollId: string): CountRow =>
    rows[rollId] || { rollId, physicalMeters: '', reason: '', counted: false };

  const updateRow = (rollId: string, patch: Partial<CountRow>) => {
    setRows((prev) => ({
      ...prev,
      [rollId]: { ...getRow(rollId), ...patch, counted: true },
    }));
    setLastSavedEntries(null);
  };

  const countedRows = useMemo(() => {
    return Object.values(rows).filter((r) => r.counted && r.physicalMeters.trim() !== '');
  }, [rows]);

  const rowsNeedingReason = useMemo(() => {
    return countedRows.filter((r) => {
      const roll = rolls.find((x) => x.id === r.rollId);
      if (!roll) return false;
      const variance = round1(Number(r.physicalMeters) - roll.remainingMeters);
      return variance !== 0 && !r.reason.trim();
    });
  }, [countedRows, rolls]);

  function round1(n: number): number {
    return Math.round(n * 10) / 10;
  }

  const buildSessionLabel = (dateStr: string): { sessionId: string; sessionLabel: string } => {
    const d = new Date(dateStr || today());
    const monthIdx = isNaN(d.getMonth()) ? Number(getCurrentMonth2Digits()) - 1 : d.getMonth();
    const monthLabel = THAI_MONTHS[monthIdx]?.label.split(' - ')[1] || '';
    const yearBE = isNaN(d.getFullYear()) ? getCurrentThaiYearBE2Digits() : String(d.getFullYear() + 543).slice(-2);
    const sessionId = `${yearBE}-${THAI_MONTHS[monthIdx]?.value || getCurrentMonth2Digits()}`;
    return { sessionId, sessionLabel: `ตรวจนับประจำเดือน ${monthLabel} ${yearBE}` };
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError(null);

    if (countedRows.length === 0) {
      setError('กรุณากรอกยอดนับจริงอย่างน้อย 1 ม้วน');
      return;
    }
    if (!recordedBy.trim()) {
      setError('กรุณาระบุชื่อผู้ตรวจนับ');
      return;
    }
    // Fast client-side pre-check against the numbers on screen, so an
    // obviously-incomplete form doesn't even trigger a network round-trip.
    // The authoritative check happens again below, against freshly
    // re-fetched system values.
    if (rowsNeedingReason.length > 0) {
      setError(`กรุณาระบุเหตุผลของส่วนต่าง (${rowsNeedingReason.length} ม้วน) ก่อนบันทึก`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Re-read each roll's remainingMeters straight from the server right
      // before saving. The value shown on screen was captured when the
      // operator opened this modal; if someone else cut stock from the same
      // roll while counting was in progress, that on-screen figure is stale.
      // Always compute and save the variance against the true latest value.
      const rollIds = countedRows.map((r) => r.rollId);
      const fresh = await onFetchFreshRemaining(rollIds);

      const missingRollIds = rollIds.filter((id) => !fresh[id]);
      if (missingRollIds.length > 0) {
        const names = missingRollIds
          .map((id) => {
            const r = rolls.find((x) => x.id === id);
            return r ? `${r.lotNumber} #${r.rollNumber}` : id;
          })
          .join(', ');
        setError(`ไม่สามารถตรวจสอบยอดล่าสุดของม้วน: ${names} ได้ (อาจถูกลบ/ย้ายไปคลังเก่าไปแล้ว) กรุณาลบม้วนนี้ออกจากรอบนับแล้วลองใหม่`);
        setIsSubmitting(false);
        return;
      }

      const { sessionId, sessionLabel } = buildSessionLabel(countedAt);
      const nowIso = new Date().toISOString();

      const entries: CycleCountRecord[] = countedRows.map((r) => {
        const roll = rolls.find((x) => x.id === r.rollId)!;
        const freshData = fresh[r.rollId]!;
        const physicalMeters = round1(Number(r.physicalMeters) || 0);
        // Use the just-fetched system figure, not the possibly-stale one
        // from when the modal was opened.
        const systemMeters = freshData.remainingMeters;
        const variance = round1(physicalMeters - systemMeters);
        return {
          id: `cc_${sessionId}_${roll.id}_${Date.now()}`,
          sessionId,
          sessionLabel,
          rollId: roll.id,
          lotNumber: roll.lotNumber,
          rollNumber: roll.rollNumber,
          pattern: roll.pattern,
          width: roll.width,
          systemMeters,
          physicalMeters,
          varianceMeters: variance,
          reason: r.reason.trim() || undefined,
          countedBy: recordedBy.trim(),
          countedAt: countedAt || today(),
          adjustmentApplied: false,
          createdAt: nowIso,
        };
      });

      // Re-validate the reason requirement against the FRESH variance —
      // stock may have moved since the operator typed their numbers, so a
      // roll that looked fine on screen could now show a real variance
      // (or vice versa). This is the authoritative check, not the one above.
      const stillNeedsReason = entries.filter((e) => e.varianceMeters !== 0 && !e.reason);
      if (stillNeedsReason.length > 0) {
        setError(
          `ยอดในระบบเปลี่ยนไปตั้งแต่เริ่มนับ (มีการตัดสต๊อกม้วนนี้ระหว่างที่กำลังนับ) กรุณาตรวจสอบส่วนต่างอีกครั้งและระบุเหตุผลสำหรับ: ${
            stillNeedsReason.map((e) => `${e.lotNumber} #${e.rollNumber}`).join(', ')
          }`
        );
        setIsSubmitting(false);
        return;
      }

      await onSaveSession(entries);
      saveRecentOperator(recordedBy.trim());
      setLastSavedEntries(entries);
      setRows({});
      // Invalidate the cached History/Compare data so the next time either
      // tab is opened it re-fetches and includes what was just saved,
      // instead of silently showing a stale list from before this save.
      setHistory(null);
      setCompareSessionA('');
      setCompareSessionB('');
    } catch (err: any) {
      setError(err?.message || 'บันทึกผลตรวจนับไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApply = async (entry: CycleCountRecord) => {
    if (!onApplyAdjustment) return;
    setApplyingRollId(entry.rollId);
    try {
      await onApplyAdjustment(entry);
      setAppliedRollIds((prev) => new Set(prev).add(entry.rollId));
    } finally {
      setApplyingRollId(null);
    }
  };

  const handleOpenHistory = async () => {
    setActiveView('history');
    if (history !== null) return;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await onLoadHistory();
      setHistory(data);
    } catch (err: any) {
      setHistoryError(err?.message || 'ไม่สามารถโหลดประวัติตรวจนับได้');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenCompare = async () => {
    setActiveView('compare');
    if (history !== null) return;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await onLoadHistory();
      setHistory(data);
    } catch (err: any) {
      setHistoryError(err?.message || 'ไม่สามารถโหลดประวัติตรวจนับได้');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteEntry = async (entry: CycleCountRecord) => {
    if (!window.confirm(`ยืนยันลบรายการนับ ${entry.lotNumber} #${entry.rollNumber} (${entry.sessionLabel})?`)) return;
    setDeletingId(entry.id);
    try {
      await onDeleteEntry(entry.id);
      setHistory((prev) => (prev ? prev.filter((h) => h.id !== entry.id) : prev));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSession = async (sessionId: string, sessionLabel: string) => {
    if (!window.confirm(`ยืนยันลบประวัติการตรวจนับทั้งรอบ "${sessionLabel}"? การลบนี้ไม่สามารถกู้คืนได้`)) return;
    setDeletingId(sessionId);
    try {
      await onDeleteSession(sessionId);
      setHistory((prev) => (prev ? prev.filter((h) => h.sessionId !== sessionId) : prev));
    } finally {
      setDeletingId(null);
    }
  };

  // Group history entries by sessionId for a readable view
  const historyBySession = useMemo(() => {
    if (!history) return [];
    const map = new Map<string, { sessionLabel: string; countedAt: string; entries: CycleCountRecord[] }>();
    history.forEach((h) => {
      const key = h.sessionId;
      if (!map.has(key)) {
        map.set(key, { sessionLabel: h.sessionLabel, countedAt: h.countedAt, entries: [] });
      }
      map.get(key)!.entries.push(h);
    });
    return Array.from(map.entries())
      .map(([sessionId, v]) => ({ sessionId, ...v }))
      .sort((a, b) => (b.entries[0]?.createdAt || '').localeCompare(a.entries[0]?.createdAt || ''));
  }, [history]);

  // Default to comparing the two most recent sessions once history loads
  React.useEffect(() => {
    if (historyBySession.length >= 2 && !compareSessionA && !compareSessionB) {
      setCompareSessionA(historyBySession[1].sessionId);
      setCompareSessionB(historyBySession[0].sessionId);
    }
  }, [historyBySession, compareSessionA, compareSessionB]);

  // Build a per-roll comparison table between the two selected sessions
  const comparisonRows = useMemo(() => {
    const sessionA = historyBySession.find((s) => s.sessionId === compareSessionA);
    const sessionB = historyBySession.find((s) => s.sessionId === compareSessionB);
    if (!sessionA || !sessionB) return [];

    const mapA = new Map(sessionA.entries.map((e) => [e.rollId, e]));
    const mapB = new Map(sessionB.entries.map((e) => [e.rollId, e]));
    const allRollIds = new Set([...mapA.keys(), ...mapB.keys()]);

    return Array.from(allRollIds)
      .map((rollId) => {
        const a = mapA.get(rollId) || null;
        const b = mapB.get(rollId) || null;
        const label = a || b!;
        const changeVsPrevious =
          a && b ? round1(b.varianceMeters - a.varianceMeters) : null;
        return { rollId, lotNumber: label.lotNumber, rollNumber: label.rollNumber, a, b, changeVsPrevious };
      })
      .sort((x, y) => x.lotNumber.localeCompare(y.lotNumber) || x.rollNumber.localeCompare(y.rollNumber));
  }, [historyBySession, compareSessionA, compareSessionB]);

  // All hooks (useState/useMemo/useEffect) above this line must run on
  // every render regardless of `isOpen` — the early return has to come
  // after every one of them, or React throws "Rendered fewer hooks than
  // expected" (minified error #310) the moment the modal is opened.
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold leading-tight truncate">
                ระบบตรวจนับสต๊อกประจำเดือน (Physical Cycle Count)
              </h2>
              <p className="text-[11px] text-slate-400">
                เทียบยอดนับจริงหน้างานกับยอดในระบบ พร้อมบันทึกเหตุผลส่วนต่าง
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { if (!isSubmitting) onClose(); }}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub tabs */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('count')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeView === 'count' ? 'bg-slate-900 text-amber-400' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            ตรวจนับรอบนี้
          </button>
          <button
            type="button"
            onClick={handleOpenHistory}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeView === 'history' ? 'bg-slate-900 text-amber-400' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>ประวัติการตรวจนับ</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCompare}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeView === 'compare' ? 'bg-slate-900 text-amber-400' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>เปรียบเทียบรายเดือน</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-sm">
          {activeView === 'count' ? (
            <>
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {lastSavedEntries && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>บันทึกผลตรวจนับสำเร็จ {lastSavedEntries.length} ม้วน</span>
                  </div>
                  {lastSavedEntries.some((e) => e.varianceMeters !== 0) && onApplyAdjustment && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px]">พบส่วนต่าง — กดปรับยอดในระบบให้ตรงกับของจริงได้ทีละม้วน:</p>
                      {lastSavedEntries.filter((e) => e.varianceMeters !== 0).map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-2 bg-white/70 rounded-lg px-2.5 py-1.5">
                          <span className="text-[11px] font-mono">
                            {e.lotNumber} #{e.rollNumber}: ระบบ {formatMeters(e.systemMeters)} → จริง {formatMeters(e.physicalMeters)} ม.
                            <strong className={e.varianceMeters > 0 ? ' text-emerald-700' : ' text-rose-700'}>
                              {' '}({e.varianceMeters > 0 ? '+' : ''}{formatMeters(e.varianceMeters)} ม.)
                            </strong>
                          </span>
                          {appliedRollIds.has(e.rollId) ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shrink-0">ปรับแล้ว</span>
                          ) : canEdit ? (
                            <button
                              type="button"
                              onClick={() => handleApply(e)}
                              disabled={applyingRollId === e.rollId}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shrink-0 cursor-pointer disabled:opacity-60 flex items-center gap-1"
                            >
                              {applyingRollId === e.rollId ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
                              <span>ปรับยอด</span>
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Session meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    ผู้ตรวจนับ
                  </label>
                  <input
                    type="text"
                    list="cycle-count-operators"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    placeholder="ชื่อผู้ตรวจนับ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                  <datalist id="cycle-count-operators">
                    {recentOperators.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    วันที่ตรวจนับ
                  </label>
                  <input
                    type="date"
                    value={countedAt}
                    onChange={(e) => setCountedAt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาล็อต / เบอร์ม้วน / ลาย..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>กรอกเฉพาะม้วนที่ตรวจนับจริงหน้างาน ม้วนที่ไม่กรอกจะไม่ถูกบันทึกในรอบนี้ ถ้ายอดนับจริงไม่ตรงกับระบบ ต้องระบุเหตุผลก่อนจึงจะบันทึกได้</span>
              </div>

              {/* Roll rows */}
              <div className="space-y-2">
                {filteredRolls.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-mono">ไม่พบม้วนฟอยล์ที่ตรงกับการค้นหา</div>
                ) : (
                  filteredRolls.map((roll) => {
                    const row = getRow(roll.id);
                    const physical = row.physicalMeters.trim() === '' ? null : Number(row.physicalMeters);
                    const variance = physical !== null ? round1(physical - roll.remainingMeters) : null;
                    const needsReason = variance !== null && variance !== 0;
                    return (
                      <div key={roll.id} className={`p-3 rounded-xl border space-y-2 ${
                        row.counted && needsReason && !row.reason.trim()
                          ? 'bg-amber-50 border-amber-300'
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-xs">
                            <span className="font-bold text-slate-900">ล็อต {roll.lotNumber}</span>
                            <span className="text-slate-500"> • เบอร์ #{roll.rollNumber} • ลาย {roll.pattern} • หน้า {roll.width} มม.</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            ระบบ: <strong className="text-slate-800">{formatMeters(roll.remainingMeters)} ม.</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">นับจริง:</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              value={row.physicalMeters}
                              onChange={(e) => updateRow(roll.id, { physicalMeters: e.target.value })}
                              placeholder="เมตร"
                              className="w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                            />
                            <span className="text-[11px] text-slate-400">ม.</span>
                          </div>
                          {variance !== null && (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              variance === 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : variance > 0
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-rose-100 text-rose-800'
                            }`}>
                              {variance === 0 ? 'ตรงกัน' : `${variance > 0 ? '+' : ''}${formatMeters(variance)} ม.`}
                            </span>
                          )}
                        </div>
                        {needsReason && (
                          <input
                            type="text"
                            value={row.reason}
                            onChange={(e) => updateRow(roll.id, { reason: e.target.value })}
                            placeholder="ระบุเหตุผลของส่วนต่าง (เช่น นับผิด, ฟอยล์ตกหล่นเสียหาย, ยืมข้ามไลน์) *จำเป็น"
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs ${
                              row.reason.trim() ? 'bg-white border-slate-300' : 'bg-amber-50 border-amber-400'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : activeView === 'history' ? (
            <>
              {historyError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs">{historyError}</div>
              )}
              {isLoadingHistory ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>กำลังโหลดประวัติการตรวจนับ...</span>
                </div>
              ) : historyBySession.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-mono">ยังไม่มีประวัติการตรวจนับสต๊อก</div>
              ) : (
                <div className="space-y-3">
                  {historyBySession.map((session) => {
                    const varianceCount = session.entries.filter((e) => e.varianceMeters !== 0).length;
                    return (
                      <div key={session.sessionId} className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-3 py-2 bg-slate-100 flex items-center justify-between flex-wrap gap-1.5">
                          <span className="font-bold text-xs text-slate-800">{session.sessionLabel}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-mono">
                              นับ {session.entries.length} ม้วน • พบส่วนต่าง {varianceCount} ม้วน
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSession(session.sessionId, session.sessionLabel)}
                                disabled={deletingId === session.sessionId}
                                title="ลบประวัติการตรวจนับทั้งรอบนี้"
                                className="p-1 rounded-md text-rose-500 hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                              >
                                {deletingId === session.sessionId ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {session.entries.map((e) => (
                            <div key={e.id} className="px-3 py-2 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-800">{e.lotNumber} #{e.rollNumber}</span>
                                <span className="text-slate-500"> • {e.countedBy} • {e.countedAt}</span>
                                {e.reason && <div className="text-slate-500 italic mt-0.5">เหตุผล: {e.reason}</div>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`font-mono font-bold ${
                                  e.varianceMeters === 0 ? 'text-emerald-700' : e.varianceMeters > 0 ? 'text-sky-700' : 'text-rose-700'
                                }`}>
                                  {formatMeters(e.systemMeters)} → {formatMeters(e.physicalMeters)} ม.
                                  {e.varianceMeters !== 0 && ` (${e.varianceMeters > 0 ? '+' : ''}${formatMeters(e.varianceMeters)})`}
                                </span>
                                {e.varianceMeters !== 0 && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                    e.adjustmentApplied ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {e.adjustmentApplied ? 'ปรับยอดแล้ว' : 'ยังไม่ปรับยอด'}
                                  </span>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(e)}
                                    disabled={deletingId === e.id}
                                    title="ลบรายการนี้"
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                                  >
                                    {deletingId === e.id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* COMPARE TAB: pick two counting sessions and see per-roll changes */}
              {historyError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs">{historyError}</div>
              )}
              {isLoadingHistory ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>กำลังโหลดประวัติการตรวจนับ...</span>
                </div>
              ) : historyBySession.length < 2 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-mono">
                  ต้องมีประวัติการตรวจนับอย่างน้อย 2 รอบขึ้นไปจึงจะเปรียบเทียบได้
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">รอบที่ 1 (เทียบจาก)</label>
                      <select
                        value={compareSessionA}
                        onChange={(e) => setCompareSessionA(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        {historyBySession.map((s) => (
                          <option key={s.sessionId} value={s.sessionId}>{s.sessionLabel}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">รอบที่ 2 (เทียบไป)</label>
                      <select
                        value={compareSessionB}
                        onChange={(e) => setCompareSessionB(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        {historyBySession.map((s) => (
                          <option key={s.sessionId} value={s.sessionId}>{s.sessionLabel}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {comparisonRows.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-mono">ไม่มีข้อมูลตรงกันระหว่างสองรอบนี้</div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                        {comparisonRows.map((row) => (
                          <div key={row.rollId} className="px-3 py-2 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 shrink-0">{row.lotNumber} #{row.rollNumber}</span>
                            <div className="flex items-center gap-3 flex-wrap font-mono">
                              <span className={row.a ? (row.a.varianceMeters === 0 ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-300'}>
                                {row.a ? `${row.a.varianceMeters > 0 ? '+' : ''}${formatMeters(row.a.varianceMeters)} ม.` : 'ไม่ได้นับ'}
                              </span>
                              <span className="text-slate-300">→</span>
                              <span className={row.b ? (row.b.varianceMeters === 0 ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-300'}>
                                {row.b ? `${row.b.varianceMeters > 0 ? '+' : ''}${formatMeters(row.b.varianceMeters)} ม.` : 'ไม่ได้นับ'}
                              </span>
                              {row.changeVsPrevious !== null && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                  row.changeVsPrevious === 0
                                    ? 'bg-slate-200 text-slate-600'
                                    : Math.abs(row.b!.varianceMeters) < Math.abs(row.a!.varianceMeters)
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {row.changeVsPrevious === 0
                                    ? 'ไม่เปลี่ยน'
                                    : Math.abs(row.b!.varianceMeters) < Math.abs(row.a!.varianceMeters)
                                      ? 'ดีขึ้น'
                                      : 'แย่ลง'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {activeView === 'count' && (
          <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-slate-500">
              กรอกแล้ว {countedRows.length} ม้วน
              {rowsNeedingReason.length > 0 && (
                <span className="text-amber-700 font-bold"> • ยังขาดเหตุผล {rowsNeedingReason.length} ม้วน</span>
              )}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || countedRows.length === 0 || !canEdit}
              title={!canEdit ? 'ต้องปลดล็อคโหมดคีย์ข้อมูลก่อน' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกผลตรวจนับ'}</span>
            </button>
          </div>
        )}

        {/* Blocking overlay while saving */}
        {isSubmitting && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 text-center px-6">
            <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
            <div>
              <p className="font-bold text-slate-900 text-sm">กำลังบันทึกผลตรวจนับ...</p>
              <p className="text-xs text-slate-500 mt-1">กรุณาอย่าปิดหน้าต่างนี้จนกว่าจะบันทึกสำเร็จ</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
