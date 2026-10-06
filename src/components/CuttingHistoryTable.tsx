import React, { useState, useMemo } from 'react';
import { confirmAction } from '../utils/confirmAction';
import { StockCutRecord, FoilRoll, PuSandwichCutRecord } from '../types';
import { 
  Search, 
  Download, 
  Trash2, 
  Pencil, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  X, 
  Copy, 
  Check, 
  Layers, 
  Factory, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Filter,
  Scissors
} from 'lucide-react';
import { exportCutRecordsToCSV, exportPuSandwichRecordsToCSV } from '../utils/storage';
import { formatMeters, compareLotAndRoll } from '../utils/formatters';
import { UserMode } from '../utils/auth';
import { getPatternStyle } from '../utils/patternStyles';
import { SODetailModal } from './SODetailModal';

export type HistoryCategory = 'all' | 'foil' | 'sandwich';
type SortField = 'date' | 'so' | 'type' | 'details' | 'used' | 'ng' | 'remaining' | 'recorder';
type SortDirection = 'asc' | 'desc';

export interface UnifiedHistoryItem {
  id: string;
  type: 'foil' | 'sandwich';
  soNumber: string;
  date: string;
  recordedDate?: string;
  categoryLabel: string;
  // Details
  detailsSummary: string;
  subDetails?: string;
  width?: number;
  pattern?: string;
  isSilverSide?: boolean;
  isWhiteSide?: boolean;
  // Metrics
  usedDisplay: string;
  usedValue: number;
  ngDisplay: string;
  ngValue: number;
  remainingDisplay: string;
  remainingValue: number;
  // Meta
  recordedBy: string;
  notes?: string;
  createdAt: string;
  // Raw references
  rawFoil?: StockCutRecord;
  rawSandwich?: PuSandwichCutRecord;
}

interface CuttingHistoryTableProps {
  records: StockCutRecord[];
  rolls?: FoilRoll[];
  puRecords?: PuSandwichCutRecord[];
  onDeleteRecord: (recordId: string) => void;
  onEditRecord?: (record: StockCutRecord) => void;
  onDeleteSandwichRecord?: (recordId: string) => void;
  onEditSandwichRecord?: (record: PuSandwichCutRecord) => void;
  onOpenCutModal: () => void;
  onOpenPuSandwichModal?: () => void;
  initialCategory?: HistoryCategory;
  userMode?: UserMode;
  onRequestUnlock?: (action?: () => void) => void;
}

export const CuttingHistoryTable: React.FC<CuttingHistoryTableProps> = ({
  records,
  rolls = [],
  puRecords = [],
  onDeleteRecord,
  onEditRecord,
  onDeleteSandwichRecord,
  onEditSandwichRecord,
  onOpenCutModal,
  onOpenPuSandwichModal,
  initialCategory = 'all',
  userMode = 'visitor',
  onRequestUnlock,
}) => {
  // Category Tab: All, Foil, Sandwich
  const [categoryFilter, setCategoryFilter] = useState<HistoryCategory>(initialCategory);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<StockCutRecord | null>(null);
  const [selectedSandwichDetail, setSelectedSandwichDetail] = useState<PuSandwichCutRecord | null>(null);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sort State
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const safePuRecords = useMemo(() => Array.isArray(puRecords) ? puRecords : [], [puRecords]);

  // Combine Foil Records & Sandwich Records into Unified Structure
  const unifiedItems: UnifiedHistoryItem[] = useMemo(() => {
    const list: UnifiedHistoryItem[] = [];

    // 1. Foil Records
    records.forEach((r) => {
      const d = (r.usageDate || r.recordedDate || (r.createdAt ? r.createdAt.slice(0, 10) : '')).trim();
      const patternText = r.pattern || '';
      const sideText = r.isSilverSide ? ' (ท้องเงิน)' : r.isWhiteSide ? ' (ท้องขาว)' : '';
      const details = `ล็อต ${r.lotNumber} #${r.rollNumber} · ${patternText}${sideText} (${r.width}มม.)`;

      list.push({
        id: `foil_${r.id}`,
        type: 'foil',
        soNumber: r.soNumber || '-',
        date: d,
        recordedDate: r.recordedDate,
        categoryLabel: 'ฟอยล์',
        detailsSummary: details,
        subDetails: `หน้ากว้าง ${r.width} มม.`,
        width: r.width,
        pattern: r.pattern,
        isSilverSide: r.isSilverSide,
        isWhiteSide: r.isWhiteSide,
        usedDisplay: `${formatMeters(r.usedMeters)} ม.`,
        usedValue: Number(r.usedMeters) || 0,
        ngDisplay: r.ngMeters > 0 ? `${formatMeters(r.ngMeters)} ม.` : '—',
        ngValue: Number(r.ngMeters) || 0,
        remainingDisplay: `${formatMeters(r.remainingAfter)} ม.`,
        remainingValue: Number(r.remainingAfter) || 0,
        recordedBy: r.recordedBy || '-',
        notes: r.notes,
        createdAt: r.createdAt || '',
        rawFoil: r,
      });
    });

    // 2. PU Sandwich Records
    safePuRecords.forEach((s) => {
      const d = (s.productionDate || (s.createdAt ? s.createdAt.slice(0, 10) : '')).trim();
      const details = `${s.coilColor || ''} ${s.thickness ? `${s.thickness}มม.` : ''} · คอยล์ #${s.coilNumber || '-'} (${s.steelOrigin || 'เหล็ก'})`;
      const soLen = s.soLengthMeters ? ` (${Number(s.soLengthMeters).toLocaleString()} ม.)` : '';

      list.push({
        id: `sandwich_${s.id}`,
        type: 'sandwich',
        soNumber: s.soNumber || '-',
        date: d,
        categoryLabel: 'แซนวิช',
        detailsSummary: details,
        subDetails: s.steelOrigin,
        usedDisplay: `${Number(s.weightUsed || 0).toLocaleString()} กก.${soLen}`,
        usedValue: Number(s.weightUsed) || 0,
        ngDisplay: (s.ngKg || 0) > 0 ? `${s.ngKg} กก. (${s.ngMeters || 0}ม.)` : '—',
        ngValue: Number(s.ngKg) || 0,
        remainingDisplay: `หลังใช้ ${Number(s.weightAfter || 0).toLocaleString()} กก.`,
        remainingValue: Number(s.weightAfter) || 0,
        recordedBy: s.recordedBy || '-',
        notes: s.notes,
        createdAt: s.createdAt || '',
        rawSandwich: s,
      });
    });

    return list;
  }, [records, safePuRecords]);

  // Filtering
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return unifiedItems.filter((item) => {
      // 1. Category Filter
      if (categoryFilter === 'foil' && item.type !== 'foil') return false;
      if (categoryFilter === 'sandwich' && item.type !== 'sandwich') return false;

      // 2. Date Range Filter
      if (startDate && item.date && item.date < startDate) return false;
      if (endDate && item.date && item.date > endDate) return false;

      // 3. Search Query (Matches SO, Details, RecordedBy, Notes)
      if (!q) return true;
      return (
        item.soNumber.toLowerCase().includes(q) ||
        item.detailsSummary.toLowerCase().includes(q) ||
        item.recordedBy.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.type === 'foil' && 'ฟอยล์'.includes(q)) ||
        (item.type === 'sandwich' && 'แซนวิช'.includes(q))
      );
    });
  }, [unifiedItems, categoryFilter, startDate, endDate, searchQuery]);

  // Sorting
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'date':
          diff = a.date.localeCompare(b.date);
          if (diff === 0) diff = a.createdAt.localeCompare(b.createdAt);
          break;
        case 'so':
          diff = a.soNumber.localeCompare(b.soNumber, undefined, { numeric: true, sensitivity: 'base' });
          break;
        case 'type':
          diff = a.type.localeCompare(b.type);
          break;
        case 'details':
          diff = a.detailsSummary.localeCompare(b.detailsSummary);
          break;
        case 'used':
          diff = a.usedValue - b.usedValue;
          break;
        case 'ng':
          diff = a.ngValue - b.ngValue;
          break;
        case 'remaining':
          diff = a.remainingValue - b.remainingValue;
          break;
        case 'recorder':
          diff = a.recordedBy.localeCompare(b.recordedBy);
          break;
        default:
          diff = 0;
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [filteredItems, sortField, sortDirection]);

  // Statistics of Current Filtered Set
  const stats = useMemo(() => {
    const foilItems = sortedItems.filter((i) => i.type === 'foil');
    const sandwichItems = sortedItems.filter((i) => i.type === 'sandwich');

    const totalFoilUsed = foilItems.reduce((acc, i) => acc + i.usedValue, 0);
    const totalFoilNg = foilItems.reduce((acc, i) => acc + i.ngValue, 0);

    const totalSandwichKg = sandwichItems.reduce((acc, i) => acc + i.usedValue, 0);
    const totalSandwichNgKg = sandwichItems.reduce((acc, i) => acc + i.ngValue, 0);

    return {
      totalCount: sortedItems.length,
      foilCount: foilItems.length,
      sandwichCount: sandwichItems.length,
      totalFoilUsed,
      totalFoilNg,
      totalSandwichKg,
      totalSandwichNgKg,
    };
  }, [sortedItems]);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'date' || field === 'used' || field === 'ng' ? 'desc' : 'asc');
    }
  };

  // Guarded actions for visitor vs editor
  const handleActionGuarded = (action: () => void) => {
    if (userMode === 'visitor') {
      if (onRequestUnlock) onRequestUnlock(action);
      return;
    }
    action();
  };

  // Export current list to CSV
  const handleExportCSV = () => {
    if (categoryFilter === 'sandwich') {
      exportPuSandwichRecordsToCSV(safePuRecords);
    } else if (categoryFilter === 'foil') {
      exportCutRecordsToCSV(records);
    } else {
      // Export Foil first, then notify
      exportCutRecordsToCSV(records);
      setTimeout(() => {
        exportPuSandwichRecordsToCSV(safePuRecords);
      }, 500);
    }
  };

  // Copy single row text for LINE
  const handleCopySingle = (item: UnifiedHistoryItem) => {
    let text = '';
    if (item.type === 'foil' && item.rawFoil) {
      const f = item.rawFoil;
      text = `📦 [ตัดฟอยล์] SO: ${f.soNumber}\n📅 วันที่: ${item.date}\n🏷️ ${item.detailsSummary}\n✂️ ตัดใช้: ${formatMeters(f.usedMeters)} ม.` +
        (f.ngMeters > 0 ? ` (NG: ${formatMeters(f.ngMeters)} ม.)` : '') +
        `\n📊 คงเหลือ: ${formatMeters(f.remainingAfter)} ม.\n👤 ผู้บันทึก: ${f.recordedBy || '-'}`;
    } else if (item.type === 'sandwich' && item.rawSandwich) {
      const s = item.rawSandwich;
      text = `🥪 [PU แซนวิช] SO: ${s.soNumber}\n📅 วันที่: ${item.date}\n🔩 ${item.detailsSummary}\n⚖️ เหล็กที่ใช้: ${Number(s.weightUsed).toLocaleString()} กก.` +
        (s.soLengthMeters ? ` (${Number(s.soLengthMeters).toLocaleString()} ม.)` : '') +
        (s.ngKg ? ` | NG: ${s.ngKg} กก.` : '') +
        `\n👤 ผู้บันทึก: ${s.recordedBy || '-'}`;
    }
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  };

  // Render Sort Header
  const renderSortTh = (field: SortField, label: string, align: 'left' | 'right' | 'center' = 'left', stickyLeft = false) => {
    const isCurrent = sortField === field;
    return (
      <th
        onClick={() => handleToggleSort(field)}
        className={`px-3 py-2 text-xs font-semibold select-none cursor-pointer transition-colors ${
          stickyLeft
            ? 'sticky left-0 z-30 bg-slate-100 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)]'
            : 'bg-slate-50 hover:bg-slate-100'
        } ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      >
        <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span className={isCurrent ? 'text-slate-950 font-bold' : 'text-slate-600'}>{label}</span>
          {isCurrent ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-amber-600" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-4">
      {/* Category Tab Selector (ชัดเจน: ตัดสต๊อกรวม, ฟอยล์, แซนวิช) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'all'
                  ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scissors className="w-4 h-4 text-slate-700" />
              <span>ตัดสต๊อกรวม (ทั้งหมด)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-mono">
                {unifiedItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('foil')}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'foil'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-800" />
              <span>ตัดฟอยล์</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-950 text-[10px] font-mono">
                {records.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('sandwich')}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'sandwich'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Factory className="w-4 h-4 text-emerald-200" />
              <span>ตัด SO แซนวิช</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-950 text-[10px] font-mono">
                {safePuRecords.length}
              </span>
            </button>
          </div>

          {/* Quick Actions (Export CSV & Quick Cut) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              title="ส่งออกประวัติเป็นไฟล์ CSV"
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>ส่งออก CSV</span>
            </button>

            {categoryFilter === 'sandwich' && onOpenPuSandwichModal ? (
              <button
                type="button"
                onClick={onOpenPuSandwichModal}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Factory className="w-3.5 h-3.5 text-emerald-200" />
                <span>ตัด SO แซนวิชใหม่</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenCutModal}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>ตัดสต็อกฟอยล์ใหม่</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา SO, ล็อต, คอยล์, สี, ผู้บันทึก..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/60 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-mono"
              title="ตั้งแต่วันที่"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-mono"
              title="ถึงวันที่"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                title="ล้างช่วงวันที่"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Summary of Filtered Results */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono pt-2 border-t border-slate-100">
          <div className="text-slate-500 flex items-center gap-1.5">
            <span>แสดง <strong className="text-slate-900">{sortedItems.length}</strong> รายการ</span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-amber-700">ฟอยล์: {stats.foilCount}</span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-emerald-700">แซนวิช: {stats.sandwichCount}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {stats.foilCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[11px]">
                ฟอยล์ใช้ {formatMeters(stats.totalFoilUsed)} ม. {stats.totalFoilNg > 0 ? `(NG ${formatMeters(stats.totalFoilNg)} ม.)` : ''}
              </span>
            )}
            {stats.sandwichCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-950 border border-emerald-200 font-bold text-[11px]">
                เหล็กใช้ {stats.totalSandwichKg.toLocaleString()} กก. {stats.totalSandwichNgKg > 0 ? `(NG ${stats.totalSandwichNgKg} กก.)` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* COMPACT SINGLE-ROW HORIZONTAL SCROLL TABLE WITH STICKY SO COLUMN */}
      {/* ตามคำขอ: "แสดง so แถวเดียวเล็กๆ แบบเลื่อนซ้ายขวา แต่ให้แสดง so ไว้ตลอดเมื่อเลื่อน" */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {sortedItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">ไม่พบรายการตัดสต๊อกตามที่ค้นหา</p>
            <p className="text-xs text-slate-400">ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา</p>
          </div>
        ) : (
          <div className="overflow-x-auto relative scroll-smooth focus:outline-none">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[840px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  {/* STICKY SO HEADER */}
                  {renderSortTh('so', 'รหัส SO (ตรึงซ้าย)', 'left', true)}
                  {renderSortTh('type', 'ประเภท', 'center')}
                  {renderSortTh('date', 'วันที่ผลิต/ตัด')}
                  {renderSortTh('details', 'รายละเอียด / ล็อต / คอยล์')}
                  {renderSortTh('used', 'ปริมาณที่ใช้', 'right')}
                  {renderSortTh('ng', 'NG ที่เสีย', 'right')}
                  {renderSortTh('remaining', 'คงเหลือ / หลังตัด', 'right')}
                  {renderSortTh('recorder', 'ผู้บันทึก')}
                  <th className="px-3 py-2 text-center font-semibold text-slate-600 w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedItems.map((item) => {
                  const isFoil = item.type === 'foil';
                  const patternStyle = isFoil && item.pattern ? getPatternStyle(item.pattern) : null;

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-slate-50/90 transition-colors h-10 sm:h-11"
                    >
                      {/* STICKY SO COLUMN: Always visible when scrolling horizontally */}
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 transition-colors px-3 py-2 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center gap-1.5 min-w-[120px]">
                          <span
                            className={`font-mono font-black text-xs px-2 py-0.5 rounded-lg border shadow-2xs ${
                              isFoil
                                ? 'bg-amber-50 text-amber-950 border-amber-200'
                                : 'bg-emerald-50 text-emerald-950 border-emerald-200'
                            }`}
                          >
                            {item.soNumber}
                          </span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isFoil
                              ? 'bg-amber-100/80 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100/80 text-emerald-950 border border-emerald-300'
                          }`}
                        >
                          {isFoil ? <Scissors className="w-3 h-3 text-amber-700" /> : <Factory className="w-3 h-3 text-emerald-700" />}
                          <span>{item.categoryLabel}</span>
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2 font-mono text-slate-700">
                        {item.date || '-'}
                      </td>

                      {/* Details / Lot / Coil */}
                      <td className="px-3 py-2">
                        {isFoil && item.rawFoil ? (
                          <div className="flex items-center gap-1.5 max-w-[320px]">
                            <div className="inline-flex items-center gap-1 bg-black text-white px-2 py-0.5 rounded-md border border-slate-800 shadow-2xs shrink-0">
                              <span className="text-[10px] font-black uppercase text-amber-400">LOT.</span>
                              <span className="lot-number-display text-xs font-black text-white">{item.rawFoil.lotNumber}</span>
                              <span className="text-slate-600 font-bold">|</span>
                              <span className="text-[10px] font-black uppercase text-amber-400">NO.</span>
                              <span className="lot-number-display text-xs font-black text-amber-300">#{item.rawFoil.rollNumber}</span>
                            </div>
                            <span className="text-slate-600 text-xs truncate">
                              {item.rawFoil.pattern} ({item.rawFoil.width}มม.)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 max-w-[280px] truncate" title={item.detailsSummary}>
                            {patternStyle && (
                              <span className={`w-2 h-2 rounded-full shrink-0 ${patternStyle.dotClass}`} />
                            )}
                            <span className="font-medium text-slate-900 truncate">
                              {item.detailsSummary}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Used Amount */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                        {item.usedDisplay}
                      </td>

                      {/* NG Amount */}
                      <td className={`px-3 py-2 text-right font-mono ${item.ngValue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                        {item.ngDisplay}
                      </td>

                      {/* Remaining / After Cut */}
                      <td className="px-3 py-2 text-right font-mono text-slate-700 font-semibold">
                        {item.remainingDisplay}
                      </td>

                      {/* Recorder */}
                      <td className="px-3 py-2 text-slate-600 text-[11px] truncate max-w-[120px]">
                        {item.recordedBy}
                      </td>

                      {/* Actions (Copy / Edit / Delete) */}
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Copy line text */}
                          <button
                            type="button"
                            onClick={() => handleCopySingle(item)}
                            title="คัดลอกข้อมูลสรุปเพื่อส่ง LINE"
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Full detail pop-up */}
                          {isFoil && item.rawFoil && (
                            <button
                              type="button"
                              onClick={() => setSelectedDetailRecord(item.rawFoil!)}
                              title="ดูรายละเอียดใบ SO ฟอยล์แบบเต็ม"
                              className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit */}
                          {isFoil && item.rawFoil && onEditRecord && (
                            <button
                              type="button"
                              onClick={() => handleActionGuarded(() => onEditRecord(item.rawFoil!))}
                              title="แก้ไขรายการตัดฟอยล์"
                              className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isFoil && item.rawSandwich && onEditSandwichRecord && (
                            <button
                              type="button"
                              onClick={() => handleActionGuarded(() => onEditSandwichRecord(item.rawSandwich!))}
                              title="แก้ไขรายการตัด SO แซนวิช"
                              className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              handleActionGuarded(async () => {
                                if (isFoil && item.rawFoil) {
                                  if (
                                    await confirmAction({
                                      title: 'ยกเลิกรายการตัดฟอยล์',
                                      message: `ต้องการยกเลิกรายการตัดฟอยล์ SO ${item.soNumber} หรือไม่?\n(ระบบจะคืนยอดเข้าม้วนเดิมอัตโนมัติ)`,
                                      confirmLabel: 'ยกเลิกรายการ',
                                    })
                                  ) {
                                    onDeleteRecord(item.rawFoil.id);
                                  }
                                } else if (!isFoil && item.rawSandwich && onDeleteSandwichRecord) {
                                  if (
                                    await confirmAction({
                                      title: 'ลบรายการตัด SO แซนวิช',
                                      message: `ต้องการลบรายการตัด SO แซนวิช ${item.soNumber} หรือไม่?`,
                                      confirmLabel: 'ลบรายการ',
                                    })
                                  ) {
                                    onDeleteSandwichRecord(item.rawSandwich.id);
                                  }
                                }
                              });
                            }}
                            title="ลบ/ยกเลิกรายการนี้"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Pop-up Modal: Foil SO Cut Details */}
      <SODetailModal
        record={selectedDetailRecord}
        rolls={rolls || []}
        records={records}
        onClose={() => setSelectedDetailRecord(null)}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
        userMode={userMode}
        onRequestUnlock={onRequestUnlock}
      />
    </div>
  );
};
