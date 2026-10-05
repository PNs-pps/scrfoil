import React, { useRef, useState, useEffect, useMemo } from 'react';
import { FoilRoll, StockCutRecord, PuSandwichCutRecord } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS, getCanonicalPatternStyle } from '../utils/soFormatter';
import { formatMeters, todayLocalISO } from '../utils/formatters';
import {
  Package,
  Scissors,
  AlertOctagon,
  Layers,
  ArrowRight,
  Sparkles,
  ClipboardCheck,
  CalendarDays,
  Factory,
  Scale,
  TrendingUp,
  Workflow
} from 'lucide-react';
import { MonthlyFoilUsageBarChart } from './MonthlyFoilUsageBarChart';

export type MonthlySummaryScope = 'all' | 'foil' | 'sandwich';

interface DashboardOverviewProps {
  rolls: FoilRoll[];
  records: StockCutRecord[];
  puRecords?: PuSandwichCutRecord[];
  archivedRolls?: FoilRoll[];
  archiveLoaded?: boolean;
  onLoadArchive?: () => void | Promise<void>;
  onOpenCutModal: (rollId?: string) => void;
  onOpenAddModal: () => void;
  onOpenDailyFlow?: () => void;
  onViewAllRolls: () => void;
  onViewAllHistory?: (category?: 'all' | 'foil' | 'sandwich') => void;
  onOpenMonthlySummary?: (scope?: MonthlySummaryScope) => void;
  onOpenCycleCount?: () => void;
  onOpenBatchImport?: () => void;
  onDoubleBackup?: () => Promise<void> | void;
  isDoubleBackingUp?: boolean;
  lastDoubleBackupTime?: string | null;
  showToast?: (text: string, type?: 'success' | 'info') => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  rolls,
  records,
  puRecords = [],
  archivedRolls = [],
  archiveLoaded = false,
  onLoadArchive,
  onOpenCutModal,
  onOpenAddModal,
  onOpenDailyFlow,
  onViewAllRolls,
  onViewAllHistory,
  onOpenMonthlySummary,
  onOpenCycleCount,
  onDoubleBackup,
  isDoubleBackingUp = false,
  lastDoubleBackupTime,
  showToast,
}) => {
  const [dashboardTab, setDashboardTab] = useState<'all' | 'foil' | 'sandwich'>('all');

  // โหลดคลังเก่าอัตโนมัติเมื่อเข้าแดชบอร์ดเพื่อให้ยอด "หมดแล้ว" แม่นยำ
  useEffect(() => {
    if (!archiveLoaded && onLoadArchive) {
      void onLoadArchive();
    }
  }, [archiveLoaded, onLoadArchive]);

  // วันนี้
  const todayStr = todayLocalISO();

  // --- FOIL METRICS ---
  const totalRemainingMeters = rolls.reduce((acc, r) => acc + Math.max(0, Number(r.remainingMeters) || 0), 0);
  const totalOriginalMeters = rolls.reduce((acc, r) => acc + r.totalMeters, 0);
  const totalUsedMeters = records.reduce((acc, r) => acc + r.usedMeters, 0);
  const totalNgMeters = records.reduce((acc, r) => acc + r.ngMeters, 0);
  const totalDeductedMeters = totalUsedMeters + totalNgMeters;
  const ngRatePercent =
    totalDeductedMeters > 0
      ? ((totalNgMeters / totalDeductedMeters) * 100).toFixed(1)
      : '0.0';

  const activeRolls = rolls.filter(
    (r) => Number(r.remainingMeters) > 0 && !r.isZeroedOut && r.status !== 'depleted'
  );
  const localDepleted = rolls.filter(
    (r) => Number(r.remainingMeters) <= 0 || r.isZeroedOut || r.status === 'depleted'
  );
  const depletedCount = archiveLoaded
    ? new Set([...localDepleted.map((r) => r.id), ...archivedRolls.map((r) => r.id)]).size
    : localDepleted.length;
  const redAlertRolls = activeRolls.filter((r) => r.remainingMeters > 0 && r.remainingMeters <= 50);
  const yellowAlertRolls = activeRolls.filter(
    (r) => r.remainingMeters > 50 && r.remainingMeters <= 200
  );
  const remainPct =
    totalOriginalMeters > 0
      ? Math.round((totalRemainingMeters / totalOriginalMeters) * 100)
      : 0;

  // --- PU SANDWICH METRICS ---
  const safePuRecords = useMemo(() => Array.isArray(puRecords) ? puRecords : [], [puRecords]);

  const sandwichStats = useMemo(() => {
    let totalKg = 0;
    let externalSteelKg = 0;
    let blueScopeKg = 0;
    let otherSteelKg = 0;
    let totalNgKg = 0;
    let totalNgMeters = 0;
    let totalSoMeters = 0;
    let todayCount = 0;

    safePuRecords.forEach((r) => {
      const w = Number(r.weightUsed) || 0;
      totalKg += w;
      totalSoMeters += Number(r.soLengthMeters) || 0;
      if (r.steelOrigin === 'เหล็กนอก') externalSteelKg += w;
      else if (r.steelOrigin === 'เหล็กBlue Scope') blueScopeKg += w;
      else otherSteelKg += w;

      totalNgKg += Number(r.ngKg) || 0;
      totalNgMeters += Number(r.ngMeters) || 0;

      const d = (r.productionDate || r.createdAt || '').slice(0, 10);
      if (d === todayStr) todayCount += 1;
    });

    const ngPercent = totalKg > 0 ? ((totalNgKg / totalKg) * 100).toFixed(1) : '0.0';
    const externalPct = totalKg > 0 ? Math.round((externalSteelKg / totalKg) * 100) : 0;
    const blueScopePct = totalKg > 0 ? Math.round((blueScopeKg / totalKg) * 100) : 0;
    const otherPct = totalKg > 0 ? Math.round((otherSteelKg / totalKg) * 100) : 0;

    return {
      count: safePuRecords.length,
      todayCount,
      totalKg: Math.round(totalKg * 100) / 100,
      totalTons: Math.round((totalKg / 1000) * 100) / 100,
      totalSoMeters: Math.round(totalSoMeters * 10) / 10,
      totalNgKg: Math.round(totalNgKg * 100) / 100,
      totalNgMeters: Math.round(totalNgMeters * 10) / 10,
      ngPercent,
      externalSteelKg,
      externalPct,
      blueScopeKg,
      blueScopePct,
      otherSteelKg,
      otherPct,
    };
  }, [safePuRecords, todayStr]);

  // วันนี้ยอดตัดรวม
  const todayFoilCount = records.filter(
    (r) => (r.usageDate || r.recordedDate || r.createdAt || '').slice(0, 10) === todayStr
  ).length;
  const todayTotalCuts = todayFoilCount + sandwichStats.todayCount;

  // สถิติลายฟอยล์
  const patternStats = useMemo(() => {
    const stats = STANDARD_PATTERNS.map((p) => {
      const matchedRolls = rolls.filter((r) => r.pattern === p.value);
      const remaining = matchedRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
      const total = matchedRolls.reduce((sum, r) => sum + r.totalMeters, 0);
      const count = matchedRolls.filter((r) => r.remainingMeters > 0).length;
      return {
        name: p.value,
        label: p.label,
        remaining,
        total,
        count,
        percent: total > 0 ? Math.round((remaining / total) * 100) : 0,
      };
    });

    const customPatterns: string[] = Array.from(
      new Set(rolls.map((r) => r.pattern).filter((p) => !STANDARD_PATTERNS.some((sp) => sp.value === p)))
    );
    customPatterns.forEach((cp: string) => {
      const matchedRolls = rolls.filter((r) => r.pattern === cp);
      const remaining = matchedRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
      const total = matchedRolls.reduce((sum, r) => sum + r.totalMeters, 0);
      const count = matchedRolls.filter((r) => r.remainingMeters > 0).length;
      stats.push({
        name: cp,
        label: cp,
        remaining,
        total,
        count,
        percent: total > 0 ? Math.round((remaining / total) * 100) : 0,
      });
    });
    return stats;
  }, [rolls]);

  // สถิติหน้ากว้างฟอยล์
  const widthStats = useMemo(() => {
    return STANDARD_WIDTHS.map((w) => {
      const matchedRolls = rolls.filter((r) => r.width === w);
      const remaining = matchedRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
      const total = matchedRolls.reduce((sum, r) => sum + r.totalMeters, 0);
      const count = matchedRolls.filter((r) => r.remainingMeters > 0).length;
      return {
        width: w,
        remaining,
        total,
        count,
        percent: total > 0 ? Math.round((remaining / total) * 100) : 0,
      };
    });
  }, [rolls]);

  // Unified KPI Slide Cards
  const kpiCards = useMemo(() => {
    return [
      {
        id: 'remain',
        label: 'ฟอยล์คงเหลือรวม',
        value: formatMeters(totalRemainingMeters),
        unit: 'เมตร',
        accent: 'amber',
        icon: Layers,
        badge: `${remainPct}% จากลูกเต็ม`,
        footer: (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>จากลูกเต็ม {formatMeters(totalOriginalMeters)} ม.</span>
              <span className="font-bold text-amber-700">{remainPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, remainPct)}%` }}
              />
            </div>
          </div>
        ),
      },
      {
        id: 'rolls',
        label: 'ม้วนฟอยล์พร้อมใช้',
        value: String(activeRolls.length),
        unit: 'ม้วน',
        accent: 'emerald',
        icon: Package,
        badge: `หมดแล้ว ${depletedCount} ม้วน`,
        footer: (
          <div className="space-y-1">
            <p className="text-[11px] text-slate-500">
              หมดแล้ว{' '}
              <span className="font-mono font-semibold text-rose-700">{depletedCount}</span> ม้วน
              {!archiveLoaded ? <span className="text-slate-400"> (กำลังโหลด...)</span> : null}
            </p>
            {redAlertRolls.length > 0 && (
              <p className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                ใกล้หมด ≤50ม. ({redAlertRolls.length} ม้วน)
              </p>
            )}
            {yellowAlertRolls.length > 0 && (
              <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                เหลือน้อย ≤200ม. ({yellowAlertRolls.length} ม้วน)
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'sandwich',
        label: 'การผลิต PU แซนวิช',
        value: String(sandwichStats.count),
        unit: 'ใบงาน',
        accent: 'emerald',
        icon: Factory,
        badge: `${sandwichStats.totalTons} ตันเหล็ก`,
        footer: (
          <div className="space-y-1">
            <p className="text-[11px] text-slate-600">
              น้ำหนักเหล็ก: <strong className="text-slate-900 font-mono">{sandwichStats.totalKg.toLocaleString()}</strong> กก.
            </p>
            <p className="text-[11px] text-slate-500">
              ความยาวผลิต: <span className="font-mono font-semibold text-slate-700">{sandwichStats.totalSoMeters.toLocaleString()}</span> ม.
            </p>
          </div>
        ),
      },
      {
        id: 'ng',
        label: 'NG ฟอยล์ & เสียหาย',
        value: formatMeters(totalNgMeters),
        unit: 'เมตร',
        accent: 'rose',
        icon: AlertOctagon,
        badge: `${ngRatePercent}% เสีย`,
        footer: (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">อัตรา NG ฟอยล์</span>
            <span className="text-[11px] font-bold font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
              {ngRatePercent}%
            </span>
          </div>
        ),
      },
    ];
  }, [
    totalRemainingMeters,
    remainPct,
    totalOriginalMeters,
    activeRolls.length,
    depletedCount,
    archiveLoaded,
    redAlertRolls.length,
    yellowAlertRolls.length,
    sandwichStats,
    totalNgMeters,
    ngRatePercent,
  ]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const cardW = el.scrollWidth / kpiCards.length;
      const idx = Math.round(el.scrollLeft / Math.max(cardW, 1));
      setActiveSlide(Math.min(kpiCards.length - 1, Math.max(0, idx)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [kpiCards.length]);

  return (
    <div className="space-y-4 pb-6">
      {/* Compact Hero Header (≤ ~1/8 screen height) */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-900 text-white px-3 py-2.5 shadow-sm border border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 tracking-wide shrink-0">
              ร่มเกล้า
            </span>
            <h2 className="text-sm font-bold tracking-tight text-white truncate">
              ภาพรวมสต๊อก
              {todayTotalCuts > 0 && (
                <span className="ml-1.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  วันนี้ {todayTotalCuts}
                </span>
              )}
            </h2>
          </div>

          {/* Compact Quick Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenDailyFlow && (
              <button
                type="button"
                onClick={onOpenDailyFlow}
                title="ผังผลิตรายวัน"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-[11px] font-bold shadow-sm transition-all duration-200 active:scale-95 cursor-pointer"
              >
                <Workflow className="w-3.5 h-3.5 stroke-[2.4]" />
                <span className="hidden xs:inline">Flow</span>
              </button>
            )}
            {onOpenMonthlySummary && (
              <div className="flex items-center rounded-lg overflow-hidden border border-white/15 bg-white/10 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => onOpenMonthlySummary('all')}
                  className="px-1.5 py-1 hover:bg-white/20 text-white cursor-pointer border-r border-white/15"
                  title="สรุปรวม"
                >
                  รวม
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMonthlySummary('foil')}
                  className="px-1.5 py-1 hover:bg-white/20 text-amber-300 cursor-pointer border-r border-white/15"
                  title="สรุปฟอยล์"
                >
                  ฟอยล์
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMonthlySummary('sandwich')}
                  className="px-1.5 py-1 hover:bg-white/20 text-emerald-300 cursor-pointer"
                  title="สรุปแซนวิช"
                >
                  แซน
                </button>
              </div>
            )}
            {onOpenCycleCount && (
              <button
                type="button"
                onClick={onOpenCycleCount}
                title="ตรวจนับสต๊อก"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold cursor-pointer border border-slate-700 transition-colors"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setDashboardTab('all')}
            className={`flex-1 px-2 py-1 rounded-md font-bold transition-all duration-200 cursor-pointer ${
              dashboardTab === 'all'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('foil')}
            className={`flex-1 px-2 py-1 rounded-md font-bold transition-all duration-200 cursor-pointer ${
              dashboardTab === 'foil'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ฟอยล์ ({activeRolls.length})
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('sandwich')}
            className={`flex-1 px-2 py-1 rounded-md font-bold transition-all duration-200 cursor-pointer ${
              dashboardTab === 'sandwich'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            แซนวิช ({sandwichStats.count})
          </button>
        </div>
      </div>

      {/* KPI Cards Horizontal Scroller */}
      <div className="-mx-1">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
            ตัวชี้วัดหลัก (Key Metrics)
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">เลื่อนดูการ์ด →</span>
        </div>
        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="snap-center shrink-0 w-[78vw] max-w-[280px] sm:w-[260px] bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col transition-all hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      {card.label}
                    </span>
                    {card.badge && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 mt-0.5 inline-block">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    card.accent === 'amber' ? 'bg-amber-50 text-amber-600' :
                    card.accent === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    card.accent === 'rose' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'
                  }`}>
                    <Icon className="w-5 h-5 stroke-[2.2]" />
                  </div>
                </div>
                <div className="mt-3 text-2xl sm:text-3xl font-bold font-mono tracking-tight text-slate-900">
                  {card.value}{' '}
                  <span className="text-sm font-normal text-slate-400">{card.unit}</span>
                </div>
                <div className="mt-auto pt-3 border-t border-slate-100">{card.footer}</div>
              </div>
            );
          })}
        </div>
        {/* Indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-1">
          {kpiCards.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-label={`ไปการ์ด ${i + 1}`}
              onClick={() => {
                const el = scrollerRef.current;
                if (!el) return;
                const cardW = el.scrollWidth / kpiCards.length;
                el.scrollTo({ left: cardW * i, behavior: 'smooth' });
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeSlide === i ? 'w-5 bg-amber-500' : 'w-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* SECTION: PU SANDWICH DASHBOARD (ย้ายมาจากเมนูแซนวิชเดิมตามคำขอ) */}
      {(dashboardTab === 'all' || dashboardTab === 'sandwich') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <Factory className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-slate-950 uppercase">
                    PU Sandwich
                  </span>
                  <span className="text-xs text-emerald-200/80 font-medium hidden sm:inline">
                    ไม่ใช้ฟอยล์ · บันทึกน้ำหนักคอยล์เหล็ก
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  แดชบอร์ดผลิต PU แซนวิช
                </h3>
              </div>
            </div>

            {/* ปุ่มบันทึกผลิตแซนวิชถูกลบตามคำขอ (เข้าถึงได้จากเมนูอื่น) */}
          </div>

          {/* Sandwich Summary Grid */}
          <div className="p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/60">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium block">น้ำหนักเหล็กที่ใช้รวม</span>
              <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
                {sandwichStats.totalKg.toLocaleString()} <span className="text-xs text-slate-500 font-normal">กก.</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold mt-0.5 block font-mono">
                {sandwichStats.totalTons} ตัน
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium block">ความยาวผลิต SO รวม</span>
              <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
                {sandwichStats.totalSoMeters.toLocaleString()} <span className="text-xs text-slate-500 font-normal">เมตร</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                จากทั้งหมด {sandwichStats.count} ใบงาน
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium block">NG เสียหาย (กก./ม.)</span>
              <div className="text-lg sm:text-xl font-bold font-mono text-rose-600 mt-1">
                {sandwichStats.totalNgKg.toLocaleString()} <span className="text-xs text-slate-500 font-normal">กก.</span>
              </div>
              <span className="text-[11px] text-rose-700 font-mono mt-0.5 block">
                {sandwichStats.totalNgMeters} ม. ({sandwichStats.ngPercent}%)
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium block">สัดส่วนประเภทเหล็ก</span>
              <div className="text-xs space-y-1 mt-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-600">เหล็กนอก:</span>
                  <span className="font-bold text-slate-900">{sandwichStats.externalPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Blue Scope:</span>
                  <span className="font-bold text-slate-900">{sandwichStats.blueScopePct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: FOIL USAGE BAR CHART */}
      {(dashboardTab === 'all' || dashboardTab === 'foil') && (
        <MonthlyFoilUsageBarChart
          records={records}
          rolls={rolls}
          onDoubleBackup={onDoubleBackup}
          isDoubleBackingUp={isDoubleBackingUp}
          lastDoubleBackupTime={lastDoubleBackupTime}
          showToast={showToast}
        />
      )}

      {/* SECTION: PATTERN & WIDTH BREAKDOWNS */}
      {(dashboardTab === 'all' || dashboardTab === 'foil') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ลายฟอยล์ */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">คงเหลือฟอยล์แยกตามลาย</h3>
                <p className="text-[11px] text-slate-500">ขาว · ดำ · ไม้ · เทา · กลีบบัว</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg font-mono">
                {patternStats.length} ลาย
              </span>
            </div>
            <div className="space-y-2">
              {patternStats.map((item) => {
                const pStyle = getCanonicalPatternStyle(item.name);
                return (
                  <div
                    key={item.name}
                    className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${pStyle.dotClass}`} />
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {pStyle.label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">({item.count} ม้วน)</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-slate-900 shrink-0">
                        {formatMeters(item.remaining)} ม.
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${
                          item.remaining === 0 ? 'bg-slate-300' : pStyle.progressClass
                        }`}
                        style={{
                          width: `${Math.max(
                            item.total > 0 ? (item.remaining / item.total) * 100 : 0,
                            item.remaining > 0 ? 4 : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* หน้ากว้างฟอยล์ */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">คงเหลือแยกตามหน้ากว้าง</h3>
                  <p className="text-[11px] text-slate-500">830 · 850 · 880 · 900 มม.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {widthStats.map((item) => (
                  <div
                    key={item.width}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 transition-all hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400">
                        {item.width} มม.
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{item.count} ม้วน</span>
                    </div>
                    <div className="mt-2 text-lg font-bold font-mono text-slate-900">
                      {formatMeters(item.remaining)}
                      <span className="text-[10px] font-normal text-slate-400 ml-0.5">ม.</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1 mt-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-1 rounded-full"
                        style={{ width: `${Math.min(100, item.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/50 text-[11px] text-slate-700">
              <span className="font-semibold text-amber-950 inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                830/850 มม.
              </span>{' '}
              → สำหรับฉนวน PU 1 นิ้ว ·{' '}
              <span className="font-semibold text-amber-950">880/900 มม.</span> → สำหรับฉนวน PU 2 นิ้ว
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
