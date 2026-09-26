import React, { useState, useMemo } from 'react';
import { PuSandwichCutRecord, SteelOriginType } from '../types';
import { 
  Factory, 
  Search, 
  Download, 
  Trash2, 
  Scale, 
  Calendar, 
  Layers, 
  FileText,
  User,
  Filter,
  CheckCircle2,
  ChevronDown,
  AlertTriangle,
  X,
  Copy,
  Check,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { exportPuSandwichRecordsToCSV } from '../utils/storage';
import { UserMode } from '../utils/auth';
import { KpiSlideRow } from './KpiSlideRow';

interface PuSandwichViewProps {
  records?: PuSandwichCutRecord[];
  onOpenCreateModal?: () => void;
  onDeleteRecord?: (id: string) => Promise<void> | void;
  userMode: UserMode;
  onUnlockEditor?: () => void;
}

export const PuSandwichView: React.FC<PuSandwichViewProps> = ({
  records = [],
  onDeleteRecord,
  userMode,
  onUnlockEditor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [steelFilter, setSteelFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [onlyWithNg, setOnlyWithNg] = useState<boolean>(false);
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState<boolean>(false);
  const [modalMonth, setModalMonth] = useState<string>('all');
  const [copiedMonthly, setCopiedMonthly] = useState<boolean>(false);

  const safeRecords = Array.isArray(records) ? records : [];

  // Available months from records
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    safeRecords.forEach((r) => {
      const d = r.productionDate || (r.createdAt ? r.createdAt.slice(0, 10) : '');
      if (d && d.length >= 7) {
        set.add(d.slice(0, 7)); // YYYY-MM
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [safeRecords]);

  // Statistics
  const stats = useMemo(() => {
    let totalKg = 0;
    let externalSteelKg = 0;
    let blueScopeKg = 0;
    let otherSteelKg = 0;
    let totalNgKg = 0;
    let totalNgMeters = 0;
    let ngRecordCount = 0;

    safeRecords.forEach((r) => {
      const w = Number(r.weightUsed) || 0;
      totalKg += w;
      if (r.steelOrigin === 'เหล็กนอก') externalSteelKg += w;
      else if (r.steelOrigin === 'เหล็กBlue Scope') blueScopeKg += w;
      else otherSteelKg += w;

      const ngK = Number(r.ngKg) || 0;
      const ngM = Number(r.ngMeters) || 0;
      totalNgKg += ngK;
      totalNgMeters += ngM;
      if (ngK > 0 || ngM > 0) {
        ngRecordCount += 1;
      }
    });

    const ngPercent = totalKg > 0 ? (totalNgKg / totalKg) * 100 : 0;

    return {
      totalCount: safeRecords.length,
      totalKg: Math.round(totalKg * 100) / 100,
      totalTons: Math.round((totalKg / 1000) * 100) / 100,
      externalSteelKg: Math.round(externalSteelKg * 100) / 100,
      blueScopeKg: Math.round(blueScopeKg * 100) / 100,
      otherSteelKg: Math.round(otherSteelKg * 100) / 100,
      totalNgKg: Math.round(totalNgKg * 100) / 100,
      totalNgMeters: Math.round(totalNgMeters * 10) / 10,
      ngPercent: Math.round(ngPercent * 100) / 100,
      ngRecordCount,
    };
  }, [safeRecords]);

  const modalRecords = useMemo(() => {
    if (modalMonth === 'all') return safeRecords;
    return safeRecords.filter((r) => {
      const d = r.productionDate || (r.createdAt ? r.createdAt.slice(0, 10) : '');
      return d.startsWith(modalMonth);
    });
  }, [safeRecords, modalMonth]);

  const modalStats = useMemo(() => {
    let totalKg = 0;
    let externalSteelKg = 0;
    let blueScopeKg = 0;
    let otherSteelKg = 0;
    let totalNgKg = 0;
    let totalNgMeters = 0;
    let totalSoLength = 0;

    modalRecords.forEach((r) => {
      const w = Number(r.weightUsed) || 0;
      totalKg += w;
      if (r.steelOrigin === 'เหล็กนอก') externalSteelKg += w;
      else if (r.steelOrigin === 'เหล็กBlue Scope') blueScopeKg += w;
      else otherSteelKg += w;

      totalNgKg += Number(r.ngKg) || 0;
      totalNgMeters += Number(r.ngMeters) || 0;
      totalSoLength += Number(r.soLengthMeters) || 0;
    });

    const ngPercent = totalKg > 0 ? (totalNgKg / totalKg) * 100 : 0;
    const externalPct = totalKg > 0 ? (externalSteelKg / totalKg) * 100 : 0;
    const blueScopePct = totalKg > 0 ? (blueScopeKg / totalKg) * 100 : 0;
    const otherPct = totalKg > 0 ? (otherSteelKg / totalKg) * 100 : 0;

    return {
      count: modalRecords.length,
      totalKg: Math.round(totalKg * 100) / 100,
      totalTons: Math.round((totalKg / 1000) * 100) / 100,
      externalSteelKg: Math.round(externalSteelKg * 100) / 100,
      externalPct: Math.round(externalPct * 10) / 10,
      blueScopeKg: Math.round(blueScopeKg * 100) / 100,
      blueScopePct: Math.round(blueScopePct * 10) / 10,
      otherSteelKg: Math.round(otherSteelKg * 100) / 100,
      otherPct: Math.round(otherPct * 10) / 10,
      totalNgKg: Math.round(totalNgKg * 100) / 100,
      totalNgMeters: Math.round(totalNgMeters * 10) / 10,
      totalSoLength: Math.round(totalSoLength * 10) / 10,
      ngPercent: Math.round(ngPercent * 100) / 100,
    };
  }, [modalRecords]);

  const handleCopyMonthlySummary = () => {
    const monthText = modalMonth === 'all' ? 'ภาพรวมทั้งหมดทุกเดือน' : `ประจำเดือน ${modalMonth}`;
    const lines = [
      `📊 สรุปผลการผลิต PU Sandwich (ไม่ใช้ฟอยล์)`,
      `🏢 โรงงานผลิตหลังคาเย็นสยาม (ร่มเกล้า)`,
      `📅 ${monthText}`,
      `─────────────────────────`,
      `📦 ยอดใบงานทั้งหมด: ${modalStats.count} SO`,
      `⚖️ น้ำหนักเหล็กที่ใช้จริง: ${modalStats.totalKg.toLocaleString('th-TH')} กก. (${modalStats.totalTons} ตัน)`,
      `📏 ยอดความยาวงานผลิต SO รวม: ${modalStats.totalSoLength.toLocaleString('th-TH')} เมตร`,
      `⚠️ ยอด NG (ของเสีย): ${modalStats.totalNgKg.toLocaleString('th-TH')} กก. (${modalStats.totalNgMeters.toLocaleString('th-TH')} ม.)`,
      `📉 สัดส่วน NG เสีย: ${modalStats.ngPercent}%`,
      `─────────────────────────`,
      `🔩 สัดส่วนประเภทเหล็กที่ใช้:`,
      `- เหล็กนอก: ${modalStats.externalSteelKg.toLocaleString('th-TH')} กก. (${modalStats.externalPct}%)`,
      `- เหล็ก Blue Scope: ${modalStats.blueScopeKg.toLocaleString('th-TH')} กก. (${modalStats.blueScopePct}%)`,
      modalStats.otherSteelKg > 0 ? `- เหล็กอื่นๆ: ${modalStats.otherSteelKg.toLocaleString('th-TH')} กก. (${modalStats.otherPct}%)` : null,
      `─────────────────────────`,
      `ระบบบันทึกสต๊อกและรายงาน Realtime`
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedMonthly(true);
      setTimeout(() => setCopiedMonthly(false), 2500);
    });
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return safeRecords.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.coilNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.coilColor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.recordedBy || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSteel = steelFilter === 'all' || r.steelOrigin === steelFilter;

      const dateStr = r.productionDate || (r.createdAt ? r.createdAt.slice(0, 10) : '');
      const matchesMonth = selectedMonth === 'all' || dateStr.startsWith(selectedMonth);

      const matchesNg = !onlyWithNg || (Number(r.ngKg) > 0 || Number(r.ngMeters) > 0);

      return matchesSearch && matchesSteel && matchesMonth && matchesNg;
    });
  }, [safeRecords, searchTerm, steelFilter, selectedMonth, onlyWithNg]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Action */}
      <div className="bg-linear-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-xs font-bold border border-emerald-400/30 flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5" />
                สายการผลิต PU Sandwich
              </span>
              <span className="text-xs text-emerald-200/80">ระบบไม่ตัดเบิกม้วนฟอยล์</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              บันทึกการตัด SO ผลิต PU Sandwich (ไม่ใช้ฟอยล์)
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              สำหรับงานผลิตหลังคาและผนังแซนวิช บันทึกคอล์ยเหล็ก น้ำหนักก่อนใช้ และน้ำหนักหลังใช้ พร้อมเลือกชนิดเหล็ก (เหล็กนอก / Blue Scope / อื่นๆ) และเรียกดูประวัติย้อนหลังได้ตลอดเวลา
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsMonthlyModalOpen(true)}
              className="px-4 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02]"
              title="เปิดสรุปยอดการผลิต PU Sandwich รายเดือน"
            >
              <Calendar className="w-4 h-4" />
              สรุปรายเดือนแซนวิช
            </button>
            <button
              type="button"
              onClick={() => exportPuSandwichRecordsToCSV(records)}
              disabled={records.length === 0}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
              title="ดาวน์โหลดรายการทั้งหมดเป็นไฟล์ CSV (เปิดใน Excel ได้)"
            >
              <Download className="w-4 h-4" />
              ส่งออก CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI 2 แถวสไลด์ — มือถือไม่รก */}
      <div className="space-y-3">
        <KpiSlideRow
          title="สรุปผลิต · น้ำหนัก & ใบงาน"
          cards={[
            {
              id: 'kg',
              label: 'น้ำหนักเหล็กใช้สะสม',
              value: stats.totalKg.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
              unit: 'กก.',
              icon: <Scale className="w-4 h-4" />,
              iconClass: 'bg-emerald-50 text-emerald-700',
              footer: <span className="text-emerald-700 font-semibold">≈ {stats.totalTons} ตัน</span>,
            },
            {
              id: 'so',
              label: 'จำนวนใบสั่งตัด SO',
              value: String(stats.totalCount),
              unit: 'รายการ',
              icon: <FileText className="w-4 h-4" />,
              iconClass: 'bg-teal-50 text-teal-700',
              footer: 'งานผลิต PU Sandwich',
            },
            {
              id: 'ng',
              label: 'NG เสียหายสะสม',
              value: stats.totalNgKg.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
              unit: 'กก.',
              icon: <AlertTriangle className="w-4 h-4" />,
              iconClass: 'bg-rose-50 text-rose-700',
              valueClass: 'text-rose-700',
              footer: (
                <span>
                  {stats.totalNgMeters.toLocaleString('th-TH', { minimumFractionDigits: 1 })} ม. ·{' '}
                  <strong>{stats.ngPercent.toFixed(2)}%</strong>
                </span>
              ),
            },
          ]}
        />
        <KpiSlideRow
          title="แยกตามแหล่งเหล็ก"
          cards={[
            {
              id: 'ext',
              label: 'เหล็กนอก',
              value: stats.externalSteelKg.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
              unit: 'กก.',
              icon: <Layers className="w-4 h-4" />,
              iconClass: 'bg-emerald-50 text-emerald-800',
              footer: `สัดส่วน ${
                stats.totalKg > 0 ? ((stats.externalSteelKg / stats.totalKg) * 100).toFixed(1) : 0
              }%`,
            },
            {
              id: 'bs',
              label: 'Blue Scope',
              value: stats.blueScopeKg.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
              unit: 'กก.',
              icon: <Layers className="w-4 h-4" />,
              iconClass: 'bg-sky-50 text-sky-700',
              footer: `สัดส่วน ${
                stats.totalKg > 0 ? ((stats.blueScopeKg / stats.totalKg) * 100).toFixed(1) : 0
              }%`,
            },
            {
              id: 'other',
              label: 'เหล็กอื่นๆ',
              value: stats.otherSteelKg.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
              unit: 'กก.',
              icon: <Layers className="w-4 h-4" />,
              iconClass: 'bg-slate-100 text-slate-600',
              footer: `สัดส่วน ${
                stats.totalKg > 0 ? ((stats.otherSteelKg / stats.totalKg) * 100).toFixed(1) : 0
              }%`,
            },
          ]}
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหารหัส SO, เบอร์คอล์ย, สีคอล์ย, ผู้บันทึก..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Steel Origin Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">ชนิดเหล็ก:</span>
            <select
              value={steelFilter}
              onChange={(e) => setSteelFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
            >
              <option value="all">ทั้งหมด</option>
              <option value="เหล็กนอก">1. เหล็กนอก</option>
              <option value="เหล็กBlue Scope">2. เหล็กBlue Scope</option>
              <option value="อื่นๆ">3. อื่นๆ</option>
            </select>
          </div>

          {/* Month Filter */}
          {availableMonths.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-medium">เดือน:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
              >
                <option value="all">ทุกเดือน</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* NG Filter Button */}
          <button
            type="button"
            onClick={() => setOnlyWithNg(!onlyWithNg)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
              onlyWithNg
                ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="กรองเฉพาะรายการที่มียอด NG"
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${onlyWithNg ? 'text-white' : 'text-rose-600'}`} />
            เฉพาะมี NG {stats.ngRecordCount > 0 ? `(${stats.ngRecordCount})` : ''}
          </button>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          แสดง <strong className="text-slate-900">{filteredRecords.length}</strong> จาก {records.length} รายการ
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Factory className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {onlyWithNg ? 'ไม่พบรายการที่มียอด NG' : 'ยังไม่มีรายการตัด SO ผลิต PU Sandwich'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {onlyWithNg
                ? 'ไม่มีรายการที่มีของเสีย หรือลองปิดตัวกรอง "เฉพาะมี NG"'
                : 'เมื่อมีการผลิตแซนวิชโดยไม่ใช้ฟอยล์ สามารถบันทึกน้ำหนักคอล์ยเหล็ก ความยาวตามใบงาน SO และระบบจะคำนวณยอด NG ให้อัตโนมัติ'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-3.5">รหัส SO</th>
                  <th className="py-3 px-3.5">วันที่ตัด</th>
                  <th className="py-3 px-3.5">สีคอล์ย</th>
                  <th className="py-3 px-3.5">ความหนา</th>
                  <th className="py-3 px-3.5">เบอร์คอล์ย</th>
                  <th className="py-3 px-3.5">ชนิดเหล็ก</th>
                  <th className="py-3 px-3.5 text-right">น้ำหนักก่อนใช้</th>
                  <th className="py-3 px-3.5 text-right">น้ำหนักหลังใช้</th>
                  <th className="py-3 px-3.5 text-right font-black text-emerald-800">ใช้จริง (กก.)</th>
                  <th className="py-3 px-3.5 text-right font-bold text-teal-800">งาน SO (ม.)</th>
                  <th className="py-3 px-3.5 text-right text-rose-700 font-bold">ยอด NG (กก.)</th>
                  <th className="py-3 px-3.5 text-right text-rose-700 font-bold">ยอด NG (ม.)</th>
                  <th className="py-3 px-3.5">ผู้บันทึก</th>
                  <th className="py-3 px-3.5">หมายเหตุ</th>
                  <th className="py-3 px-3.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                        {r.soNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-sans text-slate-600 whitespace-nowrap">
                      {r.productionDate}
                    </td>
                    <td className="py-3 px-3.5 font-sans">
                      <span className="font-semibold text-slate-800">
                        {r.coilColor}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700">
                      {r.thickness} มม.
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-800">
                      {r.coilNumber}
                    </td>
                    <td className="py-3 px-3.5 font-sans whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.steelOrigin === 'เหล็กBlue Scope'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : r.steelOrigin === 'เหล็กนอก'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {r.steelOrigin}
                        {r.customSteelOrigin ? ` (${r.customSteelOrigin})` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right text-slate-600">
                      {r.weightBefore.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3.5 text-right text-slate-600">
                      {r.weightAfter.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3.5 text-right font-black text-emerald-700 text-sm">
                      {r.weightUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-teal-700">
                      {r.soLengthMeters ? (
                        <span>{r.soLengthMeters.toLocaleString('th-TH', { minimumFractionDigits: 1 })} ม.</span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      {(r.ngKg || 0) > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                            {r.ngKg?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </span>
                          {r.soLengthMeters ? (
                            <span className="text-[10px] text-slate-400 mt-0.5 font-sans">
                              (หักงาน {r.soLengthMeters}ม.)
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">0.00</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      {(r.ngMeters || 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                          {r.ngMeters?.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">0.0</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-sans text-slate-600 whitespace-nowrap">
                      {r.recordedBy}
                    </td>
                    <td className="py-3 px-3.5 font-sans text-slate-500 max-w-[150px] truncate" title={r.notes || ''}>
                      {r.notes || '-'}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      {onDeleteRecord && (
                        <button
                          type="button"
                          onClick={() => {
                            if (userMode === 'visitor' && onUnlockEditor) {
                              onUnlockEditor();
                              return;
                            }
                            if (window.confirm(`ยืนยันการลบรายการตัด SO ${r.soNumber} (คอล์ย ${r.coilNumber})?`)) {
                              onDeleteRecord(r.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบรายการนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Monthly Summary Modal */}
      {isMonthlyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-linear-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">
                    สรุปรายเดือน: สายการผลิต PU Sandwich
                  </h3>
                  <p className="text-xs text-emerald-100/80">
                    รายงานภาพรวมการผลิต คอล์ยเหล็ก น้ำหนักที่ใช้จริง และยอดของเสีย NG
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Controls Bar */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="modal-month-select" className="text-xs font-bold text-slate-700">
                  เลือกเดือน:
                </label>
                <select
                  id="modal-month-select"
                  value={modalMonth}
                  onChange={(e) => setModalMonth(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">ทุกเดือน (ยอดสะสมทั้งหมด)</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      เดือน {m}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 font-mono">
                  ({modalStats.count} ใบงาน SO)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMonthlySummary}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="คัดลอกข้อความสรุปส่ง LINE"
                >
                  {copiedMonthly ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedMonthly ? 'คัดลอกแล้ว!' : 'คัดลอกสรุปส่ง LINE'}
                </button>
                <button
                  type="button"
                  onClick={() => exportPuSandwichRecordsToCSV(modalRecords)}
                  disabled={modalRecords.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  title="ส่งออกรายการเดือนนี้เป็น CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  ส่งออก CSV
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Steel Used */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    น้ำหนักเหล็กใช้จริงรวม
                  </span>
                  <div className="text-2xl font-black text-emerald-950 font-mono">
                    {modalStats.totalKg.toLocaleString('th-TH')}{' '}
                    <span className="text-xs font-normal text-emerald-700">กก.</span>
                  </div>
                  <div className="text-xs text-emerald-700 font-medium">
                    ประมาณ {modalStats.totalTons.toLocaleString('th-TH')} ตัน
                  </div>
                </div>

                {/* Total Length Produced */}
                <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                    ความยาวตามงาน SO รวม
                  </span>
                  <div className="text-2xl font-black text-teal-950 font-mono">
                    {modalStats.totalSoLength.toLocaleString('th-TH')}{' '}
                    <span className="text-xs font-normal text-teal-700">เมตร</span>
                  </div>
                  <div className="text-xs text-teal-700 font-medium">
                    จากทั้งหมด {modalStats.count} ใบงาน
                  </div>
                </div>

                {/* NG Weight */}
                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                    ยอดเสีย NG รวม (กก.)
                  </span>
                  <div className="text-2xl font-black text-rose-950 font-mono">
                    {modalStats.totalNgKg.toLocaleString('th-TH')}{' '}
                    <span className="text-xs font-normal text-rose-700">กก.</span>
                  </div>
                  <div className="text-xs text-rose-700 font-medium">
                    สัดส่วน NG: {modalStats.ngPercent}%
                  </div>
                </div>

                {/* NG Meters */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                    ยอดเสีย NG รวม (เมตร)
                  </span>
                  <div className="text-2xl font-black text-amber-950 font-mono">
                    {modalStats.totalNgMeters.toLocaleString('th-TH')}{' '}
                    <span className="text-xs font-normal text-amber-700">เมตร</span>
                  </div>
                  <div className="text-xs text-amber-700 font-medium">
                    คำนวณตามน้ำหนักต่อเมตรมาตรฐาน
                  </div>
                </div>
              </div>

              {/* Steel Origin Breakdown */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  สัดส่วนการใช้น้ำหนักเหล็กตามชนิด (Steel Types)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
                    <span className="text-xs font-bold text-emerald-900 block">เหล็กนอก</span>
                    <div className="text-lg font-black text-emerald-900 font-mono">
                      {modalStats.externalSteelKg.toLocaleString('th-TH')} กก.
                    </div>
                    <div className="text-[11px] text-emerald-700">
                      คิดเป็น {modalStats.externalPct}% ของยอดผลิต
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                    <span className="text-xs font-bold text-blue-900 block">เหล็ก Blue Scope</span>
                    <div className="text-lg font-black text-blue-900 font-mono">
                      {modalStats.blueScopeKg.toLocaleString('th-TH')} กก.
                    </div>
                    <div className="text-[11px] text-blue-700">
                      คิดเป็น {modalStats.blueScopePct}% ของยอดผลิต
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
                    <span className="text-xs font-bold text-amber-900 block">เหล็กอื่นๆ / พิเศษ</span>
                    <div className="text-lg font-black text-amber-900 font-mono">
                      {modalStats.otherSteelKg.toLocaleString('th-TH')} กก.
                    </div>
                    <div className="text-[11px] text-amber-700">
                      คิดเป็น {modalStats.otherPct}% ของยอดผลิต
                    </div>
                  </div>
                </div>
              </div>

              {/* Orders Table for this Month */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    รายการตัด SO ประจำเดือน ({modalRecords.length} รายการ)
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    เรียงตามลำดับล่าสุด
                  </span>
                </div>
                {modalRecords.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-mono">
                    ไม่มีรายการในเดือนนี้
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">SO</th>
                          <th className="py-2.5 px-3">วันที่</th>
                          <th className="py-2.5 px-3">สี / เบอร์</th>
                          <th className="py-2.5 px-3">ชนิดเหล็ก</th>
                          <th className="py-2.5 px-3 text-right">ใช้จริง (กก.)</th>
                          <th className="py-2.5 px-3 text-right">งาน SO (ม.)</th>
                          <th className="py-2.5 px-3 text-right text-rose-600">NG (กก.)</th>
                          <th className="py-2.5 px-3 text-right text-rose-600">NG (ม.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {modalRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{r.soNumber}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-600">{r.productionDate}</td>
                            <td className="py-2.5 px-3 font-sans">
                              {r.coilColor} #{r.coilNumber} ({r.thickness}มม.)
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-700">{r.steelOrigin}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                              {r.weightUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right text-teal-800">
                              {r.soLengthMeters ? `${r.soLengthMeters}ม.` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-700">
                              {(r.ngKg || 0) > 0 ? r.ngKg?.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-700">
                              {(r.ngMeters || 0) > 0 ? `${r.ngMeters}ม.` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
