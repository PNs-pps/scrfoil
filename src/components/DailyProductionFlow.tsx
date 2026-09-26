import React, { useState, useMemo } from 'react';
import { 
  StockCutRecord, 
  FoilRoll,
  PuSandwichCutRecord
} from '../types';
import { 
  getPatternStyle, 
  WIDTH_SPECIFICATIONS 
} from '../utils/patternStyles';
import { 
  Workflow, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ArrowRight, 
  TrendingUp, 
  Copy, 
  Check, 
  Clock, 
  User, 
  ChevronRight, 
  Sparkles,
  Award,
  Factory
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  Cell 
} from 'recharts';
import { KpiSlideRow } from './KpiSlideRow';

interface DailyProductionFlowProps {
  records: StockCutRecord[];
  rolls: FoilRoll[];
  puRecords?: PuSandwichCutRecord[];
  onOpenCutModal?: () => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export type DailyFlowItem = 
  | { type: 'foil'; data: StockCutRecord; time: string; so: string }
  | { type: 'sandwich'; data: PuSandwichCutRecord; time: string; so: string };

export const DailyProductionFlow: React.FC<DailyProductionFlowProps> = ({
  records,
  rolls,
  puRecords = [],
  showToast,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [filterLine, setFilterLine] = useState<'all' | 'foil' | 'sandwich'>('all');
  const [copiedDaily, setCopiedDaily] = useState<boolean>(false);

  const safePuRecords = useMemo(() => Array.isArray(puRecords) ? puRecords : [], [puRecords]);

  // Get available dates from both Foil records and Sandwich records, sorted descending
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    dates.add(todayStr);
    records.forEach((r) => {
      const d = (r.usageDate || r.recordedDate || r.createdAt || '').slice(0, 10);
      if (d && d.length === 10) dates.add(d);
    });
    safePuRecords.forEach((r) => {
      const d = (r.productionDate || r.createdAt || '').slice(0, 10);
      if (d && d.length === 10) dates.add(d);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [records, safePuRecords, todayStr]);

  // Filter foil records for selected date
  const dayRecords = useMemo(() => {
    return records
      .filter((r) => {
        const d = (r.usageDate || r.recordedDate || r.createdAt || '').slice(0, 10);
        return d === selectedDate;
      })
      .sort((a, b) => {
        const timeA = a.createdAt || '';
        const timeB = b.createdAt || '';
        return timeA.localeCompare(timeB); // chronological flow for the day
      });
  }, [records, selectedDate]);

  // Filter sandwich records for selected date
  const dayPuRecords = useMemo(() => {
    return safePuRecords
      .filter((r) => {
        const d = (r.productionDate || r.createdAt || '').slice(0, 10);
        return d === selectedDate;
      })
      .sort((a, b) => {
        const timeA = a.createdAt || '';
        const timeB = b.createdAt || '';
        return timeA.localeCompare(timeB);
      });
  }, [safePuRecords, selectedDate]);

  // Statistics for foil on this day
  const stats = useMemo(() => {
    const totalUsed = dayRecords.reduce((sum, r) => sum + r.usedMeters, 0);
    const totalNg = dayRecords.reduce((sum, r) => sum + r.ngMeters, 0);
    const totalDeducted = totalUsed + totalNg;
    const yieldRate = totalDeducted > 0 ? (totalUsed / totalDeducted) * 100 : 100;
    const uniqueSo = Array.from(new Set(dayRecords.map((r) => r.soNumber).filter(Boolean)));
    const uniqueRolls = Array.from(new Set(dayRecords.map((r) => r.foilId).filter(Boolean)));

    // Pattern distribution for this day
    const patternMap = new Map<string, number>();
    dayRecords.forEach((r) => {
      patternMap.set(r.pattern, (patternMap.get(r.pattern) || 0) + r.usedMeters);
    });

    // Width distribution for this day
    const widthMap = new Map<number, number>();
    dayRecords.forEach((r) => {
      widthMap.set(r.width, (widthMap.get(r.width) || 0) + r.usedMeters);
    });

    return {
      totalUsed,
      totalNg,
      totalDeducted,
      yieldRate,
      soCount: uniqueSo.length,
      rollCount: uniqueRolls.length,
      patternMap,
      widthMap,
    };
  }, [dayRecords]);

  // Statistics for sandwich on this day
  const puStats = useMemo(() => {
    const totalKg = dayPuRecords.reduce((sum, r) => sum + (Number(r.weightUsed) || 0), 0);
    const totalNgKg = dayPuRecords.reduce((sum, r) => sum + (Number(r.ngKg) || 0), 0);
    const totalNgMeters = dayPuRecords.reduce((sum, r) => sum + (Number(r.ngMeters) || 0), 0);
    const totalSoLength = dayPuRecords.reduce((sum, r) => sum + (Number(r.soLengthMeters) || 0), 0);
    const uniqueSo = Array.from(new Set(dayPuRecords.map((r) => r.soNumber).filter(Boolean)));

    const ngPercent = totalKg > 0 ? (totalNgKg / totalKg) * 100 : 0;

    return {
      count: dayPuRecords.length,
      soCount: uniqueSo.length,
      totalKg: Math.round(totalKg * 100) / 100,
      totalTons: Math.round((totalKg / 1000) * 100) / 100,
      totalNgKg: Math.round(totalNgKg * 100) / 100,
      totalNgMeters: Math.round(totalNgMeters * 10) / 10,
      totalSoLength: Math.round(totalSoLength * 10) / 10,
      ngPercent: Math.round(ngPercent * 100) / 100,
    };
  }, [dayPuRecords]);

  // Combined flow items chronologically
  const combinedFlow = useMemo<DailyFlowItem[]>(() => {
    const list: DailyFlowItem[] = [];
    if (filterLine === 'all' || filterLine === 'foil') {
      dayRecords.forEach((r) => {
        list.push({
          type: 'foil',
          data: r,
          time: r.createdAt || '',
          so: r.soNumber || '',
        });
      });
    }
    if (filterLine === 'all' || filterLine === 'sandwich') {
      dayPuRecords.forEach((p) => {
        list.push({
          type: 'sandwich',
          data: p,
          time: p.createdAt || '',
          so: p.soNumber || '',
        });
      });
    }
    return list.sort((a, b) => a.time.localeCompare(b.time));
  }, [dayRecords, dayPuRecords, filterLine]);

  // Distinct SOs across both lines on this day
  const distinctDailySo = useMemo(() => {
    const set = new Set<string>();
    dayRecords.forEach((r) => { if (r.soNumber) set.add(r.soNumber); });
    dayPuRecords.forEach((p) => { if (p.soNumber) set.add(p.soNumber); });
    return Array.from(set);
  }, [dayRecords, dayPuRecords]);

  // Format date display in Thai
  const displaySelectedDate = useMemo(() => {
    try {
      const d = new Date(selectedDate);
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Chart data per SO for this day (Foil)
  const chartData = useMemo(() => {
    // Group by SO for the day
    const soMap = new Map<string, { so: string; used: number; ng: number; pattern: string }>();
    dayRecords.forEach((r) => {
      const existing = soMap.get(r.soNumber) || {
        so: r.soNumber || 'ไม่ระบุ SO',
        used: 0,
        ng: 0,
        pattern: r.pattern,
      };
      existing.used += r.usedMeters;
      existing.ng += r.ngMeters;
      soMap.set(r.soNumber, existing);
    });
    return Array.from(soMap.values());
  }, [dayRecords]);

  // Copy daily summary for LINE
  const handleCopyDailySummary = () => {
    if (dayRecords.length === 0 && dayPuRecords.length === 0) {
      if (showToast) showToast('ยังไม่มีรายการผลิตในวันที่เลือก', 'info');
      return;
    }

    const lines: string[] = [
      `📊 ผลการผลิตโรงงานรายวัน (Production Daily Flow)`,
      `🏢 หลังคาเย็นสยาม (ร่มเกล้า)`,
      `📅 วันที่: ${displaySelectedDate} (${selectedDate})`,
      `📦 รวมคำสั่งซื้อทั้งหมด: ${distinctDailySo.length} SO`,
      `─────────────────────────`,
    ];

    if (dayRecords.length > 0) {
      lines.push(
        `🌀 [สายผลิตติดฟอยล์ PU]:`,
        `  • ยอดตัดลงแผ่นจริง: ${stats.totalUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.`,
        `  • เศษ NG เสีย: ${stats.totalNg.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.`,
        `  • ประสิทธิภาพ (Yield): ${stats.yieldRate.toFixed(2)}%`,
        `  • จำนวน: ${stats.soCount} SO | เบิกฟอยล์ ${stats.rollCount} ม้วน`,
        `─────────────────────────`
      );
    }

    if (dayPuRecords.length > 0) {
      lines.push(
        `🥪 [สายผลิต PU แซนวิช (ไม่ใช้ฟอยล์)]:`,
        `  • น้ำหนักเหล็กใช้จริง: ${puStats.totalKg.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก. (${puStats.totalTons} ตัน)`,
        `  • ยอดงานผลิตตาม SO รวม: ${puStats.totalSoLength.toLocaleString('th-TH', { minimumFractionDigits: 1 })} เมตร`,
        `  • ยอด NG เสีย: ${puStats.totalNgKg.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก. (${puStats.totalNgMeters} ม.)`,
        `  • สัดส่วน NG เสีย: ${puStats.ngPercent}%`,
        `  • จำนวน: ${puStats.soCount} SO (${puStats.count} รายการ)`,
        `─────────────────────────`
      );
    }

    lines.push(`📋 ลำดับเวลาการผลิต (Flow Timeline):`);
    combinedFlow.forEach((item, idx) => {
      if (item.type === 'foil') {
        const r = item.data;
        const sideText = r.isSilverSide ? ' [ท้องเงิน]' : r.isWhiteSide ? ' [ท้องขาว]' : '';
        lines.push(
          `${idx + 1}. [ฟอยล์] SO: ${r.soNumber} | ล็อต ${r.lotNumber} #${r.rollNumber}` +
          `\n   - ลาย ${r.pattern}${sideText} หน้า ${r.width}มม.` +
          `\n   - ตัดได้: ${r.usedMeters.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.` +
          (r.ngMeters > 0 ? ` (NG: ${r.ngMeters} ม.)` : '') +
          ` | โดย: ${r.recordedBy || '-'}`
        );
      } else {
        const p = item.data;
        lines.push(
          `${idx + 1}. [PU แซนวิช] SO: ${p.soNumber} | สี ${p.coilColor} #${p.coilNumber} (${p.thickness}มม.)` +
          `\n   - ชนิด: ${p.steelOrigin}` +
          `\n   - ใช้จริง: ${p.weightUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก.` +
          (p.soLengthMeters ? ` | งาน SO: ${p.soLengthMeters} ม.` : '') +
          (p.ngKg > 0 ? ` (NG: ${p.ngKg} กก. / ${p.ngMeters} ม.)` : '') +
          ` | โดย: ${p.recordedBy || '-'}`
        );
      }
    });

    lines.push(`─────────────────────────`);
    lines.push(`ระบบบันทึกผลการผลิต Realtime`);

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedDaily(true);
      setTimeout(() => setCopiedDaily(false), 2500);
      if (showToast) {
        showToast('คัดลอกสรุปผลผลิตรายวัน (รวมฟอยล์ + แซนวิช) เรียบร้อยแล้ว!', 'success');
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Workflow className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Flow Chart ผลการผลิตรายวัน
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Production Flow
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                ขั้นตอนสายการผลิต & วิเคราะห์ยอดตัดสต๊อกฟอยล์ประจำวัน (เรียกดูย้อนหลังได้)
              </p>
            </div>
          </div>

          {/* Date Selector & Copy Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-amber-600" />
              <label htmlFor="flow-chart-date-select" className="sr-only">
                เลือกวันที่ผลิต
              </label>
              <select
                id="flow-chart-date-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-slate-800 border-none outline-hidden cursor-pointer"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date === todayStr ? `วันนี้ (${date})` : date}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleCopyDailySummary}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                copiedDaily
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
              title="คัดลอกสรุปผลผลิตของวันนี้เพื่อวางใน LINE"
            >
              {copiedDaily ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>คัดลอกแล้ว!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>คัดลอกผลผลิตรายวัน</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Date Banner & Line Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="font-bold text-amber-950">วันที่ตรวจสอบ:</span>
            <span className="text-amber-900 font-semibold">{displaySelectedDate}</span>
          </div>

          {/* Line Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterLine('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterLine === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-700 border border-amber-200'
              }`}
            >
              ทุกสายผลิต ({distinctDailySo.length} SO)
            </button>
            <button
              type="button"
              onClick={() => setFilterLine('foil')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterLine === 'foil'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-700 border border-amber-200'
              }`}
            >
              สายติดฟอยล์ ({dayRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterLine('sandwich')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterLine === 'sandwich'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-700 border border-amber-200'
              }`}
            >
              สาย PU แซนวิช ({dayPuRecords.length})
            </button>
          </div>
        </div>
      </div>

      {/* Visual Process Flow Diagram */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              ขั้นตอนกระบวนการผลิตและการไหลของวัสดุ (Manufacturing Process Flow)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">บูรณาการฟอยล์ & แซนวิช</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Step 1: Order Intake */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-amber-50/40 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 font-mono font-bold text-xs flex items-center justify-center">
                1
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-semibold">SO Intake</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">
              รับคำสั่งผลิต SO
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              ตรวจสอบใบสั่งผลิต SO สำหรับทั้งสายติดฟอยล์และ PU แซนวิช
            </p>
            <div className="pt-1 text-[11px] font-mono text-amber-800 font-medium">
              • วันนี้: {distinctDailySo.length} คำสั่งซื้อ SO
            </div>
          </div>

          {/* Step 2: Roll & Coil Allocation */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-blue-700 text-white font-mono font-bold text-xs flex items-center justify-center">
                2
              </span>
              <span className="text-[11px] font-mono text-blue-600 font-semibold">Allocation</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">
              เบิกจ่ายม้วนฟอยล์ / คอล์ยเหล็ก
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              เบิกม้วนฟอยล์ตามลาย หรือชั่งน้ำหนักคอล์ยเหล็กก่อนขึ้นเครื่องแซนวิช
            </p>
            <div className="pt-1 text-[11px] font-mono text-blue-800 font-medium">
              • ฟอยล์ {stats.rollCount} ม้วน | แซนวิช {puStats.count} ม้วนคอล์ย
            </div>
          </div>

          {/* Step 3: PU Foaming & Lamination */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-amber-50/60 border border-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-mono font-bold text-xs flex items-center justify-center">
                3
              </span>
              <span className="text-[11px] font-mono text-amber-700 font-semibold">Lamination</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">
              Processing (ดำเนินการผลิต) 
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              เดินเครื่องฉีดโฟม PU และประกบฟอยล์ หรือประกบเหล็กแซนวิช 2 ด้าน
            </p>
            <div className="pt-1 text-[11px] font-mono text-amber-900 font-bold">
              • ฟอยล์: {stats.totalUsed.toLocaleString()} ม. | แซนวิช: {puStats.totalKg.toLocaleString()} กก.
            </div>
          </div>

          {/* Step 4: Quality Inspection & Stock Deduction */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/50 border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                4
              </span>
              <span className="text-[11px] font-mono text-emerald-700 font-semibold">Quality & Cut</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">
              ตรวจรับ & บันทึกยอดตัด
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              คัดแยกเศษ NG ชั่งน้ำหนักคืน ตัดสต๊อกฟอยล์และบันทึกคอล์ย Realtime
            </p>
            <div className="pt-1 text-[11px] font-mono text-emerald-800 font-bold">
              • NG ฟอยล์: {stats.totalNg.toLocaleString()} ม. | NG แซนวิช: {puStats.totalNgKg.toLocaleString()} กก.
            </div>
          </div>
        </div>
      </div>

      {/* KPI สไลด์ — สายฟอยล์ */}
      {(filterLine === 'all' || filterLine === 'foil') && (
        <KpiSlideRow
          title={`สายฟอยล์ · ${stats.soCount} SO · ${dayRecords.length} รายการ`}
          cards={[
            {
              id: 'foil-used',
              label: 'ผลิตลงแผ่นจริง',
              value: stats.totalUsed.toLocaleString('th-TH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              unit: 'ม.',
              icon: <CheckCircle2 className="w-4 h-4" />,
              iconClass: 'bg-emerald-50 text-emerald-600',
              valueClass: 'text-emerald-700',
              footer: `${stats.soCount} คำสั่งซื้อ SO`,
            },
            {
              id: 'foil-ng',
              label: 'NG ฟอยล์',
              value: stats.totalNg.toLocaleString('th-TH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              unit: 'ม.',
              icon: <AlertTriangle className="w-4 h-4" />,
              iconClass: 'bg-rose-50 text-rose-600',
              valueClass: stats.totalNg > 0 ? 'text-rose-600' : 'text-slate-400',
              footer:
                stats.totalDeducted > 0
                  ? `${((stats.totalNg / stats.totalDeducted) * 100).toFixed(1)}% ของการตัด`
                  : 'ไม่มีของเสีย',
            },
            {
              id: 'foil-yield',
              label: 'Yield',
              value: `${stats.yieldRate.toFixed(1)}%`,
              icon: <Award className="w-4 h-4" />,
              iconClass: 'bg-amber-50 text-amber-600',
              footer: `รวมตัด ${stats.totalDeducted.toLocaleString('th-TH', { maximumFractionDigits: 1 })} ม. · ${stats.rollCount} ม้วน`,
            },
          ]}
        />
      )}

      {/* KPI สไลด์ — สายแซนวิช */}
      {(filterLine === 'all' || filterLine === 'sandwich') && (
        <KpiSlideRow
          title={`สายแซนวิช · ${puStats.soCount} SO · ${dayPuRecords.length} รายการ`}
          cards={[
            {
              id: 'pu-kg',
              label: 'น้ำหนักเหล็กใช้จริง',
              value: puStats.totalKg.toLocaleString('th-TH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              unit: 'กก.',
              icon: <CheckCircle2 className="w-4 h-4" />,
              iconClass: 'bg-emerald-50 text-emerald-600',
              valueClass: 'text-emerald-700',
              footer: `≈ ${puStats.totalTons} ตัน`,
            },
            {
              id: 'pu-len',
              label: 'ความยาวตามงาน SO',
              value: puStats.totalSoLength.toLocaleString('th-TH', { minimumFractionDigits: 1 }),
              unit: 'ม.',
              icon: <Layers className="w-4 h-4" />,
              iconClass: 'bg-teal-50 text-teal-600',
              valueClass: 'text-teal-700',
              footer: `${puStats.soCount} คำสั่งซื้อ SO`,
            },
            {
              id: 'pu-ng',
              label: 'NG แซนวิช',
              value: puStats.totalNgKg.toLocaleString('th-TH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              unit: 'กก.',
              icon: <AlertTriangle className="w-4 h-4" />,
              iconClass: 'bg-rose-50 text-rose-600',
              valueClass: puStats.totalNgKg > 0 ? 'text-rose-600' : 'text-slate-400',
              footer: `${puStats.ngPercent.toFixed(1)}% · ${puStats.totalNgMeters.toLocaleString('th-TH', { minimumFractionDigits: 1 })} ม.`,
            },
          ]}
        />
      )}

      {/* Production Breakdown Chart by SO (Foil) */}
      {(filterLine === 'all' || filterLine === 'foil') && chartData.length > 0 ? (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                กราฟเปรียบเทียบยอดผลิตและ NG แยกตามคำสั่งซื้อ SO (ฟอยล์)
              </h3>
              <p className="text-xs text-slate-500">
                แสดงสัดส่วนเมตรที่ผลิตได้จริง (เขียว) เทียบกับ NG เสีย (แดง)
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">
              {chartData.length} รายการ
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <XAxis 
                  dataKey="so" 
                  tick={{ fontSize: 11, fill: '#475569' }} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  formatter={(value: any) => [`${Number(value || 0).toLocaleString()} ม.`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="used" name="ตัดใช้งานจริง (ม.)" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ng" name="NG เสีย (ม.)" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* Detailed Chronological Production Timeline (Flow Table) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              ลำดับเวลาการผลิต (Production Timeline Flow)
            </h3>
            <p className="text-xs text-slate-500">
              แสดงรายการตัดตามลำดับเวลาที่เกิดขึ้นจริงในวันที่ {displaySelectedDate}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold">
            {combinedFlow.length} รายการ
          </span>
        </div>

        {combinedFlow.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm font-mono space-y-2">
            <Workflow className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
            <p>ไม่มีประวัติการผลิตหรือตัดสต๊อกในวันที่ {selectedDate}</p>
            <p className="text-xs text-slate-400">
              สามารถเลือกวันที่อื่นจากกล่องเลือกวันที่ด้านบนเพื่อดูย้อนหลังได้
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-center w-12">ลำดับ</th>
                  <th className="px-4 py-3">ประเภท</th>
                  <th className="px-4 py-3">รหัส SO / ออเดอร์</th>
                  <th className="px-4 py-3">รายละเอียดวัสดุ (ม้วน/คอล์ย)</th>
                  <th className="px-4 py-3">หน้ากว้าง / ชนิดเหล็ก</th>
                  <th className="px-4 py-3">ลายฟอยล์ / ความหนา</th>
                  <th className="px-4 py-3 text-right">ตัดใช้จริง</th>
                  <th className="px-4 py-3 text-right">NG เสีย</th>
                  <th className="px-4 py-3">ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combinedFlow.map((item, idx) => {
                  if (item.type === 'foil') {
                    const r = item.data;
                    const pStyle = getPatternStyle(r.pattern);
                    return (
                      <tr key={`foil-${r.id}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            ติดฟอยล์
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-amber-900 text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {r.soNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <div className="font-bold text-slate-900">
                            ล็อต: {r.lotNumber}
                          </div>
                          <div className="text-slate-500">
                            เบอร์: #{r.rollNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {r.width} มม.
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${pStyle.dotClass}`} />
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${pStyle.badgeClass}`}>
                                {pStyle.name}
                              </span>
                            </div>
                            {r.isSilverSide && (
                              <span className="inline-flex items-center w-fit px-1.5 py-0.2 rounded bg-gradient-to-r from-slate-100 to-zinc-200 text-slate-800 text-[10px] font-bold border border-slate-300">
                                เงิน
                              </span>
                            )}
                            {r.isWhiteSide && (
                              <span className="inline-flex items-center w-fit px-1.5 py-0.2 rounded bg-white text-slate-800 text-[10px] font-bold border border-slate-300">
                                ขาว
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 text-sm">
                          {r.usedMeters.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-rose-600">
                          {r.ngMeters > 0 ? `${r.ngMeters.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.` : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{r.recordedBy || '-'}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  } else {
                    const p = item.data;
                    return (
                      <tr key={`sandwich-${p.id}`} className="hover:bg-emerald-50/40 transition-colors bg-emerald-50/15">
                        <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 w-fit">
                            <Factory className="w-3 h-3" />
                            PU แซนวิช
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-emerald-900 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {p.soNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <div className="font-bold text-slate-900 font-sans">
                            สี: {p.coilColor}
                          </div>
                          <div className="text-slate-500">
                            เบอร์คอล์ย: #{p.coilNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-sans text-xs">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                            p.steelOrigin === 'เหล็กBlue Scope'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : p.steelOrigin === 'เหล็กนอก'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {p.steelOrigin}
                            {p.customSteelOrigin ? ` (${p.customSteelOrigin})` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                          {p.thickness} มม.
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800 text-sm">
                          <div>{p.weightUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก.</div>
                          {p.soLengthMeters ? (
                            <div className="text-[10px] text-teal-700 font-normal">
                              (งาน {p.soLengthMeters.toLocaleString('th-TH', { minimumFractionDigits: 1 })}ม.)
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-rose-600">
                          {p.ngKg > 0 ? (
                            <div>
                              <div>{p.ngKg.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก.</div>
                              {p.ngMeters > 0 ? (
                                <div className="text-[10px] text-rose-500 font-normal">
                                  ({p.ngMeters.toLocaleString('th-TH', { minimumFractionDigits: 1 })}ม.)
                                </div>
                              ) : null}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{p.recordedBy || '-'}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
