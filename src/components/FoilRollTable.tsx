import React, { useState, useMemo } from 'react';
import { FoilRoll, FoilPattern, FoilWidth, WIDTH_SPECIFICATIONS } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS } from '../utils/soFormatter';
import { formatMeters, compareLotAndRoll } from '../utils/formatters';
import { UserMode } from '../utils/auth';
import { groupRollsByDateReceived } from '../utils/dateGrouping';
import { EditFoilModal } from './EditFoilModal';
import { 
  Search, 
  Filter, 
  Scissors, 
  History, 
  Trash2, 
  Plus, 
  Download, 
  AlertCircle,
  CheckCircle2,
  Layers,
  LayoutGrid,
  List,
  FolderTree,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  CheckSquare,
  Square,
  X,
  Tag,
  Hash,
  Upload,
  FileSpreadsheet,
  Lock,
  Calendar,
  Pencil
} from 'lucide-react';

interface FoilRollTableProps {
  rolls: FoilRoll[];
  onOpenCutModal: (rollId: string) => void;
  onOpenAddModal: () => void;
  onViewRollHistory: (roll: FoilRoll) => void;
  onDeleteRoll: (rollId: string) => void;
  onExportRolls: () => void;
  onToggleZeroOut?: (rollId: string, zeroOut: boolean) => void;
  onOpenBatchImport?: () => void;
  onOpenMonthlySummary?: () => void;
  onUpdateRoll?: (roll: FoilRoll) => void;
  userMode?: UserMode;
  onRequestUnlock?: () => void;
}

type GroupByCategory = 'hierarchy' | 'width' | 'pattern' | 'date' | 'none';

export const FoilRollTable: React.FC<FoilRollTableProps> = ({
  rolls,
  onOpenCutModal,
  onOpenAddModal,
  onViewRollHistory,
  onDeleteRoll,
  onExportRolls,
  onToggleZeroOut,
  onOpenBatchImport,
  onOpenMonthlySummary,
  onUpdateRoll,
  userMode = 'visitor',
  onRequestUnlock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<'all' | 'lot' | 'roll'>('all');
  const [selectedWidth, setSelectedWidth] = useState<string>('all');
  const [selectedPattern, setSelectedPattern] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'depleted'>('all');
  const [groupBy, setGroupBy] = useState<GroupByCategory>('hierarchy');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingRoll, setEditingRoll] = useState<FoilRoll | null>(null);

  const handleActionGuarded = (action: () => void) => {
    if (userMode === 'visitor' && onRequestUnlock) {
      onRequestUnlock();
      return;
    }
    action();
  };

  // Unique lots for quick 1-click filter chips
  const uniqueLots = useMemo(() => {
    const set = new Set<string>();
    rolls.forEach((r) => {
      if (r.lotNumber && r.lotNumber.trim()) {
        set.add(r.lotNumber.trim());
      }
    });
    return Array.from(set).slice(0, 8);
  }, [rolls]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const filteredRolls = useMemo(() => {
    return rolls.filter((r) => {
      // Search filter by Lot Number, Roll Number, or All
      const q = searchQuery.toLowerCase().trim();
      let matchQuery = true;
      if (q) {
        if (searchTarget === 'lot') {
          matchQuery = r.lotNumber.toLowerCase().includes(q);
        } else if (searchTarget === 'roll') {
          matchQuery = r.rollNumber.toLowerCase().includes(q);
        } else {
          matchQuery =
            r.lotNumber.toLowerCase().includes(q) || 
            r.rollNumber.toLowerCase().includes(q) ||
            r.pattern.toLowerCase().includes(q) ||
            (r.notes ? r.notes.toLowerCase().includes(q) : false);
        }
      }

      // Width
      const matchWidth = selectedWidth === 'all' || String(r.width) === selectedWidth;

      // Pattern
      const matchPattern = selectedPattern === 'all' || r.pattern === selectedPattern;

      // Status
      const matchStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && r.remainingMeters > 0) ||
        (statusFilter === 'depleted' && r.remainingMeters <= 0);

      return matchQuery && matchWidth && matchPattern && matchStatus;
    }).sort((a, b) => compareLotAndRoll(a.lotNumber, a.rollNumber, b.lotNumber, b.rollNumber));
  }, [rolls, searchQuery, searchTarget, selectedWidth, selectedPattern, statusFilter]);

  const filteredTotalRemaining = filteredRolls.reduce((sum, r) => sum + r.remainingMeters, 0);

  // Hierarchical Grouping: Width > Pattern > Lot
  interface LotGroup {
    lotNumber: string;
    rolls: FoilRoll[];
    totalRemaining: number;
    totalFull: number;
    activeCount: number;
    depletedCount: number;
  }

  interface PatternGroup {
    pattern: string;
    totalRemaining: number;
    totalFull: number;
    totalRolls: number;
    activeCount: number;
    depletedCount: number;
    lots: LotGroup[];
  }

  interface HierarchyGroup {
    width: number;
    widthTitle: string;
    spec?: string;
    totalRemaining: number;
    totalFull: number;
    totalRolls: number;
    activeCount: number;
    depletedCount: number;
    patterns: PatternGroup[];
  }

  const hierarchyData = useMemo(() => {
    if (groupBy !== 'hierarchy') {
      return null;
    }

    // 1. Group by Width (Standard widths first)
    const widthMap = new Map<number, FoilRoll[]>();
    STANDARD_WIDTHS.forEach(w => widthMap.set(w, []));

    filteredRolls.forEach(roll => {
      const list = widthMap.get(roll.width) || [];
      list.push(roll);
      widthMap.set(roll.width, list);
    });

    const result: HierarchyGroup[] = [];

    widthMap.forEach((wRolls, w) => {
      if (wRolls.length === 0 && selectedWidth !== 'all') return;
      if (wRolls.length === 0 && rolls.filter(r => r.width === w).length === 0) return;

      // 2. Group by Pattern (ท้องฟอยล์)
      const patternMap = new Map<string, FoilRoll[]>();
      STANDARD_PATTERNS.forEach(p => patternMap.set(p.value, []));

      wRolls.forEach(roll => {
        const list = patternMap.get(roll.pattern) || [];
        list.push(roll);
        patternMap.set(roll.pattern, list);
      });

      const patternGroups: PatternGroup[] = [];

      patternMap.forEach((pRolls, pName) => {
        if (pRolls.length === 0) return;

        // 3. Group by Lot within this Pattern
        const lotMap = new Map<string, FoilRoll[]>();
        pRolls.forEach(roll => {
          const lotKey = roll.lotNumber && roll.lotNumber.trim() ? roll.lotNumber.trim() : 'ไม่ระบุล็อต';
          const list = lotMap.get(lotKey) || [];
          list.push(roll);
          lotMap.set(lotKey, list);
        });

        // Sort Lot keys naturally
        const sortedLots = Array.from(lotMap.keys()).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );

        const lotGroups: LotGroup[] = sortedLots.map(lotKey => {
          const lRolls = lotMap.get(lotKey) || [];
          // Sort rolls by Lot and Roll number
          lRolls.sort((a, b) => compareLotAndRoll(a.lotNumber, a.rollNumber, b.lotNumber, b.rollNumber));

          const totalRemaining = lRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
          const totalFull = lRolls.reduce((sum, r) => sum + r.totalMeters, 0);
          const activeCount = lRolls.filter(r => r.remainingMeters > 0).length;
          const depletedCount = lRolls.filter(r => r.remainingMeters <= 0).length;

          return {
            lotNumber: lotKey,
            rolls: lRolls,
            totalRemaining,
            totalFull,
            activeCount,
            depletedCount,
          };
        });

        const pTotalRemaining = pRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
        const pTotalFull = pRolls.reduce((sum, r) => sum + r.totalMeters, 0);
        const pActiveCount = pRolls.filter(r => r.remainingMeters > 0).length;
        const pDepletedCount = pRolls.filter(r => r.remainingMeters <= 0).length;

        patternGroups.push({
          pattern: pName,
          totalRemaining: pTotalRemaining,
          totalFull: pTotalFull,
          totalRolls: pRolls.length,
          activeCount: pActiveCount,
          depletedCount: pDepletedCount,
          lots: lotGroups,
        });
      });

      if (patternGroups.length === 0) return;

      const wTotalRemaining = wRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
      const wTotalFull = wRolls.reduce((sum, r) => sum + r.totalMeters, 0);
      const wActiveCount = wRolls.filter(r => r.remainingMeters > 0).length;
      const wDepletedCount = wRolls.filter(r => r.remainingMeters <= 0).length;

      result.push({
        width: w,
        widthTitle: `หน้ากว้าง ${w} มม.`,
        spec: WIDTH_SPECIFICATIONS[w],
        totalRemaining: wTotalRemaining,
        totalFull: wTotalFull,
        totalRolls: wRolls.length,
        activeCount: wActiveCount,
        depletedCount: wDepletedCount,
        patterns: patternGroups,
      });
    });

    return result;
  }, [groupBy, filteredRolls, selectedWidth, rolls]);

  // Grouped Rolls computation for other modes
  interface RollGroup {
    key: string;
    title: string;
    subTitle?: string;
    badge: string;
    rolls: FoilRoll[];
    totalRemaining: number;
    totalFull: number;
    activeCount: number;
    depletedCount: number;
    pattern?: string;
    width?: number;
  }

  const groupedData = useMemo(() => {
    if (groupBy === 'none' || groupBy === 'hierarchy') {
      return null;
    }

    if (groupBy === 'width') {
      // Group by Width (830, 850, 880, 900, etc.)
      const groupsMap = new Map<number, FoilRoll[]>();
      
      // Keep standard widths in order first
      STANDARD_WIDTHS.forEach(w => groupsMap.set(w, []));

      filteredRolls.forEach(roll => {
        const list = groupsMap.get(roll.width) || [];
        list.push(roll);
        groupsMap.set(roll.width, list);
      });

      const result: RollGroup[] = [];
      groupsMap.forEach((gRolls, w) => {
        if (gRolls.length === 0 && selectedWidth !== 'all') return;
        if (gRolls.length === 0 && rolls.filter(r => r.width === w).length === 0) return;

        const totalRemaining = gRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
        const totalFull = gRolls.reduce((sum, r) => sum + r.totalMeters, 0);
        const activeCount = gRolls.filter(r => r.remainingMeters > 0).length;
        const depletedCount = gRolls.filter(r => r.remainingMeters <= 0).length;

        result.push({
          key: `width-${w}`,
          title: `หน้ากว้าง ${w} มม.`,
          subTitle: `${gRolls.length} ม้วน (${activeCount} ม้วนพร้อมใช้)`,
          badge: `${w} mm`,
          rolls: gRolls,
          totalRemaining,
          totalFull,
          activeCount,
          depletedCount,
          width: w
        });
      });

      return result;
    }

    if (groupBy === 'pattern') {
      // Group by Pattern (ท้องขาว, ดำ, ไม้อ่อน, ลายไม้เข้ม, เทา, กลีบบัว)
      const groupsMap = new Map<string, FoilRoll[]>();
      
      // Standard patterns first
      STANDARD_PATTERNS.forEach(p => groupsMap.set(p.value, []));

      filteredRolls.forEach(roll => {
        const list = groupsMap.get(roll.pattern) || [];
        list.push(roll);
        groupsMap.set(roll.pattern, list);
      });

      const result: RollGroup[] = [];
      groupsMap.forEach((gRolls, pName) => {
        if (gRolls.length === 0 && selectedPattern !== 'all') return;
        if (gRolls.length === 0 && rolls.filter(r => r.pattern === pName).length === 0) return;

        const totalRemaining = gRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
        const totalFull = gRolls.reduce((sum, r) => sum + r.totalMeters, 0);
        const activeCount = gRolls.filter(r => r.remainingMeters > 0).length;
        const depletedCount = gRolls.filter(r => r.remainingMeters <= 0).length;

        result.push({
          key: `pattern-${pName}`,
          title: `ลาย${pName}`,
          subTitle: `${gRolls.length} ม้วน (${activeCount} ม้วนพร้อมใช้)`,
          badge: pName,
          rolls: gRolls,
          totalRemaining,
          totalFull,
          activeCount,
          depletedCount,
          pattern: pName
        });
      });

      return result;
    }

    if (groupBy === 'date') {
      const dateGroups = groupRollsByDateReceived(filteredRolls);
      return dateGroups.map(dg => {
        const totalRemaining = dg.rolls.reduce((sum, r) => sum + r.remainingMeters, 0);
        const totalFull = dg.rolls.reduce((sum, r) => sum + r.totalMeters, 0);
        const activeCount = dg.rolls.filter(r => r.remainingMeters > 0).length;
        const depletedCount = dg.rolls.filter(r => r.remainingMeters <= 0).length;

        return {
          key: `date-${dg.date}`,
          title: `วันที่รับเข้า: ${dg.displayDate}`,
          subTitle: `${dg.rolls.length} ม้วน (ยอดเต็ม ${formatMeters(totalFull)} ม. | เหลือ ${formatMeters(totalRemaining)} ม.)`,
          badge: dg.date,
          rolls: dg.rolls,
          totalRemaining,
          totalFull,
          activeCount,
          depletedCount,
        };
      });
    }

    return null;
  }, [groupBy, filteredRolls, selectedWidth, selectedPattern, rolls]);

  // Highlight matched search term in text
  const highlightMatch = (text: string, query: string) => {
    if (!query || !query.trim()) return text;
    const q = query.trim();
    const index = text.toLowerCase().indexOf(q.toLowerCase());
    if (index === -1) return text;
    const before = text.substring(0, index);
    const match = text.substring(index, index + q.length);
    const after = text.substring(index + q.length);
    return (
      <>
        {before}
        <mark className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded shadow-2xs">
          {match}
        </mark>
        {after}
      </>
    );
  };

  // Render roll row helper
  const renderRollRow = (roll: FoilRoll) => {
    const isZeroed = Boolean(roll.isZeroedOut);
    const rem = roll.remainingMeters;
    const isDepleted = rem <= 0 && !isZeroed;

    const percentLeft = roll.totalMeters > 0 
      ? Math.round((rem / roll.totalMeters) * 100) 
      : 0;

    // Color highlights requested:
    // <= 50m   -> Red (50 สีแดง - วิกฤต / ติ๊กเป็น 0 ได้)
    // <= 200m  -> Yellow (200 สีเหลือง - เหลือน้อย)
    // > 200m   -> Normal (เขียว/ปกติ)
    let highlightLevel: 'red' | 'yellow' | 'normal' | 'depleted' = 'normal';
    if (isZeroed || (rem > 0 && rem <= 50)) {
      highlightLevel = 'red';
    } else if (rem > 50 && rem <= 200) {
      highlightLevel = 'yellow';
    } else if (isDepleted) {
      highlightLevel = 'depleted';
    }

    let rowClass = 'hover:bg-slate-50/80 transition-colors';
    if (highlightLevel === 'red') {
      rowClass = 'bg-rose-50/90 hover:bg-rose-100/80 border-l-4 border-l-rose-500 transition-colors';
    } else if (highlightLevel === 'yellow') {
      rowClass = 'bg-amber-50/90 hover:bg-amber-100/80 border-l-4 border-l-amber-400 transition-colors';
    } else if (highlightLevel === 'depleted') {
      rowClass = 'bg-slate-50/50 opacity-75 transition-colors';
    }

    return (
      <tr 
        key={roll.id} 
        className={rowClass}
      >
        {/* Lot & Roll - Enhanced for High Visibility */}
        <td className="px-4 py-3.5">
          <div className="flex flex-col gap-1.5">
            {/* Roll Number - Big Eye-Catching Badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black text-sm font-mono shadow-xs border border-amber-500 tracking-wider">
                #{highlightMatch(roll.rollNumber, searchQuery)}
              </span>
              {highlightLevel === 'red' && (
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse shrink-0" title="สต๊อกเหลือน้อยวิกฤต (<= 50 ม. สีแดง)" />
              )}
              {highlightLevel === 'yellow' && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" title="สต๊อกเหลือน้อย (<= 200 ม. สีเหลือง)" />
              )}
            </div>

            {/* Lot Number - Clear High-Contrast Mono Tag */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-semibold">ล็อต:</span>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                {highlightMatch(roll.lotNumber, searchQuery)}
              </span>
            </div>

            {roll.notes && (
              <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={roll.notes}>
                {roll.notes}
              </div>
            )}
          </div>
        </td>

        {/* Width with description */}
        <td className="px-4 py-3.5">
          <div className="inline-flex flex-col">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white/90 text-slate-900 border border-slate-200 shadow-2xs">
              {roll.width} มม.
            </span>
            {WIDTH_SPECIFICATIONS[roll.width] && (
              <span className="text-[11px] text-slate-600 font-medium mt-0.5 whitespace-nowrap">
                {WIDTH_SPECIFICATIONS[roll.width]}
              </span>
            )}
          </div>
        </td>

        {/* Pattern (ท้องฟอยล์) */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full border border-slate-300 shrink-0 ${
              roll.pattern === 'ท้องขาว' ? 'bg-white' :
              roll.pattern === 'ดำ' ? 'bg-slate-900' :
              roll.pattern === 'ไม้อ่อน' || (roll.pattern as string) === 'ลายไม่อ่อน' ? 'bg-amber-200' :
              roll.pattern === 'ไม้เข้ม' || (roll.pattern as string) === 'ลายไม้เข้ม' ? 'bg-amber-800' :
              roll.pattern === 'เทา' ? 'bg-slate-400' :
              'bg-rose-300'
            }`} />
            <span className="font-medium text-slate-900 text-xs">
              {roll.pattern}
            </span>
          </div>
        </td>

        {/* Total full meters */}
        <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600">
          {formatMeters(roll.totalMeters)} ม.
        </td>

        {/* Remaining with progress bar & zero-out checkbox */}
        <td className="px-4 py-3.5 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className={`font-mono font-bold text-sm ${
              isZeroed ? 'text-rose-700 line-through' :
              highlightLevel === 'red' ? 'text-rose-700 font-black' :
              highlightLevel === 'yellow' ? 'text-amber-800 font-bold' :
              isDepleted ? 'text-slate-400' :
              'text-emerald-700'
            }`}>
              {formatMeters(rem)}
            </span>
            <span className="text-[11px] text-slate-500">ม.</span>
          </div>

          {isZeroed && roll.manualZeroedOriginalMeters !== undefined && (
            <div className="text-[10px] text-rose-700 font-bold font-mono">
              ตัดเป็น 0 แล้ว (เดิม {formatMeters(roll.manualZeroedOriginalMeters)} ม.)
            </div>
          )}

          {/* Visual Progress Bar */}
          <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-1 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isZeroed ? 'bg-rose-500' :
                highlightLevel === 'red' ? 'bg-rose-600' :
                highlightLevel === 'yellow' ? 'bg-amber-400' :
                isDepleted ? 'bg-slate-300' :
                'bg-emerald-500'
              }`}
              style={{ width: `${percentLeft}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block text-right">
            คงเหลือ {percentLeft}%
          </span>

          {/* Checkbox to zero-out roll (for rolls highlighted <= 200m or currently zeroed) */}
          {(highlightLevel === 'red' || highlightLevel === 'yellow' || isZeroed) && onToggleZeroOut && (
            <div className="mt-1.5 flex items-center justify-end">
              <label 
                htmlFor={`zero-toggle-${roll.id}`}
                title={isZeroed ? "คลิกเพื่อติ๊กออกและคืนค่ายอดเดิม" : "ติ๊กเพื่อตัดยอดคงเหลือสล็อตนี้เป็น 0 เมตร"}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all border shadow-2xs select-none ${
                  isZeroed 
                    ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700' 
                    : 'bg-white text-rose-700 border-rose-400 hover:bg-rose-50'
                }`}
              >
                <input
                  id={`zero-toggle-${roll.id}`}
                  type="checkbox"
                  checked={isZeroed}
                  onChange={(e) => onToggleZeroOut(roll.id, e.target.checked)}
                  className="w-3.5 h-3.5 accent-rose-600 rounded cursor-pointer"
                />
                <span>{isZeroed ? 'ตัดสล็อตเป็น 0 (คืนค่า)' : 'ตัดสล็อตเป็น 0'}</span>
              </label>
            </div>
          )}
        </td>

        {/* Used Meters */}
        <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-700">
          {roll.usedMeters > 0 ? `${formatMeters(roll.usedMeters)} ม.` : '-'}
        </td>

        {/* NG Scrap */}
        <td className="px-4 py-3.5 text-right font-mono text-xs text-rose-600">
          {roll.ngMeters > 0 ? `${formatMeters(roll.ngMeters)} ม.` : '-'}
        </td>

        {/* Status */}
        <td className="px-4 py-3.5 text-center">
          {isZeroed ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
              ตัดเป็น 0 แล้ว
            </span>
          ) : isDepleted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              หมดแล้ว
            </span>
          ) : highlightLevel === 'red' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
              &le; 50 ม. (แดง)
            </span>
          ) : highlightLevel === 'yellow' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              &le; 200 ม. (เหลือง)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              พร้อมใช้งาน
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => handleActionGuarded(() => onOpenCutModal(roll.id))}
              disabled={isDepleted || isZeroed}
              title={isZeroed ? "ม้วนนี้ถูกตัดเป็น 0 แล้ว (ติ๊กออกเพื่อคืนค่าก่อนตัด)" : userMode === 'visitor' ? "ต้องปลดล็อคโหมดคีย์ข้อมูลก่อนตัดสต๊อก" : "ตัดสต๊อกม้วนนี้"}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                isDepleted || isZeroed
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-50 hover:bg-amber-500 text-amber-900 hover:text-slate-950 border border-amber-300'
              }`}
            >
              {userMode === 'visitor' && <Lock className="w-3 h-3 text-slate-400" />}
              <Scissors className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ตัดสต๊อก</span>
            </button>

            {onUpdateRoll && (
              <button
                onClick={() => handleActionGuarded(() => setEditingRoll(roll))}
                title={userMode === 'visitor' ? "ต้องปลดล็อคโหมดคีย์ข้อมูลก่อนแก้ไขข้อมูลฟอยล์" : "แก้ไขข้อมูลฟอยล์ม้วนนี้"}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer"
              >
                {userMode === 'visitor' && <Lock className="w-3 h-3 text-slate-400" />}
                <Pencil className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden xl:inline">แก้ไข</span>
              </button>
            )}

            <button
              onClick={() => onViewRollHistory(roll)}
              title="ดูประวัติการใช้งานและใบงาน SO ที่ใช้ตัดม้วนนี้"
              className="px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden xl:inline">ประวัติใบงาน</span>
            </button>

            <button
              onClick={() => {
                handleActionGuarded(() => {
                  if (confirm(`คุณต้องการลบม้วน ${roll.lotNumber} เบอร์ ${roll.rollNumber} ใช่หรือไม่?`)) {
                    onDeleteRoll(roll.id);
                  }
                });
              }}
              title={userMode === 'visitor' ? "ต้องปลดล็อคโหมดคีย์ข้อมูลก่อนลบม้วน" : "ลบม้วนนี้ออกจากสต๊อก"}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              {userMode === 'visitor' ? <Lock className="w-3.5 h-3.5 text-slate-300" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Search Bar & Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Row 1: Search Bar & Target Mode & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-amber-500 absolute left-3.5 pointer-events-none" />
              <input
                id="foil-roll-search-bar"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                placeholder={
                  searchTarget === 'lot'
                    ? 'ค้นหาเฉพาะเลขล็อต (Lot Number) เช่น LOT2609-01...'
                    : searchTarget === 'roll'
                    ? 'ค้นหาเฉพาะเบอร์ม้วน (Roll Number) เช่น R01, R02...'
                    : 'ค้นหาด่วนตามเลขล็อต (Lot No.) หรือ เบอร์ม้วน (Roll No.)...'
                }
                className="w-full pl-10 pr-24 py-2.5 text-sm bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium placeholder:text-slate-400"
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="ล้างคำค้นหา (Clear)"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200 hidden sm:inline">
                  {filteredRolls.length}/{rolls.length} ม้วน
                </span>
              </div>
            </div>
          </div>

          {/* Search Scope Filter Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setSearchTarget('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchTarget === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>ทั้งหมด</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchTarget('lot')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchTarget === 'lot'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3 h-3 text-amber-950" />
              <span>เลขล็อต (Lot No.)</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchTarget('roll')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchTarget === 'roll'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Hash className="w-3 h-3 text-amber-950" />
              <span>เบอร์ม้วน (Roll No.)</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {onOpenBatchImport && (
              <button
                type="button"
                onClick={() => handleActionGuarded(onOpenBatchImport)}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                title="อัปโหลดข้อมูลใบงาน SO ที่ใช้ตัดฟอยล์แบบเป็นชุด"
              >
                {userMode === 'visitor' ? <Lock className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5 stroke-[2.2]" />}
                <span>อัปโหลด SO ตัดฟอยล์</span>
              </button>
            )}

            {onOpenMonthlySummary && (
              <button
                type="button"
                onClick={onOpenMonthlySummary}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                title="เปิดหน้าต่างสรุปการใช้ฟอยล์รายเดือน"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>สรุปรายเดือน</span>
              </button>
            )}

            <button
              onClick={onExportRolls}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>ส่งออก CSV</span>
            </button>

            <button
              onClick={() => handleActionGuarded(onOpenAddModal)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              {userMode === 'visitor' ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Plus className="w-3.5 h-3.5 text-amber-400" />}
              <span>เพิ่มฟอยล์ใหม่</span>
            </button>
          </div>
        </div>

        {/* Row 1.5: Quick Lot Number Chips for Faster Access */}
        {uniqueLots.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 pt-1 text-xs">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3 text-slate-400" />
              <span>คลิกเลือกล็อตด่วน:</span>
            </span>
            {uniqueLots.map((lot) => {
              const isSelected = searchQuery.trim().toLowerCase() === lot.toLowerCase();
              return (
                <button
                  key={lot}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSearchQuery('');
                    } else {
                      setSearchQuery(lot);
                      setSearchTarget('lot');
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold shadow-2xs ring-1 ring-amber-400'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {lot}
                </button>
              );
            })}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[11px] text-rose-600 hover:underline ml-1 font-medium cursor-pointer"
              >
                ล้างคำค้น
              </button>
            )}
          </div>
        )}

        {/* Active Search Summary Notification Banner */}
        {searchQuery.trim() && (
          <div className="flex items-center justify-between bg-amber-50/90 border border-amber-200 px-3.5 py-2 rounded-xl text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-amber-600" />
              <span>
                กำลังกรองด้วยคำค้นหา: <strong className="font-mono font-bold text-slate-900">"{searchQuery}"</strong>{' '}
                <span className="text-slate-600">
                  ({searchTarget === 'lot' ? 'เฉพาะเลขล็อต' : searchTarget === 'roll' ? 'เฉพาะเบอร์ม้วน' : 'ทุกล็อต/เบอร์ม้วน/ลาย'})
                </span>
                {' • '}
                พบ <strong className="text-amber-800 font-bold">{filteredRolls.length}</strong> ม้วน
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-amber-900 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>ล้างคำค้น</span>
            </button>
          </div>
        )}

        {/* Row 2: Group By Categorization & Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Group By Categorization Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs mr-1">
            <span className="px-2 py-1 text-slate-500 font-semibold flex items-center gap-1">
              <FolderTree className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">จัดหมวดหมู่:</span>
            </span>
            <button
              type="button"
              onClick={() => setGroupBy('hierarchy')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                groupBy === 'hierarchy'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>กว้าง &gt; ท้อง &gt; ล็อต</span>
              <span className="text-[10px] bg-amber-600 text-white px-1 rounded-sm font-normal">หลัก</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('width')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                groupBy === 'width'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ตามหน้ากว้าง
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('pattern')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                groupBy === 'pattern'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ตามท้องฟอยล์
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('date')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                groupBy === 'date'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3 text-amber-500" />
              <span>ตามวันที่รับเข้า</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('none')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                groupBy === 'none'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ไม่แยกกลุ่ม
            </button>
          </div>

          <div className="flex items-center gap-1 text-slate-500 mr-1 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>กรองตาม:</span>
          </div>

          {/* Width Filter */}
          <select
            value={selectedWidth}
            onChange={(e) => setSelectedWidth(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:border-amber-500 cursor-pointer"
          >
            <option value="all">หน้ากว้าง: ทั้งหมด</option>
            {STANDARD_WIDTHS.map(w => (
              <option key={w} value={String(w)}>{w} มม. ({WIDTH_SPECIFICATIONS[w] || ''})</option>
            ))}
          </select>

          {/* Pattern Filter */}
          <select
            value={selectedPattern}
            onChange={(e) => setSelectedPattern(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:border-amber-500 cursor-pointer"
          >
            <option value="all">ท้องฟอยล์: ทั้งหมด</option>
            {STANDARD_PATTERNS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({rolls.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'active' ? 'bg-white text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              มีของ ({rolls.filter(r => r.remainingMeters > 0).length})
            </button>
            <button
              onClick={() => setStatusFilter('depleted')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'depleted' ? 'bg-white text-rose-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              หมดแล้ว ({rolls.filter(r => r.remainingMeters <= 0).length})
            </button>
          </div>

          {(searchQuery || selectedWidth !== 'all' || selectedPattern !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchTarget('all');
                setSelectedWidth('all');
                setSelectedPattern('all');
                setStatusFilter('all');
              }}
              className="text-xs text-rose-600 hover:underline ml-auto cursor-pointer font-medium"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>

        {/* Stock Level Warning Legend */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 text-[11px] font-medium text-slate-600">
          <span className="text-slate-400 font-semibold">ไฮไลท์ระดับสต๊อก:</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-100/90 text-rose-900 border border-rose-300 font-mono font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
            &le; 50 ม. (สีแดง - สต๊อกวิกฤต / มีช่องติ๊กตัดสล็อตเป็น 0)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100/90 text-amber-900 border border-amber-300 font-mono font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            &le; 200 ม. (สีเหลือง - สต๊อกเหลือน้อย)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            &gt; 200 ม. (ปกติ / พร้อมใช้งาน)
          </span>
        </div>
      </div>

      {/* Main Content: Grouped View or Flat View */}
      {filteredRolls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-500 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-base">
              {searchQuery ? `ไม่พบม้วนฟอยล์ที่ตรงกับ "${searchQuery}"` : 'ไม่พบม้วนฟอยล์ที่ตรงกับเงื่อนไข'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery 
                ? `ลองตรวจสอบตัวสะกดของเลขล็อต หรือเบอร์ม้วน หรือคลิกเปลี่ยนโหมดค้นหาเป็น "ทั้งหมด"`
                : 'ลองเปลี่ยนตัวกรอง หรือกดปุ่ม "เพิ่มฟอยล์ใหม่"'}
            </p>
          </div>
          {(searchQuery || selectedWidth !== 'all' || selectedPattern !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchTarget('all');
                setSelectedWidth('all');
                setSelectedPattern('all');
                setStatusFilter('all');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer mx-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ล้างตัวกรองและคำค้นหา</span>
            </button>
          )}
        </div>
      ) : hierarchyData && hierarchyData.length > 0 ? (
        /* Hierarchical Grouping: Width > Pattern > Lot */
        <div className="space-y-6">
          {hierarchyData.map((wGroup) => {
            const widthKey = `w-${wGroup.width}`;
            const isWidthCollapsed = searchQuery.trim() ? false : !!collapsedGroups[widthKey];
            const percentRemaining = wGroup.totalFull > 0 
              ? Math.round((wGroup.totalRemaining / wGroup.totalFull) * 100) 
              : 0;

            return (
              <div 
                key={widthKey}
                className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Level 1: Width Header */}
                <div 
                  onClick={() => toggleGroup(widthKey)}
                  className="px-4 sm:px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer select-none hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      type="button" 
                      className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      {isWidthCollapsed ? (
                        <ChevronRight className="w-5 h-5 text-amber-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-amber-400" />
                      )}
                    </button>

                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-sm font-mono shadow-xs">
                        {wGroup.width} มม.
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">
                            {wGroup.widthTitle}
                          </h3>
                          {wGroup.spec && (
                            <span className="text-xs text-amber-300 font-medium hidden md:inline">
                              ({wGroup.spec})
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                            {wGroup.totalRolls} ม้วน
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono">
                          {wGroup.patterns.length} ชนิดท้องฟอยล์ • พร้อมใช้ {wGroup.activeCount} ม้วน • หมด {wGroup.depletedCount} ม้วน
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Width Level Stats */}
                  <div className="flex items-center gap-6 font-mono text-xs self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-slate-400 block text-[11px]">คงเหลือรวมหน้ากว้างนี้</span>
                      <span className="text-base font-bold text-amber-400">
                        {formatMeters(wGroup.totalRemaining)}{' '}
                        <span className="text-xs font-normal text-slate-300">ม.</span>
                      </span>
                    </div>

                    <div className="w-24 hidden md:block">
                      <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                        <span>คงเหลือ</span>
                        <span className="font-bold">{percentRemaining}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-amber-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${percentRemaining}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Level 2 & 3: Patterns & Lots */}
                {!isWidthCollapsed && (
                  <div className="p-3 sm:p-5 space-y-5 bg-slate-50/70">
                    {wGroup.patterns.map((pGroup) => {
                      const patternKey = `w-${wGroup.width}-p-${pGroup.pattern}`;
                      const isPatternCollapsed = searchQuery.trim() ? false : !!collapsedGroups[patternKey];

                      return (
                        <div 
                          key={patternKey}
                          className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
                        >
                          {/* Pattern Header */}
                          <div 
                            onClick={() => toggleGroup(patternKey)}
                            className="px-4 py-3 bg-slate-100/90 hover:bg-slate-200/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer select-none transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <button 
                                type="button" 
                                className="p-1 rounded text-slate-500 hover:text-slate-800"
                              >
                                {isPatternCollapsed ? (
                                  <ChevronRight className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>

                              <span className={`w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 ${
                                pGroup.pattern === 'ท้องขาว' ? 'bg-white' :
                                pGroup.pattern === 'ดำ' ? 'bg-slate-900' :
                                pGroup.pattern === 'ไม้อ่อน' || (pGroup.pattern as string) === 'ลายไม่อ่อน' ? 'bg-amber-200' :
                                pGroup.pattern === 'ไม้เข้ม' || (pGroup.pattern as string) === 'ลายไม้เข้ม' ? 'bg-amber-800' :
                                pGroup.pattern === 'เทา' ? 'bg-slate-400' :
                                'bg-rose-300'
                              }`} />

                              <span className="font-bold text-slate-800 text-sm">
                                ท้องฟอยล์: {pGroup.pattern}
                              </span>

                              <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-300 text-slate-700 font-mono font-semibold">
                                {pGroup.totalRolls} ม้วน ({pGroup.lots.length} ล็อต)
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto">
                              <span className="text-slate-500">
                                พร้อมใช้ <strong className="text-emerald-700">{pGroup.activeCount}</strong> ม้วน
                              </span>
                              <span className="text-slate-300">|</span>
                              <span className="text-slate-700">
                                รวมเหลือ: <strong className="text-emerald-700 font-bold">{formatMeters(pGroup.totalRemaining)}</strong> ม.
                              </span>
                            </div>
                          </div>

                          {/* Lots and Table */}
                          {!isPatternCollapsed && (
                            <div className="p-3 sm:p-4 space-y-4">
                              {pGroup.lots.map((lot) => {
                                return (
                                  <div 
                                    key={`lot-${lot.lotNumber}`}
                                    className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-2xs"
                                  >
                                    {/* Lot Sub-header */}
                                    <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-500">ล็อต:</span>
                                        <span className="font-mono font-bold text-xs bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded shadow-2xs">
                                          {lot.lotNumber}
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">
                                          ({lot.rolls.length} ม้วน)
                                        </span>
                                        <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                          <span>เบอร์:</span>
                                          {lot.rolls.map(r => (
                                            <span 
                                              key={r.id}
                                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                r.remainingMeters <= 0 
                                                  ? 'bg-slate-200 text-slate-500 line-through'
                                                  : r.remainingMeters <= 50
                                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                  : r.remainingMeters <= 200
                                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                  : 'bg-white text-slate-700 border border-slate-200'
                                              }`}
                                            >
                                              #{r.rollNumber}
                                            </span>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="text-xs font-mono text-slate-600">
                                        คงเหลือในล็อต:{' '}
                                        <strong className="text-emerald-700 font-bold text-sm">
                                          {formatMeters(lot.totalRemaining)}
                                        </strong>{' '}
                                        ม.
                                      </div>
                                    </div>

                                    {/* Rolls Table for this Lot */}
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50/50 text-slate-500 text-[11px] uppercase border-b border-slate-200 font-semibold">
                                          <tr>
                                            <th className="px-4 py-2.5">ล็อต & เบอร์</th>
                                            <th className="px-4 py-2.5">หน้ากว้าง</th>
                                            <th className="px-4 py-2.5">ท้องฟอยล์</th>
                                            <th className="px-4 py-2.5 text-right">ลูกเต็ม</th>
                                            <th className="px-4 py-2.5 text-right w-44">คงเหลือปัจจุบัน</th>
                                            <th className="px-4 py-2.5 text-right">ตัดใช้</th>
                                            <th className="px-4 py-2.5 text-right">NG เสีย</th>
                                            <th className="px-4 py-2.5 text-center">สถานะ</th>
                                            <th className="px-4 py-2.5 text-center">จัดการ</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {lot.rolls.map(renderRollRow)}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : groupedData && groupedData.length > 0 ? (
        /* Categorized / Grouped View */
        <div className="space-y-4">
          {groupedData.map((group) => {
            const isCollapsed = searchQuery.trim() ? false : !!collapsedGroups[group.key];
            const percentRemaining = group.totalFull > 0 
              ? Math.round((group.totalRemaining / group.totalFull) * 100) 
              : 0;

            return (
              <div 
                key={group.key}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Group Header Card */}
                <div 
                  onClick={() => toggleGroup(group.key)}
                  className="px-4 sm:px-5 py-3.5 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      type="button" 
                      className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* Group Icon / Dot */}
                    {group.pattern ? (
                      <span className={`w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 ${
                        group.pattern === 'ท้องขาว' ? 'bg-white' :
                        group.pattern === 'ดำ' ? 'bg-slate-900' :
                        group.pattern === 'ไม้อ่อน' || (group.pattern as string) === 'ลายไม่อ่อน' ? 'bg-amber-200' :
                        group.pattern === 'ลายไม้เข้ม' ? 'bg-amber-800' :
                        group.pattern === 'เทา' ? 'bg-slate-400' :
                        'bg-rose-300'
                      }`} />
                    ) : (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
                        {group.badge}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          {group.title}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-mono font-medium">
                          {group.rolls.length} ม้วน
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {group.activeCount} ม้วนพร้อมใช้ • {group.depletedCount} ม้วนหมดแล้ว
                      </p>
                    </div>
                  </div>

                  {/* Group Summary Metrics */}
                  <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto font-mono text-xs">
                    <div className="text-right">
                      <span className="text-slate-400 block text-[11px]">คงเหลือรวม</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {formatMeters(group.totalRemaining)}{' '}
                        <span className="text-xs font-normal text-slate-500">ม.</span>
                      </span>
                    </div>

                    <div className="w-24 hidden md:block">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>คงเหลือ</span>
                        <span className="font-bold">{percentRemaining}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${percentRemaining}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group Content (Roll Table) */}
                {!isCollapsed && (
                  group.rolls.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs font-mono">
                      ไม่มีรายการม้วนฟอยล์ในหมวดนี้ที่ตรงกับเงื่อนไขการกรอง
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/70 text-slate-500 text-xs uppercase border-b border-slate-200 font-semibold">
                          <tr>
                            <th className="px-4 py-3">ล็อต & เบอร์</th>
                            <th className="px-4 py-3">หน้ากว้าง</th>
                            <th className="px-4 py-3">ท้องฟอยล์</th>
                            <th className="px-4 py-3 text-right">ลูกเต็ม</th>
                            <th className="px-4 py-3 text-right w-48">คงเหลือปัจจุบัน</th>
                            <th className="px-4 py-3 text-right">ตัดใช้</th>
                            <th className="px-4 py-3 text-right">NG เสีย</th>
                            <th className="px-4 py-3 text-center">สถานะ</th>
                            <th className="px-4 py-3 text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.rolls.map(renderRollRow)}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            );
          })}

          {/* Footer info bar */}
          <div className="px-5 py-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 gap-2 font-mono">
            <div>
              จัดกลุ่มตาม: <span className="font-bold text-slate-900">{groupBy === 'width' ? 'หน้ากว้าง (มม.)' : 'ท้องฟอยล์'}</span> ({groupedData.length} หมวดหมู่)
            </div>
            <div>
              ยอดคงเหลือรวมทั้งหมด:{' '}
              <span className="font-bold text-emerald-700 text-sm">
                {formatMeters(filteredTotalRemaining)}
              </span>{' '}
              เมตร
            </div>
          </div>
        </div>
      ) : (
        /* Flat View (No Grouping) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3.5">ล็อต & เบอร์</th>
                  <th className="px-4 py-3.5">หน้ากว้าง</th>
                  <th className="px-4 py-3.5">ท้องฟอยล์</th>
                  <th className="px-4 py-3.5 text-right">ลูกเต็ม</th>
                  <th className="px-4 py-3.5 text-right w-48">คงเหลือปัจจุบัน</th>
                  <th className="px-4 py-3.5 text-right">ตัดใช้</th>
                  <th className="px-4 py-3.5 text-right">NG เสีย</th>
                  <th className="px-4 py-3.5 text-center">สถานะ</th>
                  <th className="px-4 py-3.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRolls.map(renderRollRow)}
              </tbody>
            </table>
          </div>

          {/* Footer info bar */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 gap-2 font-mono">
            <div>
              แสดงผล <span className="font-bold text-slate-900">{filteredRolls.length}</span> จากทั้งหมด <span className="font-bold text-slate-900">{rolls.length}</span> ม้วน
            </div>
            <div>
              ยอดคงเหลือรวมในรายการที่เลือก:{' '}
              <span className="font-bold text-emerald-700 text-sm">
                {formatMeters(filteredTotalRemaining)}
              </span>{' '}
              เมตร
            </div>
          </div>
        </div>
      )}

      {/* Edit Foil Modal */}
      {editingRoll && onUpdateRoll && (
        <EditFoilModal
          isOpen={Boolean(editingRoll)}
          onClose={() => setEditingRoll(null)}
          roll={editingRoll}
          onSave={(updatedRoll) => {
            onUpdateRoll(updatedRoll);
            setEditingRoll(null);
          }}
        />
      )}
    </div>
  );
};
