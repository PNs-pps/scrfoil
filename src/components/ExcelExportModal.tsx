import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Layers, 
  Calculator, 
  ShoppingBag, 
  FileText,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { FoilRoll, StockCutRecord, PuSandwichCutRecord } from '../types';
import { 
  generateAndDownloadExcelReport, 
  ExportReportType, 
  ExportMaterialFilter, 
  DateFilterRange 
} from '../utils/excelExporter';
import { todayLocalISO, formatMeters } from '../utils/formatters';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rolls: FoilRoll[];
  records: StockCutRecord[];
  puRecords?: PuSandwichCutRecord[];
}

type PresetPeriod = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'all' | 'custom';

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  rolls,
  records,
  puRecords = [],
}) => {
  const today = todayLocalISO();

  // Selected report type
  const [reportType, setReportType] = useState<ExportReportType>('accounting');
  const [materialFilter, setMaterialFilter] = useState<ExportMaterialFilter>('all');
  const [presetPeriod, setPresetPeriod] = useState<PresetPeriod>('thisMonth');

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(today);

  const [isExporting, setIsExporting] = useState(false);
  const [exportedFilename, setExportedFilename] = useState<string | null>(null);

  // Compute calculated date range based on preset
  const computedDateRange = useMemo<DateFilterRange>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    if (presetPeriod === 'today') {
      return { startDate: today, endDate: today, label: 'วันนี้' };
    }
    if (presetPeriod === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      return { startDate: yStr, endDate: yStr, label: 'เมื่อวาน' };
    }
    if (presetPeriod === 'last7days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      const pastStr = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
      return { startDate: pastStr, endDate: today, label: '7 วันล่าสุด' };
    }
    if (presetPeriod === 'thisMonth') {
      const startStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      return { startDate: startStr, endDate: today, label: 'เดือนนี้' };
    }
    if (presetPeriod === 'lastMonth') {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      const startStr = `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}-01`;
      const endStr = `${lastDayOfPrev.getFullYear()}-${pad(lastDayOfPrev.getMonth() + 1)}-${pad(lastDayOfPrev.getDate())}`;
      return { startDate: startStr, endDate: endStr, label: 'เดือนที่แล้ว' };
    }
    if (presetPeriod === 'all') {
      return { startDate: '', endDate: '', label: 'ทั้งหมด' };
    }
    return { startDate: customStartDate, endDate: customEndDate, label: 'กำหนดเอง' };
  }, [presetPeriod, today, customStartDate, customEndDate]);

  // Preview counts based on current filters
  const previewData = useMemo(() => {
    const filterFn = (item: { usageDate?: string; productionDate?: string; date?: string; recordedDate?: string }) => {
      const d = item.usageDate || item.productionDate || item.date || item.recordedDate;
      if (!d) return true;
      const str = d.slice(0, 10);
      if (computedDateRange.startDate && str < computedDateRange.startDate) return false;
      if (computedDateRange.endDate && str > computedDateRange.endDate) return false;
      return true;
    };

    const foilCount = records.filter(filterFn).length;
    const puCount = puRecords.filter(filterFn).length;
    const activeRollsCount = rolls.filter(r => r.status === 'active' && !r.isZeroedOut && Number(r.remainingMeters) > 0).length;

    return { foilCount, puCount, activeRollsCount };
  }, [records, puRecords, rolls, computedDateRange]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      setExportedFilename(null);

      const filename = await generateAndDownloadExcelReport({
        reportType,
        materialFilter,
        dateRange: computedDateRange,
        rolls,
        records,
        puRecords,
      });

      setExportedFilename(filename);
    } catch (err) {
      console.error('Export Excel failed:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-linear-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-emerald-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                ส่งออกรายงาน Excel สำเร็จรูป
              </h2>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                ออกแบบเฉพาะสำหรับฝ่ายบัญชี ฝ่ายจัดซื้อ และสรุปภาพรวมการผลิต
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-800 text-sm">

          {/* Section 1: เลือกรูปแบบรายงาน */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. เลือกประเภทรายงานที่ต้องการ
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              {/* รายงานฝ่ายบัญชี */}
              <button
                type="button"
                onClick={() => setReportType('accounting')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'accounting'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                      <Calculator className="w-4 h-4" />
                    </span>
                    {reportType === 'accounting' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="font-bold text-xs sm:text-sm">สำหรับฝ่ายบัญชี</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    สรุปเบิกใช้แยก SO, คำนวณเมตรใช้, เมตรเสีย NG, อัตรา NG% และสูตร SUM
                  </div>
                </div>
              </button>

              {/* รายงานฝ่ายจัดซื้อ */}
              <button
                type="button"
                onClick={() => setReportType('purchasing')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'purchasing'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
                      <ShoppingBag className="w-4 h-4" />
                    </span>
                    {reportType === 'purchasing' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="font-bold text-xs sm:text-sm">สำหรับฝ่ายจัดซื้อ</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    สต๊อกคงเหลือปัจจุบัน, จุดแจ้งเตือนสั่งซื้อ, สรุปตามหน้ากว้างและลาย
                  </div>
                </div>
              </button>

              {/* รายงานครบวงจร ทุกชีท */}
              <button
                type="button"
                onClick={() => setReportType('all_master')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'all_master'
                    ? 'border-amber-600 bg-amber-50/70 text-amber-950 ring-2 ring-amber-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    {reportType === 'all_master' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div className="font-bold text-xs sm:text-sm">ฉบับสมบูรณ์ (Master)</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    รวมทุกชีท: สรุปภาพรวม + บัญชีฟอยล์/แซนวิช + จัดซื้อสต๊อกคงคลัง
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: ช่วงเวลา (Date Range) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              2. เลือกช่วงเวลาของข้อมูล
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {[
                { key: 'today', label: 'วันนี้' },
                { key: 'yesterday', label: 'เมื่อวาน' },
                { key: 'last7days', label: '7 วันล่าสุด' },
                { key: 'thisMonth', label: 'เดือนนี้' },
                { key: 'lastMonth', label: 'เดือนที่แล้ว' },
                { key: 'all', label: 'ทั้งหมด' },
                { key: 'custom', label: 'กำหนดเอง...' },
              ].map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setPresetPeriod(preset.key as PresetPeriod)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    presetPeriod === preset.key
                      ? 'bg-slate-900 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range Picker */}
            {presetPeriod === 'custom' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">ตั้งแต่วันที่</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">ถึงวันที่</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: ตัวกรองประเภทวัตถุดิบ (เฉพาะกรณีรายงานบัญชีหรือฉบับสมบูรณ์) */}
          {reportType !== 'purchasing' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                3. ตัวกรองวัตถุดิบ
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMaterialFilter('all')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                    materialFilter === 'all'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  ทั้งหมด (ฟอยล์ + แซนวิช)
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialFilter('foil')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                    materialFilter === 'foil'
                      ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  เฉพาะม้วนฟอยล์
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialFilter('sandwich')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                    materialFilter === 'sandwich'
                      ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  เฉพาะงาน PU Sandwich
                </button>
              </div>
            </div>
          )}

          {/* Section 4: สรุปพรีวิวข้อมูลที่จะส่งออก */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="font-bold text-slate-800 mb-1 flex items-center justify-between">
              <span>ข้อมูลที่จะถูกส่งออก:</span>
              <span className="text-[11px] font-normal text-slate-500">
                {computedDateRange.label} ({computedDateRange.startDate || 'แรกเริ่ม'} ~ {computedDateRange.endDate || 'ปัจจุบัน'})
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500">ประวัติเบิกฟอยล์</div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                  {materialFilter !== 'sandwich' ? `${previewData.foilCount} รายการ` : '-'}
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500">ประวัติแซนวิช</div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                  {materialFilter !== 'foil' ? `${previewData.puCount} รายการ` : '-'}
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                <div className="text-[11px] text-slate-500">ม้วนฟอยล์ในสต๊อก</div>
                <div className="text-sm font-bold text-blue-700 font-mono mt-0.5">
                  {rolls.length} ม้วน
                </div>
              </div>
            </div>
          </div>

          {/* Download Success Notice */}
          {exportedFilename && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">ส่งออกรายงานสำเร็จแล้ว!</span>
                <span className="block text-[11px] text-emerald-700">
                  ดาวน์โหลดไฟล์: <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">{exportedFilename}</code>
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            ปิด
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>กำลังสร้างไฟล์ Excel...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดรายงาน Excel</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
