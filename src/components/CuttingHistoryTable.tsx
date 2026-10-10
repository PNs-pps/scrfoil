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
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { exportCutRecordsToCSV, exportPuSandwichRecordsToCSV } from '../utils/storage';
import { formatMeters, compareLotAndRoll } from '../utils/formatters';
import { UserMode } from '../utils/auth';
import { getPatternStyle } from '../utils/patternStyles';
import { SODetailModal } from './SODetailModal';

export type HistoryCategory = 'all' | 'foil' | 'sandwich';
type SortField = 'date' | 'so' | 'type' | 'details' | 'pattern' | 'side' | 'used' | 'ng' | 'remaining' | 'recorder';
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

  // Table horizontal scrolling & swipe controls
  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const isDraggingRef = React.useRef(false);
  const dragStartXRef = React.useRef(0);
  const dragScrollLeftRef = React.useRef(0);
  const hasMovedRef = React.useRef(false);

  const checkScroll = React.useCallback(() => {
    if (!tableScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  const scrollTable = (direction: 'left' | 'right') => {
    if (!tableScrollRef.current) return;
    const amount = direction === 'left' ? -420 : 420;
    tableScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    if (!tableScrollRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartXRef.current = e.pageX - tableScrollRef.current.offsetLeft;
    dragScrollLeftRef.current = tableScrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !tableScrollRef.current) return;
    const x = e.pageX - tableScrollRef.current.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.5;
    if (Math.abs(walk) > 3) {
      hasMovedRef.current = true;
      tableScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
      checkScroll();
    }
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    hasMovedRef.current = false;
  };

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
        subDetails: `${r.width} มม.`,
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
      const details = `คอยล์ #${s.coilNumber || '-'} · สี ${s.coilColor || '-'} ${s.thickness ? `${s.thickness}มม.` : ''} (${s.steelOrigin || 'เหล็ก'})`;

      list.push({
        id: `sandwich_${s.id}`,
        type: 'sandwich',
        soNumber: s.soNumber || '-',
        date: d,
        categoryLabel: 'แซนวิช',
        detailsSummary: details,
        subDetails: s.steelOrigin,
        usedDisplay: s.soLengthMeters ? `${formatMeters(s.soLengthMeters)} ม.` : `${formatMeters(s.weightUsed)} ม.`,
        usedValue: Number(s.soLengthMeters || s.weightUsed) || 0,
        ngDisplay: (s.ngMeters || 0) > 0 ? `${formatMeters(s.ngMeters)} ม.` : '—',
        ngValue: Number(s.ngMeters) || 0,
        remainingDisplay: '—',
        remainingValue: 0,
        remainingBeforeDisplay: undefined,
        remainingBeforeValue: 0,
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
        case 'pattern':
          diff = (a.pattern || '').localeCompare(b.pattern || '');
          break;
        case 'side': {
          const sideRank = (x: typeof a) => (x.isSilverSide ? 1 : x.isWhiteSide ? 2 : 0);
          diff = sideRank(a) - sideRank(b);
          break;
        }
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
      text = `🥪 [PU แซนวิช] SO: ${s.soNumber}\n📅 วันที่: ${item.date}\n🔩 ${item.detailsSummary}\n⚖️ เหล็กที่ใช้: ${formatMeters(s.weightUsed)} กก.` +
        (s.soLengthMeters ? ` (${formatMeters(s.soLengthMeters)} ม.)` : '') +
        ((s.ngKg || 0) > 0 ? ` | NG: ${formatMeters(s.ngKg)} กก.` : '') +
        ((s.ngMeters || 0) > 0 ? ` (${formatMeters(s.ngMeters)} ม.)` : '') +
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
        className={`px-3 py-2.5 text-xs font-bold select-none cursor-pointer transition-colors ${
          stickyLeft
            ? 'sticky left-0 top-0 z-40 bg-slate-100 border-r-2 border-slate-300 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap'
            : 'bg-slate-50/95 hover:bg-slate-100'
        } ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      >
        <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span className={isCurrent ? 'text-slate-950 font-black' : 'text-slate-600'}>{label}</span>
          {isCurrent ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 shrink-0" />
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
          <div className="flex items-center gap-2 shrink-0 flex-wrap">

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
            {stats.foilCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[11px]">
                ฟอยล์ใช้ {formatMeters(stats.totalFoilUsed)} ม. {stats.totalFoilNg > 0 ? `(NG ${formatMeters(stats.totalFoilNg)} ม.)` : ''}
              </span>
            )}
            {stats.sandwichCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-950 border border-emerald-200 font-bold text-[11px]">
                เหล็กใช้ {formatMeters(stats.totalSandwichKg)} กก. {stats.totalSandwichNgKg > 0 ? `(NG ${formatMeters(stats.totalSandwichNgKg)} กก.)` : ''}
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
      ) : (
        /* SINGLE-ROW SWIPEABLE SO HISTORY (ตรึง SO ด้านซ้าย รายละเอียดอยู่ในแถวเดียวกัน ปัดซ้ายขวา) */
        <div className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-sm overflow-hidden transition-all">
          {/* Top Banner with Swipe Guidance & Quick Navigation Buttons */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-500/10 via-amber-100/40 to-slate-100 border-b border-slate-200 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-amber-700 animate-pulse" />
                <span>ปัดซ้าย-ขวา เพื่อดูรายละเอียดทั้งหมดในแถวเดียวกัน</span>
              </span>
              <span className="hidden sm:inline text-slate-500 font-medium">
                · รหัส SO ตรึงคงที่อยู่ด้านซ้ายเสมอ
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollTable('left')}
                disabled={!canScrollLeft}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                title="เลื่อนไปทางซ้าย"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden md:inline">เลื่อนซ้าย</span>
              </button>
              <button
                type="button"
                onClick={() => scrollTable('right')}
                disabled={!canScrollRight}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                title="เลื่อนไปทางขวา"
              >
                <span className="hidden md:inline">เลื่อนขวา</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Swipeable Table Scroll Container with Mouse Drag & Touch Pan */}
          <div
            ref={tableScrollRef}
            onScroll={checkScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="overflow-x-auto relative scroll-smooth focus:outline-none select-none md:select-auto cursor-grab active:cursor-grabbing"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
          >
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[980px]">
              <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-700 sticky top-0 z-30">
                <tr>
                  {/* STICKY SO HEADER (ตรึงซ้าย กะทัดรัด) */}
                  {renderSortTh('so', 'รหัส SO', 'left', true)}
                  {renderSortTh('type', 'ประเภท', 'center')}
                  {renderSortTh('details', 'ล็อต / เบอร์ / กว้าง')}
                  {renderSortTh('pattern', 'ท้อง')}
                  {renderSortTh('used', 'ปริมาณที่ใช้', 'right')}
                  {renderSortTh('ng', 'NG ที่เสีย', 'right')}
                  {renderSortTh('remaining', 'ก่อน / หลังตัด', 'right')}
                  {renderSortTh('recorder', 'ผู้บันทึก & หมายเหตุ')}
                  <th className="px-2.5 py-2 text-center text-xs font-bold text-slate-600 w-32 bg-slate-50/95">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {sortedItems.map((item) => {
                  const isFoil = item.type === 'foil';
                  const patternStyle = isFoil && item.pattern ? getPatternStyle(item.pattern) : null;

                  return (
                    <tr key={item.id} className="group hover:bg-amber-50/40 transition-colors">
                      {/* 1. STICKY SO COLUMN (ตรึงตำแหน่งซ้าย มีเฉพาะรหัส SO เท่านั้น ไม่มีอิโมจิหรือไอคอน มาร์คเส้นแบ่งชัดเจน) */}
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-amber-50/90 transition-colors px-2.5 py-2 border-r-2 border-slate-300 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap w-24 min-w-[95px] max-w-[120px]">
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
                          className={`font-mono font-bold text-xs px-2 py-1 rounded-lg border shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer block w-full text-center truncate ${
                            isFoil
                              ? 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          {item.soNumber}
                        </button>
                      </td>

                      {/* 2. ประเภท (Type Badge) */}
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isFoil
                              ? 'bg-amber-100 text-amber-950 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                          }`}
                        >
                          {isFoil ? (
                            <Scissors className="w-3 h-3 text-amber-700" />
                          ) : (
                            <Factory className="w-3 h-3 text-emerald-700" />
                          )}
                          <span>{item.categoryLabel}</span>
                        </span>
                      </td>

                      {/* 3. รายละเอียด / หลอด, เบอร์, กว้าง (2 แถว คอลัมน์ชิดกัน) */}
                      <td
                        className="px-2.5 py-2 cursor-pointer hover:bg-slate-100/60 transition-colors whitespace-nowrap"
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
                          <div className="flex flex-col gap-0.5">
                            {/* แถว 1: เบอร์หลอด (LOT) & เบอร์ม้วน (NO.) */}
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-xs">
                                {item.rawFoil.lotNumber}
                              </span>
                              <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-xs">
                                #{item.rawFoil.rollNumber}
                              </span>
                            </div>
                            {/* แถว 2: กว้าง (หน้ากว้างไม่ต้องใส่คำว่าหน้า) */}
                            <div className="text-[11px] font-mono font-semibold text-slate-600">
                              กว้าง {item.rawFoil.width} มม.
                            </div>
                          </div>
                        ) : item.rawSandwich ? (
                          <div className="flex flex-col gap-0.5">
                            {/* แถว 1: เบอร์คอยล์ */}
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-bold text-emerald-950 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-xs">
                                คอยล์ #{item.rawSandwich.coilNumber || '-'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-sans">
                                ({item.rawSandwich.steelOrigin || 'เหล็ก'})
                              </span>
                            </div>
                            {/* แถว 2: สี และ ความหนา */}
                            <div className="text-[11px] font-sans font-medium text-slate-600">
                              สี {item.rawSandwich.coilColor || '-'} {item.rawSandwich.thickness ? `· ${item.rawSandwich.thickness} มม.` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-500 truncate max-w-[200px]" title={item.detailsSummary}>
                            {item.detailsSummary}
                          </div>
                        )}
                      </td>

                      {/* 4. ท้อง (ลาย) - กรอบท้องคลุมแค่ขาว จุดสีอยู่นอกกรอบ ขาว/เงิน ไล่เชดสีไม่มีกรอบ */}
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        {isFoil && item.rawFoil ? (
                          <div className="inline-flex items-center gap-1.5">
                            {/* กรอบท้องคลุมแค่ชื่อลาย/ขาว */}
                            <span
                              className={`px-2 py-0.5 rounded-md border font-bold text-xs shadow-2xs ${
                                patternStyle
                                  ? patternStyle.highlightClass
                                  : 'bg-slate-100 text-slate-800 border-slate-300'
                              }`}
                              title={
                                patternStyle
                                  ? `${item.rawFoil.pattern || 'ขาว'} (${patternStyle.colorName})`
                                  : undefined
                              }
                            >
                              {item.rawFoil.pattern || 'ขาว'}
                            </span>

                            {/* จุดสีอยู่นอกกรอบ: ขาว เงิน แบบไล่เชดสีไม่มีกรอบ */}
                            {item.isSilverSide && (
                              <span
                                className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-slate-300 via-slate-100 to-zinc-400 shadow-sm shrink-0 border-0"
                                title="ตัวเลือก: ท้องเงิน"
                              />
                            )}
                            {item.isWhiteSide && (
                              <span
                                className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-sm shrink-0 border-0"
                                title="ตัวเลือก: ท้องขาว"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 5. ปริมาณที่ใช้ */}
                      <td className="px-2.5 py-2 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                        {item.usedDisplay}
                      </td>

                      {/* 6. NG ที่เสีย */}
                      <td
                        className={`px-2.5 py-2 text-right font-mono whitespace-nowrap ${
                          item.ngValue > 0 ? 'text-rose-600 font-black' : 'text-slate-400'
                        }`}
                      >
                        {item.ngDisplay}
                      </td>

                      {/* 7. คงเหลือ / หลังตัด */}
                      <td className="px-2.5 py-2 text-right font-mono text-slate-800 font-bold whitespace-nowrap">
                        <div>{item.remainingDisplay}</div>
                        {item.remainingBeforeDisplay && (
                          <div className="text-[11px] text-slate-400 font-normal">
                            (ก่อน: {item.remainingBeforeDisplay})
                          </div>
                        )}
                      </td>

                      {/* 8. ผู้บันทึก & หมายเหตุ */}
                      <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 max-w-[180px]">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">
                            {item.recordedBy}
                          </span>
                        </div>
                        {item.notes && (
                          <div
                            className="text-[11px] text-slate-400 truncate max-w-[180px] mt-0.5"
                            title={item.notes}
                          >
                            📝 {item.notes}
                          </div>
                        )}
                      </td>

                      {/* 9. จัดการ */}
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* คัดลอกสรุปส่ง LINE */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySingle(item);
                              }}
                              title="คัดลอกข้อมูลเพื่อส่ง LINE"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* ดูรายละเอียดเต็ม */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isFoil && item.rawFoil) {
                                  setSelectedDetailRecord(item.rawFoil);
                                } else if (!isFoil && item.rawSandwich) {
                                  setSelectedSandwichDetail(item.rawSandwich);
                                }
                              }}
                              title="ดูรายละเอียดใบ SO แบบเต็ม"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer border border-slate-200"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* แก้ไข */}
                            {isFoil && item.rawFoil && onEditRecord && (
                              <button
                                type="button"
                                onClick={() => handleActionGuarded(() => onEditRecord(item.rawFoil!))}
                                title="แก้ไขรายการตัดฟอยล์"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer border border-slate-200"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isFoil && item.rawSandwich && onEditSandwichRecord && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleActionGuarded(() => onEditSandwichRecord(item.rawSandwich!))
                                }
                                title="แก้ไขรายการตัด SO แซนวิช"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer border border-slate-200"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* ลบ / ยกเลิก */}
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
                    {formatMeters(selectedSandwichDetail.weightBefore)}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                  <div className="text-[10px] font-bold text-slate-600">หลังใช้ (กก.)</div>
                  <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                    {formatMeters(selectedSandwichDetail.weightAfter)}
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                  <div className="text-[10px] font-bold text-amber-700">ใช้ไป (กก.)</div>
                  <div className="font-mono font-bold text-amber-900 text-base mt-0.5">
                    {formatMeters(selectedSandwichDetail.weightUsed)}
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
                      <div className="font-mono font-bold mt-0.5 text-slate-900">
                        {formatMeters(selectedSandwichDetail.soLengthMeters)}
                      </div>
                    </div>
                  )}
                  {selectedSandwichDetail.lengthMeters != null && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="text-[10px] font-bold text-slate-500">ความยาวที่ผลิต (ม.)</div>
                      <div className="font-mono font-bold mt-0.5 text-slate-900">
                        {formatMeters(selectedSandwichDetail.lengthMeters)}
                      </div>
                    </div>
                  )}
                  {selectedSandwichDetail.ngKg != null && Number(selectedSandwichDetail.ngKg) > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                      <div className="text-[10px] font-bold text-rose-600">NG (กก.)</div>
                      <div className="font-mono font-bold text-rose-800 mt-0.5">
                        {formatMeters(selectedSandwichDetail.ngKg)}
                      </div>
                    </div>
                  )}
                  {selectedSandwichDetail.ngMeters != null && Number(selectedSandwichDetail.ngMeters) > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                      <div className="text-[10px] font-bold text-rose-600">NG (ม.)</div>
                      <div className="font-mono font-bold text-rose-800 mt-0.5">
                        {formatMeters(selectedSandwichDetail.ngMeters)}
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
