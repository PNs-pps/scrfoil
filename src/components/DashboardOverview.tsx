import React from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS } from '../utils/soFormatter';
import { formatMeters } from '../utils/formatters';
import { 
  Package, 
  Scissors, 
  AlertOctagon, 
  TrendingDown, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  Sparkles,
  BarChart2
} from 'lucide-react';

interface DashboardOverviewProps {
  rolls: FoilRoll[];
  records: StockCutRecord[];
  onOpenCutModal: (rollId?: string) => void;
  onOpenAddModal: () => void;
  onViewAllRolls: () => void;
  onViewAllHistory: () => void;
  onOpenMonthlySummary?: () => void;
  onOpenBatchImport?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  rolls,
  records,
  onOpenCutModal,
  onOpenAddModal,
  onViewAllRolls,
  onViewAllHistory,
  onOpenMonthlySummary,
  onOpenBatchImport,
}) => {
  // Aggregate KPIs
  const totalRemainingMeters = rolls.reduce((acc, r) => acc + r.remainingMeters, 0);
  const totalOriginalMeters = rolls.reduce((acc, r) => acc + r.totalMeters, 0);
  const totalUsedMeters = records.reduce((acc, r) => acc + r.usedMeters, 0);
  const totalNgMeters = records.reduce((acc, r) => acc + r.ngMeters, 0);
  const totalDeductedMeters = totalUsedMeters + totalNgMeters;
  const ngRatePercent = totalDeductedMeters > 0 
    ? ((totalNgMeters / totalDeductedMeters) * 100).toFixed(1) 
    : '0.0';

  const activeRolls = rolls.filter(r => r.remainingMeters > 0);
  const depletedRolls = rolls.filter(r => r.remainingMeters <= 0);
  const redAlertRolls = rolls.filter(r => r.remainingMeters > 0 && r.remainingMeters <= 200);
  const orangeAlertRolls = rolls.filter(r => r.remainingMeters > 200 && r.remainingMeters <= 500);

  // Group by Pattern
  const patternStats = STANDARD_PATTERNS.map(p => {
    const matchedRolls = rolls.filter(r => r.pattern === p.value);
    const remaining = matchedRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
    const total = matchedRolls.reduce((sum, r) => sum + r.totalMeters, 0);
    const count = matchedRolls.filter(r => r.remainingMeters > 0).length;
    return {
      name: p.value,
      label: p.label,
      remaining,
      total,
      count,
      percent: total > 0 ? Math.round((remaining / total) * 100) : 0,
    };
  });

  // Also include any custom patterns not in standard
  const customPatterns: string[] = Array.from(new Set(
    rolls.map(r => r.pattern).filter(p => !STANDARD_PATTERNS.some(sp => sp.value === p))
  ));
  customPatterns.forEach((cp: string) => {
    const matchedRolls = rolls.filter(r => r.pattern === cp);
    const remaining = matchedRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
    const total = matchedRolls.reduce((sum, r) => sum + r.totalMeters, 0);
    const count = matchedRolls.filter(r => r.remainingMeters > 0).length;
    patternStats.push({
      name: cp,
      label: cp,
      remaining,
      total,
      count,
      percent: total > 0 ? Math.round((remaining / total) * 100) : 0,
    });
  });

  // Group by Width
  const widthStats = STANDARD_WIDTHS.map(w => {
    const matchedRolls = rolls.filter(r => r.width === w);
    const remaining = matchedRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
    const total = matchedRolls.reduce((sum, r) => sum + r.totalMeters, 0);
    const count = matchedRolls.filter(r => r.remainingMeters > 0).length;
    return {
      width: w,
      remaining,
      total,
      count,
      percent: total > 0 ? Math.round((remaining / total) * 100) : 0,
    };
  });

  // Recent 5 cuts
  const recentCuts = [...records].reverse().slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Welcome / Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-400 text-slate-950">
              หลังคาเย็นสยาม (ร่มเกล้า)
            </span>
            <span className="text-xs text-slate-400">
              ระบบสต๊อกฟอยล์และบันทึกใบสั่งผลิตตัดฟอยล์
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            แดชบอร์ดคงเหลือฟอยล์หลังคา PU Foam
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            สรุปยอดเมตรคงเหลือสะสม ม้วนฟอยล์พร้อมใช้งาน การใช้งานจริง และเศษ NG แยกตามลายและหน้ากว้าง
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 sm:self-center shrink-0">
          {onOpenMonthlySummary && (
            <button
              type="button"
              onClick={onOpenMonthlySummary}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
              title="เปิดหน้าต่างสรุปการใช้ฟอยล์รายเดือนและส่งออกรายงาน"
            >
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <span>สรุปรายเดือน</span>
            </button>
          )}

          {onOpenBatchImport && (
            <button
              type="button"
              onClick={onOpenBatchImport}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
              title="อัปโหลด SO ตัดฟอยล์เป็นชุด"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>อัปโหลด SO ตัดฟอยล์</span>
            </button>
          )}

          <button
            onClick={() => onOpenCutModal()}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Scissors className="w-4 h-4 stroke-[2.5]" />
            <span>ตัดสต๊อก</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Package className="w-4 h-4 text-amber-600" />
            <span>+ รับเข้าม้วนใหม่</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Remaining */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ยอดคงเหลือรวมทั้งหมด
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {formatMeters(totalRemainingMeters)} <span className="text-sm font-normal text-slate-500">เมตร</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>จากลูกเต็มรวม: {formatMeters(totalOriginalMeters)} ม.</span>
              <span className="font-semibold text-amber-700">
                {totalOriginalMeters > 0 ? Math.round((totalRemainingMeters / totalOriginalMeters) * 100) : 0}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div 
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (totalRemainingMeters / (totalOriginalMeters || 1)) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Active Rolls */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ม้วนพร้อมใช้งาน
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {activeRolls.length} <span className="text-sm font-normal text-slate-500">ม้วน</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-slate-500">ม้วนตัดหมดแล้ว:</span>
              <span className="font-semibold text-slate-700 font-mono">{depletedRolls.length} ม้วน</span>
            </div>
            {redAlertRolls.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <span>วิกฤต (&le;200ม.): {redAlertRolls.length} ม้วน</span>
              </div>
            )}
            {orangeAlertRolls.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-orange-800 font-semibold bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>ใกล้หมด (&le;500ม.): {orangeAlertRolls.length} ม้วน</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Total Used in Production */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ผลิตลงแผ่นจริง
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {formatMeters(totalUsedMeters)} <span className="text-sm font-normal text-slate-500">เมตร</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>บันทึกการตัดแล้ว: {records.length} ครั้ง</span>
              <span className="text-blue-700 font-medium font-mono">{records.length > 0 ? records[records.length-1].soNumber : '-'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: NG Waste & Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              NG ที่เสีย (เศษ/ชำรุด)
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-600 tracking-tight">
              {formatMeters(totalNgMeters)} <span className="text-sm font-normal text-slate-500">เมตร</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">'ลายไม้เข้ม'</span>
              <span className="font-bold text-rose-700 font-mono bg-rose-50 px-1.5 py-0.5 rounded">
                {ngRatePercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section: Breakdown by Pattern & Width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Breakdown by Pattern (ลายฟอยล์) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                สต๊อกคงเหลือแยกตามลาย
              </h3>
              <p className="text-xs text-slate-500">
                ขาว, ดำ, ไม้อ่อน, ลายไม้เข้ม, เทา, กลีบบัว
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {patternStats.length} ลาย
            </span>
          </div>

          <div className="space-y-3">
            {patternStats.map((item) => (
              <div key={item.name} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 ${
                      item.name === 'ขาว' ? 'bg-white' :
                      item.name === 'ดำ' ? 'bg-slate-900' :
                      item.name === 'ไม้อ่อน' ? 'bg-amber-200' :
                      item.name === 'ไม้เข้ม' ? 'bg-amber-800' :
                      item.name === 'เทา' ? 'bg-slate-400' :
                      'bg-rose-300'
                    }`} />
                    <span className="text-sm font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {item.count} ม้วน
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {formatMeters(item.remaining)} <span className="text-xs font-normal text-slate-500">ม.</span>
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      item.remaining === 0 ? 'bg-slate-300' :
                      item.name === 'ดำ' ? 'bg-slate-800' :
                      item.name === 'ไม้เข้ม' ? 'bg-amber-800' :
                      item.name === 'ไม้อ่อน' ? 'bg-amber-500' :
                      item.name === 'กลีบบัว' ? 'bg-rose-400' :
                      item.name === 'เทา' ? 'bg-slate-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(item.total > 0 ? (item.remaining / item.total) * 100 : 0, item.remaining > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown by Width (หน้ากว้าง 830, 850, 880, 900) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                สต๊อกคงเหลือแยกตามหน้ากว้าง (มม.)
              </h3>
              <p className="text-xs text-slate-500">
                ขนาด 830, 850, 880, 900 มม. สำหรับลอนแผ่นหลังคาแต่ละรุ่น
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono">
              4 ขนาดหลัก
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {widthStats.map((item) => (
              <div 
                key={item.width} 
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-900 text-amber-400">
                    {item.width} มม.
                  </span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {item.count} ม้วน
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold font-mono text-slate-900">
                    {formatMeters(item.remaining)} <span className="text-xs font-normal text-slate-500">ม.</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                    <span>จาก {formatMeters(item.total)} ม.</span>
                    <span className="font-semibold text-slate-700">{item.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div 
                      className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, item.percent)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Help Guide for Width */}
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs text-slate-700 space-y-1">
            <span className="font-semibold text-amber-900 block flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              คำแนะนำการเลือกหน้ากว้างกับลอนหลังคา:
            </span>
            <p className="text-slate-600 text-[11px]">
              • <strong>830 / 850 มม.:</strong> สำหรับลอนมาตรฐาน 760 , ฉนวนหนา 25 มม. (1 นิ้ว)
            </p>
            <p className="text-slate-600 text-[11px]">
              • <strong>880 / 900 มม.:</strong> สำหรับลอนมาตรฐาน 760 , ฉนวนหนา 50 มม. (2 นิ้ว)
            </p>
          </div>
        </div>

      </div>

      {/* Recent Cut Activities Log Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              รายการตัดสต๊อกล่าสุด (ล่าสุด 5 รายการ)
            </h3>
          </div>
          <button
            onClick={onViewAllHistory}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
          >
            <span>ดูประวัติทั้งหมด ({records.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCuts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            ยังไม่มีประวัติการตัดสต๊อก กดปุ่ม "ตัดสต๊อกฟอยล์" ด้านบนเพื่อเริ่มบันทึก
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">รหัส SO</th>
                  <th className="px-4 py-3 font-semibold">ล็อต / เบอร์</th>
                  <th className="px-4 py-3 font-semibold">ลาย & กว้าง</th>
                  <th className="px-4 py-3 font-semibold text-right">เมตรที่ใช้</th>
                  <th className="px-4 py-3 font-semibold text-right">NG ที่เสีย</th>
                  <th className="px-4 py-3 font-semibold text-right">คงเหลือหลังตัด</th>
                  <th className="px-4 py-3 font-semibold">วันที่ใช้</th>
                  <th className="px-4 py-3 font-semibold">ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {recentCuts.map((cut) => (
                  <tr key={cut.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-amber-800">
                      {cut.soNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-800 text-xs">
                      {cut.lotNumber} <span className="text-slate-400">#{cut.rollNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-medium text-slate-900">{cut.pattern}</span>
                      <span className="text-slate-400 ml-1">({cut.width}มม.)</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                      {formatMeters(cut.usedMeters)} ม.
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600 text-xs">
                      {cut.ngMeters > 0 ? `+${formatMeters(cut.ngMeters)} ม.` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatMeters(cut.remainingAfter)} ม.
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                      {cut.usageDate}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 truncate max-w-[150px]">
                      {cut.recordedBy}
                    </td>
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
