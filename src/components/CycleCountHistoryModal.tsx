import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  History,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Trash2,
  Lock,
} from 'lucide-react';
import { CycleCountSession, CycleCountLine } from '../types';
import { formatMeters, round2 } from '../utils/formatters';
import { fetchCycleCountSessions, deleteCycleCountSession } from '../lib/firebase';

interface CycleCountHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (text: string, type?: 'success' | 'info') => void;
  canEdit?: boolean;
  /** เรียกเมื่อ Visitor กดลบ — ให้ปลดล็อกโหมด Editor */
  onRequestUnlock?: () => void;
}

type ViewMode = 'list' | 'detail' | 'compare';

export const CycleCountHistoryModal: React.FC<CycleCountHistoryModalProps> = ({
  isOpen,
  onClose,
  showToast,
  canEdit = false,
  onRequestUnlock,
}) => {
  const [sessions, setSessions] = useState<CycleCountSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchCycleCountSessions(48);
      setSessions(items);
      // expand latest period by default
      if (items.length > 0) {
        const p = items[0].period;
        setExpandedPeriods((prev) => ({ ...prev, [p]: true }));
      }
    } catch (err: any) {
      setError(err?.message || 'โหลดประวัตินับสต๊อกไม่สำเร็จ');
      showToast?.(err?.message || 'โหลดประวัตินับสต๊อกไม่สำเร็จ', 'info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      load();
      setViewMode('list');
      setSelectedId(null);
      setCompareA('');
      setCompareB('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDelete = async (session: CycleCountSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (deletingId) return;
    if (!canEdit) {
      showToast?.('ต้องเข้าโหมด Editor ก่อนจึงลบประวัติได้', 'info');
      onRequestUnlock?.();
      return;
    }
    const label = `${session.period} (${session.status === 'completed' ? 'เสร็จสิ้น' : 'แบบร่าง'})`;
    const ok = window.confirm(
      `ลบประวัติ Cycle Count งวด ${label} ใช่หรือไม่?\n\nลบเฉพาะเอกสารประวัติงวดนี้ ไม่ลบใบปรับยอดที่บันทึกในประวัติม้วนฟอยล์แล้ว`
    );
    if (!ok) return;
    setDeletingId(session.id);
    try {
      await deleteCycleCountSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      if (selectedId === session.id) {
        setSelectedId(null);
        setViewMode('list');
      }
      if (compareA === session.id) setCompareA('');
      if (compareB === session.id) setCompareB('');
      showToast?.(`ลบประวัติ Cycle Count งวด ${session.period} แล้ว`, 'info');
    } catch (err: any) {
      setError(err?.message || 'ลบประวัติไม่สำเร็จ');
      showToast?.(err?.message || 'ลบประวัติไม่สำเร็จ', 'info');
    } finally {
      setDeletingId(null);
    }
  };

  const byPeriod = useMemo(() => {
    const map = new Map<string, CycleCountSession[]>();
    sessions.forEach((s) => {
      const list = map.get(s.period) || [];
      list.push(s);
      map.set(s.period, list);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) || null,
    [sessions, selectedId]
  );

  const sessionA = useMemo(() => sessions.find((s) => s.id === compareA) || null, [sessions, compareA]);
  const sessionB = useMemo(() => sessions.find((s) => s.id === compareB) || null, [sessions, compareB]);

  const compareRows = useMemo(() => {
    if (!sessionA || !sessionB) return [];
    const mapA = new Map(sessionA.lines.map((l) => [l.rollId, l]));
    const mapB = new Map(sessionB.lines.map((l) => [l.rollId, l]));
    const allIds = new Set([...mapA.keys(), ...mapB.keys()]);
    const rows: {
      rollId: string;
      lotNumber: string;
      rollNumber: string;
      pattern: string;
      width: string | number;
      a?: CycleCountLine;
      b?: CycleCountLine;
      physicalDiff: number;
      varianceDiff: number;
    }[] = [];
    allIds.forEach((id) => {
      const a = mapA.get(id);
      const b = mapB.get(id);
      const lotNumber = a?.lotNumber || b?.lotNumber || '';
      const rollNumber = a?.rollNumber || b?.rollNumber || '';
      const pattern = a?.pattern || b?.pattern || '';
      const width = a?.width ?? b?.width ?? '';
      const physicalDiff = round2((b?.physicalCount ?? 0) - (a?.physicalCount ?? 0));
      const varianceDiff = round2((b?.variance ?? 0) - (a?.variance ?? 0));
      rows.push({
        rollId: id,
        lotNumber,
        rollNumber,
        pattern: String(pattern),
        width,
        a,
        b,
        physicalDiff,
        varianceDiff,
      });
    });
    // prioritize rows that differ
    rows.sort((x, y) => {
      const xd = Math.abs(x.physicalDiff) + Math.abs(x.varianceDiff);
      const yd = Math.abs(y.physicalDiff) + Math.abs(y.varianceDiff);
      if (yd !== xd) return yd - xd;
      return `${x.lotNumber}${x.rollNumber}`.localeCompare(`${y.lotNumber}${y.rollNumber}`);
    });
    return rows;
  }, [sessionA, sessionB]);

  const differingCompareCount = useMemo(
    () => compareRows.filter((r) => Math.abs(r.physicalDiff) > 0.001 || Math.abs(r.varianceDiff) > 0.001).length,
    [compareRows]
  );

  if (!isOpen) return null;

  const formatPeriod = (p: string) => {
    const [y, m] = p.split('-');
    if (!y || !m) return p;
    const months = [
      '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ];
    return `${months[Number(m)] || m} ${Number(y) + 543}`;
  };

  const sessionSummary = (s: CycleCountSession) => {
    const varCount = s.lines.filter((l) => Math.abs(l.variance) > 0.001).length;
    const adjusted = s.lines.filter((l) => l.adjusted).length;
    return { varCount, adjusted, total: s.lines.length };
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-400/40 flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-violet-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold leading-tight truncate">
                ประวัติตรวจนับสต๊อก (Cycle Count)
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                ดูย้อนหลังรายเดือน · เปรียบเทียบงวดเพื่อจับข้อมูลผิดพลาด
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setSelectedId(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
              viewMode === 'list'
                ? 'bg-slate-900 text-amber-400 border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            รายการตามเดือน
          </button>
          <button
            type="button"
            onClick={() => setViewMode('compare')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
              viewMode === 'compare'
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            เปรียบเทียบงวด
          </button>
          {viewMode === 'detail' && selectedSession && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              รายละเอียด · {formatPeriod(selectedSession.period)}
            </span>
          )}
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0">
          {loading && sessions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              กำลังโหลดประวัติ...
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <ClipboardList className="w-10 h-10 mx-auto opacity-40" />
              <p className="font-semibold text-slate-600">ยังไม่มีประวัติ Cycle Count</p>
              <p className="text-xs">เมื่อบันทึกงวดนับสต๊อก ระบบจะแสดงที่นี่</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-3">
              {byPeriod.map(([period, list]) => {
                const open = expandedPeriods[period] !== false;
                return (
                  <div key={period} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPeriods((prev) => ({
                          ...prev,
                          [period]: !open,
                        }))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2">
                        {open ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <span className="font-bold text-slate-900 text-sm">{formatPeriod(period)}</span>
                        <span className="text-[10px] font-mono text-slate-400">{period}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {list.length} ครั้งที่บันทึก
                      </span>
                    </button>
                    {open && (
                      <div className="divide-y divide-slate-100">
                        {list.map((s) => {
                          const sum = sessionSummary(s);
                          return (
                            <div
                              key={s.id}
                              className="px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3 hover:bg-amber-50/50 transition-colors"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedId(s.id);
                                  setViewMode('detail');
                                }}
                                className="flex-1 min-w-[140px] text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      s.status === 'completed'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {s.status === 'completed' ? 'เสร็จสิ้น' : 'แบบร่าง'}
                                  </span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    {s.completedAt || s.createdAt
                                      ? new Date(s.completedAt || s.createdAt).toLocaleString('th-TH')
                                      : '—'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  ผู้ตรวจนับ: <strong>{s.countedBy || '—'}</strong>
                                  {s.notes ? ` · ${s.notes}` : ''}
                                </p>
                              </button>
                              <div className="flex items-center gap-3 text-[11px] text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  {sum.total} ม้วน
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  ส่วนต่าง {sum.varCount}
                                </span>
                                <span className="text-violet-700 font-semibold">
                                  ปรับยอด {sum.adjusted}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedId(s.id);
                                    setViewMode('detail');
                                  }}
                                  className="text-[11px] text-amber-700 font-bold cursor-pointer hover:underline px-1"
                                >
                                  ดูรายละเอียด
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(s, e)}
                                  disabled={deletingId === s.id}
                                  title={
                                    canEdit
                                      ? 'ลบประวัติงวดนี้'
                                      : 'ต้องเข้าโหมด Editor ก่อนลบ'
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer disabled:opacity-50 shrink-0 ${
                                    canEdit
                                      ? 'border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                  }`}
                                >
                                  {canEdit ? (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  ) : (
                                    <Lock className="w-3.5 h-3.5" />
                                  )}
                                  {deletingId === s.id ? 'กำลังลบ...' : 'ลบประวัติ'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'detail' && selectedSession ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('list');
                    setSelectedId(null);
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  ← กลับรายการ
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-500">
                    งวด <strong className="text-slate-800">{formatPeriod(selectedSession.period)}</strong>
                    {' · '}
                    {selectedSession.status === 'completed' ? 'เสร็จสิ้น' : 'แบบร่าง'}
                    {selectedSession.countedBy ? ` · ${selectedSession.countedBy}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedSession)}
                    disabled={deletingId === selectedSession.id}
                    title={canEdit ? 'ลบประวัติงวดนี้' : 'ต้องเข้าโหมด Editor ก่อนลบ'}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                      canEdit
                        ? 'border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {canEdit ? (
                      <Trash2 className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    {deletingId === selectedSession.id ? 'กำลังลบ...' : 'ลบประวัติ'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs min-w-[640px]">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold">ล็อต / เบอร์</th>
                      <th className="text-left px-3 py-2 font-bold">ลาย · หน้า</th>
                      <th className="text-right px-3 py-2 font-bold">ยอดระบบ</th>
                      <th className="text-right px-3 py-2 font-bold">นับจริง</th>
                      <th className="text-right px-3 py-2 font-bold">ส่วนต่าง</th>
                      <th className="text-left px-3 py-2 font-bold">เหตุผล</th>
                      <th className="text-center px-3 py-2 font-bold">ปรับยอด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSession.lines.map((l) => {
                      const hasVar = Math.abs(l.variance) > 0.001;
                      return (
                        <tr
                          key={l.rollId}
                          className={`border-t border-slate-100 ${hasVar ? 'bg-amber-50/60' : 'bg-white'}`}
                        >
                          <td className="px-3 py-2 font-mono font-semibold">
                            {l.lotNumber} #{l.rollNumber}
                          </td>
                          <td className="px-3 py-2">
                            {l.pattern} · {l.width} มม.
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatMeters(l.systemRemaining)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {formatMeters(l.physicalCount)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono font-bold ${
                              hasVar
                                ? l.variance > 0
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                                : 'text-slate-300'
                            }`}
                          >
                            {hasVar
                              ? (l.variance > 0 ? '+' : '') + formatMeters(l.variance)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{l.reason || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            {l.adjusted ? (
                              <span className="text-emerald-700 font-bold">✓</span>
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
            </div>
          ) : viewMode === 'compare' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-violet-50/80 border border-violet-200">
                <div>
                  <label className="block text-[10px] font-bold text-violet-800 uppercase mb-1">
                    งวด A (ฐาน)
                  </label>
                  <select
                    value={compareA}
                    onChange={(e) => setCompareA(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-violet-200 bg-white text-xs font-medium cursor-pointer"
                  >
                    <option value="">— เลือกงวด —</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatPeriod(s.period)} ·{' '}
                        {s.status === 'completed' ? 'เสร็จ' : 'ร่าง'} ·{' '}
                        {new Date(s.createdAt).toLocaleDateString('th-TH')}
                        {s.countedBy ? ` · ${s.countedBy}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-violet-800 uppercase mb-1">
                    งวด B (เทียบ)
                  </label>
                  <select
                    value={compareB}
                    onChange={(e) => setCompareB(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-violet-200 bg-white text-xs font-medium cursor-pointer"
                  >
                    <option value="">— เลือกงวด —</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatPeriod(s.period)} ·{' '}
                        {s.status === 'completed' ? 'เสร็จ' : 'ร่าง'} ·{' '}
                        {new Date(s.createdAt).toLocaleDateString('th-TH')}
                        {s.countedBy ? ` · ${s.countedBy}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!sessionA || !sessionB ? (
                <p className="text-center text-sm text-slate-500 py-10">
                  เลือก 2 งวดเพื่อเปรียบเทียบยอดนับจริงและส่วนต่าง
                  <br />
                  <span className="text-xs text-slate-400">
                    ใช้จับกรณีลงข้อมูลผิด หรือยอดเปลี่ยนระหว่างเดือน
                  </span>
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                    <span>
                      เปรียบเทียบ{' '}
                      <strong>{formatPeriod(sessionA.period)}</strong> →{' '}
                      <strong>{formatPeriod(sessionB.period)}</strong>
                    </span>
                    <span className="text-amber-700 font-semibold">
                      ม้วนที่ยอดต่างกัน {differingCompareCount} จาก {compareRows.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="text-left px-3 py-2 font-bold">ล็อต / เบอร์</th>
                          <th className="text-right px-3 py-2 font-bold">นับจริง A</th>
                          <th className="text-right px-3 py-2 font-bold">นับจริง B</th>
                          <th className="text-right px-3 py-2 font-bold">Δ นับจริง</th>
                          <th className="text-right px-3 py-2 font-bold">Var A</th>
                          <th className="text-right px-3 py-2 font-bold">Var B</th>
                          <th className="text-left px-3 py-2 font-bold">เหตุผล B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareRows.map((r) => {
                          const differs =
                            Math.abs(r.physicalDiff) > 0.001 || Math.abs(r.varianceDiff) > 0.001;
                          return (
                            <tr
                              key={r.rollId}
                              className={`border-t border-slate-100 ${
                                differs ? 'bg-amber-50/70' : 'bg-white'
                              }`}
                            >
                              <td className="px-3 py-2 font-mono font-semibold">
                                {r.lotNumber} #{r.rollNumber}
                                <span className="block text-[10px] text-slate-400 font-sans font-normal">
                                  {r.pattern} · {r.width} มม.
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {r.a ? formatMeters(r.a.physicalCount) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {r.b ? formatMeters(r.b.physicalCount) : '—'}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-mono font-bold ${
                                  Math.abs(r.physicalDiff) > 0.001
                                    ? r.physicalDiff > 0
                                      ? 'text-emerald-700'
                                      : 'text-rose-700'
                                    : 'text-slate-300'
                                }`}
                              >
                                {Math.abs(r.physicalDiff) > 0.001
                                  ? (r.physicalDiff > 0 ? '+' : '') + formatMeters(r.physicalDiff)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-slate-600">
                                {r.a && Math.abs(r.a.variance) > 0.001
                                  ? formatMeters(r.a.variance)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-slate-600">
                                {r.b && Math.abs(r.b.variance) > 0.001
                                  ? formatMeters(r.b.variance)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{r.b?.reason || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-white flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
