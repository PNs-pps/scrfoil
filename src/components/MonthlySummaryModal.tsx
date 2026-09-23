import React, { useState, useMemo } from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { 
  X, 
  Calendar, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Scissors, 
  AlertOctagon, 
  Layers, 
  Package, 
  Search,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import { formatMeters } from '../utils/formatters';

interface MonthlySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rolls: FoilRoll[];
  records: StockCutRecord[];
  onOpenRollHistory?: (rollId: string) => void;
}

const THAI_MONTHS = [
  { value: '01', label: 'มกราคม' },
  { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' },
  { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' },
  { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' },
  { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' },
  { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' },
  { value: '12', label: 'ธันวาคม' },
];

export const MonthlySummaryModal: React.FC<MonthlySummaryModalProps> = ({
  isOpen,
  onClose,
  rolls,
  records,
  onOpenRollHistory,
}) => {
  // Default to current month and year
  const now = new Date();
  const currentYearAD = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState<number>(currentYearAD);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [filterPattern, setFilterPattern] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [summarySortBy, setSummarySortBy] = useState<'width_lot_roll' | 'most_used'>('width_lot_roll');

  // Available years from records or rolls
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYearAD, currentYearAD - 1, currentYearAD + 1]);
    records.forEach((r) => {
      const d = r.usageDate || r.recordedDate;
      if (d && d.length >= 4) {
        const y = parseInt(d.slice(0, 4), 10);
        if (!isNaN(y) && y > 2000) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [records, currentYearAD]);

  // Filter records matching the selected year and month
  // date format: YYYY-MM-DD
  const monthlyRecords = useMemo(() => {
    const prefix = `${selectedYear}-${selectedMonth}`;
    return records.filter((r) => {
      const d = r.usageDate || r.recordedDate;
      return d && d.startsWith(prefix);
    });
  }, [records, selectedYear, selectedMonth]);

  // Aggregate stats per roll for this month
  const rollUsageSummary = useMemo(() => {
    // Map of rollId -> accumulated stats in this month
    const rollMap = new Map<string, {
      rollId: string;
      lotNumber: string;
      rollNumber: string;
      width: number;
      pattern: string;
      usedMetersThisMonth: number;
      ngMetersThisMonth: number;
      totalDeductedThisMonth: number;
      soNumbers: string[];
      cutCount: number;
      currentRemaining: number;
      totalMeters: number;
      status: 'active' | 'depleted' | 'out_of_stock';
      isZeroedOut?: boolean;
    }>();

    // 1. Process records
    monthlyRecords.forEach((rec) => {
      const key = rec.foilId || `${rec.lotNumber}_${rec.rollNumber}`;
      const existing = rollMap.get(key);
      const targetRoll = rolls.find((r) => r.id === rec.foilId || (r.lotNumber === rec.lotNumber && r.rollNumber === rec.rollNumber));

      if (existing) {
        existing.usedMetersThisMonth += rec.usedMeters;
        existing.ngMetersThisMonth += rec.ngMeters;
        existing.totalDeductedThisMonth += rec.totalDeducted;
        if (rec.soNumber && !existing.soNumbers.includes(rec.soNumber)) {
          existing.soNumbers.push(rec.soNumber);
        }
        existing.cutCount += 1;
      } else {
        rollMap.set(key, {
          rollId: targetRoll ? targetRoll.id : rec.foilId,
          lotNumber: targetRoll ? targetRoll.lotNumber : rec.lotNumber,
          rollNumber: targetRoll ? targetRoll.rollNumber : rec.rollNumber,
          width: targetRoll ? targetRoll.width : rec.width,
          pattern: targetRoll ? targetRoll.pattern : rec.pattern,
          usedMetersThisMonth: rec.usedMeters,
          ngMetersThisMonth: rec.ngMeters,
          totalDeductedThisMonth: rec.totalDeducted,
          soNumbers: rec.soNumber ? [rec.soNumber] : [],
          cutCount: 1,
          currentRemaining: targetRoll ? targetRoll.remainingMeters : 0,
          totalMeters: targetRoll ? targetRoll.totalMeters : 0,
          status: targetRoll ? targetRoll.status : 'active',
          isZeroedOut: targetRoll?.isZeroedOut,
        });
      }
    });

    let list = Array.from(rollMap.values());

    // Apply pattern filter
    if (filterPattern !== 'all') {
      list = list.filter((r) => r.pattern === filterPattern);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => 
        r.lotNumber.toLowerCase().includes(q) ||
        r.rollNumber.toLowerCase().includes(q) ||
        r.pattern.toLowerCase().includes(q) ||
        r.soNumbers.some(so => so.toLowerCase().includes(q))
      );
    }

    // Sort either by Width > Lot > Roll Number (default, easy to check) or by Most Used
    if (summarySortBy === 'width_lot_roll') {
      list.sort((a, b) => {
        if (a.width !== b.width) return Number(a.width) - Number(b.width);
        const lotComp = a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true, sensitivity: 'base' });
        if (lotComp !== 0) return lotComp;
        return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
      });
    } else {
      list.sort((a, b) => b.totalDeductedThisMonth - a.totalDeductedThisMonth);
    }

    return list;
  }, [monthlyRecords, rolls, filterPattern, searchQuery, summarySortBy]);

  // Overall KPIs for this month
  const totalUsedMonth = monthlyRecords.reduce((sum, r) => sum + r.usedMeters, 0);
  const totalNgMonth = monthlyRecords.reduce((sum, r) => sum + r.ngMeters, 0);
  const totalDeductedMonth = totalUsedMonth + totalNgMonth;
  const ngRateMonth = totalDeductedMonth > 0 
    ? ((totalNgMonth / totalDeductedMonth) * 100).toFixed(1) 
    : '0.0';
  const rollsTouchedCount = rollUsageSummary.length;

  const currentMonthLabel = THAI_MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth;
  const thaiYear = selectedYear + 543;

  // Export Monthly Summary to CSV (Ordering: Width > Lot > Roll Number consecutively)
  const handleExportMonthlyCSV = () => {
    const headers = [
      'ลำดับ',
      'หน้ากว้าง (มม.)',
      'เลขล็อต',
      'เบอร์ม้วน',
      'ลายฟอยล์',
      'เมตรที่ใช้ลงแผ่นจริงเดือนนี้ (ม.)',
      'NG ที่เสียเดือนนี้ (ม.)',
      'รวมตัดในเดือนนี้ (ม.)',
      'คงเหลือปัจจุบันในระบบ (ม.)',
      'สัดส่วนคงเหลือ (%)',
      'สถานะม้วน',
      'จำนวนครั้งที่ตัด',
      'รายการใบงาน / SO ที่ตัด'
    ];

    // Ensure rows are sorted Width > Lot > Roll Number for easy physical auditing
    const sortedForExport = [...rollUsageSummary].sort((a, b) => {
      if (a.width !== b.width) return Number(a.width) - Number(b.width);
      const lotComp = a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true, sensitivity: 'base' });
      if (lotComp !== 0) return lotComp;
      return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
    });

    const rows = sortedForExport.map((item, idx) => {
      const pctLeft = item.totalMeters > 0 
        ? Math.round((item.currentRemaining / item.totalMeters) * 100) 
        : 0;
      const statusText = item.isZeroedOut 
        ? 'ตัดเป็น 0 (เศษเหลือน้อย)' 
        : item.currentRemaining <= 0 
          ? 'หมดแล้ว' 
          : item.currentRemaining <= 50 
            ? 'วิกฤต (<=50ม. สีแดง)' 
            : item.currentRemaining <= 200 
              ? 'เหลือน้อย (<=200ม. สีเหลือง)' 
              : 'พร้อมใช้งาน';

      return [
        idx + 1,
        item.width,
        `"${item.lotNumber}"`,
        `"${item.rollNumber}"`,
        `"${item.pattern}"`,
        item.usedMetersThisMonth,
        item.ngMetersThisMonth,
        item.totalDeductedThisMonth,
        item.currentRemaining,
        `${pctLeft}%`,
        `"${statusText}"`,
        item.cutCount,
        `"${item.soNumbers.join(', ')}"`
      ];
    });

    // Add summary row at bottom
    rows.push([
      'รวมทั้งสิ้น',
      '-',
      '-',
      '-',
      '-',
      totalUsedMonth,
      totalNgMonth,
      totalDeductedMonth,
      '-',
      '-',
      '-',
      monthlyRecords.length,
      `"รวม ${rollsTouchedCount} ม้วน"`
    ]);

    const csvContent = '\uFEFF' + [
      `"สรุปการใช้ฟอยล์ประจำเดือน ${currentMonthLabel} พ.ศ. ${thaiYear} - หลังคาเย็นสยาม (ร่มเกล้า)"`,
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `สรุปการใช้ฟอยล์_ประจำเดือน_${currentMonthLabel}_${thaiYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs">
      <div 
        id="modal-monthly-summary"
        className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                  หลังคาเย็นสยาม (ร่มเกล้า)
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  MONTHLY FOIL USAGE REPORT
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white leading-tight mt-0.5">
                ตารางสรุปการใช้ฟอยล์ประจำเดือน
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Period Selector Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Month Select */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-slate-500 font-medium">เดือน:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {THAI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} ({m.value})
                  </option>
                ))}
              </select>
            </div>

            {/* Year Select */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">ปี พ.ศ.:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr + 543} ({yr})
                  </option>
                ))}
              </select>
            </div>

            {/* Pattern Filter */}
            <select
              value={filterPattern}
              onChange={(e) => setFilterPattern(e.target.value)}
              className="text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 shadow-2xs focus:outline-none cursor-pointer"
            >
              <option value="all">ลายฟอยล์: ทั้งหมด</option>
              {Array.from(new Set(rolls.map(r => r.pattern))).map(p => (
                <option key={p} value={p}>ลาย {p}</option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นล็อต, เบอร์, SO..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl w-36 sm:w-48 shadow-2xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Sort Toggle: Width > Lot > Roll (easy check) vs Most used */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => setSummarySortBy('width_lot_roll')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  summarySortBy === 'width_lot_roll'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="เรียงหน้ากว้าง > ล็อต > เบอร์ม้วน เพื่อง่ายต่อการตรวจเช็ค"
              >
                เรียง: กว้าง &gt; ล็อต &gt; เบอร์
              </button>
              <button
                type="button"
                onClick={() => setSummarySortBy('most_used')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  summarySortBy === 'most_used'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ยอดตัดสูงสุด
              </button>
            </div>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportMonthlyCSV}
            disabled={rollUsageSummary.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลดตารางสรุปรายเดือน (CSV)</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Monthly KPI Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Used */}
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-blue-800 uppercase block">
                ลงแผ่นจริงเดือนนี้
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-blue-900 mt-1 block">
                {formatMeters(totalUsedMonth)} <span className="text-xs font-normal text-blue-600">ม.</span>
              </span>
            </div>

            {/* Total NG */}
            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-rose-800 uppercase block">
                NG เสียเดือนนี้
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-rose-700 mt-1 block">
                {formatMeters(totalNgMonth)} <span className="text-xs font-normal text-rose-500">ม.</span>
              </span>
            </div>

            {/* Total Deducted */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-amber-800 uppercase block">
                รวมตัดเดือนนี้
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-amber-900 mt-1 block">
                {formatMeters(totalDeductedMonth)} <span className="text-xs font-normal text-amber-600">ม.</span>
              </span>
            </div>

            {/* Scrap Rate */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-600 uppercase block">
                อัตราส่วนของเสีย (% NG)
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-800 mt-1 block">
                {ngRateMonth}%
              </span>
            </div>

            {/* Cuts Count */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-600 uppercase block">
                จำนวนครั้งที่ตัด
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-800 mt-1 block">
                {monthlyRecords.length} <span className="text-xs font-normal text-slate-500">ครั้ง</span>
              </span>
            </div>

            {/* Rolls Touched */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-600 uppercase block">
                ลูกฟอยล์ที่ถูกตัด
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 mt-1 block">
                {rollsTouchedCount} <span className="text-xs font-normal text-slate-500">ม้วน</span>
              </span>
            </div>
          </div>

          {/* Table Header Description */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>
                  สรุปการใช้งานฟอยล์แต่ละลูก ประจำเดือน {currentMonthLabel} พ.ศ. {thaiYear}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                แสดงยอดตัดลงแผ่นจริง NG ของเสีย รวมตัดในเดือน และยอดคงเหลือปัจจุบันในระบบสำหรับทุกลูกที่ถูกตัด
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              พบ {rollUsageSummary.length} ลูก
            </span>
          </div>

          {/* Table */}
          {rollUsageSummary.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <Scissors className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-base">
                ไม่มีการตัดสต๊อกฟอยล์ในเดือน {currentMonthLabel} พ.ศ. {thaiYear}
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                ลองเลือกเดือนหรือปีอื่น หรือทำการบันทึกตัดสต๊อกใบงาน SO สำหรับเดือนนี้
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3.5">ลำดับ</th>
                      <th className="p-3.5">หน้ากว้าง</th>
                      <th className="p-3.5">เลขล็อต</th>
                      <th className="p-3.5">เบอร์ม้วน</th>
                      <th className="p-3.5">ลายท้องฟอยล์</th>
                      <th className="p-3.5 text-right">ใช้ลงแผ่นจริง (ม.)</th>
                      <th className="p-3.5 text-right">NG เสีย (ม.)</th>
                      <th className="p-3.5 text-right">รวมตัดเดือนนี้ (ม.)</th>
                      <th className="p-3.5 text-right">คงเหลือในระบบ (ม.)</th>
                      <th className="p-3.5 text-center">สถานะปัจจุบัน</th>
                      <th className="p-3.5">ใบสั่งผลิต SO ที่ตัด</th>
                      <th className="p-3.5 text-center">ดูประวัติ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rollUsageSummary.map((item, idx) => {
                      const isZeroed = Boolean(item.isZeroedOut);
                      const rem = item.currentRemaining;
                      const isDepleted = rem <= 0 && !isZeroed;

                      // Thresholds: <= 50 red, <= 200 yellow, > 200 normal
                      const isRed = isZeroed || (rem > 0 && rem <= 50);
                      const isYellow = rem > 50 && rem <= 200;

                      return (
                        <tr key={item.rollId || idx} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-3.5 font-mono text-slate-400 font-medium">
                            {idx + 1}
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-200">
                              {item.width} มม.
                            </span>
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-900 text-xs sm:text-sm">
                            {item.lotNumber}
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono text-xs border border-amber-500">
                              #{item.rollNumber}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-800">
                              {item.pattern}
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-blue-900 text-xs sm:text-sm">
                            {formatMeters(item.usedMetersThisMonth)} <span className="text-[10px] font-normal text-slate-400">ม.</span>
                          </td>
                          <td className="p-3.5 text-right font-mono text-rose-600 font-semibold">
                            {item.ngMetersThisMonth > 0 ? (
                              <>
                                {formatMeters(item.ngMetersThisMonth)}{' '}
                                <span className="text-[10px] font-normal text-slate-400">ม.</span>
                              </>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-amber-900 text-xs sm:text-sm">
                            {formatMeters(item.totalDeductedThisMonth)} <span className="text-[10px] font-normal text-slate-400">ม.</span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className={`font-mono font-bold text-xs sm:text-sm ${
                              isRed ? 'text-rose-700' : isYellow ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              {formatMeters(item.currentRemaining)}{' '}
                              <span className="text-[10px] font-normal text-slate-400">ม.</span>
                            </div>
                            {item.totalMeters > 0 && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                จากเต็ม {formatMeters(item.totalMeters)} ม. ({Math.round((item.currentRemaining / item.totalMeters) * 100)}%)
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {isZeroed ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                ติ๊กเป็น 0 (เศษ)
                              </span>
                            ) : isDepleted ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700">
                                หมดแล้ว
                              </span>
                            ) : isRed ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                &le; 50 ม. (แดง)
                              </span>
                            ) : isYellow ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                &le; 200 ม. (เหลือง)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                พร้อมใช้
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                              {item.soNumbers.slice(0, 4).map((so) => (
                                <span key={so} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-mono text-[10px] font-bold">
                                  {so}
                                </span>
                              ))}
                              {item.soNumbers.length > 4 && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                                  +{item.soNumbers.length - 4} งาน
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.rollId && onOpenRollHistory) {
                                  onClose();
                                  onOpenRollHistory(item.rollId);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="เปิดดูประวัติการใช้งานของลูกนี้"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t border-slate-200 text-slate-900">
                    <tr>
                      <td colSpan={3} className="p-3.5 text-right font-semibold">
                        รวมทั้งสิ้น ({rollUsageSummary.length} ลูก, {monthlyRecords.length} งาน):
                      </td>
                      <td className="p-3.5 text-right font-mono text-blue-900 text-sm">
                        {formatMeters(totalUsedMonth)} ม.
                      </td>
                      <td className="p-3.5 text-right font-mono text-rose-600 text-sm">
                        {formatMeters(totalNgMonth)} ม.
                      </td>
                      <td className="p-3.5 text-right font-mono text-amber-900 text-sm">
                        {formatMeters(totalDeductedMonth)} ม.
                      </td>
                      <td colSpan={4} className="p-3.5 text-slate-500 text-xs font-normal">
                        * อัตราส่วนของเสีย NG ประจำเดือน: {ngRateMonth}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 hidden sm:block">
            บริษัท หลังคาเย็นสยาม (ร่มเกล้า) - ระบบรายงานสต๊อกฟอยล์
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors cursor-pointer ml-auto"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
