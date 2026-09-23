import React, { useState, useMemo } from 'react';
import { 
  StockCutRecord, 
  FoilRoll 
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

interface DailyProductionFlowProps {
  records: StockCutRecord[];
  rolls: FoilRoll[];
  onOpenCutModal?: () => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const DailyProductionFlow: React.FC<DailyProductionFlowProps> = ({
  records,
  rolls,
  showToast,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [copiedDaily, setCopiedDaily] = useState<boolean>(false);

  // Get available dates from records, sorted descending
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    dates.add(todayStr);
    records.forEach((r) => {
      const d = (r.usageDate || r.recordedDate || r.createdAt || '').slice(0, 10);
      if (d && d.length === 10) dates.add(d);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [records, todayStr]);

  // Filter records for selected date
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

  // Statistics for the day
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

  // Chart data per SO for this day
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
    if (dayRecords.length === 0) {
      if (showToast) showToast('ยังไม่มีรายการผลิตในวันที่เลือก', 'info');
      return;
    }

    const lines: string[] = [
      `📊 ผลการผลิตและตัดสต๊อกฟอยล์รายวัน`,
      `🏢 หลังคาเย็นสยาม (ร่มเกล้า)`,
      `📅 วันที่: ${displaySelectedDate} (${selectedDate})`,
      `─────────────────────────`,
      `✅ ยอดตัดลงแผ่นจริง: ${stats.totalUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.`,
      `⚠️ เศษ NG เสีย: ${stats.totalNg.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.`,
      `📈 ประสิทธิภาพการผลิต (Yield): ${stats.yieldRate.toFixed(2)}%`,
      `📦 คำสั่งซื้อ (SO): ${stats.soCount} รายการ | เบิกใช้ ${stats.rollCount} ม้วน`,
      `─────────────────────────`,
      `📋 ลำดับงานผลิต (Flow Timeline):`,
    ];

    dayRecords.forEach((r, idx) => {
      const sideText = r.isSilverSide ? ' [ท้องเงิน]' : r.isWhiteSide ? ' [ท้องขาว]' : '';
      lines.push(
        `${idx + 1}. SO: ${r.soNumber} | ม้วน: #${r.rollNumber} (${r.lotNumber})` +
        `\n   - ลาย: ${r.pattern}${sideText} | หน้า ${r.width} มม.` +
        `\n   - ผลิตได้: ${r.usedMeters.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.` +
        (r.ngMeters > 0 ? ` (NG: ${r.ngMeters.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.)` : '') +
        ` | ผู้ตัด: ${r.recordedBy || '-'}`
      );
    });

    lines.push(`─────────────────────────`);
    lines.push(`บันทึกระบบสต๊อกฟอยล์ Realtime`);

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedDaily(true);
      setTimeout(() => setCopiedDaily(false), 2500);
      if (showToast) {
        showToast('คัดลอกสรุปผลผลิตรายวันเรียบร้อยแล้ว พร้อมส่งลง LINE!', 'success');
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

        {/* Date Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-950">วันที่ตรวจสอบ:</span>
            <span className="text-amber-900 font-semibold">{displaySelectedDate}</span>
          </div>
          <div className="text-amber-800 font-semibold mt-1 sm:mt-0">
            จำนวนงานที่ผลิต: <strong>{dayRecords.length}</strong> รายการ | คำสั่งซื้อ: <strong>{stats.soCount}</strong> SO
          </div>
        </div>
      </div>

      {/* Visual Process Flow Diagram (ขั้นตอนกระบวนการผลิต 4 ขั้นตอน) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              ขั้นตอนกระบวนการผลิตและการไหลของวัสดุ (Manufacturing Process Flow)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">4 ขั้นตอนมาตรฐาน</span>
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
              ระบุรหัส SO ตรวจสอบชนิดลายฟอยล์ (ขาว/ดำ/ไม้อ่อน/ไม้เข้ม/เทา/กลีบบัว) และตัวเลือกท้อง (เงิน/ขาว)
            </p>
            <div className="pt-1 text-[11px] font-mono text-amber-800 font-medium">
              • กว้าง 830, 850, 880, 900 มม.
            </div>
          </div>

          {/* Step 2: Roll Allocation */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-blue-700 text-white font-mono font-bold text-xs flex items-center justify-center">
                2
              </span>
              <span className="text-[11px] font-mono text-blue-600 font-semibold">Allocation</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">
              เบิกจ่ายม้วนฟอยล์
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              จัดม้วนฟอยล์ตามหลัก FIFO ตรวจสอบเบอร์ม้วน ล็อต และยอดเมตรคงเหลือก่อนนำเข้าเครื่อง
            </p>
            <div className="pt-1 text-[11px] font-mono text-blue-800 font-medium">
              • ม้วนที่เปิดใช้วันนี้: {stats.rollCount} ม้วน
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
              ฉีดโฟม PU & รีดฟอยล์
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              เดินเครื่องจักรฉีดโฟม PU พร้อมรีดประกบฟอยล์ใต้แผ่นหลังคาตามความยาวคำสั่งผลิต
            </p>
            <div className="pt-1 text-[11px] font-mono text-amber-900 font-bold">
              • ผลิตได้วันนี้: {stats.totalUsed.toLocaleString()} ม.
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
              ตรวจรับ & ตัดยอดสต๊อก
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              คัดแยกเศษหัว-ท้าย NG เสีย บันทึกยอดใช้งานจริง และหักยอดสต๊อกคงเหลือ Realtime
            </p>
            <div className="pt-1 text-[11px] font-mono text-emerald-800 font-bold">
              • Yield: {stats.yieldRate.toFixed(1)}% | NG: {stats.totalNg.toLocaleString()} ม.
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Used Meters */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>ยอดผลิตลงแผ่นจริง</span>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700">
              {stats.totalUsed.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-mono">เมตร</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {stats.soCount} คำสั่งซื้อ SO
          </div>
        </div>

        {/* Total NG Meters */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>เศษสูญเสีย (NG)</span>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className={`text-2xl sm:text-3xl font-black font-mono ${
              stats.totalNg > 0 ? 'text-rose-600' : 'text-slate-400'
            }`}>
              {stats.totalNg.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-mono">เมตร</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {stats.totalDeducted > 0
              ? `คิดเป็น ${((stats.totalNg / stats.totalDeducted) * 100).toFixed(1)}% ของการตัด`
              : 'ไม่มีของเสีย'}
          </div>
        </div>

        {/* Yield Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-600" />
            <span>ประสิทธิภาพ (Yield)</span>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
              {stats.yieldRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
            <div
              className={`h-1.5 rounded-full ${
                stats.yieldRate >= 95 ? 'bg-emerald-500' : stats.yieldRate >= 90 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, stats.yieldRate)}%` }}
            />
          </div>
        </div>

        {/* Total Deducted */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            <span>รวมตัดออกจากม้วน</span>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl sm:text-3xl font-black font-mono text-amber-800">
              {stats.totalDeducted.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-mono">เมตร</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            จากม้วนฟอยล์ {stats.rollCount} ม้วน
          </div>
        </div>
      </div>

      {/* Production Breakdown Chart by SO */}
      {chartData.length > 0 ? (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                กราฟเปรียบเทียบยอดผลิตและ NG แยกตามคำสั่งซื้อ SO
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
            {dayRecords.length} รายการ
          </span>
        </div>

        {dayRecords.length === 0 ? (
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
                  <th className="px-4 py-3">รหัส SO / ออเดอร์</th>
                  <th className="px-4 py-3">ม้วนฟอยล์ (ล็อต/เบอร์)</th>
                  <th className="px-4 py-3">หน้ากว้าง</th>
                  <th className="px-4 py-3">ลายท้องฟอยล์</th>
                  <th className="px-4 py-3 text-right">ตัดใช้จริง</th>
                  <th className="px-4 py-3 text-right">NG เสีย</th>
                  <th className="px-4 py-3 text-right">รวมตัดออก</th>
                  <th className="px-4 py-3">ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dayRecords.map((r, idx) => {
                  const pStyle = getPatternStyle(r.pattern);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                        {idx + 1}
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
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-800 text-xs">
                        -{r.totalDeducted.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{r.recordedBy || '-'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
