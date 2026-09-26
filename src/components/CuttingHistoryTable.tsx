import React, { useState, useMemo } from 'react';
import { StockCutRecord, WIDTH_SPECIFICATIONS } from '../types';
import { 
  Search, 
  Download, 
  Trash2, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  X, 
  Tag, 
  Folder, 
  FolderOpen, 
  Lock,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check
} from 'lucide-react';
import { exportCutRecordsToCSV } from '../utils/storage';
import { formatMeters, compareLotAndRoll } from '../utils/formatters';
import { UserMode } from '../utils/auth';
import { groupCutsByDate, exportCutsDateCSV } from '../utils/dateGrouping';
import { getPatternStyle } from '../utils/patternStyles';
import { findHiddenExactDuplicates } from '../utils/soHistoryAudit';

type SortField = 'date' | 'so' | 'lot_roll' | 'width' | 'pattern' | 'used' | 'ng' | 'total' | 'remaining' | 'recorder';
type SortDirection = 'asc' | 'desc';

interface CuttingHistoryTableProps {
  records: StockCutRecord[];
  onDeleteRecord: (recordId: string) => void;
  onOpenCutModal: () => void;
  userMode?: UserMode;
  onRequestUnlock?: () => void;
}

export const CuttingHistoryTable: React.FC<CuttingHistoryTableProps> = ({
  records,
  onDeleteRecord,
  onOpenCutModal,
  userMode = 'visitor',
  onRequestUnlock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'so' | 'employee' | 'lot_roll'>('all');
  const [selectedSo, setSelectedSo] = useState('all');
  const [selectedLot, setSelectedLot] = useState('all');
  const [selectedWidth, setSelectedWidth] = useState('all');
  const [selectedPattern, setSelectedPattern] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'flat' | 'date_folder'>('flat');
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  // Sort state: default to 'date' desc (ปัจจุบันไปหาอดีต)
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);
  const [copiedBatch, setCopiedBatch] = useState<boolean>(false);

  // Copy single record for LINE
  const handleCopySingleRecord = (item: StockCutRecord) => {
    const sideText = item.isSilverSide ? ' [ท้องเงิน]' : item.isWhiteSide ? ' [ท้องขาว]' : '';
    const dateText = item.usageDate || item.recordedDate || (item.createdAt ? item.createdAt.slice(0, 10) : '');
    const text = [
      `📋 รายละเอียดตัดฟอยล์ SO: ${item.soNumber}`,
      `📅 วันที่ตัด: ${dateText}`,
      `🏷️ ม้วน: ล็อต ${item.lotNumber} | เบอร์ #${item.rollNumber}`,
      `📐 หน้ากว้าง: ${item.width} มม.`,
      `🎨 ลายฟอยล์: ${item.pattern}${sideText}`,
      `✂️ ยอดตัดใช้งาน: ${formatMeters(item.usedMeters)} ม.` + (item.ngMeters > 0 ? ` (NG เสีย: ${formatMeters(item.ngMeters)} ม.)` : ''),
      `📉 รวมตัดออกสุทธิ: ${formatMeters(item.totalDeducted)} ม.`,
      `📊 คงเหลือในม้วน: ${formatMeters(item.remainingAfter)} ม.`,
      `👤 ผู้บันทึก: ${item.recordedBy || '-'}`,
      item.notes ? `📝 หมายเหตุ: ${item.notes}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedRecordId(item.id);
      setTimeout(() => setCopiedRecordId(null), 2500);
    });
  };

  // Copy batch of records
  const handleCopyBatchSummary = (itemsToCopy: StockCutRecord[]) => {
    if (itemsToCopy.length === 0) return;
    const totalUsed = itemsToCopy.reduce((sum, r) => sum + r.usedMeters, 0);
    const totalNg = itemsToCopy.reduce((sum, r) => sum + r.ngMeters, 0);
    const totalDeducted = totalUsed + totalNg;

    const lines: string[] = [
      `📋 สรุปรายการตัดสต๊อกฟอยล์ (${itemsToCopy.length} รายการ)`,
      `─────────────────────────`,
    ];

    itemsToCopy.slice(0, 50).forEach((item, idx) => {
      const sideText = item.isSilverSide ? ' [เงิน]' : item.isWhiteSide ? ' [ขาว]' : '';
      lines.push(
        `${idx + 1}. SO: ${item.soNumber} | #${item.rollNumber} (${item.lotNumber})` +
        `\n   ${item.pattern}${sideText} | หน้า ${item.width} มม.` +
        `\n   ตัดใช้: ${formatMeters(item.usedMeters)} ม.` +
        (item.ngMeters > 0 ? ` (NG: ${formatMeters(item.ngMeters)} ม.)` : '') +
        ` | เหลือ: ${formatMeters(item.remainingAfter)} ม.`
      );
    });

    if (itemsToCopy.length > 50) {
      lines.push(`... และอีก ${itemsToCopy.length - 50} รายการ`);
    }

    lines.push(`─────────────────────────`);
    lines.push(`✅ รวมตัดใช้งานจริง: ${formatMeters(totalUsed)} ม.`);
    if (totalNg > 0) {
      lines.push(`⚠️ รวมเศษ NG เสีย: ${formatMeters(totalNg)} ม.`);
    }
    lines.push(`📦 รวมตัดออกจากสต๊อกสุทธิ: ${formatMeters(totalDeducted)} ม.`);

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2500);
    });
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Default to desc for dates and numeric amounts; asc for text
      if (field === 'date' || field === 'used' || field === 'ng' || field === 'total' || field === 'remaining') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  // Unique SO numbers and Employee names for quick filter pills & dropdowns
  const { sosList, lotsList, widthsList, employeesList } = useMemo(() => {
    const soMap = new Map<string, number>();
    const lotMap = new Map<string, number>();
    const widthSet = new Set<number>();
    const empSet = new Set<string>();

    records.forEach(r => {
      const so = (r.soNumber || '').trim();
      if (so) soMap.set(so, (soMap.get(so) || 0) + 1);

      const lot = (r.lotNumber || '').trim();
      if (lot) lotMap.set(lot, (lotMap.get(lot) || 0) + 1);

      if (r.width) widthSet.add(r.width);
      if (r.recordedBy) empSet.add(r.recordedBy.trim());
    });

    const sosList = Array.from(soMap.entries())
      .map(([so, count]) => ({ so, count }))
      .sort((a, b) => a.so.localeCompare(b.so, undefined, { numeric: true, sensitivity: 'base' }));

    const lotsList = Array.from(lotMap.entries())
      .map(([lot, count]) => ({ lot, count }))
      .sort((a, b) => a.lot.localeCompare(b.lot, undefined, { numeric: true, sensitivity: 'base' }));

    const widthsList = Array.from(widthSet).sort((a, b) => a - b);
    const employeesList = Array.from(empSet).slice(0, 8);

    return { sosList, lotsList, widthsList, employeesList };
  }, [records]);

  // Date range preset handler
  const handleDatePreset = (preset: 'today' | '7days' | '30days' | 'this_month' | 'clear') => {
    const today = new Date();
    const toYMD = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'today') {
      const s = toYMD(today);
      setStartDate(s);
      setEndDate(s);
      return;
    }

    if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(toYMD(past));
      setEndDate(toYMD(today));
      return;
    }

    if (preset === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(toYMD(past));
      setEndDate(toYMD(today));
      return;
    }

    if (preset === 'this_month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toYMD(first));
      setEndDate(toYMD(today));
      return;
    }
  };

  // Has active filter applied
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedSo !== 'all' ||
    selectedLot !== 'all' ||
    selectedWidth !== 'all' ||
    selectedPattern !== 'all' ||
    startDate ||
    endDate
  );

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSearchScope('all');
    setSelectedSo('all');
    setSelectedLot('all');
    setSelectedWidth('all');
    setSelectedPattern('all');
    setStartDate('');
    setEndDate('');
  };

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // 1. Filter
    const matched = records.filter((r) => {
      // SO dropdown
      if (selectedSo !== 'all' && (r.soNumber || '').trim() !== selectedSo) {
        return false;
      }

      // Lot dropdown
      if (selectedLot !== 'all' && (r.lotNumber || '').trim() !== selectedLot) {
        return false;
      }

      // Width dropdown
      if (selectedWidth !== 'all' && String(r.width) !== selectedWidth) {
        return false;
      }

      // Pattern filter
      if (selectedPattern !== 'all') {
        const pNorm = (r.pattern || '').trim().toLowerCase();
        const selNorm = selectedPattern.trim().toLowerCase();
        if (selNorm === 'ไม้อ่อน' || selNorm === 'ไม้อ้อน') {
          if (!pNorm.includes('ไม้อ่อน') && !pNorm.includes('ไม้อ้อน')) return false;
        } else if (selNorm === 'ขาว' || selNorm === 'ท้องขาว') {
          if (!pNorm.includes('ขาว')) return false;
        } else if (selNorm === 'กลีบบัว' || selNorm === 'เงิน') {
          if (!pNorm.includes('กลีบบัว') && !pNorm.includes('เงิน')) return false;
        } else if (r.pattern !== selectedPattern) {
          return false;
        }
      }

      // Date range filter (usageDate, fallback to recordedDate / createdAt)
      const recordDate = (r.usageDate || r.recordedDate || (r.createdAt ? r.createdAt.slice(0, 10) : '')).trim();
      if (startDate && recordDate && recordDate < startDate) {
        return false;
      }
      if (endDate && recordDate && recordDate > endDate) {
        return false;
      }

      if (!q) return true;

      if (searchScope === 'so') {
        return (
          r.soNumber.toLowerCase().includes(q) ||
          (r.isSilverSide && ('ท้องเงิน'.includes(q) || 'เงิน'.includes(q)))
        );
      }

      if (searchScope === 'employee') {
        return r.recordedBy.toLowerCase().includes(q);
      }

      if (searchScope === 'lot_roll') {
        return (
          r.lotNumber.toLowerCase().includes(q) ||
          r.rollNumber.toLowerCase().includes(q)
        );
      }

      // 'all'
      return (
        r.soNumber.toLowerCase().includes(q) ||
        r.recordedBy.toLowerCase().includes(q) ||
        r.lotNumber.toLowerCase().includes(q) ||
        r.rollNumber.toLowerCase().includes(q) ||
        (r.isSilverSide && ('ท้องเงิน'.includes(q) || 'เงิน'.includes(q))) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    });

    // 2. Sort (default: date desc - ปัจจุบันไปหาอดีต)
    return matched.sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'date': {
          const dateA = a.usageDate || a.recordedDate || a.createdAt || '';
          const dateB = b.usageDate || b.recordedDate || b.createdAt || '';
          diff = dateA.localeCompare(dateB);
          if (diff === 0) {
            // Secondary tie-breaker: createdAt
            const ca = a.createdAt || '';
            const cb = b.createdAt || '';
            diff = ca.localeCompare(cb);
          }
          break;
        }
        case 'so':
          diff = a.soNumber.localeCompare(b.soNumber, undefined, { numeric: true, sensitivity: 'base' });
          break;
        case 'lot_roll':
          diff = compareLotAndRoll(a.lotNumber, a.rollNumber, b.lotNumber, b.rollNumber);
          break;
        case 'width':
          diff = a.width - b.width;
          break;
        case 'pattern':
          diff = a.pattern.localeCompare(b.pattern);
          break;
        case 'used':
          diff = a.usedMeters - b.usedMeters;
          break;
        case 'ng':
          diff = a.ngMeters - b.ngMeters;
          break;
        case 'total':
          diff = a.totalDeducted - b.totalDeducted;
          break;
        case 'remaining':
          diff = a.remainingAfter - b.remainingAfter;
          break;
        case 'recorder':
          diff = a.recordedBy.localeCompare(b.recordedBy);
          break;
        default:
          diff = 0;
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [records, searchQuery, searchScope, selectedSo, selectedLot, selectedWidth, selectedPattern, startDate, endDate, sortField, sortDirection]);

  // Date grouped records
  const dateGroups = useMemo(() => {
    return groupCutsByDate(filteredRecords);
  }, [filteredRecords]);

  // Lookup map for instant date header metrics
  const dateGroupMap = useMemo(() => {
    const map = new Map<string, typeof dateGroups[0]>();
    dateGroups.forEach((g) => {
      map.set(g.date, g);
    });
    return map;
  }, [dateGroups]);

  const totalUsedFiltered = filteredRecords.reduce((sum, r) => sum + r.usedMeters, 0);
  const totalNgFiltered = filteredRecords.reduce((sum, r) => sum + r.ngMeters, 0);

  const toggleDateCollapse = (date: string) => {
    setCollapsedDates(prev => {
      // Default is collapsed (true) unless active filters are present
      const currentCollapsed = hasActiveFilters
        ? prev[date] === true
        : (prev[date] !== undefined ? prev[date] : true);
      return {
        ...prev,
        [date]: !currentCollapsed
      };
    });
  };

  const toggleAllFolders = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    dateGroups.forEach(g => {
      newState[g.date] = !expand; // false = expanded, true = collapsed
    });
    setCollapsedDates(newState);
  };

  const handleActionGuarded = (action: () => void) => {
    if (userMode === 'visitor' && onRequestUnlock) {
      onRequestUnlock();
      return;
    }
    action();
  };

  const renderSortHeader = (field: SortField, label: string, align: 'left' | 'right' | 'center' = 'left') => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleToggleSort(field)}
        className={`px-4 py-3.5 cursor-pointer select-none transition-colors hover:bg-slate-100/90 ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        }`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span className={isActive ? 'text-slate-900 font-bold' : 'text-slate-600'}>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 text-slate-950 font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // สแกนใบงานซ้ำที่ซ่อนในฐานข้อมูล (SO+ม้วน+ยอดเท่ากัน)
  const hiddenDups = useMemo(() => findHiddenExactDuplicates(records), [records]);
  const hiddenDupIdSet = useMemo(() => {
    const s = new Set<string>();
    hiddenDups.forEach((g) => g.recordIds.forEach((id) => s.add(id)));
    return s;
  }, [hiddenDups]);

  return (
    <div className="space-y-3">
      {/* แจ้งใบงานซ้ำที่ซ่อนอยู่ */}
      {hiddenDups.length > 0 && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-950 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            พบใบงานซ้ำ {hiddenDups.length} กลุ่ม (หักสต๊อกเบิ้ล)
          </div>
          <ul className="space-y-1 max-h-28 overflow-y-auto">
            {hiddenDups.slice(0, 8).map((g) => (
              <li key={g.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <button
                  type="button"
                  className="font-mono font-bold text-amber-900 underline cursor-pointer"
                  onClick={() => {
                    setSearchQuery(g.soNumber);
                    setSearchScope('so');
                    setSelectedSo(g.soNumber);
                  }}
                >
                  {g.soNumber}
                </button>
                <span className="text-slate-600">
                  ล็อต {g.lotNumber} #{g.rollNumber} · {g.pattern}
                </span>
                <span className="font-mono">
                  {formatMeters(g.usedMeters)}+NG{formatMeters(g.ngMeters)} ม. ×{g.count}
                </span>
                <span className="text-rose-700 font-semibold">
                  ควรลบ {g.count - 1} ใบ
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-rose-800/80">
            กดรหัส SO เพื่อกรอง · ลบรายการซ้ำในตาราง (โหมด Editor) เพื่อคืนยอด
          </p>
        </div>
      )}

      {/* แถบค้น/กรอง กระชับ — มือถือไม่เกิน ~3/8 จอ */}
      <div className="bg-white px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl border border-slate-200 shadow-sm space-y-1.5 max-h-[38vh] sm:max-h-none overflow-y-auto">
        {/* แถว 1: ค้นหา + scope + export */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="history-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchQuery('');
              }}
              placeholder={
                searchScope === 'so'
                  ? 'SO...'
                  : searchScope === 'employee'
                  ? 'ชื่อพนักงาน...'
                  : searchScope === 'lot_roll'
                  ? 'ล็อต / เบอร์...'
                  : 'ค้นหา...'
              }
              className="w-full pl-7 pr-7 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] shrink-0">
            {(
              [
                ['all', 'ทั้งหมด'],
                ['so', 'SO'],
                ['employee', 'พนักงาน'],
                ['lot_roll', 'ล็อต'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSearchScope(key)}
                className={`px-1.5 py-1 rounded-md font-semibold cursor-pointer ${
                  searchScope === key
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleCopyBatchSummary(filteredRecords)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 cursor-pointer"
            title="คัดลอก"
          >
            {copiedBatch ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => exportCutRecordsToCSV(filteredRecords)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 cursor-pointer"
            title="CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 shrink-0">
            {filteredRecords.length}/{records.length}
          </span>
        </div>

        {/* แถว 2: dropdown กระชับ ไม่มี label ยาว */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <select
            value={selectedSo}
            onChange={(e) => setSelectedSo(e.target.value)}
            className={`px-1.5 py-1 rounded-lg border text-[11px] font-mono cursor-pointer ${
              selectedSo !== 'all' ? 'bg-amber-50 border-amber-400 font-bold' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <option value="all">SO ทั้งหมด</option>
            {sosList.map(({ so, count }) => (
              <option key={so} value={so}>
                {so} ({count})
              </option>
            ))}
          </select>
          <select
            value={selectedLot}
            onChange={(e) => setSelectedLot(e.target.value)}
            className={`px-1.5 py-1 rounded-lg border text-[11px] font-mono cursor-pointer ${
              selectedLot !== 'all' ? 'bg-amber-50 border-amber-400 font-bold' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <option value="all">ล็อตทั้งหมด</option>
            {lotsList.map(({ lot, count }) => (
              <option key={lot} value={lot}>
                {lot} ({count})
              </option>
            ))}
          </select>
          <select
            value={selectedWidth}
            onChange={(e) => setSelectedWidth(e.target.value)}
            className={`px-1.5 py-1 rounded-lg border text-[11px] font-mono cursor-pointer ${
              selectedWidth !== 'all' ? 'bg-amber-50 border-amber-400 font-bold' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <option value="all">หน้ากว้าง</option>
            {widthsList.map((w) => (
              <option key={w} value={String(w)}>
                {w} มม.
              </option>
            ))}
          </select>
          <select
            value={selectedPattern}
            onChange={(e) => setSelectedPattern(e.target.value)}
            className={`px-1.5 py-1 rounded-lg border text-[11px] cursor-pointer ${
              selectedPattern !== 'all' ? 'bg-amber-50 border-amber-400 font-bold' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <option value="all">ลายทั้งหมด</option>
            <option value="ขาว">ขาว</option>
            <option value="ดำ">ดำ</option>
            <option value="ไม้อ่อน">ไม้อ่อน</option>
            <option value="ไม้เข้ม">ไม้เข้ม</option>
            <option value="เทา">เทา</option>
            <option value="กลีบบัว">กลีบบัว</option>
          </select>
        </div>

        {/* แถว 3: วันที่ + preset + ล้าง */}
        <div className="flex flex-wrap items-center gap-1">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-1.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg font-mono cursor-pointer"
          />
          <span className="text-[10px] text-slate-400">–</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-1.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg font-mono cursor-pointer"
          />
          {(['today', '7days', '30days', 'this_month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleDatePreset(p)}
              className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700 cursor-pointer"
            >
              {p === 'today' ? 'วันนี้' : p === '7days' ? '7วัน' : p === '30days' ? '30วัน' : 'เดือนนี้'}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200 cursor-pointer"
            >
              ล้าง
            </button>
          )}
          {employeesList.slice(0, 4).map((emp) => (
            <button
              key={emp}
              type="button"
              onClick={() => {
                if (searchQuery === emp && searchScope === 'employee') {
                  setSearchQuery('');
                  setSearchScope('all');
                } else {
                  setSearchQuery(emp);
                  setSearchScope('employee');
                }
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer ${
                searchQuery === emp && searchScope === 'employee'
                  ? 'bg-blue-100 border-blue-300 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {emp}
            </button>
          ))}
        </div>

        {/* แถว 4: โหมดตาราง */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode('flat')}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                viewMode === 'flat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              ตาราง ({filteredRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('date_folder')}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                viewMode === 'date_folder' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              โฟลเดอร์ ({dateGroups.length})
            </button>
          </div>

            {viewMode === 'date_folder' && (
              <>
                <button
                  type="button"
                  onClick={() => toggleAllFolders(true)}
                  className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] cursor-pointer"
                >
                  เปิดทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllFolders(false)}
                  className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] cursor-pointer"
                >
                  ปิดทั้งหมด
                </button>
              </>
            )}
          <span className="text-[10px] font-mono text-slate-500 ml-auto">
            ใช้ {formatMeters(totalUsedFiltered)} · NG {formatMeters(totalNgFiltered)} · รวม{' '}
            {formatMeters(totalUsedFiltered + totalNgFiltered)} ม.
          </span>
        </div>
      </div>

      {/* Main Content: Flat Table or Date Folders */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">ไม่พบประวัติการตัดสต๊อกตามที่ค้นหา</p>
          <p className="text-xs text-slate-400">
            คำค้น "{searchQuery}" ไม่ตรงกับรหัส SO, ชื่อพนักงาน หรือเลขล็อตใดๆ
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
            >
              ล้างคำค้นหาทั้งหมด
            </button>
          )}
        </div>
      ) : viewMode === 'flat' ? (
        /* Flat Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200 font-semibold">
                <tr>
                  {renderSortHeader('date', 'วันที่ใช้งาน')}
                  {renderSortHeader('so', 'รหัสคำสั่งซื้อ SO')}
                  {renderSortHeader('lot_roll', 'ล็อต')}
                  {renderSortHeader('width', 'หน้ากว้าง')}
                  {renderSortHeader('pattern', 'ท้องฟอยล์')}
                  {renderSortHeader('used', 'เมตรที่ใช้', 'right')}
                  {renderSortHeader('ng', 'NG ที่เสีย', 'right')}
                  {renderSortHeader('total', 'รวมตัดออก', 'right')}
                  {renderSortHeader('remaining', 'คงเหลือหลังตัด', 'right')}
                  {renderSortHeader('recorder', 'ผู้บันทึก')}
                  <th className="px-4 py-3.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item, index) => {
                  const patternStyle = getPatternStyle(item.pattern);
                  const currentDateKey = (item.usageDate || item.recordedDate || '').slice(0, 10) || 'ไม่ระบุวันที่';
                  const prevDateKey = index > 0 
                    ? ((filteredRecords[index - 1].usageDate || filteredRecords[index - 1].recordedDate || '').slice(0, 10) || 'ไม่ระบุวันที่') 
                    : null;
                  const isNewDate = currentDateKey !== prevDateKey;
                  const dayGroup = dateGroupMap.get(currentDateKey);

                  return (
                    <React.Fragment key={item.id}>
                      {/* hiddenDup highlight applied on row below */}
                      {isNewDate && (
                        <tr className="bg-gradient-to-r from-amber-100/90 via-amber-50 to-slate-50 border-y-2 border-amber-300 select-none">
                          <td colSpan={11} className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                                  <Calendar className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-950 text-sm sm:text-base">
                                      {dayGroup?.displayDate || currentDateKey}
                                    </span>
                                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-200/90 text-amber-950 border border-amber-400 shadow-2xs">
                                      {dayGroup ? `${dayGroup.records.length} รายการตัด (${dayGroup.soCount} ใบงาน SO)` : ''}
                                    </span>
                                  </div>
                                  {dayGroup && dayGroup.uniqueSoList.length > 0 && (
                                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                      รหัส SO: {dayGroup.uniqueSoList.slice(0, 8).join(', ')}{dayGroup.uniqueSoList.length > 8 ? '...' : ''}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 text-xs font-mono">
                                <div className="text-right">
                                  <span className="text-slate-500 text-[10px] block font-sans">ผลิตลงแผ่น</span>
                                  <span className="text-slate-950 font-bold text-sm">
                                    {formatMeters(dayGroup?.totalUsedMeters || 0)} ม.
                                  </span>
                                </div>

                                {(dayGroup?.totalNgMeters || 0) > 0 && (
                                  <div className="text-right">
                                    <span className="text-rose-500 text-[10px] block font-sans">NG เสีย</span>
                                    <span className="text-rose-600 font-bold text-sm">
                                      {formatMeters(dayGroup?.totalNgMeters || 0)} ม.
                                    </span>
                                  </div>
                                )}

                                <div className="text-right">
                                  <span className="text-amber-800 text-[10px] block font-sans">รวมตัดออก</span>
                                  <span className="text-amber-950 font-bold text-sm">
                                    {formatMeters((dayGroup?.totalUsedMeters || 0) + (dayGroup?.totalNgMeters || 0))} ม.
                                  </span>
                                </div>

                                {dayGroup && (
                                  <div className="flex items-center gap-1.5 ml-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyBatchSummary(dayGroup.records)}
                                      title="คัดลอกสรุปรายการของวันนี้เพื่อส่ง LINE"
                                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 font-sans font-semibold text-xs flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-amber-700" />
                                      <span className="hidden sm:inline">คัดลอกวันนี้</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => exportCutsDateCSV(dayGroup.date, dayGroup.records)}
                                      title="ดาวน์โหลด CSV เฉพาะวันนี้"
                                      className="px-2 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5 text-slate-500" />
                                      <span className="hidden md:inline">CSV</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      <tr
                        className={`transition-colors ${
                          hiddenDupIdSet.has(item.id)
                            ? 'bg-rose-50/90 hover:bg-rose-100/80 ring-1 ring-inset ring-rose-200'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                      {/* Usage & Record Date */}
                      <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                        <div className="font-mono text-slate-900 font-bold">{item.usageDate || '-'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">บันทึก: {item.recordedDate || '-'}</div>
                      </td>

                      {/* SO Number with prominent styling */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="font-mono font-black text-amber-900 text-sm bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block shadow-2xs">
                            {highlightMatch(item.soNumber, searchQuery)}
                          </div>
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-slate-500 mt-1 truncate max-w-[200px]" title={item.notes}>
                            {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Lot & Roll - Enhanced Prominence */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-xs font-mono border border-amber-500 shadow-2xs">
                              #{highlightMatch(item.rollNumber, searchQuery)}
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="text-slate-400 mr-1">ล็อต:</span>
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {highlightMatch(item.lotNumber, searchQuery)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Width (หน้ากว้าง) - Clear & Distinct */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2.5 py-1 rounded-md border border-slate-300 inline-block shadow-2xs w-fit">
                            หน้า {item.width} มม.
                          </span>
                          {WIDTH_SPECIFICATIONS[item.width] && (
                            <span className="text-[11px] text-slate-500 font-mono mt-0.5 whitespace-nowrap">
                              {WIDTH_SPECIFICATIONS[item.width]}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Pattern (ท้องฟอยล์) - Clear Color Swatch & Explicit Badge */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${patternStyle.dotClass}`} />
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${patternStyle.badgeClass}`}>
                              {patternStyle.name}
                            </span>
                          </div>
                          {item.isSilverSide && (
                            <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-md bg-gradient-to-r from-slate-100 to-zinc-200 text-slate-800 text-[11px] font-bold border border-slate-300 shadow-2xs">
                              เงิน
                            </span>
                          )}
                          {item.isWhiteSide && (
                            <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-md bg-white text-slate-800 text-[11px] font-bold border border-slate-300 shadow-2xs">
                              ขาว
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Used Meters */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatMeters(item.usedMeters)}{' '}
                        <span className="text-[11px] font-normal text-slate-400">ม.</span>
                      </td>

                      {/* NG Meters */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-rose-600">
                        {item.ngMeters > 0 ? (
                          <>
                            {formatMeters(item.ngMeters)}{' '}
                            <span className="text-[11px] font-normal text-slate-400">ม.</span>
                          </>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Total Deducted */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-amber-800">
                        -{formatMeters(item.totalDeducted)}{' '}
                        <span className="text-[11px] font-normal text-slate-400">ม.</span>
                      </td>

                      {/* Remaining After */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-emerald-700">
                        {formatMeters(item.remainingAfter)}{' '}
                        <span className="text-[11px] font-normal text-slate-400">ม.</span>
                      </td>

                      {/* Recorded By with Highlight */}
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <div className="flex items-center gap-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {highlightMatch(item.recordedBy, searchQuery)}
                          </span>
                        </div>
                      </td>

                      {/* Actions: Copy Details for LINE & Delete/Void */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopySingleRecord(item)}
                            title={
                              copiedRecordId === item.id
                                ? 'คัดลอกลงคลิปบอร์ดแล้ว!'
                                : 'คัดลอกรายละเอียดงาน SO นี้เพื่อนำไปวางใน LINE'
                            }
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              copiedRecordId === item.id
                                ? 'text-emerald-600 bg-emerald-50'
                                : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                          >
                            {copiedRecordId === item.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleActionGuarded(() => {
                                if (
                                  confirm(
                                    `ต้องการยกเลิกรายการตัดสต๊อก ${item.soNumber} หรือไม่?\n(ระบบจะคืนยอด ${item.totalDeducted.toLocaleString()} เมตร กลับเข้าม้วน ${item.lotNumber} เบอร์ ${item.rollNumber} อัตโนมัติ)`
                                  )
                                ) {
                                  onDeleteRecord(item.id);
                                }
                              });
                            }}
                            title={
                              userMode === 'visitor'
                                ? 'ต้องปลดล็อคโหมดคีย์ข้อมูลก่อนยกเลิกรายการ'
                                : 'ยกเลิกรายการนี้และคืนยอดกลับม้วนฟอยล์'
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            {userMode === 'visitor' ? (
                              <Lock className="w-3.5 h-3.5 text-slate-300" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Summary */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 gap-2 font-mono">
            <div>
              รวมประวัติการตัด: <span className="font-bold text-slate-900">{filteredRecords.length}</span> รายการ
            </div>
            <div className="flex items-center gap-4">
              <div>
                ผลิตลงแผ่นรวม:{' '}
                <span className="font-bold text-slate-900 text-sm">
                  {totalUsedFiltered.toLocaleString()}
                </span>{' '}
                ม.
              </div>
              <div>
                NG เสียรวม:{' '}
                <span className="font-bold text-rose-600 text-sm">
                  {totalNgFiltered.toLocaleString()}
                </span>{' '}
                ม.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Date Folder Grouped View */
        <div className="space-y-3">
          {dateGroups.map((group) => {
            const isCollapsed = hasActiveFilters
              ? collapsedDates[group.date] === true
              : (collapsedDates[group.date] !== undefined ? collapsedDates[group.date] : true);
            return (
              <div
                key={group.date}
                className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-amber-500 shadow-xs overflow-hidden transition-all"
              >
                {/* Folder Header */}
                <div
                  onClick={() => toggleDateCollapse(group.date)}
                  className="px-5 py-4 bg-gradient-to-r from-amber-50/60 via-slate-50/80 to-white hover:bg-amber-50/80 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-amber-700 shrink-0" />
                    )}
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-950 text-base sm:text-lg">
                          {group.displayDate}
                        </span>
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 border border-amber-400 shadow-2xs">
                          {group.records.length} รายการตัด
                        </span>
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {group.soCount} ใบงาน SO
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        <span className="font-mono">รหัส SO: {group.uniqueSoList.slice(0, 6).join(', ')}{group.uniqueSoList.length > 6 ? '...' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Folder Summary & Export Button */}
                  <div className="flex items-center gap-4 self-end sm:self-auto font-mono text-xs">
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">ตัดใช้</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatMeters(group.totalUsedMeters)} ม.
                      </span>
                    </div>
                    {group.totalNgMeters > 0 && (
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">NG</span>
                        <span className="font-bold text-rose-600 text-sm">
                          {formatMeters(group.totalNgMeters)} ม.
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyBatchSummary(group.records);
                      }}
                      title="คัดลอกรายการตัดของวันนี้เพื่อส่ง LINE"
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 text-slate-700 flex items-center gap-1 font-sans text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden md:inline">คัดลอกวันนี้</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportCutsDateCSV(group.date, group.records);
                      }}
                      title="ดาวน์โหลด CSV สำหรับวันนี้"
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1 font-sans text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden md:inline">CSV วันนี้</span>
                    </button>
                  </div>
                </div>

                {/* Folder Content Table */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/50 text-slate-400 text-[11px] uppercase border-b border-slate-100 font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">รหัส SO</th>
                          <th className="px-4 py-2.5">ล็อต & เบอร์ม้วน</th>
                          <th className="px-4 py-2.5">หน้ากว้าง</th>
                          <th className="px-4 py-2.5">ท้องฟอยล์</th>
                          <th className="px-4 py-2.5 text-right">เมตรที่ใช้</th>
                          <th className="px-4 py-2.5 text-right">NG</th>
                          <th className="px-4 py-2.5 text-right">รวมตัดออก</th>
                          <th className="px-4 py-2.5">ผู้บันทึก</th>
                          <th className="px-4 py-2.5 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.records.map((item) => {
                          const patternStyle = getPatternStyle(item.pattern);
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                hiddenDupIdSet.has(item.id)
                                  ? 'bg-rose-50/90 hover:bg-rose-100/80 ring-1 ring-inset ring-rose-200'
                                  : 'hover:bg-slate-50/70'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="font-mono font-bold text-amber-900 text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    {highlightMatch(item.soNumber, searchQuery)}
                                  </span>
                                  {hiddenDupIdSet.has(item.id) && (
                                    <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 rounded">
                                      ซ้ำ
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black font-mono text-[11px]">
                                    #{highlightMatch(item.rollNumber, searchQuery)}
                                  </span>
                                  <span className="font-mono text-slate-700">
                                    {highlightMatch(item.lotNumber, searchQuery)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                                  หน้า {item.width} มม.
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-3 h-3 rounded-full shrink-0 ${patternStyle.dotClass}`} />
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${patternStyle.badgeClass}`}>
                                      {patternStyle.name}
                                    </span>
                                  </div>
                                  {item.isSilverSide && (
                                    <span className="inline-flex items-center w-fit px-1.5 py-0.2 rounded bg-gradient-to-r from-slate-100 to-zinc-200 text-slate-800 text-[10px] font-bold border border-slate-300">
                                      เงิน
                                    </span>
                                  )}
                                  {item.isWhiteSide && (
                                    <span className="inline-flex items-center w-fit px-1.5 py-0.2 rounded bg-white text-slate-800 text-[10px] font-bold border border-slate-300">
                                      ขาว
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-xs">
                                {formatMeters(item.usedMeters)} ม.
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-rose-600">
                                {item.ngMeters > 0 ? `${formatMeters(item.ngMeters)} ม.` : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-amber-800 text-xs">
                                -{formatMeters(item.totalDeducted)} ม.
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-700">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{highlightMatch(item.recordedBy, searchQuery)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleCopySingleRecord(item)}
                                    title={
                                      copiedRecordId === item.id
                                        ? 'คัดลอกลงคลิปบอร์ดแล้ว!'
                                        : 'คัดลอกรายละเอียดงาน SO นี้เพื่อนำไปวางใน LINE'
                                    }
                                    className={`p-1 rounded transition-colors cursor-pointer ${
                                      copiedRecordId === item.id
                                        ? 'text-emerald-600 bg-emerald-50'
                                        : 'text-slate-400 hover:text-amber-600'
                                    }`}
                                  >
                                    {copiedRecordId === item.id ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleActionGuarded(() => {
                                        if (
                                          confirm(
                                            `ต้องการยกเลิกรายการตัดสต๊อก ${item.soNumber} หรือไม่?\n(ระบบจะคืนยอด ${item.totalDeducted.toLocaleString()} เมตร กลับเข้าม้วน ${item.lotNumber} เบอร์ ${item.rollNumber} อัตโนมัติ)`
                                          )
                                        ) {
                                          onDeleteRecord(item.id);
                                        }
                                      });
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                    title="ยกเลิกรายการ"
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
            );
          })}
        </div>
      )}
    </div>
  );
};
