import React, { useState, useMemo } from 'react';
import { PuSandwichCutRecord } from '../types';
import {
  groupPuSandwichByThaiColors,
  PrimaryColorGroup,
  KNOWN_BASE_THAI_COLORS,
} from '../utils/thaiColorCategorizer';
import { formatMeters } from '../utils/formatters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Layers,
  Scale,
  FileText,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Table as TableIcon,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface PuSandwichChartProps {
  records: PuSandwichCutRecord[];
  className?: string;
}

type ChartViewMode = 'color' | 'monthly' | 'thickness';
type ChartMetric = 'meters' | 'weight' | 'ng';

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

export const PuSandwichChart: React.FC<PuSandwichChartProps> = ({
  records = [],
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('color');
  const [metric, setMetric] = useState<ChartMetric>('meters');
  const [showTable, setShowTable] = useState<boolean>(false);

  // Group by colors
  const colorGroups = useMemo(() => groupPuSandwichByThaiColors(records), [records]);

  // Grand totals
  const totalMeters = useMemo(
    () => records.reduce((sum, r) => sum + (Number(r.soLengthMeters) || 0), 0),
    [records]
  );
  const totalWeight = useMemo(
    () => records.reduce((sum, r) => sum + (Number(r.weightUsed) || 0), 0),
    [records]
  );
  const totalNgMeters = useMemo(
    () => records.reduce((sum, r) => sum + (Number(r.ngMeters) || 0), 0),
    [records]
  );
  const totalNgKg = useMemo(
    () => records.reduce((sum, r) => sum + (Number(r.ngKg) || 0), 0),
    [records]
  );

  // Top color
  const topColor = colorGroups[0];
  const topColorPct = totalMeters > 0 && topColor ? ((topColor.totalLengthMeters / totalMeters) * 100).toFixed(1) : '0';

  // 1. Data for "แยกตามสีคอยล์" (By Color)
  const colorChartData = useMemo(() => {
    return colorGroups.map((g) => ({
      name: g.displayLabel,
      baseColor: g.baseColor,
      meters: g.totalLengthMeters,
      weight: g.totalWeightKg,
      ng: g.totalNgMeters,
      ngKg: g.totalNgKg,
      count: g.count,
      barColor: g.colorMeta.barColor || '#059669',
      subVariantsText: g.subVariants.map((s) => s.subColor).join(', '),
      percent: totalMeters > 0 ? ((g.totalLengthMeters / totalMeters) * 100).toFixed(1) : '0',
    }));
  }, [colorGroups, totalMeters]);

  // 2. Data for "แนวโน้มรายเดือน" (Monthly Trend)
  const currentYear = new Date().getFullYear();
  const monthlyChartData = useMemo(() => {
    const map = new Map<
      string,
      {
        monthNum: string;
        monthName: string;
        externalMeters: number;
        blueScopeMeters: number;
        otherMeters: number;
        externalWeight: number;
        blueScopeWeight: number;
        otherWeight: number;
        ngMeters: number;
        ngKg: number;
        totalMeters: number;
        totalWeight: number;
        count: number;
      }
    >();

    MONTH_NAMES_TH.forEach((m) => {
      map.set(m.num, {
        monthNum: m.num,
        monthName: m.short,
        externalMeters: 0,
        blueScopeMeters: 0,
        otherMeters: 0,
        externalWeight: 0,
        blueScopeWeight: 0,
        otherWeight: 0,
        ngMeters: 0,
        ngKg: 0,
        totalMeters: 0,
        totalWeight: 0,
        count: 0,
      });
    });

    records.forEach((r) => {
      const d = r.productionDate || (r.createdAt ? r.createdAt.slice(0, 10) : '');
      if (!d || d.length < 7) return;
      const monthNum = d.slice(5, 7);
      const entry = map.get(monthNum);
      if (!entry) return;

      const m = Number(r.soLengthMeters) || 0;
      const w = Number(r.weightUsed) || 0;
      const ngM = Number(r.ngMeters) || 0;
      const ngK = Number(r.ngKg) || 0;
      const origin = r.steelOrigin || 'เหล็กนอก';

      entry.count += 1;
      entry.totalMeters += m;
      entry.totalWeight += w;
      entry.ngMeters += ngM;
      entry.ngKg += ngK;

      if (origin.includes('Blue Scope')) {
        entry.blueScopeMeters += m;
        entry.blueScopeWeight += w;
      } else if (origin.includes('เหล็กนอก')) {
        entry.externalMeters += m;
        entry.externalWeight += w;
      } else {
        entry.otherMeters += m;
        entry.otherWeight += w;
      }
    });

    return Array.from(map.values()).map((row) => ({
      ...row,
      externalMeters: Math.round(row.externalMeters * 10) / 10,
      blueScopeMeters: Math.round(row.blueScopeMeters * 10) / 10,
      otherMeters: Math.round(row.otherMeters * 10) / 10,
      externalWeight: Math.round(row.externalWeight * 100) / 100,
      blueScopeWeight: Math.round(row.blueScopeWeight * 100) / 100,
      otherWeight: Math.round(row.otherWeight * 100) / 100,
      totalMeters: Math.round(row.totalMeters * 10) / 10,
      totalWeight: Math.round(row.totalWeight * 100) / 100,
      ngMeters: Math.round(row.ngMeters * 10) / 10,
      ngKg: Math.round(row.ngKg * 100) / 100,
    }));
  }, [records]);

  // 3. Data for "แยกตามความหนา" (By Thickness)
  const thicknessChartData = useMemo(() => {
    const map = new Map<
      string,
      {
        thickness: string;
        numThickness: number;
        meters: number;
        weight: number;
        ngMeters: number;
        count: number;
      }
    >();

    records.forEach((r) => {
      const num = parseFloat(String(r.thickness).replace(/[^0-9.]/g, '')) || 0;
      const label = num > 0 ? `${num.toFixed(2)} มม.` : (r.thickness?.trim() || 'ไม่ระบุ');

      if (!map.has(label)) {
        map.set(label, {
          thickness: label,
          numThickness: num,
          meters: 0,
          weight: 0,
          ngMeters: 0,
          count: 0,
        });
      }
      const item = map.get(label)!;
      item.count += 1;
      item.meters += Number(r.soLengthMeters) || 0;
      item.weight += Number(r.weightUsed) || 0;
      item.ngMeters += Number(r.ngMeters) || 0;
    });

    const list = Array.from(map.values()).map((t) => ({
      ...t,
      meters: Math.round(t.meters * 10) / 10,
      weight: Math.round(t.weight * 100) / 100,
      ngMeters: Math.round(t.ngMeters * 10) / 10,
    }));

    list.sort((a, b) => a.numThickness - b.numThickness);
    return list;
  }, [records]);

  // Custom Tooltip for Color Chart
  const CustomColorTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-mono max-w-xs space-y-1.5 animate-in fade-in-50">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
          <span
            className="w-3 h-3 rounded-full border border-white/40 shrink-0"
            style={{ backgroundColor: data.barColor }}
          />
          <span className="font-bold text-sm text-white font-sans">{data.name}</span>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 ml-auto font-bold">
            {data.percent}%
          </span>
        </div>
        <div className="space-y-1 pt-0.5">
          <div className="flex justify-between text-slate-300">
            <span>ความยาวผลิต:</span>
            <strong className="text-emerald-400">{formatMeters(data.meters)} ม.</strong>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>น้ำหนักใช้:</span>
            <strong className="text-slate-100">{formatMeters(data.weight)} กก.</strong>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>จำนวนใบ SO:</span>
            <strong className="text-slate-100">{data.count} ใบงาน</strong>
          </div>
          {data.ng > 0 && (
            <div className="flex justify-between text-rose-300">
              <span>NG ที่เสีย:</span>
              <strong className="text-rose-400">
                {formatMeters(data.ng)} ม. ({formatMeters(data.ngKg)} กก.)
              </strong>
            </div>
          )}
          {data.subVariantsText && (
            <div className="text-[10px] text-slate-400 font-sans border-t border-slate-800 pt-1 mt-1 truncate">
              สีย่อย: {data.subVariantsText}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Custom Tooltip for Monthly Chart
  const CustomMonthlyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-mono max-w-xs space-y-1.5">
        <div className="font-bold text-sm text-white font-sans border-b border-slate-800 pb-1">
          เดือน{label} ({data.count} ใบงาน)
        </div>
        <div className="space-y-1 pt-0.5">
          <div className="flex justify-between text-emerald-400">
            <span>เหล็กนอก:</span>
            <strong>{metric === 'weight' ? `${formatMeters(data.externalWeight)} กก.` : `${formatMeters(data.externalMeters)} ม.`}</strong>
          </div>
          <div className="flex justify-between text-sky-400">
            <span>Blue Scope:</span>
            <strong>{metric === 'weight' ? `${formatMeters(data.blueScopeWeight)} กก.` : `${formatMeters(data.blueScopeMeters)} ม.`}</strong>
          </div>
          {data.otherMeters > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>อื่นๆ:</span>
              <strong>{metric === 'weight' ? `${formatMeters(data.otherWeight)} กก.` : `${formatMeters(data.otherMeters)} ม.`}</strong>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-800 pt-1 text-amber-300 font-bold">
            <span>รวมเดือนนี้:</span>
            <strong>{metric === 'weight' ? `${formatMeters(data.totalWeight)} กก.` : `${formatMeters(data.totalMeters)} ม.`}</strong>
          </div>
          {data.ngMeters > 0 && (
            <div className="flex justify-between text-rose-400">
              <span>NG เสียหาย:</span>
              <strong>{formatMeters(data.ngMeters)} ม. ({formatMeters(data.ngKg)} กก.)</strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Metric label and unit
  const metricLabel = metric === 'meters' ? 'ความยาว (เมตร)' : metric === 'weight' ? 'น้ำหนัก (กก.)' : 'NG เสียหาย (ม.)';
  const metricUnit = metric === 'meters' ? 'ม.' : metric === 'weight' ? 'กก.' : 'ม.';

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden ${className}`}>
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-slate-950 uppercase">
                PU Sandwich Chart
              </span>
              <span className="text-xs text-emerald-200/80 font-medium hidden sm:inline">
                วิเคราะห์การผลิตเปรียบเทียบ
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
              ชาร์ตวิเคราะห์ผลการผลิต PU Sandwich
            </h3>
          </div>
        </div>

        {/* Quick View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('color')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              viewMode === 'color'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🎨 แยกตามสีคอยล์
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              viewMode === 'monthly'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📅 รายเดือน
          </button>
          <button
            type="button"
            onClick={() => setViewMode('thickness')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              viewMode === 'thickness'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📏 ตามความหนา
          </button>
        </div>
      </div>

      {/* Control Bar: Metric Selector + Insights */}
      <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Metric Selector Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 font-bold mr-1">แกนข้อมูล:</span>
          <button
            type="button"
            onClick={() => setMetric('meters')}
            className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              metric === 'meters'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            📏 ความยาว SO (เมตร)
          </button>
          <button
            type="button"
            onClick={() => setMetric('weight')}
            className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              metric === 'weight'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            ⚖️ น้ำหนักเหล็ก (กก.)
          </button>
          <button
            type="button"
            onClick={() => setMetric('ng')}
            className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              metric === 'ng'
                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            ⚠️ NG เสียหาย (ม.)
          </button>
        </div>

        {/* Insights & Table Toggle */}
        <div className="flex items-center gap-2 ml-auto">
          {topColor && (
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl text-emerald-950 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                สีนิยมอันดับ 1: <strong className="font-bold text-emerald-800">{topColor.displayLabel}</strong> ({topColorPct}%)
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              showTable
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{showTable ? 'ซ่อนตาราง' : 'ดูตารางสรุป'}</span>
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="p-3 sm:p-5">
        {records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">ยังไม่มีข้อมูลการผลิต PU Sandwich สำหรับแสดงชาร์ต</p>
          </div>
        ) : (
          <div className="w-full">
            {/* View 1: By Coil Color */}
            {viewMode === 'color' && (
              <div>
                <div className="flex items-center justify-between mb-3 text-xs text-slate-600">
                  <span className="font-bold flex items-center gap-1.5 text-slate-800">
                    <span>เปรียบเทียบตามกลุ่มสีหลักภาษาไทย ({colorChartData.length} กลุ่มสี)</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    แกนค่า: {metricLabel}
                  </span>
                </div>
                <div className="h-72 w-full min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={colorChartData}
                      margin={{ top: 10, right: 15, left: -10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                      />
                      <Tooltip content={<CustomColorTooltip />} />
                      <Bar
                        dataKey={metric}
                        name={metricLabel}
                        radius={[6, 6, 0, 0]}
                        animationDuration={600}
                      >
                        {colorChartData.map((entry) => (
                          <Cell
                            key={entry.baseColor}
                            fill={metric === 'ng' ? '#e11d48' : entry.barColor}
                            stroke={entry.baseColor === 'ขาว' ? '#94a3b8' : 'none'}
                            strokeWidth={entry.baseColor === 'ขาว' ? 1.5 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* View 2: Monthly Trend */}
            {viewMode === 'monthly' && (
              <div>
                <div className="flex items-center justify-between mb-3 text-xs text-slate-600">
                  <span className="font-bold text-slate-800">
                    แนวโน้มยอดผลิตรายเดือน ประจำปี {currentYear + 543} (ม.ค. - ธ.ค.)
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    แกนค่า: {metricLabel}
                  </span>
                </div>
                <div className="h-72 w-full min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyChartData}
                      margin={{ top: 10, right: 15, left: -10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="monthName" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                      />
                      <Tooltip content={<CustomMonthlyTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        formatter={(val) => <span className="text-xs font-bold text-slate-700">{val}</span>}
                      />
                      {metric === 'meters' && (
                        <>
                          <Bar dataKey="externalMeters" name="เหล็กนอก (ม.)" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="blueScopeMeters" name="Blue Scope (ม.)" stackId="a" fill="#0284c7" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="otherMeters" name="อื่นๆ (ม.)" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
                        </>
                      )}
                      {metric === 'weight' && (
                        <>
                          <Bar dataKey="externalWeight" name="เหล็กนอก (กก.)" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="blueScopeWeight" name="Blue Scope (กก.)" stackId="a" fill="#0284c7" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="otherWeight" name="อื่นๆ (กก.)" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
                        </>
                      )}
                      {metric === 'ng' && (
                        <Bar dataKey="ngMeters" name="NG เสียหาย (ม.)" fill="#e11d48" radius={[6, 6, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* View 3: By Thickness */}
            {viewMode === 'thickness' && (
              <div>
                <div className="flex items-center justify-between mb-3 text-xs text-slate-600">
                  <span className="font-bold text-slate-800">
                    เปรียบเทียบตามความหนาคอยล์เหล็ก ({thicknessChartData.length} ขนาดความหนา)
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    แกนค่า: {metricLabel}
                  </span>
                </div>
                <div className="h-72 w-full min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={thicknessChartData}
                      margin={{ top: 10, right: 15, left: -10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="thickness" tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                      />
                      <Tooltip
                        formatter={(val: any) => [`${formatMeters(val)} ${metricUnit}`, metricLabel]}
                        labelFormatter={(lbl) => `ความหนา: ${lbl}`}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                      />
                      <Bar
                        dataKey={metric}
                        name={metricLabel}
                        fill={metric === 'ng' ? '#e11d48' : '#0d9488'}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Optional Data Table View */}
            {showTable && (
              <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in">
                <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>ตารางข้อมูลสรุป {viewMode === 'color' ? 'แยกตามสี' : viewMode === 'monthly' ? 'รายเดือน' : 'ตามความหนา'}</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">หมวดหมู่</th>
                        <th className="py-2 px-3 text-center">จำนวน SO</th>
                        <th className="py-2 px-3 text-right">ความยาวผลิต (ม.)</th>
                        <th className="py-2 px-3 text-right">น้ำหนักใช้ (กก.)</th>
                        <th className="py-2 px-3 text-right">NG (ม.)</th>
                        <th className="py-2 px-3 text-right">สัดส่วน (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {viewMode === 'color' &&
                        colorChartData.map((row) => (
                          <tr key={row.baseColor} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-sans font-bold flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.barColor }}
                              />
                              <span>{row.name}</span>
                            </td>
                            <td className="py-2 px-3 text-center font-bold">{row.count}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-800">{formatMeters(row.meters)}</td>
                            <td className="py-2 px-3 text-right font-bold">{formatMeters(row.weight)}</td>
                            <td className="py-2 px-3 text-right text-rose-600">{row.ng > 0 ? formatMeters(row.ng) : '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-700">{row.percent}%</td>
                          </tr>
                        ))}

                      {viewMode === 'monthly' &&
                        monthlyChartData
                          .filter((m) => m.count > 0)
                          .map((m) => (
                            <tr key={m.monthNum} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 font-sans font-bold">เดือน{m.monthName}</td>
                              <td className="py-2 px-3 text-center font-bold">{m.count}</td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-800">{formatMeters(m.totalMeters)}</td>
                              <td className="py-2 px-3 text-right font-bold">{formatMeters(m.totalWeight)}</td>
                              <td className="py-2 px-3 text-right text-rose-600">{m.ngMeters > 0 ? formatMeters(m.ngMeters) : '—'}</td>
                              <td className="py-2 px-3 text-right font-bold text-slate-700">
                                {totalMeters > 0 ? ((m.totalMeters / totalMeters) * 100).toFixed(1) : 0}%
                              </td>
                            </tr>
                          ))}

                      {viewMode === 'thickness' &&
                        thicknessChartData.map((t) => (
                          <tr key={t.thickness} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-sans font-bold">{t.thickness}</td>
                            <td className="py-2 px-3 text-center font-bold">{t.count}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-800">{formatMeters(t.meters)}</td>
                            <td className="py-2 px-3 text-right font-bold">{formatMeters(t.weight)}</td>
                            <td className="py-2 px-3 text-right text-rose-600">{t.ngMeters > 0 ? formatMeters(t.ngMeters) : '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-700">
                              {totalMeters > 0 ? ((t.meters / totalMeters) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
