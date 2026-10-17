import React, { useState, useMemo } from 'react';
import { confirmAction } from '../utils/confirmAction';
import { StockCutRecord, FoilRoll, PuSandwichCutRecord, SOAuditLogItem } from '../types';
import { isCountableCut } from '../utils/rollAggregates';
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
  FileSpreadsheet,
  History,
  ArrowRight,
  Clock,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
  Ban,
  CalendarClock
} from 'lucide-react';
import { exportCutRecordsToCSV, exportPuSandwichRecordsToCSV } from '../utils/storage';
import { formatMeters, compareLotAndRoll, formatThaiDateTime, formatThaiDate } from '../utils/formatters';
import { exportAuditLogsToCSV } from '../utils/auditLogger';
import { UserMode } from '../utils/auth';
import { getPatternStyle } from '../utils/patternStyles';
import { SODetailModal } from './SODetailModal';
import { SOReservationHubView } from './SOReservationHubView';

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
  cutStatus?: 'completed' | 'reserved' | 'cancelled';
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
  onConfirmProduction?: (recordId: string, soNumber: string) => Promise<void> | void;
  onReallocateRoll?: (record: StockCutRecord) => void;
  onCancelProduction?: (record: StockCutRecord) => void;
  initialCategory?: HistoryCategory;
  userMode?: UserMode;
  onRequestUnlock?: (action?: () => void) => void;
  auditLogs?: SOAuditLogItem[];
  onVerifyRecord?: (record: StockCutRecord) => void;
  onNavigateToAuditHub?: () => void;
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
  onConfirmProduction,
  onReallocateRoll,
  onCancelProduction,
  initialCategory = 'all',
  userMode = 'visitor',
  onRequestUnlock,
  auditLogs = [],
  onVerifyRecord,
  onNavigateToAuditHub,
}) => {
  // Main Mode: 'records' (ตารางตัดสต๊อกปกติ) | 'reservations' (คิวจอง SO) | 'audit' (ตรวจสอบประวัติการแก้ไข SO)
  const [historyMode, setHistoryMode] = useState<'records' | 'reservations' | 'audit'>('records');

  // Audit Trail Filters
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'all' | 'foil' | 'sandwich'>('all');
  const [auditTimeFilter, setAuditTimeFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');

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
        cutStatus: r.cutStatus || 'completed',
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
        usedDisplay: s.soLengthMeters ? `${formatMeters(s.soLengthMeters)} ม.` : `${formatMeters(s.weightUsed)} กก.`,
        usedValue: Number(s.soLengthMeters || s.weightUsed) || 0,
        ngDisplay: (s.ngMeters || 0) > 0 ? `${formatMeters(s.ngMeters)} ม.` : ((s.ngKg || 0) > 0 ? `${formatMeters(s.ngKg)} กก.` : '—'),
        ngValue: Number(s.ngMeters || s.ngKg) || 0,
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
  // นับเฉพาะรายการที่ตัดจริง — ตัดใบจอง (reserved) และใบยกเลิก (cancelled) ออก
  const stats = useMemo(() => {
    const foilItems = sortedItems.filter((i) => i.type === 'foil');
    const countableFoilItems = foilItems.filter(isCountableCut);
    const sandwichItems = sortedItems.filter((i) => i.type === 'sandwich');

    const totalFoilUsed = countableFoilItems.reduce((acc, i) => acc + i.usedValue, 0);
    const totalFoilNg = countableFoilItems.reduce((acc, i) => acc + i.ngValue, 0);

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

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    let list = auditLogs;
    if (auditTypeFilter !== 'all') {
      list = list.filter((l) => l.recordType === auditTypeFilter);
    }
    if (auditTimeFilter !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (auditTimeFilter === 'today') {
        list = list.filter((l) => new Date(l.timestamp).getTime() >= startOfToday);
      } else if (auditTimeFilter === '7days') {
        const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
        list = list.filter((l) => new Date(l.timestamp).getTime() >= sevenDaysAgo);
      } else if (auditTimeFilter === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        list = list.filter((l) => new Date(l.timestamp).getTime() >= startOfMonth);
      }
    }
    if (auditSearchQuery.trim()) {
      const q = auditSearchQuery.toLowerCase().trim();
      list = list.filter((l) => {
        const soMatch = (l.soNumber || '').toLowerCase().includes(q);
        const opMatch = (l.operator || '').toLowerCase().includes(q);
        const summaryMatch = (l.summary || '').toLowerCase().includes(q);
        const lotMatch = (l.rollInfo?.lotNumber || '').toLowerCase().includes(q);
        const rollMatch = (l.rollInfo?.rollNumber || '').toLowerCase().includes(q);
        const colorMatch = (l.rollInfo?.coilColor || '').toLowerCase().includes(q);
        const diffMatch = (l.diffs || []).some(
          (d) =>
            (d.label || '').toLowerCase().includes(q) ||
            String(d.oldValue || '').toLowerCase().includes(q) ||
            String(d.newValue || '').toLowerCase().includes(q)
        );
        return soMatch || opMatch || summaryMatch || lotMatch || rollMatch || colorMatch || diffMatch;
      });
    }
    return list;
  }, [auditLogs, auditTypeFilter, auditTimeFilter, auditSearchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Header & Mode Switcher: ตัดสต๊อก vs ตรวจสอบประวัติการแก้ไข SO (Audit Trail) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setHistoryMode('records')}
              className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                historyMode === 'records'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scissors className={`w-4 h-4 ${historyMode === 'records' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>รายการตัดสต๊อก (Cuts)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                historyMode === 'records' ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-800'
              }`}>
                {unifiedItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setHistoryMode('reservations')}
              className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                historyMode === 'reservations'
                  ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarClock className={`w-4 h-4 ${historyMode === 'reservations' ? 'text-amber-950' : 'text-amber-600'}`} />
              <span>คิวจอง SO (รอตัดจริง)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                historyMode === 'reservations' ? 'bg-amber-950 text-amber-200' : 'bg-amber-100 text-amber-950'
              }`}>
                {records.filter((r) => r.cutStatus === 'reserved').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setHistoryMode('audit')}
              className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                historyMode === 'audit'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className={`w-4 h-4 ${historyMode === 'audit' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>ประวัติการแก้ไข SO (Audit Trail)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                historyMode === 'audit' ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-800'
              }`}>
                {auditLogs.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {historyMode === 'audit' && (
              <button
                type="button"
                onClick={() => exportAuditLogsToCSV(filteredAuditLogs)}
                disabled={filteredAuditLogs.length === 0}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title="ส่งออกรายงานประวัติการแก้ไขเป็นไฟล์ CSV/Excel"
              >
                <Download className="w-3.5 h-3.5 text-emerald-100" />
                <span>ส่งออกรายงาน Audit</span>
              </button>
            )}
            {onNavigateToAuditHub && (
              <button
                type="button"
                onClick={onNavigateToAuditHub}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                title="เปิดศูนย์ตรวจ SO แบบเต็มจอ"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>ศูนย์ตรวจ SO เต็มจอ</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Tab Selector & Normal Records Table */}
      {historyMode === 'records' && (
      <div className="space-y-4">
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
                  <th className="px-2.5 py-2 text-center text-xs font-bold text-slate-600 bg-slate-50/95">
                    สถานะ
                  </th>
                  {renderSortTh('type', 'ประเภท', 'center')}
                  {renderSortTh('details', 'ล็อต / เบอร์ / กว้าง')}
                  {renderSortTh('pattern', 'ท้อง')}
                  {renderSortTh('used', 'ปริมาณที่ใช้', 'right')}
                  {renderSortTh('ng', 'NG ที่เสีย', 'right')}
                  {renderSortTh('remaining', 'ก่อน / หลังตัด', 'right')}
                  {renderSortTh('recorder', 'ผู้บันทึก & หมายเหตุ')}
                  <th className="px-2.5 py-2 text-center text-xs font-bold text-slate-600 w-36 bg-slate-50/95">
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

                      {/* 1.5 สถานะ (Status Badge: ตัดจริง 🟢 / รอตัด 🟡 / ยกเลิก ⚪) */}
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        {item.cutStatus === 'reserved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>รอตัด</span>
                          </span>
                        ) : item.cutStatus === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            <Ban className="w-3 h-3 text-rose-500" />
                            <span>ยกเลิก</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>ตัดจริง</span>
                          </span>
                        )}
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

                      {/* 4. ท้อง (ลาย) - กรอบชื่อลาย พร้อมจุดและป้ายตัวเลือก ท้องเงิน / ท้องขาว คมชัด มีขอบ */}
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        {isFoil && item.rawFoil ? (
                          <div className="inline-flex items-center gap-1.5">
                            {/* กรอบท้องคลุมชื่อลาย */}
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

                            {/* จุดและป้ายตัวเลือก: ท้องเงิน (สีเงินเมทัลลิก คมชัด มีขอบ) */}
                            {item.isSilverSide && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-slate-200 via-zinc-100 to-slate-200 text-slate-900 border border-slate-400 text-[11px] font-black shadow-2xs"
                                title="ตัวเลือกพิเศษ: ท้องเงิน"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-slate-400 via-white to-slate-600 ring-1 ring-slate-500 shadow-xs shrink-0"
                                  aria-hidden="true"
                                />
                                <span>เงิน</span>
                              </span>
                            )}

                            {/* จุดและป้ายตัวเลือก: ท้องขาว (สีขาว คมชัด ขอบเข้มตัดพื้นชัดเจน) */}
                            {item.isWhiteSide && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white text-slate-950 border-2 border-slate-400 text-[11px] font-black shadow-2xs"
                                title="ตัวเลือกพิเศษ: ท้องขาว"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full bg-white ring-1.5 ring-slate-700 shadow-xs shrink-0"
                                  aria-hidden="true"
                                />
                                <span>ขาว</span>
                              </span>
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
                            {/* ปุ่มสำหรับรายการจองรอตัด: ยืนยันผลิตจริง / เปลี่ยนฟอยล์ / ยกเลิกผลิต */}
                            {isFoil && item.rawFoil && item.cutStatus === 'reserved' && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleActionGuarded(async () => {
                                    if (onConfirmProduction) {
                                      await onConfirmProduction(item.rawFoil!.id, item.rawFoil!.soNumber);
                                    }
                                  });
                                }}
                                title="กดยืนยันว่าผลิตจริงแล้ว (หักสต๊อกม้วนฟอยล์)"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">ยืนยันผลิต</span>
                              </button>
                            )}

                            {isFoil && item.rawFoil && item.cutStatus === 'reserved' && onReallocateRoll && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleActionGuarded(() => onReallocateRoll(item.rawFoil!));
                                }}
                                title="เปลี่ยนม้วนฟอยล์ที่ผูกไว้กับ SO นี้"
                                className="p-1.5 rounded-lg text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer border border-amber-300"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                              </button>
                            )}

                            {isFoil && item.rawFoil && item.cutStatus === 'reserved' && onCancelProduction && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleActionGuarded(() => onCancelProduction(item.rawFoil!));
                                }}
                                title="ยกเลิกการผลิตและคืนยอดจอง"
                                className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-300"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

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
      </div>
      )}

      {/* SO Audit Trail & Diff Mode (ตรวจสอบประวัติการแก้ไข SO) */}
      {historyMode === 'audit' && (
        <div className="space-y-4">
          {/* Audit Controls & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
            {/* Search & Date Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  placeholder="ค้นหาตามรหัส SO, ผู้แก้ไข, ล็อต, เบอร์ม้วน, คอยล์, ค่าที่เปลี่ยน..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/60 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                />
                {auditSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAuditSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Material Type Pills */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAuditTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    auditTypeFilter === 'all'
                      ? 'bg-white text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด ({auditLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTypeFilter('foil')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    auditTypeFilter === 'foil'
                      ? 'bg-amber-400 text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ฟอยล์ ({auditLogs.filter((l) => l.recordType === 'foil').length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTypeFilter('sandwich')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    auditTypeFilter === 'sandwich'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  แซนวิช ({auditLogs.filter((l) => l.recordType === 'sandwich').length})
                </button>
              </div>

              {/* Time Range Pills */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAuditTimeFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    auditTimeFilter === 'all' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  ทุกช่วงเวลา
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTimeFilter('today')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    auditTimeFilter === 'today' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  วันนี้
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTimeFilter('7days')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    auditTimeFilter === '7days' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  7 วันล่าสุด
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTimeFilter('month')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    auditTimeFilter === 'month' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  เดือนนี้
                </button>
              </div>
            </div>

            {/* Explanation & Info Banner */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>ระบบ SO Audit Trail & Diff:</strong> บันทึกประวัติเปรียบเทียบค่าเดิม vs ค่าใหม่ ทุกครั้งที่มีการแก้ไขรายการตัด SO (ไม่บันทึกประวัติการลบตามคำสั่ง)
                </span>
              </div>
              <span className="font-mono text-[11px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md self-start sm:self-auto font-bold">
                แสดงผล {filteredAuditLogs.length} รายการ
              </span>
            </div>
          </div>

          {/* Audit Logs Cards List */}
          {filteredAuditLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <History className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {auditSearchQuery || auditTypeFilter !== 'all' || auditTimeFilter !== 'all'
                  ? 'ไม่พบประวัติการแก้ไขที่ตรงกับเงื่อนไขการค้นหา'
                  : 'ยังไม่มีประวัติการแก้ไขรายการตัด SO'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                เมื่อมีเจ้าหน้าที่กดปุ่มแก้ไขรายการตัด SO ในระบบ ข้อมูลการเปลี่ยนแปลงค่าก่อนหน้า vs ค่าใหม่ (Change Diff) พร้อมชื่อผู้แก้ไขและวันเวลาจะถูกบันทึกและแสดงที่นี่โดยอัตโนมัติ
              </p>
              {(auditSearchQuery || auditTypeFilter !== 'all' || auditTimeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setAuditSearchQuery('');
                    setAuditTypeFilter('all');
                    setAuditTimeFilter('all');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAuditLogs.map((log) => {
                const isFoil = log.recordType === 'foil';
                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all p-4 sm:p-5 space-y-3"
                  >
                    {/* Log Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Action Badge */}
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1">
                          <Pencil className="w-3 h-3 text-amber-700" />
                          <span>แก้ไขข้อมูล</span>
                        </span>

                        {/* Material Type Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isFoil
                              ? 'bg-slate-100 text-slate-800 border border-slate-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isFoil ? 'ตัดฟอยล์' : 'PU แซนวิช'}
                        </span>

                        {/* SO Number Badge */}
                        <span className="font-mono font-bold text-xs bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded-md">
                          SO: {log.soNumber}
                        </span>
                      </div>

                      {/* Operator & Timestamp */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.operator || '-'}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatThaiDateTime(log.timestamp)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Roll / Coil Context */}
                    {log.rollInfo && (
                      <div className="text-xs text-slate-600 bg-slate-50/90 rounded-xl px-3 py-2 border border-slate-200/70 flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-700">
                          {isFoil ? '📦 ข้อมูลม้วนฟอยล์:' : '🥪 ข้อมูลคอยล์แซนวิช:'}
                        </span>
                        {isFoil ? (
                          <>
                            <span>ล็อต: <strong className="font-mono">{log.rollInfo.lotNumber || '-'}</strong></span>
                            <span>•</span>
                            <span>เบอร์: <strong className="font-mono">#{log.rollInfo.rollNumber || '-'}</strong></span>
                            {log.rollInfo.width && (
                              <>
                                <span>•</span>
                                <span>หน้ากว้าง: <strong className="font-mono">{log.rollInfo.width} มม.</strong></span>
                              </>
                            )}
                            {log.rollInfo.pattern && (
                              <>
                                <span>•</span>
                                <span>ลาย: <strong>{log.rollInfo.pattern}</strong></span>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <span>สีคอยล์: <strong className="font-mono">{log.rollInfo.coilColor || '-'}</strong></span>
                            <span>•</span>
                            <span>เบอร์คอยล์: <strong className="font-mono">#{log.rollInfo.coilNumber || '-'}</strong></span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Diff Items Grid */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        รายการที่เปลี่ยนแปลง ({log.diffs.length} ฟิลด์):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {log.diffs.map((diff, dIdx) => (
                          <div
                            key={dIdx}
                            className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between gap-1.5"
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                              <span>{diff.label}</span>
                              {diff.delta !== undefined && (
                                <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  diff.delta > 0
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : 'bg-rose-100 text-rose-900'
                                }`}>
                                  {diff.delta > 0 ? `+${diff.delta}` : diff.delta} {diff.unit || ''}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="line-through text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-mono truncate max-w-[45%]" title={String(diff.oldValue)}>
                                {String(diff.oldValue ?? '-')} {diff.unit || ''}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono truncate max-w-[45%]" title={String(diff.newValue)}>
                                {String(diff.newValue ?? '-')} {diff.unit || ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary row */}
                    {log.summary && (
                      <div className="text-xs text-slate-500 italic bg-slate-50/50 rounded-lg px-2.5 py-1.5 border border-slate-100 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">สรุป: {log.summary}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sub-menu View: คิวจอง SO (รอตัดจริง) */}
      {historyMode === 'reservations' && (
        <div className="space-y-4">
          <SOReservationHubView
            rolls={rolls}
            records={records}
            onOpenCutModal={onOpenCutModal}
            onConfirmProduction={onConfirmProduction || (async () => {})}
            onOpenReallocateModal={onReallocateRoll || (() => {})}
            onOpenCancelModal={onCancelProduction || (() => {})}
            onViewSODetail={(rec) => setSelectedDetailRecord(rec)}
          />
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
          auditLogs={auditLogs}
          onVerifyRecord={onVerifyRecord}
          onConfirmProduction={onConfirmProduction}
          onReallocateRoll={onReallocateRoll}
          onCancelProduction={onCancelProduction}
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
                  {selectedSandwichDetail.ngMeters != null && Number(selectedSandwichDetail.ngMeters) > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                      <div className="text-[10px] font-bold text-rose-600">NG (ม.)</div>
                      <div className="font-mono font-bold text-rose-800 mt-0.5">
                        {formatMeters(selectedSandwichDetail.ngMeters)} ม.
                      </div>
                    </div>
                  )}
                  {selectedSandwichDetail.ngKg != null && Number(selectedSandwichDetail.ngKg) > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                      <div className="text-[10px] font-bold text-rose-600">NG (กก.)</div>
                      <div className="font-mono font-bold text-rose-800 mt-0.5">
                        {formatMeters(selectedSandwichDetail.ngKg)} กก.
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
