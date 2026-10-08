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
  Scissors,
  LayoutGrid,
  Table as TableIcon
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
  remainingBeforeDisplay?: string;
  remainingBeforeValue?: number;
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

  // View Mode: Cards (ช่องใหญ่ ละเอียดครบ) or Table (ตารางแถวใหญ่)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('foil_history_view_mode');
      if (saved === 'cards' || saved === 'table') return saved;
    } catch {}
    return 'cards';
  });

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
        remainingBeforeDisplay: r.remainingBefore !== undefined ? `${formatMeters(r.remainingBefore)} ม.` : undefined,
        remainingBeforeValue: r.remainingBefore,
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
        remainingBeforeDisplay: s.weightBefore ? `${Number(s.weightBefore).toLocaleString()} กก.` : undefined,
        remainingBeforeValue: Number(s.weightBefore) || 0,
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

      // 3. Search Query (Matches SO, Details, RecordedBy, Notes, Pattern, Silver/White)
      if (!q) return true;
      return (
        item.soNumber.toLowerCase().includes(q) ||
        item.detailsSummary.toLowerCase().includes(q) ||
        item.recordedBy.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.pattern && item.pattern.toLowerCase().includes(q)) ||
        (item.isSilverSide && ('ท้องเงิน'.includes(q) || 'เงิน'.includes(q))) ||
        (item.isWhiteSide && ('ท้องขาว'.includes(q) || 'ขาว'.includes(q))) ||
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

        {/* Live Metrics Summary & View Mode Switcher */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono pt-2 border-t border-slate-100">
          <div className="text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>แสดง <strong className="text-slate-900">{sortedItems.length}</strong> รายการ</span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-amber-700 font-semibold">ฟอยล์: {stats.foilCount}</span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-emerald-700 font-semibold">แซนวิช: {stats.sandwichCount}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* View Mode Toggle: ช่อง SO ใหญ่ (ละเอียดครบ) vs ตาราง */}
            <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs font-sans text-xs">
              <button
                type="button"
                onClick={() => {
                  setViewMode('cards');
                  try { localStorage.setItem('foil_history_view_mode', 'cards'); } catch {}
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-amber-400 text-slate-950 shadow-xs ring-1 ring-amber-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="แสดงแต่ละ SO เป็นช่องใหญ่ พร้อมรายละเอียดครบถ้วน"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-amber-950 shrink-0" />
                <span>ช่อง SO ใหญ่ (ละเอียดครบ)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('table');
                  try { localStorage.setItem('foil_history_view_mode', 'table'); } catch {}
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="แสดงแบบตารางแนวนอน"
              >
                <TableIcon className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <span>ตาราง</span>
              </button>
            </div>

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

      {/* NO RESULTS EMPTY STATE */}
      {sortedItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-12 text-center text-slate-400 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700 text-sm">ไม่พบรายการตัดสต๊อกตามที่ค้นหา</p>
          <p className="text-xs text-slate-400">ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* VIEW MODE 1: LARGE SO CARDS (ช่องแต่ละ SO ใหญ่ขึ้นอีก และรายละเอียดครบถ้วน แสดงท้องและตัวเลือกเงิน/ขาว) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedItems.map((item) => {
            const isFoil = item.type === 'foil';
            const patternStyle = isFoil && item.pattern ? getPatternStyle(item.pattern) : null;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border-2 border-slate-200/90 hover:border-amber-400 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 space-y-3.5 group relative flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header: SO Code + Category Badge + Date + Quick LINE Copy */}
                  <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {/* Large prominent SO Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isFoil && item.rawFoil) setSelectedDetailRecord(item.rawFoil);
                          else if (!isFoil && item.rawSandwich) setSelectedSandwichDetail(item.rawSandwich);
                        }}
                        title="คลิกเพื่อดูรายละเอียดใบ SO แบบเต็ม"
                        className={`font-mono font-black text-sm sm:text-base px-3.5 py-1.5 rounded-xl border shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 ${
                          isFoil
                            ? 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
                            : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                        }`}
                      >
                        <span>{item.soNumber}</span>
                        <FileText className="w-4 h-4 opacity-70 shrink-0" />
                      </button>

                      {/* Type Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isFoil
                            ? 'bg-amber-100/90 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100/90 text-emerald-950 border border-emerald-300'
                        }`}
                      >
                        {isFoil ? <Scissors className="w-3.5 h-3.5 text-amber-700" /> : <Factory className="w-3.5 h-3.5 text-emerald-700" />}
                        <span>{item.categoryLabel}</span>
                      </span>
                    </div>

                    {/* Date & Copy Button */}
                    <div className="flex items-center gap-1.5 shrink-0 text-xs">
                      <span className="font-mono text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/90 flex items-center gap-1 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.date || '-'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySingle(item)}
                        title="คัดลอกข้อมูลสรุปเพื่อส่ง LINE"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Roll / Coil Information with Pattern & Side Choice */}
                  {isFoil && item.rawFoil ? (
                    <div className="space-y-2.5">
                      {/* Lot + Roll + Width Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* High-contrast Black & Gold Lot/Roll Badge */}
                        <div className="inline-flex items-center gap-1.5 bg-black text-white px-3 py-1 rounded-lg border border-slate-800 shadow-2xs">
                          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">LOT.</span>
                          <span className="lot-number-display text-sm font-black text-white">{item.rawFoil.lotNumber}</span>
                          <span className="text-slate-600 font-bold">|</span>
                          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">NO.</span>
                          <span className="lot-number-display text-sm font-black text-amber-300">#{item.rawFoil.rollNumber}</span>
                        </div>

                        <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          หน้ากว้าง {item.rawFoil.width} มม.
                        </span>
                      </div>

                      {/* แสดงท้องแล้วแสดงตัวเลือกว่าเป็นเงินหรือขาว (ตามคำขอ) */}
                      <div className="p-3 bg-gradient-to-r from-amber-50/70 via-slate-50 to-orange-50/40 rounded-xl border border-amber-200/90 space-y-2 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {/* แสดงท้อง (ลายฟอยล์) */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-600">ท้อง (ลายฟอยล์):</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 font-black text-xs border border-amber-300 shadow-2xs">
                              {patternStyle && <span className={`w-2.5 h-2.5 rounded-full ${patternStyle.dotClass}`} />}
                              <span>{item.rawFoil.pattern || 'ลายมาตรฐาน'}</span>
                            </span>
                          </div>

                          {/* แสดงตัวเลือกว่าเป็นเงินหรือขาว */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-600">ตัวเลือกท้อง:</span>
                            <div className="inline-flex items-center gap-1 p-0.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                              {/* ตัวเลือก ท้องเงิน */}
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black transition-all ${
                                  item.isSilverSide
                                    ? 'bg-gradient-to-r from-slate-800 to-zinc-900 text-white shadow-xs ring-1 ring-amber-400'
                                    : 'text-slate-400 bg-transparent'
                                }`}
                                title={item.isSilverSide ? 'เลือกเป็นท้องเงิน' : ''}
                              >
                                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-slate-200 to-zinc-400 border border-white/60 shrink-0" />
                                <span>ท้องเงิน</span>
                                {item.isSilverSide && <span className="text-[10px] text-amber-300 font-bold ml-0.5">✓</span>}
                                {!item.isSilverSide && !item.isWhiteSide && (
                                  <span className="text-[10px] text-slate-400 font-normal ml-0.5">(มาตรฐาน)</span>
                                )}
                              </span>

                              {/* ตัวเลือก ท้องขาว */}
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black transition-all ${
                                  item.isWhiteSide
                                    ? 'bg-slate-100 text-slate-900 border border-slate-400 shadow-xs ring-1 ring-amber-400 font-black'
                                    : 'text-slate-400 bg-transparent'
                                }`}
                                title={item.isWhiteSide ? 'เลือกเป็นท้องขาว' : ''}
                              >
                                <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 shrink-0" />
                                <span>ท้องขาว</span>
                                {item.isWhiteSide && <span className="text-[10px] text-emerald-600 font-bold ml-0.5">✓</span>}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : item.rawSandwich ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/80 text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800">คอยล์ #{item.rawSandwich.coilNumber || '-'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-700">สี {item.rawSandwich.coilColor || '-'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-slate-700">หนา {item.rawSandwich.thickness ? `${item.rawSandwich.thickness}มม.` : '-'}</span>
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          แหล่งเหล็ก: <strong className="text-slate-800">{item.rawSandwich.steelOrigin || '-'}</strong>
                          {item.rawSandwich.soLengthMeters && (
                            <span className="ml-2 font-mono">ยาว SO: {Number(item.rawSandwich.soLengthMeters).toLocaleString()} ม.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-700">{item.detailsSummary}</div>
                  )}

                  {/* Section 2: Metrics Grid (ตัวเลขใหญ่ ชัดเจน) */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    {/* เมตรที่ใช้จริง */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                        {isFoil ? 'เมตรที่ใช้จริง' : 'เหล็กที่ใช้'}
                      </span>
                      <span className="font-mono font-black text-slate-900 text-base sm:text-lg block mt-0.5">
                        {item.usedDisplay}
                      </span>
                    </div>

                    {/* NG เสีย */}
                    <div className={`p-2.5 rounded-xl border ${item.ngValue > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wide block ${item.ngValue > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                        NG เสีย
                      </span>
                      <span className={`font-mono font-black text-base sm:text-lg block mt-0.5 ${item.ngValue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {item.ngDisplay}
                      </span>
                    </div>

                    {/* คงเหลือในม้วน */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                        คงเหลือในม้วน
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-sm sm:text-base block mt-0.5">
                        {item.remainingDisplay}
                      </span>
                      {item.remainingBeforeDisplay && (
                        <span className="text-[10px] font-mono text-slate-400 block truncate" title={`ก่อนตัด: ${item.remainingBeforeDisplay}`}>
                          (ก่อน: {item.remainingBeforeDisplay})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Footer (ผู้บันทึก, หมายเหตุ & จัดการ) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      ผู้บันทึก: <strong className="text-slate-800">{item.recordedBy}</strong>
                    </span>
                    {item.notes && (
                      <span className="text-slate-400 truncate max-w-[150px]" title={item.notes}>
                        • 📝 {item.notes}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    {/* Full Detail Modal */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isFoil && item.rawFoil) setSelectedDetailRecord(item.rawFoil);
                        else if (!isFoil && item.rawSandwich) setSelectedSandwichDetail(item.rawSandwich);
                      }}
                      title="ดูรายละเอียดใบ SO แบบเต็ม"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer border border-slate-200"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    {isFoil && item.rawFoil && onEditRecord && (
                      <button
                        type="button"
                        onClick={() => handleActionGuarded(() => onEditRecord(item.rawFoil!))}
                        title="แก้ไขรายการตัดฟอยล์"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer border border-slate-200"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {!isFoil && item.rawSandwich && onEditSandwichRecord && (
                      <button
                        type="button"
                        onClick={() => handleActionGuarded(() => onEditSandwichRecord(item.rawSandwich!))}
                        title="แก้ไขรายการตัด SO แซนวิช"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer border border-slate-200"
                      >
                        <Pencil className="w-4 h-4" />
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
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-slate-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW MODE 2: TABLE VIEW (แถวใหญ่และรายละเอียดครบถ้วน) */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto relative scroll-smooth focus:outline-none">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  {/* STICKY SO HEADER */}
                  {renderSortTh('so', 'รหัส SO (ตรึงซ้าย)', 'left', true)}
                  {renderSortTh('type', 'ประเภท', 'center')}
                  {renderSortTh('date', 'วันที่ผลิต/ตัด')}
                  {renderSortTh('details', 'รายละเอียด / ล็อต / ท้อง & ตัวเลือก')}
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
                      className="group hover:bg-slate-50/90 transition-colors"
                    >
                      {/* STICKY SO COLUMN: Large prominent SO button */}
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 transition-colors px-3 py-3 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center gap-1.5 min-w-[140px]">
                          <button
                            type="button"
                            onClick={() => {
                              if (isFoil && item.rawFoil) {
                                setSelectedDetailRecord(item.rawFoil);
                              } else if (!isFoil && item.rawSandwich) {
                                setSelectedSandwichDetail(item.rawSandwich);
                              }
                            }}
                            title="คลิกเพื่อดูรายละเอียดใบ SO แบบเต็ม"
                            className={`font-mono font-black text-sm px-3 py-1.5 rounded-xl border shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-left ${
                              isFoil
                                ? 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
                                : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                            }`}
                          >
                            <span>{item.soNumber}</span>
                            <FileText className="w-3.5 h-3.5 opacity-60 ml-0.5 shrink-0" />
                          </button>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                      <td className="px-3 py-3 font-mono text-slate-700 font-medium">
                        {item.date || '-'}
                      </td>

                      {/* Details / Lot / Foil Pattern & Side Selection */}
                      <td
                        className="px-3 py-3 cursor-pointer hover:bg-slate-100/60 transition-colors"
                        onClick={() => {
                          if (isFoil && item.rawFoil) {
                            setSelectedDetailRecord(item.rawFoil);
                          } else if (!isFoil && item.rawSandwich) {
                            setSelectedSandwichDetail(item.rawSandwich);
                          }
                        }}
                        title="คลิกเพื่อดูรายละเอียดใบ SO"
                      >
                        {isFoil && item.rawFoil ? (
                          <div className="flex flex-col gap-1.5 py-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="inline-flex items-center gap-1 bg-black text-white px-2 py-0.5 rounded-md border border-slate-800 shadow-2xs shrink-0">
                                <span className="text-[10px] font-black uppercase text-amber-400">LOT.</span>
                                <span className="lot-number-display text-xs font-black text-white">{item.rawFoil.lotNumber}</span>
                                <span className="text-slate-600 font-bold">|</span>
                                <span className="text-[10px] font-black uppercase text-amber-400">NO.</span>
                                <span className="lot-number-display text-xs font-black text-amber-300">#{item.rawFoil.rollNumber}</span>
                              </div>
                              <span className="font-mono font-bold text-slate-700 text-xs">
                                หน้า {item.rawFoil.width} มม.
                              </span>
                            </div>

                            {/* แสดงท้องแล้วแสดงตัวเลือกว่าเป็นเงินหรือขาว */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="text-slate-500 font-bold">ท้อง:</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-950 font-bold border border-amber-200">
                                {patternStyle && <span className={`w-2 h-2 rounded-full ${patternStyle.dotClass}`} />}
                                <span>{item.rawFoil.pattern || 'ลายมาตรฐาน'}</span>
                              </span>
                              <span className="text-slate-300 font-bold">•</span>
                              <span className="text-slate-500 font-bold">ตัวเลือก:</span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${
                                  item.isSilverSide
                                    ? 'bg-slate-800 text-white border-slate-900 shadow-2xs'
                                    : 'text-slate-400 border-slate-200 bg-slate-50'
                                }`}
                              >
                                <span className="w-2 h-2 rounded-full bg-slate-300 border border-white/50" />
                                <span>ท้องเงิน</span>
                                {item.isSilverSide && <span className="text-[10px] text-amber-300 font-normal">✓</span>}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${
                                  item.isWhiteSide
                                    ? 'bg-white text-slate-900 border-slate-400 shadow-2xs'
                                    : 'text-slate-400 border-slate-200 bg-slate-50'
                                }`}
                              >
                                <span className="w-2 h-2 rounded-full bg-white border border-slate-400" />
                                <span>ท้องขาว</span>
                                {item.isWhiteSide && <span className="text-[10px] text-emerald-600 font-normal">✓</span>}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 max-w-[320px] truncate" title={item.detailsSummary}>
                            {patternStyle && (
                              <span className={`w-2 h-2 rounded-full shrink-0 ${patternStyle.dotClass}`} />
                            )}
                            <span className="font-medium text-slate-900">
                              {item.detailsSummary}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Used Amount */}
                      <td className="px-3 py-3 text-right font-mono font-black text-slate-900 text-sm">
                        {item.usedDisplay}
                      </td>

                      {/* NG Amount */}
                      <td className={`px-3 py-3 text-right font-mono ${item.ngValue > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}`}>
                        {item.ngDisplay}
                      </td>

                      {/* Remaining / After Cut */}
                      <td className="px-3 py-3 text-right font-mono text-slate-800 font-bold">
                        <div>{item.remainingDisplay}</div>
                        {item.remainingBeforeDisplay && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            (ก่อน: {item.remainingBeforeDisplay})
                          </div>
                        )}
                      </td>

                      {/* Recorder */}
                      <td className="px-3 py-3 text-slate-600 text-[11px] truncate max-w-[120px]">
                        {item.recordedBy}
                      </td>

                      {/* Actions (Copy / Edit / Delete) */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Copy line text */}
                          <button
                            type="button"
                            onClick={() => handleCopySingle(item)}
                            title="คัดลอกข้อมูลสรุปเพื่อส่ง LINE"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Full detail pop-up — foil */}
                          {isFoil && item.rawFoil && (
                            <button
                              type="button"
                              onClick={() => setSelectedDetailRecord(item.rawFoil!)}
                              title="ดูรายละเอียดใบ SO ฟอยล์แบบเต็ม"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Full detail pop-up — sandwich */}
                          {!isFoil && item.rawSandwich && (
                            <button
                              type="button"
                              onClick={() => setSelectedSandwichDetail(item.rawSandwich!)}
                              title="ดูรายละเอียดใบ SO แซนวิชแบบเต็ม"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
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
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isFoil && item.rawSandwich && onEditSandwichRecord && (
                            <button
                              type="button"
                              onClick={() => handleActionGuarded(() => onEditSandwichRecord(item.rawSandwich!))}
                              title="แก้ไขรายการตัด SO แซนวิช"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* Pop-up Modal: Foil SO Cut Details */}
      {selectedDetailRecord && (
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
      )}

      {/* Pop-up Modal: Sandwich SO Cut Details */}
      {selectedSandwichDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setSelectedSandwichDetail(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="รายละเอียดใบ SO แซนวิช"
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <Factory className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <h2 className="text-base font-bold">รายละเอียดใบ SO แซนวิช</h2>
                  <p className="text-xs text-emerald-100/90 font-mono mt-0.5">
                    {selectedSandwichDetail.soNumber || '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSandwichDetail(null)}
                aria-label="ปิด"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm text-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">วันที่ผลิต</div>
                  <div className="font-mono font-bold mt-0.5">{selectedSandwichDetail.productionDate || '-'}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">ผู้บันทึก</div>
                  <div className="font-bold mt-0.5">{selectedSandwichDetail.recordedBy || '-'}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">สีคอยล์</div>
                  <div className="font-bold mt-0.5">{selectedSandwichDetail.coilColor || '-'}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">ความหนา</div>
                  <div className="font-mono font-bold mt-0.5">{selectedSandwichDetail.thickness || '-'}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">เบอร์คอยล์</div>
                  <div className="font-mono font-bold mt-0.5">{selectedSandwichDetail.coilNumber || '-'}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">แหล่งเหล็ก</div>
                  <div className="font-bold mt-0.5">
                    {selectedSandwichDetail.steelOrigin === 'อื่นๆ'
                      ? selectedSandwichDetail.customSteelOrigin || 'อื่นๆ'
                      : selectedSandwichDetail.steelOrigin || '-'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                  <div className="text-[10px] font-bold text-emerald-700">ก่อนใช้ (กก.)</div>
                  <div className="font-mono font-bold text-emerald-900 text-base mt-0.5">
                    {Number(selectedSandwichDetail.weightBefore || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                  <div className="text-[10px] font-bold text-slate-600">หลังใช้ (กก.)</div>
                  <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                    {Number(selectedSandwichDetail.weightAfter || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                  <div className="text-[10px] font-bold text-amber-700">ใช้ไป (กก.)</div>
                  <div className="font-mono font-bold text-amber-900 text-base mt-0.5">
                    {Number(selectedSandwichDetail.weightUsed || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {(selectedSandwichDetail.soLengthMeters != null ||
                selectedSandwichDetail.lengthMeters != null ||
                selectedSandwichDetail.ngKg != null ||
                selectedSandwichDetail.ngMeters != null) && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedSandwichDetail.soLengthMeters != null && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="text-[10px] font-bold text-slate-500">ความยาวตาม SO (ม.)</div>
                      <div className="font-mono font-bold mt-0.5">
                        {Number(selectedSandwichDetail.soLengthMeters).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {selectedSandwichDetail.lengthMeters != null && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="text-[10px] font-bold text-slate-500">ความยาวที่ผลิต (ม.)</div>
                      <div className="font-mono font-bold mt-0.5">
                        {Number(selectedSandwichDetail.lengthMeters).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {selectedSandwichDetail.ngKg != null && Number(selectedSandwichDetail.ngKg) > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                      <div className="text-[10px] font-bold text-rose-600">NG (กก.)</div>
                      <div className="font-mono font-bold text-rose-800 mt-0.5">
                        {Number(selectedSandwichDetail.ngKg).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {selectedSandwichDetail.ngMeters != null && Number(selectedSandwichDetail.ngMeters) > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                      <div className="text-[10px] font-bold text-rose-600">NG (ม.)</div>
                      <div className="font-mono font-bold text-rose-800 mt-0.5">
                        {Number(selectedSandwichDetail.ngMeters).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedSandwichDetail.notes && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">หมายเหตุ</div>
                  <div className="mt-1 text-slate-700 leading-relaxed">{selectedSandwichDetail.notes}</div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              {onEditSandwichRecord && (
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedSandwichDetail;
                    setSelectedSandwichDetail(null);
                    handleActionGuarded(() => onEditSandwichRecord(rec));
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  แก้ไข
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedSandwichDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-bold cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
