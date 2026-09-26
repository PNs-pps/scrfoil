import React, { useRef, useState, useEffect } from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS, getCanonicalPatternStyle } from '../utils/soFormatter';
import { formatMeters } from '../utils/formatters';
import {
  Package,
  Scissors,
  AlertOctagon,
  Layers,
  ArrowRight,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import { MonthlyFoilUsageBarChart } from './MonthlyFoilUsageBarChart';

interface DashboardOverviewProps {
  rolls: FoilRoll[];
  records: StockCutRecord[];
  onOpenCutModal: (rollId?: string) => void;
  onOpenAddModal: () => void;
  onViewAllRolls: () => void;
  onViewAllHistory: () => void;
  onOpenMonthlySummary?: () => void;
  onOpenBatchImport?: () => void;
  onDoubleBackup?: () => Promise<void> | void;
  isDoubleBackingUp?: boolean;
  lastDoubleBackupTime?: string | null;
  showToast?: (text: string, type?: 'success' | 'info') => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  rolls,
  records,
  onViewAllHistory,
  onOpenMonthlySummary,
  onDoubleBackup,
  isDoubleBackingUp = false,
  lastDoubleBackupTime,
  showToast,
}) => {
  const totalRemainingMeters = rolls.reduce((acc, r) => acc + r.remainingMeters, 0);
  const totalOriginalMeters = rolls.reduce((acc, r) => acc + r.totalMeters, 0);
  const totalUsedMeters = records.reduce((acc, r) => acc + r.usedMeters, 0);
  const totalNgMeters = records.reduce((acc, r) => acc + r.ngMeters, 0);
  const totalDeductedMeters = totalUsedMeters + totalNgMeters;
  const ngRatePercent =
    totalDeductedMeters > 0
      ? ((totalNgMeters / totalDeductedMeters) * 100).toFixed(1)
      : '0.0';

  const activeRolls = rolls.filter((r) => r.remainingMeters > 0);
  const depletedRolls = rolls.filter((r) => r.remainingMeters <= 0);
  const redAlertRolls = rolls.filter((r) => r.remainingMeters > 0 && r.remainingMeters <= 50);
  const yellowAlertRolls = rolls.filter(
    (r) => r.remainingMeters > 50 && r.remainingMeters <= 200
  );
  const remainPct =
    totalOriginalMeters > 0
      ? Math.round((totalRemainingMeters / totalOriginalMeters) * 100)
      : 0;

  const patternStats = STANDARD_PATTERNS.map((p) => {
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
    patternStats.push({
      name: cp,
      label: cp,
      remaining,
      total,
      count,
      percent: total > 0 ? Math.round((remaining / total) * 100) : 0,
    });
  });

  const widthStats = STANDARD_WIDTHS.map((w) => {
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

  const recentCuts = [...records].reverse().slice(0, 5);

  // KPI slide cards
  const kpiCards = [
    {
      id: 'remain',
      label: 'ยอดคงเหลือรวม',
      value: formatMeters(totalRemainingMeters),
      unit: 'เมตร',
      accent: 'amber',
      icon: Layers,
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
      label: 'ม้วนพร้อมใช้',
      value: String(activeRolls.length),
      unit: 'ม้วน',
      accent: 'emerald',
      icon: Package,
      footer: (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-500">
            หมดแล้ว <span className="font-mono font-semibold text-slate-700">{depletedRolls.length}</span> ม้วน
          </p>
          {redAlertRolls.length > 0 && (
            <p className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
              ใกล้หมด ≤50ม. {redAlertRolls.length} ม้วน
            </p>
          )}
          {yellowAlertRolls.length > 0 && (
            <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              เหลือน้อย ≤200ม. {yellowAlertRolls.length} ม้วน
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'used',
      label: 'ผลิตลงแผ่นจริง',
      value: formatMeters(totalUsedMeters),
      unit: 'เมตร',
      accent: 'sky',
      icon: Scissors,
      footer: (
        <p className="text-[11px] text-slate-500">
          บันทึกการตัดแล้ว <span className="font-mono font-semibold text-slate-700">{records.length}</span> ครั้ง
        </p>
      ),
    },
    {
      id: 'ng',
      label: 'NG ที่เสีย',
      value: formatMeters(totalNgMeters),
      unit: 'เมตร',
      accent: 'rose',
      icon: AlertOctagon,
      footer: (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">อัตรา NG</span>
          <span className="text-[11px] font-bold font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
            {ngRatePercent}%
          </span>
        </div>
      ),
    },
  ];

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

  const accentIcon: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  const accentValue: Record<string, string> = {
    amber: 'text-slate-900',
    emerald: 'text-slate-900',
    sky: 'text-slate-900',
    rose: 'text-rose-600',
  };

  return (
    <div className="space-y-5 pb-2">
      {/* Hero บาง */}
      <div className="rounded-2xl bg-slate-900 text-white px-4 py-3.5 sm:px-5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
              หลังคาเย็นสยาม
            </span>
            <span className="text-[10px] text-slate-400 truncate">คลังฟอยล์ PU FOAM</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">แดชบอร์ดสต๊อก</h2>
        </div>
        {onOpenMonthlySummary && (
          <button
            type="button"
            onClick={onOpenMonthlySummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold cursor-pointer"
          >
            <BarChart2 className="w-3.5 h-3.5 text-emerald-300" />
            สรุปรายเดือน
          </button>
        )}
      </div>

      {/* KPI การ์ดสไลด์แนวนอน */}
      <div className="-mx-1">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            ตัวชี้วัดหลัก
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">เลื่อนดูการ์ด →</span>
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
                className="snap-center shrink-0 w-[78vw] max-w-[280px] sm:w-[240px] sm:max-w-none bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {card.label}
                  </span>
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accentIcon[card.accent]}`}
                  >
                    <Icon className="w-4.5 h-4.5 w-5 h-5" />
                  </div>
                </div>
                <div className={`mt-3 text-2xl sm:text-3xl font-bold font-mono tracking-tight ${accentValue[card.accent]}`}>
                  {card.value}{' '}
                  <span className="text-sm font-normal text-slate-400">{card.unit}</span>
                </div>
                <div className="mt-auto pt-3">{card.footer}</div>
              </div>
            );
          })}
        </div>
        {/* จุดบอกตำแหน่งสไลด์ */}
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

      {/* กราฟรายเดือน */}
      <MonthlyFoilUsageBarChart
        records={records}
        rolls={rolls}
        onDoubleBackup={onDoubleBackup}
        isDoubleBackingUp={isDoubleBackingUp}
        lastDoubleBackupTime={lastDoubleBackupTime}
        showToast={showToast}
      />

      {/* แยกตามลาย / หน้ากว้าง */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">คงเหลือตามลาย</h3>
              <p className="text-[11px] text-slate-500">ขาว · ดำ · ไม้ · เทา · กลีบบัว</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">
              {patternStats.length} ลาย
            </span>
          </div>
          <div className="space-y-2">
            {patternStats.map((item) => {
              const pStyle = getCanonicalPatternStyle(item.name);
              return (
                <div
                  key={item.name}
                  className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${pStyle.dotClass}`} />
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {pStyle.label}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{item.count} ม้วน</span>
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

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">คงเหลือตามหน้ากว้าง</h3>
              <p className="text-[11px] text-slate-500">830 · 850 · 880 · 900 มม.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {widthStats.map((item) => (
              <div
                key={item.width}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/80"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400">
                    {item.width}
                  </span>
                  <span className="text-[10px] text-slate-500">{item.count} ม้วน</span>
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
          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/50 text-[11px] text-slate-600">
            <span className="font-semibold text-amber-900 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              830/850
            </span>{' '}
            → ฉนวน 1 นิ้ว ·{' '}
            <span className="font-semibold text-amber-900">880/900</span> → ฉนวน 2 นิ้ว
          </div>
        </div>
      </div>

      {/* ตัดล่าสุด */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Scissors className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 truncate">ตัดสต๊อกล่าสุด</h3>
          </div>
          <button
            type="button"
            onClick={onViewAllHistory}
            className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 inline-flex items-center gap-0.5 cursor-pointer shrink-0"
          >
            ทั้งหมด ({records.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCuts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">ยังไม่มีประวัติการตัดสต๊อก</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">SO</th>
                  <th className="px-3 py-2 font-semibold">ล็อต#เบอร์</th>
                  <th className="px-3 py-2 font-semibold">ลาย</th>
                  <th className="px-3 py-2 font-semibold text-right">ใช้</th>
                  <th className="px-3 py-2 font-semibold text-right">NG</th>
                  <th className="px-3 py-2 font-semibold text-right">เหลือ</th>
                  <th className="px-3 py-2 font-semibold">วันที่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentCuts.map((cut) => (
                  <tr key={cut.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-mono font-bold text-amber-800">
                      {cut.soNumber}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-800">
                      {cut.lotNumber}
                      <span className="text-slate-400">#{cut.rollNumber}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {cut.pattern}
                      <span className="text-slate-400 ml-0.5">({cut.width})</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {formatMeters(cut.usedMeters)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-600">
                      {cut.ngMeters > 0 ? formatMeters(cut.ngMeters) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                      {formatMeters(cut.remainingAfter)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">{cut.usageDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
