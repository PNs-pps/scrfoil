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
  AlertTriangle
} from 'lucide-react';
import { exportPuSandwichRecordsToCSV } from '../utils/storage';
import { UserMode } from '../utils/auth';

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

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Weight Used */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">น้ำหนักเหล็กใช้สะสม</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {stats.totalKg.toLocaleString('th-TH', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-slate-500">กก.</span>
          </div>
          <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <span className="font-bold">({stats.totalTons.toLocaleString('th-TH')} ตัน)</span>
          </div>
        </div>

        {/* Total SO Cut Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">จำนวนใบสั่งตัด SO</span>
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {stats.totalCount}{' '}
            <span className="text-xs font-normal text-slate-500">รายการ/SO</span>
          </div>
          <div className="text-xs text-slate-500">
            งานผลิต PU Sandwich
          </div>
        </div>

        {/* Steel Type: External (เหล็กนอก) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">1. เหล็กนอก</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
              นำเข้า
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {stats.externalSteelKg.toLocaleString('th-TH', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-slate-500">กก.</span>
          </div>
          <div className="text-xs text-slate-500">
            สัดส่วน {stats.totalKg > 0 ? ((stats.externalSteelKg / stats.totalKg) * 100).toFixed(1) : 0}% ของทั้งหมด
          </div>
        </div>

        {/* Steel Type: Blue Scope & Others */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">2. Blue Scope & อื่นๆ</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">
              BlueScope
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {(stats.blueScopeKg + stats.otherSteelKg).toLocaleString('th-TH', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-slate-500">กก.</span>
          </div>
          <div className="text-xs text-slate-500">
            Blue Scope: {stats.blueScopeKg.toLocaleString('th-TH')} กก. | อื่นๆ: {stats.otherSteelKg.toLocaleString('th-TH')} กก.
          </div>
        </div>

        {/* Total NG Scrap Card */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-rose-900">ยอด NG เสียหายสะสม</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-700">
            {stats.totalNgKg.toLocaleString('th-TH', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-slate-500">กก.</span>
          </div>
          <div className="text-xs text-rose-800 font-medium flex items-center justify-between">
            <span>เสีย: <strong className="font-mono">{stats.totalNgMeters.toLocaleString('th-TH', { minimumFractionDigits: 1 })}</strong> ม.</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700">
              {stats.ngPercent.toFixed(2)}% NG
            </span>
          </div>
        </div>
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
                  <th className="py-3 px-3.5">1. สีคอล์ย</th>
                  <th className="py-3 px-3.5">2. ความหนา</th>
                  <th className="py-3 px-3.5">3. เบอร์คอล์ย</th>
                  <th className="py-3 px-3.5">ชนิดเหล็ก</th>
                  <th className="py-3 px-3.5 text-right">4. น้ำหนักก่อนใช้</th>
                  <th className="py-3 px-3.5 text-right">5. น้ำหนักหลังใช้</th>
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
    </div>
  );
};
