import React, { useState, useMemo } from 'react';
import { StockCutRecord, FoilRoll } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  Calendar, 
  ShieldCheck, 
  Download, 
  TrendingUp, 
  Layers, 
  Award, 
  AlertTriangle, 
  RefreshCw, 
  SlidersHorizontal,
  FileSpreadsheet,
  CheckCircle2,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { 
  STANDARD_PATTERNS, 
  normalizePattern, 
  getCanonicalPatternStyle, 
  PATTERN_HEX_COLORS 
} from '../utils/soFormatter';
import { formatMeters, round2 } from '../utils/formatters';

interface MonthlyFoilUsageBarChartProps {
  records: StockCutRecord[];
  rolls?: FoilRoll[];
  onDoubleBackup?: () => Promise<void> | void;
  isDoubleBackingUp?: boolean;
  lastDoubleBackupTime?: string | null;
  showToast?: (text: string, type?: 'success' | 'info') => void;
}

const MONTH_NAMES_TH = [
  { num: '01', short: 'ม.ค.', full: 'มกราคม' },
  { num: '02', short: 'ก.พ.', full: 'กุมภาพันธ์' },
  { num: '03', short: 'มี.ค.', full: 'มีนาคม' },
  { num: '04', short: 'เม.ย.', full: 'เมษายน' },
  { num: '05', short: 'พ.ค.', full: 'พฤษภาคม' },
  { num: '06', short: 'มิ.ย.', full: 'มิถุนายน' },
  { num: '07', short: 'ก.ค.', full: 'กรกฎาคม' },
  { num: '08', short: 'ส.ค.', full: 'สิงหาคม' },
  { num: '09', short: 'ก.ย.', full: 'กันยายน' },
  { num: '10', short: 'ต.ค.', full: 'ตุลาคม' },
  { num: '11', short: 'พ.ย.', full: 'พฤศจิกายน' },
  { num: '12', short: 'ธ.ค.', full: 'ธันวาคม' },
];

export const MonthlyFoilUsageBarChart: React.FC<MonthlyFoilUsageBarChartProps> = ({
  records,
  rolls = [],
  onDoubleBackup,
  isDoubleBackingUp = false,
  lastDoubleBackupTime,
  showToast,
}) => {
  const currentYear = new Date().getFullYear();

  // Extract available years from records
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1]);
    records.forEach((r) => {
      const d = r.usageDate || r.recordedDate || r.createdAt || '';
      if (d && d.length >= 4) {
        const y = parseInt(d.slice(0, 4), 10);
        if (!isNaN(y) && y > 2000) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [records, currentYear]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] || currentYear);
  const [chartType, setChartType] = useState<'stacked' | 'grouped'>('stacked');
  const [metric, setMetric] = useState<'used' | 'totalDeducted' | 'ng'>('used');
  const [showDataTable, setShowDataTable] = useState<boolean>(false);

  // Active patterns in the records or standards
  const allActivePatterns = useMemo(() => {
    const set = new Set<string>();
    STANDARD_PATTERNS.forEach((p) => set.add(p.value));
    records.forEach((r) => {
      if (r.pattern) set.add(normalizePattern(r.pattern));
    });
    return Array.from(set);
  }, [records]);

  // Selected patterns toggle (for filtering specific patterns on chart)
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(allActivePatterns);

  const togglePattern = (pattern: string) => {
    if (selectedPatterns.includes(pattern)) {
      if (selectedPatterns.length > 1) {
        setSelectedPatterns(selectedPatterns.filter((p) => p !== pattern));
      }
    } else {
      setSelectedPatterns([...selectedPatterns, pattern]);
    }
  };

  const selectAllPatterns = () => {
    setSelectedPatterns(allActivePatterns);
  };

  // Compile monthly data
  const { chartData, yearStats } = useMemo(() => {
    // 12 months array
    const monthsData = MONTH_NAMES_TH.map((m) => {
      const prefix = `${selectedYear}-${m.num}`;
      const recsInMonth = records.filter((r) => {
        const d = r.usageDate || r.recordedDate || r.createdAt || '';
        return d && d.startsWith(prefix);
      });

      let monthUsed = 0;
      let monthNg = 0;
      let monthDeducted = 0;
      const patternValues: Record<string, number> = {};

      allActivePatterns.forEach((p) => {
        patternValues[p] = 0;
      });

      recsInMonth.forEach((r) => {
        const p = normalizePattern(r.pattern);
        const used = Number(r.usedMeters) || 0;
        const ng = Number(r.ngMeters) || 0;
        const deducted = used + ng;

        monthUsed += used;
        monthNg += ng;
        monthDeducted += deducted;

        let targetVal = used;
        if (metric === 'totalDeducted') targetVal = deducted;
        else if (metric === 'ng') targetVal = ng;

        patternValues[p] = (patternValues[p] || 0) + targetVal;
      });

      // Round pattern values to 2 decimals
      allActivePatterns.forEach((p) => {
        patternValues[p] = Math.round((patternValues[p] || 0) * 100) / 100;
      });

      return {
        month: m.short,
        monthFull: m.full,
        monthNum: m.num,
        monthKey: `${selectedYear}-${m.num}`,
        totalUsed: Math.round(monthUsed * 100) / 100,
        totalNg: Math.round(monthNg * 100) / 100,
        totalDeducted: Math.round(monthDeducted * 100) / 100,
        currentMetricTotal: Math.round(
          (metric === 'used' ? monthUsed : metric === 'totalDeducted' ? monthDeducted : monthNg) * 100
        ) / 100,
        cutCount: recsInMonth.length,
        ...patternValues,
      };
    });

    // Compute Year-Level Statistics
    let yearTotalUsed = 0;
    let yearTotalNg = 0;
    let yearTotalDeducted = 0;
    let yearCutCount = 0;
    const patternYearTotals: Record<string, number> = {};

    allActivePatterns.forEach((p) => {
      patternYearTotals[p] = 0;
    });

    monthsData.forEach((m) => {
      yearTotalUsed += m.totalUsed;
      yearTotalNg += m.totalNg;
      yearTotalDeducted += m.totalDeducted;
      yearCutCount += m.cutCount;

      allActivePatterns.forEach((p) => {
        patternYearTotals[p] += Number((m as any)[p]) || 0;
      });
    });

    // Find top pattern
    let topPattern = '-';
    let topPatternVal = 0;
    Object.entries(patternYearTotals).forEach(([p, val]) => {
      if (val > topPatternVal) {
        topPatternVal = val;
        topPattern = p;
      }
    });

    // Find peak month
    let peakMonth = '-';
    let peakMonthVal = 0;
    monthsData.forEach((m) => {
      if (m.currentMetricTotal > peakMonthVal) {
        peakMonthVal = m.currentMetricTotal;
        peakMonth = m.monthFull;
      }
    });

    const activeMonthsCount = monthsData.filter((m) => m.currentMetricTotal > 0).length;
    const monthlyAverage = activeMonthsCount > 0 ? yearTotalUsed / activeMonthsCount : 0;
    const yearNgRate = yearTotalDeducted > 0 ? (yearTotalNg / yearTotalDeducted) * 100 : 0;

    return {
      chartData: monthsData,
      yearStats: {
        totalUsed: yearTotalUsed,
        totalNg: yearTotalNg,
        totalDeducted: yearTotalDeducted,
        cutCount: yearCutCount,
        topPattern,
        topPatternVal,
        topPatternPercent: yearTotalUsed > 0 ? ((topPatternVal / yearTotalUsed) * 100).toFixed(1) : '0',
        peakMonth,
        peakMonthVal,
        monthlyAverage,
        yearNgRate,
        patternYearTotals,
      },
    };
  }, [records, selectedYear, metric, allActivePatterns]);

  // MoM Comparison: Current Month vs Previous Month
  const currentCalendarMonthIdx = new Date().getMonth(); // 0-indexed (e.g. 8 = Sep)
  const isSelectedYearCurrent = selectedYear === currentYear;

  const [targetMonthIndex, setTargetMonthIndex] = useState<number>(() => {
    return isSelectedYearCurrent ? currentCalendarMonthIdx : 11;
  });

  const momData = useMemo(() => {
    const currM = chartData[targetMonthIndex] || chartData[0];
    const currMonthInfo = MONTH_NAMES_TH[targetMonthIndex] || MONTH_NAMES_TH[0];

    let prevMonthName = '';
    let prevTotalUsed = 0;
    let prevTotalNg = 0;
    let prevTotalDeducted = 0;
    let prevCutCount = 0;
    const prevPatternTotals: Record<string, number> = {};
    allActivePatterns.forEach((p) => {
      prevPatternTotals[p] = 0;
    });

    if (targetMonthIndex > 0) {
      const prevM = chartData[targetMonthIndex - 1];
      const prevInfo = MONTH_NAMES_TH[targetMonthIndex - 1];
      prevMonthName = `${prevInfo.full} ${selectedYear + 543}`;
      prevTotalUsed = prevM?.totalUsed || 0;
      prevTotalNg = prevM?.totalNg || 0;
      prevTotalDeducted = prevM?.totalDeducted || 0;
      prevCutCount = prevM?.cutCount || 0;
      allActivePatterns.forEach((p) => {
        prevPatternTotals[p] = (prevM as any)?.[p] || 0;
      });
    } else {
      const priorYear = selectedYear - 1;
      prevMonthName = `ธันวาคม ${priorYear + 543}`;
      const prefix = `${priorYear}-12`;
      const prevRecs = records.filter((r) => {
        const d = r.usageDate || r.recordedDate || r.createdAt || '';
        return d && d.startsWith(prefix);
      });
      prevCutCount = prevRecs.length;
      prevRecs.forEach((r) => {
        const p = normalizePattern(r.pattern);
        const u = Number(r.usedMeters) || 0;
        const n = Number(r.ngMeters) || 0;
        prevTotalUsed += u;
        prevTotalNg += n;
        prevTotalDeducted += u + n;
        prevPatternTotals[p] = (prevPatternTotals[p] || 0) + u;
      });
    }

    const diffUsed = round2(currM.totalUsed - prevTotalUsed);
    const percentUsed =
      prevTotalUsed > 0
        ? round2((diffUsed / prevTotalUsed) * 100)
        : currM.totalUsed > 0
        ? 100
        : 0;

    const diffNg = round2(currM.totalNg - prevTotalNg);
    const diffDeducted = round2(currM.totalDeducted - prevTotalDeducted);
    const diffCutCount = currM.cutCount - prevCutCount;

    const patternBreakdown = allActivePatterns
      .map((p) => {
        const currVal = (currM as any)?.[p] || 0;
        const prevVal = prevPatternTotals[p] || 0;
        const diff = round2(currVal - prevVal);
        return {
          pattern: p,
          currVal,
          prevVal,
          diff,
        };
      })
      .sort((a, b) => b.currVal - a.currVal);

    return {
      currMonthName: `${currMonthInfo.full} ${selectedYear + 543}`,
      currM,
      prevMonthName,
      prevTotalUsed,
      prevTotalNg,
      prevTotalDeducted,
      prevCutCount,
      diffUsed,
      percentUsed,
      diffNg,
      diffDeducted,
      diffCutCount,
      patternBreakdown,
    };
  }, [chartData, targetMonthIndex, selectedYear, records, allActivePatterns]);

  // Export Monthly Data to CSV for Double Backup
  const handleExportMonthlyCSV = () => {
    try {
      const headers = ['เดือน', 'ปี', 'ยอดใช้จริง (ม.)', 'เศษ NG (ม.)', 'รวมตัดสต๊อก (ม.)', 'จำนวนครั้งตัด', ...allActivePatterns.map(p => `ลาย ${p} (ม.)`)];
      const rows = chartData.map(m => [
        m.monthFull,
        selectedYear,
        m.totalUsed.toFixed(2),
        m.totalNg.toFixed(2),
        m.totalDeducted.toFixed(2),
        m.cutCount,
        ...allActivePatterns.map(p => ((m as any)[p] || 0).toFixed(2))
      ]);

      const csvContent = '\uFEFF' + [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `รายงานการใช้ฟอยล์รายเดือน_${selectedYear}_DOUBLE_BACKUP.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (showToast) {
        showToast(`ส่งออกข้อมูลรายงานรายเดือน ${selectedYear} เรียบร้อย เพื่อการสำรองข้อมูล (Double Backup)`, 'success');
      }
    } catch (e) {
      console.error(e);
      if (showToast) showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์ CSV', 'info');
    }
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      const totalInMonth = dataPoint?.currentMetricTotal || 0;

      return (
        <div className="bg-slate-950/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 text-xs min-w-[210px] space-y-2">
          <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span className="font-bold text-amber-400 text-sm">
              {dataPoint?.monthFull} {selectedYear}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {dataPoint?.cutCount || 0} SO
            </span>
          </div>

          <div className="space-y-1.5">
            {payload.map((entry: any) => {
              const val = Number(entry.value) || 0;
              if (val <= 0) return null;
              const pStyle = getCanonicalPatternStyle(entry.dataKey);
              const percent = totalInMonth > 0 ? ((val / totalInMonth) * 100).toFixed(1) : '0';

              return (
                <div key={entry.dataKey} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-slate-300 font-medium">{pStyle.label}</span>
                  </div>
                  <div className="text-right font-mono flex items-center gap-1.5">
                    <span className="font-bold text-white">{formatMeters(val)} ม.</span>
                    <span className="text-[10px] text-slate-400">({percent}%)</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-800/80 pt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>
              {metric === 'used' ? 'รวมใช้จริง:' : metric === 'totalDeducted' ? 'รวมตัดทั้งหมด:' : 'รวมเศษ NG:'}
            </span>
            <span className="font-bold text-emerald-400 text-xs">
              {formatMeters(totalInMonth)} ม.
            </span>
          </div>

          {dataPoint?.totalNg > 0 && metric !== 'ng' && (
            <div className="flex items-center justify-between text-[10px] text-rose-400 font-mono">
              <span>เศษ NG เสีย:</span>
              <span>{formatMeters(dataPoint.totalNg)} ม.</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
      {/* Top Header & Double Backup Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-200">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              แผนภูมิแท่งเปรียบเทียบการใช้ฟอยล์แยกตามประเภทในแต่ละเดือน
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Recharts Bar Chart
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            วิเคราะห์แนวโน้มการใช้วัตถุดิบฟอยล์แต่ละลาย (ขาว, ดำ, ไม้อ่อน, ไม้เข้ม, เทา, กลีบบัว) ต่อเดือน เพื่อวางแผนสั่งซื้อและประเมินสต๊อก
          </p>
        </div>
      </div>

      {/* KPI Highlight Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Usage in Year */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            ยอดใช้ฟอยล์รวมปี {selectedYear}
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
            {formatMeters(yearStats.totalUsed)} <span className="text-xs font-normal text-slate-500">ม.</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            จากคำสั่งตัด {yearStats.cutCount} ใบ SO
          </div>
        </div>

        {/* Top Used Pattern */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            ลายที่ใช้มากที่สุด (Top Pattern)
          </span>
          <div className="flex items-center gap-2">
            <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${getCanonicalPatternStyle(yearStats.topPattern).dotClass}`} />
            <span className="text-lg sm:text-xl font-black text-slate-900 truncate">
              {yearStats.topPattern}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {formatMeters(yearStats.topPatternVal)} ม. ({yearStats.topPatternPercent}%)
          </div>
        </div>

        {/* Peak Usage Month */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
            เดือนที่ยอดใช้ฟอยล์สูงสุด
          </span>
          <div className="text-lg sm:text-xl font-black text-amber-900 truncate">
            {yearStats.peakMonth}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {formatMeters(yearStats.peakMonthVal)} ม. ในเดือนนั้น
          </div>
        </div>

        {/* NG Scrap & Yield */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            ของเสีย NG สะสมทั้งปี
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-600">
            {formatMeters(yearStats.totalNg)} <span className="text-xs font-normal text-slate-500">ม.</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            อัตราเสีย {yearStats.yearNgRate.toFixed(1)}% ของการตัด
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Month-over-Month (MoM) Summary: เดือนปัจจุบันเทียบกับเดือนก่อนหน้า */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        {/* Header with Title and Month Picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                สรุปการใช้ฟอยล์: {momData.currMonthName}
                <span className="text-xs font-normal text-slate-500">
                  (เทียบกับ {momData.prevMonthName})
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                เปรียบเทียบสถิติการใช้งาน ยอดตัดลงแผ่นจริง ของเสีย NG และสัดส่วนแต่ละลาย
              </p>
            </div>
          </div>

          {/* Month Selector dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">เลือกเดือน:</span>
            <select
              value={targetMonthIndex}
              onChange={(e) => setTargetMonthIndex(Number(e.target.value))}
              className="font-bold text-slate-900 bg-transparent border-none outline-none cursor-pointer"
            >
              {MONTH_NAMES_TH.map((m, idx) => (
                <option key={m.num} value={idx}>
                  {m.full} ({chartData[idx]?.totalUsed > 0 ? `${formatMeters(chartData[idx].totalUsed)} ม.` : 'ไม่มีการตัด'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Comparison Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. ยอดใช้จริงลงแผ่น (Used Meters) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">1. ยอดใช้จริง (ลงแผ่น)</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                momData.diffUsed > 0
                  ? 'bg-amber-100 text-amber-900'
                  : momData.diffUsed < 0
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {momData.diffUsed > 0 ? <ArrowUpRight className="w-3 h-3 text-amber-700" /> : momData.diffUsed < 0 ? <ArrowDownRight className="w-3 h-3 text-blue-700" /> : <Minus className="w-3 h-3" />}
                {momData.diffUsed > 0 ? `+${formatMeters(momData.diffUsed)} ม.` : momData.diffUsed < 0 ? `${formatMeters(momData.diffUsed)} ม.` : 'เท่าเดิม'}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
              {formatMeters(momData.currM.totalUsed)} <span className="text-xs font-normal text-slate-500">ม.</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-200/60">
              <span>เดือนก่อนหน้า:</span>
              <span className="font-bold text-slate-700">{formatMeters(momData.prevTotalUsed)} ม.</span>
              <span className="font-bold text-slate-700">({momData.percentUsed > 0 ? `+${momData.percentUsed}%` : `${momData.percentUsed}%`})</span>
            </div>
          </div>

          {/* 2. ของเสีย NG */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">2. ของเสีย NG</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                momData.diffNg > 0
                  ? 'bg-rose-100 text-rose-800'
                  : momData.diffNg < 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {momData.diffNg > 0 ? <ArrowUpRight className="w-3 h-3 text-rose-600" /> : momData.diffNg < 0 ? <ArrowDownRight className="w-3 h-3 text-emerald-600" /> : <Minus className="w-3 h-3" />}
                {momData.diffNg > 0 ? `+${formatMeters(momData.diffNg)} ม.` : momData.diffNg < 0 ? `${formatMeters(momData.diffNg)} ม.` : 'เท่าเดิม'}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-rose-600">
              {formatMeters(momData.currM.totalNg)} <span className="text-xs font-normal text-slate-500">ม.</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-200/60">
              <span>เดือนก่อนหน้า:</span>
              <span className="font-bold text-slate-700">{formatMeters(momData.prevTotalNg)} ม.</span>
              <span>
                (เสีย {momData.currM.totalDeducted > 0 ? ((momData.currM.totalNg / momData.currM.totalDeducted) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </div>

          {/* 3. รวมตัดสต๊อกทั้งหมด (Used + NG) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">3. รวมตัดสต๊อก</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-mono">
                {momData.diffDeducted > 0 ? `+${formatMeters(momData.diffDeducted)} ม.` : `${formatMeters(momData.diffDeducted)} ม.`}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
              {formatMeters(momData.currM.totalDeducted)} <span className="text-xs font-normal text-slate-500">ม.</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-200/60">
              <span>เดือนก่อนหน้า:</span>
              <span className="font-bold text-slate-700">{formatMeters(momData.prevTotalDeducted)} ม.</span>
            </div>
          </div>

          {/* 4. จำนวนใบสั่งตัด SO */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">4. จำนวนคำสั่งตัด</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${
                momData.diffCutCount > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {momData.diffCutCount > 0 ? `+${momData.diffCutCount} ใบ` : `${momData.diffCutCount} ใบ`}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
              {momData.currM.cutCount} <span className="text-xs font-normal text-slate-500">ครั้ง/SO</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-200/60">
              <span>เดือนก่อนหน้า:</span>
              <span className="font-bold text-slate-700">{momData.prevCutCount} ครั้ง/SO</span>
            </div>
          </div>
        </div>

        {/* Pattern-by-Pattern Breakdown */}
        <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/70 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              เปรียบเทียบการใช้งานแยกตามลายฟอยล์ ({momData.currMonthName} vs {momData.prevMonthName})
            </span>
            <span className="text-[11px] text-slate-500 font-mono">หน่วย: เมตร</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {momData.patternBreakdown.map((p) => {
              const style = getCanonicalPatternStyle(p.pattern);
              return (
                <div key={p.pattern} className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {p.pattern}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: PATTERN_HEX_COLORS[normalizePattern(p.pattern)] || '#cbd5e1' }}
                    />
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-900">
                    {formatMeters(p.currVal)} <span className="text-[10px] font-normal text-slate-400">ม.</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>ก่อน: {formatMeters(p.prevVal)}</span>
                    <span className={p.diff > 0 ? 'text-amber-700 font-bold' : p.diff < 0 ? 'text-blue-700 font-bold' : 'text-slate-400'}>
                      {p.diff > 0 ? `+${formatMeters(p.diff)}` : p.diff < 0 ? formatMeters(p.diff) : '0'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Control Panel: Year, Mode, Metric & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 text-xs">
        {/* Left: Year & Range Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 font-medium text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>ปี:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="font-bold font-mono text-slate-900 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} ({y + 543})
                </option>
              ))}
            </select>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setMetric('used')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                metric === 'used'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ใช้จริง (ม.)
            </button>
            <button
              type="button"
              onClick={() => setMetric('totalDeducted')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                metric === 'totalDeducted'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รวมตัด (Used+NG)
            </button>
            <button
              type="button"
              onClick={() => setMetric('ng')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                metric === 'ng'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              เฉพาะ NG
            </button>
          </div>
        </div>

        {/* Right: Chart Type (Stacked vs Grouped) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setChartType('stacked')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'stacked'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="แท่งซ้อน: ดูยอดรวมรายเดือนพร้อมสัดส่วนแต่ละลาย"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>แท่งซ้อน (Stacked)</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('grouped')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'grouped'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="แท่งแยก: เปรียบเทียบความสูงของแต่ละลายเคียงข้างกัน"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>แท่งแยก (Grouped)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDataTable(!showDataTable)}
            className={`px-2.5 py-1 rounded-xl border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              showDataTable
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>ตารางตัวเลข</span>
          </button>
        </div>
      </div>

      {/* Pattern Filter Chips (Interactive Legend) */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1">
          เลือกลายที่แสดงในกราฟ:
        </span>
        {allActivePatterns.map((pat) => {
          const isSelected = selectedPatterns.includes(pat);
          const pStyle = getCanonicalPatternStyle(pat);
          const hexColor = PATTERN_HEX_COLORS[pat] || '#8b5cf6';

          return (
            <button
              key={pat}
              type="button"
              onClick={() => togglePattern(pat)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-white text-slate-900 border-slate-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-transparent opacity-50'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: hexColor }}
              />
              <span>{pStyle.label}</span>
            </button>
          );
        })}

        {selectedPatterns.length < allActivePatterns.length && (
          <button
            type="button"
            onClick={selectAllPatterns}
            className="text-xs text-amber-700 hover:underline font-semibold ml-1 cursor-pointer"
          >
            เลือกทั้งหมด
          </button>
        )}
      </div>

      {/* Recharts Bar Chart Container */}
      <div className="w-full h-80 sm:h-96 pt-2">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm space-y-1">
            <BarChart3 className="w-8 h-8 text-slate-300 stroke-1" />
            <p>ยังไม่มีบันทึกข้อมูลการตัดสต๊อกในปี {selectedYear}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
              />

              {/* Render Bars for each selected pattern */}
              {selectedPatterns.map((pat) => {
                const hexColor = PATTERN_HEX_COLORS[pat] || '#8b5cf6';
                return (
                  <Bar
                    key={pat}
                    dataKey={pat}
                    name={getCanonicalPatternStyle(pat).label}
                    fill={hexColor}
                    stackId={chartType === 'stacked' ? 'monthly_stack' : undefined}
                    radius={chartType === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Expandable Tabular Data View for Detailed Audit */}
      {showDataTable && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>ตารางตัวเลขสรุปการใช้ฟอยล์รายเดือน (เมตร) ประจำปี {selectedYear}</span>
            <button
              type="button"
              onClick={handleExportMonthlyCSV}
              className="text-amber-800 hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>ดาวน์โหลดตารางเป็น CSV</span>
            </button>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2">เดือน</th>
                  <th className="px-3 py-2 text-right">ยอดรวม ({metric === 'used' ? 'ใช้จริง' : metric === 'totalDeducted' ? 'ตัดรวม' : 'NG'})</th>
                  {selectedPatterns.map((p) => (
                    <th key={p} className="px-3 py-2 text-right">{p}</th>
                  ))}
                  <th className="px-3 py-2 text-right">จำนวน SO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {chartData.map((m) => (
                  <tr key={m.monthNum} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 font-sans font-semibold text-slate-900">
                      {m.monthFull}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-amber-900">
                      {formatMeters(m.currentMetricTotal)} ม.
                    </td>
                    {selectedPatterns.map((p) => (
                      <td key={p} className="px-3 py-2 text-right text-slate-700">
                        {formatMeters((m as any)[p] || 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-slate-500 font-sans">
                      {m.cutCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
