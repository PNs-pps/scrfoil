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
  ArrowDown
} from 'lucide-react';
import { exportCutRecordsToCSV } from '../utils/storage';
import { formatMeters, compareLotAndRoll } from '../utils/formatters';
import { UserMode } from '../utils/auth';
import { groupCutsByDate, exportCutsDateCSV } from '../utils/dateGrouping';
import { getPatternStyle } from '../utils/patternStyles';

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

  return (
    <div className="space-y-4">
      {/* Control Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Row 1: Search Bar & Scope Selection */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Main Search Box */}
          <div className="relative flex-1">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-amber-500 absolute left-3.5 pointer-events-none" />
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
                    ? 'ค้นหาเฉพาะรหัส SO เช่น so6909500...'
                    : searchScope === 'employee'
                    ? 'ค้นหาเฉพาะชื่อพนักงานผู้ตัด เช่น สมชาย, ช่างคุม...'
                    : searchScope === 'lot_roll'
                    ? 'ค้นหาเฉพาะเลขล็อต หรือ เบอร์ม้วน...'
                    : 'ค้นหารหัส SO หรือ ชื่อพนักงานผู้บันทึก หรือ ล็อต/เบอร์ม้วน...'
                }
                className="w-full pl-10 pr-24 py-2.5 text-sm bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium placeholder:text-slate-400"
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="ล้างคำค้นหา"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200 hidden sm:inline">
                  {filteredRecords.length}/{records.length} รายการ
                </span>
              </div>
            </div>
          </div>

          {/* Search Scope Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setSearchScope('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                searchScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('so')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchScope === 'so'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>รหัส SO</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('employee')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchScope === 'employee'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3 h-3" />
              <span>ชื่อพนักงาน</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('lot_roll')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchScope === 'lot_roll'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>ล็อต/ม้วน</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportCutRecordsToCSV(filteredRecords)}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ส่งออกรายการที่กรองเป็น CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">ส่งออก CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleActionGuarded(onOpenCutModal)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              {userMode === 'visitor' ? (
                <Lock className="w-3.5 h-3.5 text-slate-900" />
              ) : null}
              <span>+ บันทึกตัดสต๊อก</span>
            </button>
          </div>
        </div>

        {/* Row 1.5: Dropdown Selection Filters (SO, Lot, Width, Pattern) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Dropdown: SO Number */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              รหัสคำสั่งซื้อ SO:
            </label>
            <select
              value={selectedSo}
              onChange={(e) => setSelectedSo(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                selectedSo !== 'all'
                  ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <option value="all">รหัส SO: ทั้งหมด ({sosList.length})</option>
              {sosList.map(({ so, count }) => (
                <option key={so} value={so}>
                  {so} ({count} ครั้ง)
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown: Lot Number */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              เลขล็อต (Lot No.):
            </label>
            <select
              value={selectedLot}
              onChange={(e) => setSelectedLot(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                selectedLot !== 'all'
                  ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <option value="all">ทุกล็อต ({lotsList.length})</option>
              {lotsList.map(({ lot, count }) => (
                <option key={lot} value={lot}>
                  {lot} ({count} ม้วน/ครั้ง)
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown: Width */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              หน้ากว้าง (มม.):
            </label>
            <select
              value={selectedWidth}
              onChange={(e) => setSelectedWidth(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                selectedWidth !== 'all'
                  ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <option value="all">หน้ากว้าง: ทั้งหมด</option>
              {widthsList.map((w) => (
                <option key={w} value={String(w)}>
                  หน้า {w} มม. {WIDTH_SPECIFICATIONS[w] ? `(${WIDTH_SPECIFICATIONS[w]})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown: Pattern */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              ลายท้องฟอยล์:
            </label>
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                selectedPattern !== 'all'
                  ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <option value="all">ลายท้อง: ทั้งหมด</option>
              <option value="ขาว">ขาว</option>
              <option value="ดำ">ดำ</option>
              <option value="ไม้อ่อน">ไม้อ่อน</option>
              <option value="ไม้เข้ม">ไม้เข้ม</option>
              <option value="เทา">เทา</option>
              <option value="กลีบบัว">กลีบบัว</option>
            </select>
          </div>

          {/* Clear Filters Action */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-end">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="w-full px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <X className="w-3.5 h-3.5 text-rose-600" />
                <span>ล้างตัวกรองทั้งหมด</span>
              </button>
            ) : (
              <div className="text-[11px] text-slate-400 italic py-1.5 flex items-center gap-1">
                <span>กรองย้อนหลังได้รวดเร็ว</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Date Range Filter & Quick Presets */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-semibold text-[11px] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>ช่วงวันที่ใช้งาน:</span>
            </span>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="จากวันที่"
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-amber-500 cursor-pointer"
              />
              <span className="text-slate-400 text-xs">ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="ถึงวันที่"
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-amber-500 cursor-pointer"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleDatePreset('today')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer transition-colors"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('7days')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer transition-colors"
              >
                7 วันล่าสุด
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('30days')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer transition-colors"
              >
                30 วันล่าสุด
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('this_month')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer transition-colors"
              >
                เดือนนี้
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => handleDatePreset('clear')}
                  className="px-1.5 py-0.5 rounded text-rose-600 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                >
                  ล้างวันที่
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Chips (Employees) */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              <span>ผู้บันทึก:</span>
            </span>
            {employeesList.slice(0, 5).map((emp) => (
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
                className={`px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer border flex items-center gap-1 ${
                  searchQuery === emp && searchScope === 'employee'
                    ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold ring-1 ring-blue-400'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>{emp}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: View Mode (Flat Table vs Date Folder Grouping) & Folder Collapse Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  viewMode === 'flat'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ตารางทั้งหมด ({filteredRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('date_folder')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'date_folder'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-600" />
                <span>แยกโฟลเดอร์ตามวันที่ ({dateGroups.length} วัน)</span>
              </button>
            </div>

            {/* Folder Expand/Collapse buttons when in date_folder view */}
            {viewMode === 'date_folder' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleAllFolders(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs cursor-pointer shadow-2xs"
                >
                  📁 เปิดทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllFolders(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs cursor-pointer shadow-2xs"
                >
                  📁 ปิดทั้งหมด
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-600">
            <div>
              ผลิตลงแผ่นรวม: <strong className="text-slate-900 font-bold">{formatMeters(totalUsedFiltered)}</strong> ม.
            </div>
            <div>
              NG เสีย: <strong className="text-rose-600 font-bold">{formatMeters(totalNgFiltered)}</strong> ม.
            </div>
            <div>
              รวมตัดออก: <strong className="text-amber-800 font-bold">{formatMeters(totalUsedFiltered + totalNgFiltered)}</strong> ม.
            </div>
          </div>
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
                  {renderSortHeader('lot_roll', 'ล็อต & เบอร์ม้วน')}
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
                {filteredRecords.map((item) => {
                  const patternStyle = getPatternStyle(item.pattern);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
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
                          {item.isSilverSide && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-to-r from-slate-100 to-zinc-200 text-slate-800 text-[11px] font-bold border border-slate-300 shadow-2xs">
                              ท้องเงิน
                            </span>
                          )}
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
                        <div className="flex items-center gap-1.5">
                          <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${patternStyle.dotClass}`} />
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${patternStyle.badgeClass}`}>
                            ท้อง{patternStyle.name} ({patternStyle.colorName})
                          </span>
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

                      {/* Delete / Void Action */}
                      <td className="px-4 py-3.5 text-center">
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
                      </td>
                    </tr>
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
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Folder Header */}
                <div
                  onClick={() => toggleDateCollapse(group.date)}
                  className="px-5 py-3.5 bg-slate-50/90 hover:bg-slate-100/80 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    )}
                    <FolderOpen className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">
                          {group.displayDate}
                        </span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          {group.records.length} รายการตัด
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                          ({group.soCount} รหัส SO)
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>SO: {group.uniqueSoList.slice(0, 5).join(', ')}{group.uniqueSoList.length > 5 ? '...' : ''}</span>
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
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="font-mono font-bold text-amber-900 text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    {highlightMatch(item.soNumber, searchQuery)}
                                  </span>
                                  {item.isSilverSide && (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-gradient-to-r from-slate-100 to-zinc-200 text-slate-800 text-[10px] font-bold border border-slate-300">
                                      ท้องเงิน
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
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-3 h-3 rounded-full shrink-0 ${patternStyle.dotClass}`} />
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${patternStyle.badgeClass}`}>
                                    ท้อง{patternStyle.name} ({patternStyle.colorName})
                                  </span>
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
