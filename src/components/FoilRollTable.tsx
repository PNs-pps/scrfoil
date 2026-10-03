import React, { useState, useMemo, useRef } from 'react';
import { FoilRoll, FoilPattern, FoilWidth, WIDTH_SPECIFICATIONS, isRollUnused } from '../types';
import { STANDARD_PATTERNS, STANDARD_WIDTHS, normalizePattern } from '../utils/soFormatter';
import { formatMeters } from '../utils/formatters';
import { getPatternStyle } from '../utils/patternStyles';
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
  Folder,
  FolderOpen,
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
  Edit2,
  ArrowLeft,
  AlertTriangle,
  SlidersHorizontal,
  MoreVertical
} from 'lucide-react';

interface FoilRollTableProps {
  rolls: FoilRoll[];
  /** Depleted rolls loaded on-demand (Archive). Not in the main realtime subscription. */
  archivedRolls?: FoilRoll[];
  archiveLoaded?: boolean;
  isLoadingArchive?: boolean;
  onLoadArchive?: () => void | Promise<void>;
  onOpenCutModal: (rollId: string) => void;
  onOpenAddModal: () => void;
  onViewRollHistory: (roll: FoilRoll) => void;
  onDeleteRoll: (rollId: string) => void;
  onExportRolls: () => void;
  onToggleZeroOut?: (rollId: string, zeroOut: boolean) => void;
  onOpenBatchImport?: () => void;
  onOpenMonthlySummary?: () => void;
  userMode?: 'visitor' | 'editor';
  onUpdateRoll?: (updatedRoll: FoilRoll) => void;
  onEditRoll?: (roll: FoilRoll) => void;
  onRequestUnlock?: () => void;
}

type GroupByCategory = 'none' | 'width' | 'pattern';

interface SwipeableRollCardProps {
  roll: FoilRoll;
  searchQuery: string;
  onOpenCut: (rollId: string) => void;
  onViewHistory: (roll: FoilRoll) => void;
  onEdit?: (roll: FoilRoll) => void;
  onDelete: (roll: FoilRoll) => void;
  onOpenActionMenu: (roll: FoilRoll) => void;
  onToggleZeroOut?: (rollId: string, zeroOut: boolean) => void;
  highlightMatch: (text: string, query: string) => React.ReactNode;
}

const SwipeableRollCard: React.FC<SwipeableRollCardProps> = ({
  roll,
  searchQuery,
  onOpenCut,
  onViewHistory,
  onEdit,
  onDelete,
  onOpenActionMenu,
  onToggleZeroOut,
  highlightMatch,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalScrollRef = useRef<boolean | null>(null);

  const pStyle = getPatternStyle(roll.pattern);
  const isZeroed = Boolean(roll.isZeroedOut);
  const rem = roll.remainingMeters;
  const isDepleted = rem <= 0 && !isZeroed;

  const percentLeft = roll.totalMeters > 0 ? Math.round((rem / roll.totalMeters) * 100) : 0;

  // Highlight level: red <= 50m / zeroed, yellow <= 200m, normal > 200m, depleted <= 0
  let highlightLevel: 'red' | 'yellow' | 'normal' | 'depleted' = 'normal';
  if (isZeroed || (rem > 0 && rem <= 50)) {
    highlightLevel = 'red';
  } else if (rem > 50 && rem <= 200) {
    highlightLevel = 'yellow';
  } else if (isDepleted) {
    highlightLevel = 'depleted';
  }

  let cardBgClass = 'bg-white';
  let borderLeftClass = 'border-l-4 border-l-emerald-500';
  if (highlightLevel === 'red') {
    cardBgClass = 'bg-white';
    borderLeftClass = 'border-l-4 border-l-rose-500';
  } else if (highlightLevel === 'yellow') {
    cardBgClass = 'bg-white';
    borderLeftClass = 'border-l-4 border-l-amber-400';
  } else if (highlightLevel === 'depleted') {
    cardBgClass = 'bg-slate-100 text-slate-500';
    borderLeftClass = 'border-l-4 border-l-slate-300';
  }

  // Touch handlers for smooth horizontal slide
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    isHorizontalScrollRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    if (isHorizontalScrollRef.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontalScrollRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (!isHorizontalScrollRef.current) return;

    if (isSwiped) {
      const next = Math.max(-224, Math.min(0, -224 + diffX));
      setTranslateX(next);
    } else if (diffX < 0) {
      const next = Math.max(-224, diffX);
      setTranslateX(next);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (translateX < -60) {
      setTranslateX(-224);
      setIsSwiped(true);
    } else {
      setTranslateX(0);
      setIsSwiped(false);
    }
  };

  const toggleSwipe = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSwiped) {
      setTranslateX(0);
      setIsSwiped(false);
    } else {
      setTranslateX(-224);
      setIsSwiped(true);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 shadow-2xs select-none">
      {/* Background action tray revealed upon sliding left (4 menu actions) */}
      <div className="absolute inset-y-0 right-0 w-[224px] flex items-stretch bg-slate-900 text-white z-0">
        {/* 1. ตัดสต๊อก */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTranslateX(0);
            setIsSwiped(false);
            onOpenCut(roll.id);
          }}
          disabled={isDepleted || isZeroed}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-1 text-[10px] font-bold transition-colors cursor-pointer ${
            isDepleted || isZeroed
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:bg-amber-600'
          }`}
          title="ตัดสต๊อกฟอยล์"
        >
          <Scissors className="w-4 h-4 mb-0.5" />
          <span className="leading-tight">ตัดสต๊อก</span>
        </button>

        {/* 2. ดูไทม์ไลน์ */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTranslateX(0);
            setIsSwiped(false);
            onViewHistory(roll);
          }}
          className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 active:bg-slate-900 transition-colors cursor-pointer"
          title="ดูไทม์ไลน์การตัด"
        >
          <History className="w-4 h-4 mb-0.5" />
          <span className="leading-tight">ไทม์ไลน์</span>
        </button>

        {/* 3. แก้ไข */}
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTranslateX(0);
              setIsSwiped(false);
              onEdit(roll);
            }}
            className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white active:bg-blue-700 transition-colors cursor-pointer"
            title="แก้ไขข้อมูลม้วน"
          >
            <Edit2 className="w-4 h-4 mb-0.5" />
            <span className="leading-tight">แก้ไข</span>
          </button>
        )}

        {/* 4. ลบ */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTranslateX(0);
            setIsSwiped(false);
            onDelete(roll);
          }}
          className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white active:bg-rose-700 transition-colors cursor-pointer"
          title="ลบม้วนนี้"
        >
          <Trash2 className="w-4 h-4 mb-0.5" />
          <span className="leading-tight">ลบ</span>
        </button>
      </div>

      {/* Foreground Swipeable Card: Fits within mobile screen */}
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (isSwiped) {
            setTranslateX(0);
            setIsSwiped(false);
          } else {
            onOpenActionMenu(roll);
          }
        }}
        className={`relative z-10 p-3 ${cardBgClass} ${borderLeftClass} transition-colors cursor-pointer active:bg-slate-50`}
      >
        {/* Row 1: Lot + เบอร์ม้วน เด่นชัด */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="inline-flex items-center gap-1 bg-slate-900 text-amber-300 px-2 py-1 rounded-md shrink-0">
              <span className="text-[9px] font-bold uppercase text-amber-200/90">ล็อต</span>
              <span className="lot-number-display text-sm font-bold text-white leading-none">
                {highlightMatch(roll.lotNumber, searchQuery)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 bg-white border-2 border-amber-400 text-slate-900 px-2 py-1 rounded-md shrink-0">
              <span className="text-[9px] font-bold uppercase text-amber-700">เบอร์</span>
              <span className="lot-number-display text-sm font-bold leading-none">
                #{highlightMatch(roll.rollNumber, searchQuery)}
              </span>
            </span>
            {isRollUnused(roll) ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                ม้วนเต็ม
              </span>
            ) : !isDepleted && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 shrink-0">
                ใช้งาน
              </span>
            )}
            {highlightLevel === 'red' && (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                ≤50ม.
              </span>
            )}
            {highlightLevel === 'yellow' && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                ≤200ม.
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-200 shadow-2xs">
              {roll.width} มม.
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              <span className={`w-2 h-2 rounded-full shrink-0 ${pStyle.dotClass}`} />
              <span>{pStyle.name}</span>
            </span>
          </div>
        </div>

        {/* Row 2: Remaining meters & Progress */}
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-[11px] text-slate-500 shrink-0">คงเหลือ:</span>
            <span
              className={`font-mono font-bold text-base truncate ${
                isZeroed
                  ? 'text-rose-700 line-through'
                  : highlightLevel === 'red'
                  ? 'text-rose-700'
                  : highlightLevel === 'yellow'
                  ? 'text-yellow-700'
                  : isDepleted
                  ? 'text-slate-400'
                  : 'text-emerald-700'
              }`}
            >
              {formatMeters(rem)}
            </span>
            <span className="text-xs font-normal text-slate-500">ม.</span>
            {isZeroed && (
              <span className="text-[10px] text-rose-700 font-bold ml-1 shrink-0">
                (ตัด 0)
              </span>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-500 shrink-0">
            จาก {formatMeters(roll.totalMeters)} ม. ({percentLeft}%)
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-1 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              isZeroed
                ? 'bg-rose-500'
                : highlightLevel === 'red'
                ? 'bg-rose-600'
                : highlightLevel === 'yellow'
                ? 'bg-yellow-500'
                : isDepleted
                ? 'bg-slate-300'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${percentLeft}%` }}
          />
        </div>

        {/* Row 3: Used, NG, Checkbox and Slide hint */}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">ใช้: <strong className="text-slate-900">{formatMeters(roll.usedMeters)}</strong> ม.</span>
            <span className="text-slate-300">·</span>
            <span className={`truncate ${roll.ngMeters > 0 ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
              NG: {formatMeters(roll.ngMeters)} ม.
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(highlightLevel === 'red' || isZeroed) && onToggleZeroOut && (
              <label
                onClick={(e) => e.stopPropagation()}
                htmlFor={`zero-toggle-mob-${roll.id}`}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                  isZeroed
                    ? 'bg-rose-600 text-white border-rose-700'
                    : 'bg-white text-rose-700 border-rose-300'
                }`}
              >
                <input
                  id={`zero-toggle-mob-${roll.id}`}
                  type="checkbox"
                  checked={isZeroed}
                  onChange={(e) => onToggleZeroOut(roll.id, e.target.checked)}
                  className="w-3 h-3 accent-rose-600 rounded"
                />
                <span>ตัด 0</span>
              </label>
            )}

            <button
              type="button"
              onClick={toggleSwipe}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-950 font-sans text-[10px] font-bold border border-amber-300/80 cursor-pointer active:scale-95 transition-transform"
              title="สไลด์เปิดเมนูจัดการ"
            >
              <span>{isSwiped ? 'ปิด' : 'สไลด์'}</span>
              <SlidersHorizontal className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FoilRollTable: React.FC<FoilRollTableProps> = ({
  rolls,
  archivedRolls = [],
  archiveLoaded = false,
  isLoadingArchive = false,
  onLoadArchive,
  onOpenCutModal,
  onOpenAddModal,
  onViewRollHistory,
  onDeleteRoll,
  onExportRolls,
  onToggleZeroOut,
  onOpenBatchImport,
  onOpenMonthlySummary,
  onEditRoll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<'all' | 'lot' | 'roll'>('all');
  const [selectedWidth, setSelectedWidth] = useState<string>('all');
  const [selectedPattern, setSelectedPattern] = useState<string>('all');
  // เปิดแท็บ "ใช้งาน" เป็นค่าเริ่มต้น — แสดงเฉพาะม้วนที่มีการตัดแล้ว ลดงานเรนเดอร์
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_use' | 'unused' | 'depleted'>('in_use');
  const [groupBy, setGroupBy] = useState<GroupByCategory>('width');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Record<string, boolean>>({});
  const [actionMenuRoll, setActionMenuRoll] = useState<FoilRoll | null>(null);
  const [deleteConfirmRoll, setDeleteConfirmRoll] = useState<FoilRoll | null>(null);

  const inUseCount = useMemo(
    () => rolls.filter((r) => Number(r.remainingMeters) > 0 && !r.isZeroedOut && r.status !== 'depleted' && !isRollUnused(r)).length,
    [rolls]
  );
  const unusedCount = useMemo(
    () => rolls.filter((r) => Number(r.remainingMeters) > 0 && !r.isZeroedOut && r.status !== 'depleted' && isRollUnused(r)).length,
    [rolls]
  );
  const activeCount = inUseCount + unusedCount;

  // Source list: แยกม้วนเต็มที่ยังไม่มีการใช้งาน กับม้วนที่มีการใช้งานแล้ว
  const sourceRolls = useMemo(() => {
    if (statusFilter === 'depleted') {
      const localDepleted = rolls.filter(
        (r) => r.remainingMeters <= 0 || r.status === 'depleted' || r.isZeroedOut
      );
      if (archiveLoaded) {
        const byId = new Map<string, FoilRoll>();
        [...archivedRolls, ...localDepleted].forEach((r) => byId.set(r.id, r));
        return Array.from(byId.values());
      }
      return localDepleted;
    }
    if (statusFilter === 'in_use') {
      return rolls.filter(
        (r) => Number(r.remainingMeters) > 0 && !r.isZeroedOut && r.status !== 'depleted' && !isRollUnused(r)
      );
    }
    if (statusFilter === 'unused') {
      return rolls.filter(
        (r) => Number(r.remainingMeters) > 0 && !r.isZeroedOut && r.status !== 'depleted' && isRollUnused(r)
      );
    }
    return rolls;
  }, [rolls, archivedRolls, archiveLoaded, statusFilter]);

  // Unique lots for quick 1-click filter chips
  const uniqueLots = useMemo(() => {
    const set = new Set<string>();
    sourceRolls.forEach((r) => {
      if (r.lotNumber && r.lotNumber.trim()) {
        set.add(r.lotNumber.trim());
      }
    });
    return Array.from(set).slice(0, 8);
  }, [sourceRolls]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleSubGroup = (key: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCollapsedSubGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleAllGroups = (expand: boolean) => {
    if (!groupedData) return;
    const newState: Record<string, boolean> = {};
    const newSubState: Record<string, boolean> = {};
    groupedData.forEach(g => {
      newState[g.key] = !expand; // false = expanded, true = collapsed
      g.subGroups?.forEach(sub => {
        newSubState[`${g.key}-${sub.key}`] = !expand;
      });
    });
    setCollapsedGroups(newState);
    setCollapsedSubGroups(newSubState);
  };

  const filteredRolls = useMemo(() => {
    return sourceRolls.filter((r) => {
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

      // Width with numeric and string normalization
      const matchWidth = selectedWidth === 'all' || String(r.width) === selectedWidth || Number(r.width) === Number(selectedWidth);

      // Pattern with canonical normalization (e.g. ท้องขาว vs ขาว)
      const matchPattern = selectedPattern === 'all' || normalizePattern(r.pattern) === normalizePattern(selectedPattern);

      // Status is already handled cleanly in sourceRolls
      const matchStatus = true;

      return matchQuery && matchWidth && matchPattern && matchStatus;
    });
  }, [sourceRolls, searchQuery, searchTarget, selectedWidth, selectedPattern, statusFilter]);

  const filteredTotalRemaining = filteredRolls.reduce((sum, r) => sum + r.remainingMeters, 0);

  // Grouped Rolls computation
  interface SubGroup {
    key: string;
    title: string;
    badge?: string;
    rolls: FoilRoll[];
    totalRemaining: number;
    activeCount: number;
    depletedCount: number;
    pattern?: string;
    width?: number;
  }

  interface RollGroup {
    key: string;
    title: string;
    subTitle?: string;
    badge: string;
    rolls: FoilRoll[];
    subGroups?: SubGroup[];
    totalRemaining: number;
    totalFull: number;
    activeCount: number;
    depletedCount: number;
    pattern?: string;
    width?: number;
  }

  const groupedData = useMemo(() => {
    if (groupBy === 'none') {
      return null;
    }

    if (groupBy === 'width') {
      // Group by Width (830, 850, 880, 900, etc.)
      const groupsMap = new Map<number, FoilRoll[]>();
      
      // Keep standard widths in order first
      STANDARD_WIDTHS.forEach(w => groupsMap.set(Number(w), []));

      filteredRolls.forEach(roll => {
        const numW = Number(roll.width);
        const list = groupsMap.get(numW) || [];
        list.push(roll);
        groupsMap.set(numW, list);
      });

      const result: RollGroup[] = [];
      groupsMap.forEach((gRolls, w) => {
        if (gRolls.length === 0) return;

        const totalRemaining = gRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
        const totalFull = gRolls.reduce((sum, r) => sum + r.totalMeters, 0);
        const activeCount = gRolls.filter(r => r.remainingMeters > 0).length;
        const depletedCount = gRolls.filter(r => r.remainingMeters <= 0).length;

        // Sub-partition by Pattern inside this width folder (แยกลายฟอยล์ เรียงตามล็อต เบอร์)
        const pSubMap = new Map<string, FoilRoll[]>();
        STANDARD_PATTERNS.forEach(p => pSubMap.set(normalizePattern(p.value), []));

        gRolls.forEach(r => {
          const normP = normalizePattern(r.pattern);
          const list = pSubMap.get(normP) || [];
          list.push(r);
          pSubMap.set(normP, list);
        });

        const subGroups: SubGroup[] = [];
        pSubMap.forEach((pRolls, pName) => {
          if (pRolls.length === 0) return;

          // Natural sort: Lot Number then Roll Number (เรียงตามล็อต เบอร์)
          const sorted = [...pRolls].sort((a, b) => {
            const lotA = (a.lotNumber || '').trim();
            const lotB = (b.lotNumber || '').trim();
            const lotComp = lotA.localeCompare(lotB, undefined, { numeric: true, sensitivity: 'base' });
            if (lotComp !== 0) return lotComp;
            const rollA = (a.rollNumber || '').trim();
            const rollB = (b.rollNumber || '').trim();
            return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
          });

          const subRemaining = sorted.reduce((sum, r) => sum + r.remainingMeters, 0);
          const subActive = sorted.filter(r => r.remainingMeters > 0).length;
          const subDepleted = sorted.filter(r => r.remainingMeters <= 0).length;

          subGroups.push({
            key: `p-${pName}`,
            title: pName,
            pattern: pName,
            rolls: sorted,
            totalRemaining: subRemaining,
            activeCount: subActive,
            depletedCount: subDepleted,
          });
        });

        result.push({
          key: `width-${w}`,
          title: `หน้ากว้าง ${w} มม.`,
          subTitle: `${gRolls.length} ม้วน (${activeCount} ม้วนพร้อมใช้ • ${subGroups.length} ลาย)`,
          badge: `${w} mm`,
          rolls: gRolls,
          subGroups,
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
      // Group by Pattern (ขาว, ดำ, ไม้อ่อน, ไม้เข้ม, เทา, กลีบบัว)
      const groupsMap = new Map<string, FoilRoll[]>();
      
      // Standard patterns first
      STANDARD_PATTERNS.forEach(p => groupsMap.set(normalizePattern(p.value), []));

      filteredRolls.forEach(roll => {
        const normP = normalizePattern(roll.pattern);
        const list = groupsMap.get(normP) || [];
        list.push(roll);
        groupsMap.set(normP, list);
      });

      const result: RollGroup[] = [];
      groupsMap.forEach((gRolls, pName) => {
        if (gRolls.length === 0) return;

        const totalRemaining = gRolls.reduce((sum, r) => sum + r.remainingMeters, 0);
        const totalFull = gRolls.reduce((sum, r) => sum + r.totalMeters, 0);
        const activeCount = gRolls.filter(r => r.remainingMeters > 0).length;
        const depletedCount = gRolls.filter(r => r.remainingMeters <= 0).length;

        // Sub-partition by Width inside this pattern folder
        const wSubMap = new Map<number, FoilRoll[]>();
        STANDARD_WIDTHS.forEach(w => wSubMap.set(Number(w), []));

        gRolls.forEach(r => {
          const numW = Number(r.width);
          const list = wSubMap.get(numW) || [];
          list.push(r);
          wSubMap.set(numW, list);
        });

        const subGroups: SubGroup[] = [];
        wSubMap.forEach((wRolls, wNum) => {
          if (wRolls.length === 0) return;

          // Natural sort: Lot Number then Roll Number
          const sorted = [...wRolls].sort((a, b) => {
            const lotComp = a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true, sensitivity: 'base' });
            if (lotComp !== 0) return lotComp;
            return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
          });

          const subRemaining = sorted.reduce((sum, r) => sum + r.remainingMeters, 0);
          const subActive = sorted.filter(r => r.remainingMeters > 0).length;
          const subDepleted = sorted.filter(r => r.remainingMeters <= 0).length;

          subGroups.push({
            key: `w-${wNum}`,
            title: `หน้ากว้าง ${wNum} มม.`,
            badge: `${wNum} mm`,
            width: wNum,
            rolls: sorted,
            totalRemaining: subRemaining,
            activeCount: subActive,
            depletedCount: subDepleted,
          });
        });

        result.push({
          key: `pattern-${pName}`,
          title: `ลาย${pName}`,
          subTitle: `${gRolls.length} ม้วน (${activeCount} ม้วนพร้อมใช้ • ${subGroups.length} ขนาดหน้ากว้าง)`,
          badge: pName,
          rolls: gRolls,
          subGroups,
          totalRemaining,
          totalFull,
          activeCount,
          depletedCount,
          pattern: pName
        });
      });

      return result;
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
    const pStyle = getPatternStyle(roll.pattern);
    const isZeroed = Boolean(roll.isZeroedOut);
    const rem = roll.remainingMeters;
    const isDepleted = rem <= 0 && !isZeroed;

    const percentLeft = roll.totalMeters > 0 
      ? Math.round((rem / roll.totalMeters) * 100) 
      : 0;

    // Color highlights requested:
    // <= 50m   -> Red (ใกล้หมด / ติ๊กเป็น 0 ได้)
    // <= 200m  -> Yellow (เหลือน้อย / เตรียมสั่ง)
    // > 200m   -> Normal (เขียว/ปกติ)
    let highlightLevel: 'red' | 'yellow' | 'normal' | 'depleted' = 'normal';
    if (isZeroed || (rem > 0 && rem <= 50)) {
      highlightLevel = 'red';
    } else if (rem > 50 && rem <= 200) {
      highlightLevel = 'yellow';
    } else if (isDepleted) {
      highlightLevel = 'depleted';
    }

    let rowClass = 'hover:bg-slate-50/80 transition-colors bg-white';
    let borderCellClass = 'border-l-4 border-l-emerald-500';
    if (highlightLevel === 'red') {
      rowClass = 'hover:bg-rose-50/40 transition-colors bg-white';
      borderCellClass = 'border-l-4 border-l-rose-500';
    } else if (highlightLevel === 'yellow') {
      rowClass = 'hover:bg-amber-50/40 transition-colors bg-white';
      borderCellClass = 'border-l-4 border-l-amber-400';
    } else if (highlightLevel === 'depleted') {
      rowClass = 'bg-slate-50/90 text-slate-500 hover:bg-slate-100 transition-colors';
      borderCellClass = 'border-l-4 border-l-slate-300';
    }

    return (
      <tr 
        key={roll.id} 
        className={`${rowClass} cursor-pointer group`}
        onClick={() => setActionMenuRoll(roll)}
        title="คลิกเพื่อเปิดเมนูจัดการ (ตัดสต๊อก / ดูไทม์ไลน์ / แก้ไข / ลบ)"
      >
        {/* Lot & เบอร์ม้วน — เด่นชัดทั้งคู่ */}
        <td className={`px-4 py-3.5 ${borderCellClass}`}>
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="inline-flex items-center gap-1 bg-slate-900 text-amber-300 px-2 py-1 rounded-md">
              <span className="text-[9px] font-bold uppercase text-amber-200/90">ล็อต</span>
              <span className="lot-number-display text-sm sm:text-base font-bold text-white leading-none">
                {highlightMatch(roll.lotNumber, searchQuery)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 bg-white border-2 border-amber-400 text-slate-900 px-2 py-1 rounded-md">
              <span className="text-[9px] font-bold uppercase text-amber-700">เบอร์</span>
              <span className="lot-number-display text-sm sm:text-base font-bold leading-none">
                #{highlightMatch(roll.rollNumber, searchQuery)}
              </span>
            </span>
            {isRollUnused(roll) ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                ม้วนเต็ม
              </span>
            ) : !isDepleted && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 shrink-0">
                ใช้งาน
              </span>
            )}
            {highlightLevel === 'red' && (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0" title="สต๊อกใกล้หมด (<= 50 ม.)">
                ≤50ม.
              </span>
            )}
            {highlightLevel === 'yellow' && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0" title="สต๊อกเหลือน้อย (<= 200 ม.)">
                ≤200ม.
              </span>
            )}
          </div>
          {roll.notes && (
            <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={roll.notes}>
              {roll.notes}
            </div>
          )}
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
            <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${pStyle.dotClass}`} />
            <span className="font-medium text-slate-900 text-xs">
              {pStyle.name}
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
              highlightLevel === 'red' ? 'text-rose-700' :
              highlightLevel === 'yellow' ? 'text-yellow-700' :
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
                highlightLevel === 'yellow' ? 'bg-yellow-500' :
                isDepleted ? 'bg-slate-300' :
                'bg-emerald-500'
              }`}
              style={{ width: `${percentLeft}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block text-right">
            คงเหลือ {percentLeft}%
          </span>

          {/* Checkbox to zero-out roll (for rolls highlighted in red <= 50m, or currently zeroed) */}
          {(highlightLevel === 'red' || isZeroed) && onToggleZeroOut && (
            <div className="mt-1.5 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
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

        {/* Slide / Menu Action trigger */}
        <td className="px-3 py-3.5 text-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActionMenuRoll(roll);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
            title="เปิดเมนูจัดการ (ตัดสต๊อก / ไทม์ไลน์ / แก้ไข / ลบ)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mx-auto" />
          </button>
        </td>
      </tr>
    );
  };

  const renderMobileCard = (roll: FoilRoll) => {
    return (
      <SwipeableRollCard
        key={roll.id}
        roll={roll}
        searchQuery={searchQuery}
        onOpenCut={onOpenCutModal}
        onViewHistory={onViewRollHistory}
        onEdit={onEditRoll}
        onDelete={(r) => setDeleteConfirmRoll(r)}
        onOpenActionMenu={(r) => setActionMenuRoll(r)}
        onToggleZeroOut={onToggleZeroOut}
        highlightMatch={highlightMatch}
      />
    );
  };

  return (
    <div className="space-y-4">

      {/* ปุ่มย้อนกลับเมื่อเข้า Archive / กรองหลายชั้น */}
      {(statusFilter === 'depleted' || selectedWidth !== 'all' || selectedPattern !== 'all' || searchQuery.trim()) && (
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setSelectedWidth('all');
            setSelectedPattern('all');
            setSearchQuery('');
            setSearchTarget('all');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-amber-300 text-xs font-bold shadow-sm cursor-pointer hover:bg-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          กลับหน้ารายการม้วนทั้งหมด
        </button>
      )}

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


        </div>

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

          {groupBy !== 'none' && groupedData && groupedData.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-slate-600 font-medium">
              <button
                type="button"
                onClick={() => toggleAllGroups(true)}
                className="hover:text-amber-800 hover:underline cursor-pointer"
              >
                เปิดทั้งหมด
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => toggleAllGroups(false)}
                className="hover:text-amber-800 hover:underline cursor-pointer"
              >
                ย่อทั้งหมด
              </button>
            </div>
          )}

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

          {/* สถานะม้วน — แถวเดียว ไม่ใช้อิโมจิ · ค่าเริ่มต้น = ใช้งาน */}
          <div className="flex flex-nowrap items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ม้วนพร้อมใช้ทั้งหมด"
            >
              ทั้งหมด ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_use')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'in_use' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ม้วนที่มีการตัดใช้งานแล้ว"
            >
              ใช้งาน ({inUseCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unused')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'unused' ? 'bg-white text-emerald-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ม้วนเต็มที่ยังไม่เคยตัด"
            >
              ม้วนเต็ม ({unusedCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('depleted');
                if (!archiveLoaded && onLoadArchive) {
                  onLoadArchive();
                }
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'depleted' ? 'bg-white text-rose-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ม้วนหมดแล้ว (โหลดคลังเมื่อกด)"
            >
              หมดแล้ว
              {archiveLoaded
                ? ` (${archivedRolls.length})`
                : rolls.filter((r) => r.remainingMeters <= 0).length > 0
                  ? ` (${rolls.filter((r) => r.remainingMeters <= 0).length}+)`
                  : ''}
            </button>
          </div>

          {statusFilter === 'depleted' && (
            <div className="w-full mt-2 flex flex-wrap items-center gap-2">
              {!archiveLoaded && onLoadArchive && (
                <button
                  type="button"
                  onClick={() => onLoadArchive()}
                  disabled={isLoadingArchive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isLoadingArchive ? 'กำลังโหลดคลังข้อมูลเก่า...' : 'โหลดคลังข้อมูลเก่า (Archive) จาก Cloud'}
                </button>
              )}
              {archiveLoaded && (
                <>
                  <span className="text-[11px] text-slate-500">
                    โหลดคลังแล้ว {archivedRolls.length} ม้วน (on-demand ไม่ฟัง realtime)
                  </span>
                  {onLoadArchive && (
                    <button
                      type="button"
                      onClick={() => onLoadArchive()}
                      disabled={isLoadingArchive}
                      className="text-[11px] text-rose-700 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                    >
                      รีเฟรชคลัง
                    </button>
                  )}
                </>
              )}
              {isLoadingArchive && (
                <span className="text-[11px] text-amber-700 font-medium">กำลังดึงม้วนที่หมดแล้วจาก Firestore...</span>
              )}
            </div>
          )}

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

        {/* คำอธิบายสี — บรรทัดเดียว เลื่อนดูได้ถ้าจอแคบ */}
        <div className="flex flex-nowrap items-center gap-1.5 pt-2.5 border-t border-slate-100 text-[11px] overflow-x-auto">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shrink-0 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            เขียว = พร้อมใช้ (เหลือมากกว่า 200 ม.)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-900 border border-yellow-300 font-semibold shrink-0 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
            เหลือง = เหลือน้อย (ไม่เกิน 200 ม. ควรเตรียมสั่ง)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-900 border border-rose-300 font-semibold shrink-0 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
            แดง = ใกล้หมด (ไม่เกิน 50 ม. / ติ๊กตัดเป็น 0 ได้)
          </span>
        </div>
      </div>

      {/* Main Content: Grouped View or Flat View */}
      {filteredRolls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-500 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            {statusFilter === 'depleted' ? <FolderTree className="w-6 h-6" /> : <Search className="w-6 h-6" />}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-base">
              {statusFilter === 'depleted' && !archiveLoaded
                ? 'ยังไม่ได้โหลดคลังข้อมูลเก่า'
                : statusFilter === 'depleted' && archiveLoaded
                  ? 'คลังข้อมูลเก่าว่าง — ยังไม่มีม้วนที่หมด'
                  : searchQuery
                    ? `ไม่พบม้วนฟอยล์ที่ตรงกับ "${searchQuery}"`
                    : 'ไม่พบม้วนฟอยล์ที่ตรงกับเงื่อนไข'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {statusFilter === 'depleted' && !archiveLoaded
                ? 'กดปุ่ม "โหลดคลังข้อมูลเก่า (Archive) จาก Cloud" ด้านบน เพื่อดึงม้วนที่หมดแล้วแบบ on-demand'
                : statusFilter === 'depleted'
                  ? 'ม้วนที่ตัดหมดจะถูกย้ายมาที่นี่อัตโนมัติ (status = depleted)'
                  : searchQuery
                    ? 'ลองตรวจสอบตัวสะกดของเลขล็อต หรือเบอร์ม้วน หรือคลิกเปลี่ยนโหมดค้นหาเป็น "ทั้งหมด"'
                    : 'ลองเปลี่ยนตัวกรอง หรือกดปุ่ม "เพิ่มฟอยล์ใหม่"'}
            </p>
          </div>
          {statusFilter === 'depleted' && !archiveLoaded && onLoadArchive && (
            <button
              type="button"
              onClick={() => onLoadArchive()}
              disabled={isLoadingArchive}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer mx-auto disabled:opacity-60"
            >
              {isLoadingArchive ? 'กำลังโหลด...' : 'โหลดคลังข้อมูลเก่าจาก Cloud'}
            </button>
          )}
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
                    <span 
                      className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-200/80 transition-colors pointer-events-none shrink-0"
                    >
                      {isCollapsed ? (
                        <Folder className="w-5 h-5 fill-amber-300/80 text-amber-600" />
                      ) : (
                        <FolderOpen className="w-5 h-5 fill-amber-300 text-amber-600" />
                      )}
                    </span>

                    <span 
                      className="p-1 rounded-md text-slate-500 hover:text-slate-800 transition-colors pointer-events-none"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>

                    {/* Group Icon / Dot */}
                    {group.pattern ? (
                      <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${getPatternStyle(group.pattern).dotClass}`} />
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

                {/* Group Content (Roll Table or Sub-groups) */}
                {!isCollapsed && (
                  group.rolls.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs font-mono">
                      ไม่มีรายการม้วนฟอยล์ในหมวดนี้ที่ตรงกับเงื่อนไขการกรอง
                    </div>
                  ) : group.subGroups && group.subGroups.length > 0 ? (
                    /* Hierarchical Sub-groups: Folders separated by pattern, sorted by lot & roll */
                    <div className="divide-y divide-slate-200">
                      {group.subGroups.map((sub) => {
                        const subKey = `${group.key}-${sub.key}`;
                        const isSubCollapsed = searchQuery.trim() ? false : !!collapsedSubGroups[subKey];
                        const pStyle = sub.pattern ? getPatternStyle(sub.pattern) : null;

                        return (
                          <div key={sub.key} className="bg-slate-50/40">
                            {/* Subgroup Header */}
                            <div
                              onClick={(e) => toggleSubGroup(subKey, e)}
                              className="px-4 sm:px-5 py-2.5 bg-slate-100/90 hover:bg-slate-200/80 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="p-0.5 text-slate-500 hover:text-slate-800">
                                  {isSubCollapsed ? (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </span>

                                <span className="p-1 rounded text-sky-700 bg-sky-50 border border-sky-200/80 shrink-0">
                                  {isSubCollapsed ? (
                                    <Folder className="w-3.5 h-3.5 fill-sky-200 text-sky-600" />
                                  ) : (
                                    <FolderOpen className="w-3.5 h-3.5 fill-sky-200 text-sky-600" />
                                  )}
                                </span>

                                {pStyle && (
                                  <span className={`w-3 h-3 rounded-full shrink-0 ${pStyle.dotClass}`} />
                                )}
                                {sub.badge && (
                                  <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                                    {sub.badge}
                                  </span>
                                )}

                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                                    {sub.pattern ? `ลาย${sub.title}` : sub.title}
                                  </h4>
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 font-mono text-slate-700 font-semibold shadow-2xs">
                                    {sub.rolls.length} ม้วน
                                  </span>
                                  <span className="text-[11px] text-slate-500 hidden md:inline font-mono">
                                    (เรียงตามล็อต & เบอร์ม้วน)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 font-mono text-xs">
                                <span className="text-slate-500 text-[11px]">
                                  {sub.activeCount} พร้อมใช้ • {sub.depletedCount} หมด
                                </span>
                                <span className="text-slate-300">|</span>
                                <div>
                                  <span className="text-slate-400 text-[11px] mr-1">คงเหลือ:</span>
                                  <span className="font-bold text-emerald-700">
                                    {formatMeters(sub.totalRemaining)} <span className="font-normal text-slate-500 text-[10px]">ม.</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Subgroup Rolls: Mobile cards & Desktop table */}
                            {!isSubCollapsed && (
                              <div>
                                {/* Mobile View: Swipeable Cards */}
                                <div className="block md:hidden space-y-2 p-2.5 bg-slate-50/60">
                                  {sub.rolls.map((roll) => renderMobileCard(roll))}
                                </div>

                                {/* Desktop View: Clean Table without Status and Action columns */}
                                <div className="hidden md:block overflow-x-auto bg-white">
                                  <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/70 text-slate-500 text-[11px] uppercase border-b border-slate-200 font-semibold">
                                      <tr>
                                        <th className="px-4 py-2.5">ล็อต & เบอร์</th>
                                        <th className="px-4 py-2.5">หน้ากว้าง</th>
                                        <th className="px-4 py-2.5">ท้องฟอยล์</th>
                                        <th className="px-4 py-2.5 text-right">ลูกเต็ม</th>
                                        <th className="px-4 py-2.5 text-right w-48">คงเหลือปัจจุบัน</th>
                                        <th className="px-4 py-2.5 text-right">ตัดใช้</th>
                                        <th className="px-4 py-2.5 text-right">NG เสีย</th>
                                        <th className="px-3 py-2.5 text-center w-12" title="เมนูจัดการ">
                                          <SlidersHorizontal className="w-3.5 h-3.5 mx-auto text-slate-400" />
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {sub.rolls.map(renderRollRow)}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      {/* Mobile View: Swipeable Cards */}
                      <div className="block md:hidden space-y-2 p-2.5 bg-slate-50/60">
                        {group.rolls.map((roll) => renderMobileCard(roll))}
                      </div>

                      {/* Desktop View: Clean Table */}
                      <div className="hidden md:block overflow-x-auto">
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
                              <th className="px-3 py-3 text-center w-12" title="เมนูจัดการ">
                                <SlidersHorizontal className="w-3.5 h-3.5 mx-auto text-slate-400" />
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.rolls.map(renderRollRow)}
                          </tbody>
                        </table>
                      </div>
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
          {/* Mobile View: Swipeable Cards */}
          <div className="block md:hidden space-y-2.5 p-3 bg-slate-50/60">
            {filteredRolls.map((roll) => renderMobileCard(roll))}
          </div>

          {/* Desktop View: Clean Table */}
          <div className="hidden md:block overflow-x-auto">
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
                  <th className="px-3 py-3.5 text-center w-12" title="เมนูจัดการ">
                    <SlidersHorizontal className="w-3.5 h-3.5 mx-auto text-slate-400" />
                  </th>
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

      {/* Pop-up Modal 1: จัดการม้วนฟอยล์ (ตัดสต๊อก / ดูไทม์ไลน์ / แก้ไข / ลบ) */}
      {actionMenuRoll && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActionMenuRoll(null)}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  เมนูจัดการม้วนฟอยล์
                </span>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 bg-slate-900 text-amber-300 px-2.5 py-1 rounded-md">
                    <span className="text-[9px] font-bold uppercase text-amber-200/90">ล็อต</span>
                    <span className="lot-number-display text-base font-bold text-white">{actionMenuRoll.lotNumber}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white border-2 border-amber-400 text-slate-900 px-2.5 py-1 rounded-md">
                    <span className="text-[9px] font-bold uppercase text-amber-700">เบอร์</span>
                    <span className="lot-number-display text-base font-bold">#{actionMenuRoll.rollNumber}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  หน้ากว้าง {actionMenuRoll.width} มม. · {actionMenuRoll.pattern} · คงเหลือ {formatMeters(actionMenuRoll.remainingMeters)} ม.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionMenuRoll(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Action Menu Options */}
            <div className="space-y-2">
              {/* 1. ตัดสต๊อกฟอยล์ */}
              <button
                type="button"
                onClick={() => {
                  const rollId = actionMenuRoll.id;
                  setActionMenuRoll(null);
                  onOpenCutModal(rollId);
                }}
                disabled={actionMenuRoll.remainingMeters <= 0 || actionMenuRoll.isZeroedOut}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-950 font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div>ตัดสต๊อกฟอยล์</div>
                    <div className="text-[11px] font-normal text-amber-800">
                      {actionMenuRoll.isZeroedOut ? 'ม้วนนี้ถูกตัดเป็น 0 แล้ว' : 'บันทึกใบสั่งตัด SO / เบิกใช้ลงแผ่น'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 2. ดูไทม์ไลน์ */}
              <button
                type="button"
                onClick={() => {
                  const r = actionMenuRoll;
                  setActionMenuRoll(null);
                  onViewRollHistory(r);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 font-bold text-xs sm:text-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center shadow-xs">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div>ดูไทม์ไลน์ & ประวัติ</div>
                    <div className="text-[11px] font-normal text-slate-500">
                      ไทม์ไลน์การตัด ยอดก่อน–หลังตัด และรายการ SO ทั้งหมด
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 3. แก้ไข */}
              {onEditRoll && (
                <button
                  type="button"
                  onClick={() => {
                    const r = actionMenuRoll;
                    setActionMenuRoll(null);
                    onEditRoll(r);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 text-blue-950 font-bold text-xs sm:text-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Edit2 className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div>แก้ไขข้อมูลม้วน</div>
                      <div className="text-[11px] font-normal text-blue-800">
                        แก้ไขล็อต, เบอร์, หน้ากว้าง, ลาย, ยอดคงเหลือ
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* 4. ลบ */}
              <button
                type="button"
                onClick={() => {
                  const r = actionMenuRoll;
                  setActionMenuRoll(null);
                  setDeleteConfirmRoll(r);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-950 font-bold text-xs sm:text-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-rose-700">ลบม้วนนี้</div>
                    <div className="text-[11px] font-normal text-rose-600">
                      นำม้วนออกจากระบบสต๊อกฟอยล์
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal 2: ยืนยันการลบม้วนฟอยล์ */}
      {deleteConfirmRoll && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmRoll(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ยืนยันการลบม้วนฟอยล์
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  คุณต้องการลบม้วนนี้ออกจากระบบสต๊อกใช่หรือไม่?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">เลขล็อต & เบอร์ม้วน:</span>
                <span className="font-bold text-slate-900">
                  {deleteConfirmRoll.lotNumber} #{deleteConfirmRoll.rollNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">หน้ากว้าง & ลาย:</span>
                <span className="font-medium text-slate-900 font-sans">
                  {deleteConfirmRoll.width} มม. · {deleteConfirmRoll.pattern}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">ยอดคงเหลือปัจจุบัน:</span>
                <span className="font-bold text-emerald-700">
                  {formatMeters(deleteConfirmRoll.remainingMeters)} เมตร
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                การลบม้วนนี้จะนำม้วนออกจากคลังสต๊อก (หากเคยมีประวัติการตัดเดิม บันทึกใบงาน SO จะยังคงอยู่ในระบบ)
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmRoll(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRoll(deleteConfirmRoll.id);
                  setDeleteConfirmRoll(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
