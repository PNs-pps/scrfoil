import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import { FoilRoll, isRollUnused, StockCutRecord, WIDTH_SPECIFICATIONS } from '../types';
import { formatMeters } from '../utils/formatters';
import { getPatternStyle } from '../utils/patternStyles';
import { reservedMetersOfRoll } from '../utils/rollAggregates';
import {
  buildSpecKey,
  groupSummariesByWidth,
  isRollActiveForSummary,
  SpecStockSummary,
  WidthStockGroup,
} from '../utils/specStockSummary';

type AlertModalFilterMode = 'alerts' | 'zero' | 'one' | 'all';

interface FoilSpecAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaries: SpecStockSummary[];
  rolls: FoilRoll[];
  records: StockCutRecord[];
  activeSpecKey?: string | null;
  onSelectSpec: (width: number, pattern: string) => void;
}

export const FoilSpecAlertModal: React.FC<FoilSpecAlertModalProps> = ({
  isOpen,
  onClose,
  summaries,
  rolls,
  records,
  activeSpecKey = null,
  onSelectSpec,
}) => {
  const [filterMode, setFilterMode] = useState<AlertModalFilterMode>('alerts');
  const [expandedWidthKeys, setExpandedWidthKeys] = useState<Record<string, boolean>>({});
  const [expandedPatternKeys, setExpandedPatternKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const zeroSummaries = useMemo(
    () => summaries.filter((s) => s.fullRollCount === 0),
    [summaries]
  );

  const oneSummaries = useMemo(
    () => summaries.filter((s) => s.fullRollCount === 1),
    [summaries]
  );

  const zeroWidthGroups = useMemo(
    () => groupSummariesByWidth(zeroSummaries),
    [zeroSummaries]
  );

  const oneWidthGroups = useMemo(
    () => groupSummariesByWidth(oneSummaries),
    [oneSummaries]
  );

  const allWidthGroups = useMemo(
    () => groupSummariesByWidth(summaries),
    [summaries]
  );

  const totalRemainingAll = useMemo(
    () => summaries.reduce((sum, s) => sum + s.totalRemainingMeters, 0),
    [summaries]
  );

  const rollsBySpecKey = useMemo(() => {
    const map = new Map<string, FoilRoll[]>();
    for (const roll of rolls) {
      if (!isRollActiveForSummary(roll)) continue;
      const key = buildSpecKey(roll.width, roll.pattern);
      const list = map.get(key) || [];
      list.push(roll);
      map.set(key, list);
    }
    return map;
  }, [rolls]);

  if (!isOpen) return null;

  const toggleWidthDropdown = (sectionPrefix: string, width: number) => {
    const k = `${sectionPrefix}-${width}`;
    setExpandedWidthKeys((prev) => ({ ...prev, [k]: !(prev[k] ?? false) }));
  };

  const togglePatternDropdown = (sectionPrefix: string, specKey: string) => {
    const k = `${sectionPrefix}-${specKey}`;
    setExpandedPatternKeys((prev) => ({ ...prev, [k]: !(prev[k] ?? false) }));
  };

  const handleExpandAll = (expand: boolean) => {
    const nextWidths: Record<string, boolean> = {};
    zeroWidthGroups.forEach((g) => {
      nextWidths[`zero-${g.width}`] = expand;
    });
    oneWidthGroups.forEach((g) => {
      nextWidths[`one-${g.width}`] = expand;
    });
    allWidthGroups.forEach((g) => {
      nextWidths[`all-${g.width}`] = expand;
    });
    setExpandedWidthKeys(nextWidths);
    if (!expand) {
      setExpandedPatternKeys({});
    }
  };

  const renderWidthDropdownGroup = (
    sectionPrefix: 'zero' | 'one' | 'all',
    wGroup: WidthStockGroup,
    tone: 'red' | 'yellow' | 'mixed'
  ) => {
    const wKey = `${sectionPrefix}-${wGroup.width}`;
    const isExpanded = expandedWidthKeys[wKey] ?? false;

    const headerToneClass =
      tone === 'red'
        ? 'bg-rose-50/90 hover:bg-rose-100/80 text-rose-950'
        : tone === 'yellow'
        ? 'bg-amber-50/90 hover:bg-amber-100/80 text-amber-950'
        : wGroup.zeroFullRollCount > 0
        ? 'bg-rose-50/50 hover:bg-rose-50/80 text-slate-900'
        : wGroup.oneFullRollCount > 0
        ? 'bg-amber-50/50 hover:bg-amber-50/80 text-slate-900'
        : 'bg-slate-50/90 hover:bg-slate-100/90 text-slate-900';

    const dotClass =
      tone === 'red'
        ? 'bg-rose-600'
        : tone === 'yellow'
        ? 'bg-amber-500'
        : wGroup.zeroFullRollCount > 0
        ? 'bg-rose-600'
        : wGroup.oneFullRollCount > 0
        ? 'bg-amber-500'
        : 'bg-emerald-500';

    return (
      <div key={wKey}>
        {/* Level 1: หน้ากว้าง (Width Dropdown) */}
        <button
          type="button"
          onClick={() => toggleWidthDropdown(sectionPrefix, wGroup.width)}
          aria-expanded={isExpanded}
          className={`w-full px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-left transition-colors cursor-pointer min-h-[48px] ${headerToneClass}`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="shrink-0 opacity-70 mt-0.5">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${dotClass}`} aria-hidden="true" />
            <div className="min-w-0 flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono tabular-nums font-extrabold text-sm text-slate-900 whitespace-nowrap">
                  หน้ากว้าง {wGroup.width} มม.
                </span>
                {WIDTH_SPECIFICATIONS[wGroup.width] && (
                  <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                    ({WIDTH_SPECIFICATIONS[wGroup.width]})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <span className="text-slate-500 font-medium shrink-0">ท้อง:</span>
                {wGroup.patterns.map((p) => {
                  const pStyle = getPatternStyle(p.pattern);
                  return (
                    <span
                      key={p.key}
                      className="inline-flex items-center gap-1 font-bold text-slate-800 whitespace-nowrap"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${pStyle.dotClass}`}
                        aria-hidden="true"
                      />
                      <span>{p.pattern}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-start sm:items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto shrink-0 pl-7 sm:pl-0 font-mono tabular-nums text-xs">
            <span className="text-slate-700 leading-snug">
              <span className="whitespace-nowrap">
                ลูกเต็ม{' '}
                <strong
                  className={
                    wGroup.zeroFullRollCount > 0 && tone !== 'yellow'
                      ? 'text-rose-700'
                      : wGroup.oneFullRollCount > 0
                      ? 'text-amber-800'
                      : 'text-emerald-700'
                  }
                >
                  {wGroup.fullRollCount}
                </strong>{' '}
                / เศษ <strong>{wGroup.partialRollCount}</strong>
              </span>
              {wGroup.reverseOnlyCount > 0 && (
                <span className="ml-1.5 font-sans font-semibold text-amber-800 whitespace-nowrap">
                  (ลูกเก่า/มีปัญหา <strong className="font-mono">{wGroup.reverseOnlyCount}</strong>)
                </span>
              )}
            </span>
            <div className="text-right whitespace-nowrap shrink-0 ml-auto sm:ml-0">
              <div
                className="font-bold text-sm text-slate-900"
                title="ยอดเมตรของท้องนั้นที่ใช้ได้ (ไม่รวมลูกเก่า/มีปัญหา)"
              >
                {formatMeters(wGroup.usableRemainingMeters)}{' '}
                <span className="font-sans font-normal text-xs text-slate-500">ม.</span>
              </div>
              {wGroup.reverseOnlyMeters > 0 && (
                <div
                  className="text-[11px] font-semibold text-amber-800 tabular-nums"
                  title="ยอดเมตรของลูกเก่า/มีปัญหา"
                >
                  ({formatMeters(wGroup.reverseOnlyMeters)}{' '}
                  <span className="font-sans font-normal">ม.</span>)
                </div>
              )}
            </div>
          </div>
        </button>

        {/* Level 2: ท้องฟอยล์ (Patterns inside this Width) */}
        {isExpanded && (
          <div className="divide-y divide-slate-200 border-t border-slate-200 bg-white">
            {wGroup.patterns.map((spec) => {
              const pKey = `${sectionPrefix}-${spec.key}`;
              const isPatternExpanded = expandedPatternKeys[pKey] ?? false;
              const pStyle = getPatternStyle(spec.pattern);
              const specRolls = rollsBySpecKey.get(spec.key) || [];
              const isSelectedInTable = activeSpecKey === spec.key;

              const isZero = spec.fullRollCount === 0;
              const isOne = spec.fullRollCount === 1;

              const patternRowTone = isSelectedInTable
                ? 'bg-amber-100/70'
                : isZero
                ? 'bg-rose-50/60 hover:bg-rose-50'
                : isOne
                ? 'bg-amber-50/60 hover:bg-amber-50'
                : 'bg-white hover:bg-slate-50';

              return (
                <div key={pKey}>
                  <div
                    onClick={() => togglePatternDropdown(sectionPrefix, spec.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePatternDropdown(sectionPrefix, spec.key);
                      }
                    }}
                    aria-expanded={isPatternExpanded}
                    className={`pl-8 sm:pl-12 pr-4 sm:pr-6 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 cursor-pointer transition-colors ${patternRowTone}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-slate-400 shrink-0">
                        {isPatternExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <span
                        className={`w-3 h-3 rounded-full shrink-0 ${pStyle.dotClass}`}
                        aria-hidden="true"
                      />
                      <span className="font-bold text-sm text-slate-900 whitespace-nowrap">
                        ท้อง{spec.pattern}
                      </span>

                      {isZero ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-rose-300 bg-rose-100 text-rose-900 text-[11px] font-bold whitespace-nowrap shrink-0">
                          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>ลูกเต็มเหลือ 0 (มีเศษ {spec.partialRollCount} ม้วน)</span>
                        </span>
                      ) : isOne ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-300 bg-amber-100 text-amber-950 text-[11px] font-bold whitespace-nowrap shrink-0">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>ลูกเต็มเหลือ 1 ลูก</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-semibold whitespace-nowrap shrink-0">
                          <span>พร้อมใช้ ({spec.fullRollCount} ลูกเต็ม)</span>
                        </span>
                      )}

                      {spec.reverseOnlyCount > 0 && (
                        <span className="text-[11px] text-amber-800 font-semibold whitespace-nowrap">
                          · ลูกเก่า/มีปัญหา {spec.reverseOnlyCount} ลูก
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pl-5 lg:pl-0 shrink-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-mono tabular-nums">
                        <span
                          className="whitespace-nowrap"
                          title="ยอดเมตรของท้องนั้นที่ใช้ได้ (ไม่รวมลูกเก่า/มีปัญหา)"
                        >
                          <span className="font-sans text-slate-500 mr-1">ใช้ได้:</span>
                          <strong className="text-slate-900 text-sm">
                            {formatMeters(spec.usableRemainingMeters)}
                          </strong>{' '}
                          <span className="font-sans text-slate-500">ม.</span>
                        </span>

                        {spec.reverseOnlyMeters > 0 && (
                          <span
                            className="whitespace-nowrap font-mono text-[11px] font-semibold text-amber-800"
                            title="ยอดเมตรของลูกเก่า/มีปัญหา"
                          >
                            ({formatMeters(spec.reverseOnlyMeters)}{' '}
                            <span className="font-sans font-normal">ม.</span>)
                          </span>
                        )}

                        {spec.reservedMeters > 0 && (
                          <span className="whitespace-nowrap text-amber-800">
                            <span className="font-sans text-slate-500 mr-1">จอง SO:</span>
                            <strong>{formatMeters(spec.reservedMeters)}</strong> ·{' '}
                            <span className="font-sans text-slate-500 mr-1">สุทธิ:</span>
                            <strong className="text-emerald-700">
                              {formatMeters(spec.netAvailableMeters)}
                            </strong>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSpec(spec.width, spec.pattern);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-slate-300 bg-white hover:bg-amber-50 hover:border-amber-400 text-slate-800 cursor-pointer whitespace-nowrap min-h-[32px]"
                        title="กรองตารางด้านหลังให้แสดงม้วนของสเปกนี้"
                      >
                        <Filter className="w-3 h-3 shrink-0" />
                        <span>ดูในตาราง</span>
                      </button>
                    </div>
                  </div>

                  {/* Level 3: รายละเอียดม้วนในท้องฟอยล์นั้นเมื่อกดเปิดดร็อปดาวน์ */}
                  {isPatternExpanded && (
                    <div className="pl-12 sm:pl-16 pr-4 sm:pr-6 py-2.5 bg-slate-50/70 border-t border-slate-200/80 divide-y divide-slate-200 text-xs">
                      {specRolls.map((r) => {
                        const rReserved = reservedMetersOfRoll(records, r.id);
                        const isFull =
                          !r.isReverseSideOnly && isRollUnused(r) && rReserved === 0;

                        return (
                          <div
                            key={r.id}
                            className="py-1.5 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <span className="font-mono tabular-nums font-bold text-slate-900">
                                LOT.{r.lotNumber} #{r.rollNumber}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                  isFull
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {r.isReverseSideOnly
                                  ? 'ลูกเก่า/มีปัญหา (ใช้อีกด้าน)'
                                  : isFull
                                  ? 'ม้วนเต็ม'
                                  : 'เศษม้วน / ใช้งาน'}
                              </span>
                              {rReserved > 0 && (
                                <span className="font-mono tabular-nums text-[11px] text-amber-800 font-semibold">
                                  จอง SO {formatMeters(rReserved)} ม.
                                </span>
                              )}
                            </div>

                            <span
                              className={`font-mono tabular-nums font-bold ${
                                r.remainingMeters <= 50
                                  ? 'text-rose-700'
                                  : r.remainingMeters <= 200
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {formatMeters(r.remainingMeters)} ม.
                            </span>
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
  };

  const alertTotalCount = zeroSummaries.length + oneSummaries.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="foil-stock-alert-modal-title"
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-4xl w-full max-h-[88dvh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="foil-stock-alert-modal-title"
              className="text-base sm:text-lg font-bold text-slate-900"
            >
              แจ้งเตือนสต๊อก (ฟอยล์ลูกเต็มเหลือ 0 / เหลือ 1)
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
              <span>
                ลูกเต็มเหลือ 0 (แดง){' '}
                <strong className="font-mono tabular-nums text-rose-700">
                  {zeroSummaries.length}
                </strong>{' '}
                สเปก
              </span>
              <span aria-hidden="true">·</span>
              <span>
                ลูกเต็มเหลือ 1 (เหลือง){' '}
                <strong className="font-mono tabular-nums text-amber-800">
                  {oneSummaries.length}
                </strong>{' '}
                สเปก
              </span>
              <span aria-hidden="true">·</span>
              <span>
                คงเหลือทั้งคลัง{' '}
                <strong className="font-mono tabular-nums text-emerald-700">
                  {formatMeters(totalRemainingAll)}
                </strong>{' '}
                ม.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
            aria-label="ปิดหน้าต่างแจ้งเตือนสต๊อก"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Expand/Collapse All */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="ตัวกรองระดับแจ้งเตือนสต๊อก"
            className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              onClick={() => setFilterMode('alerts')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filterMode === 'alerts'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              แจ้งเตือนทั้งหมด ({alertTotalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('zero')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filterMode === 'zero'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-800 hover:bg-rose-50'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  filterMode === 'zero' ? 'bg-white' : 'bg-rose-600'
                }`}
              />
              <span>ลูกเต็มเหลือ 0 ({zeroSummaries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('one')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filterMode === 'one'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'text-amber-900 hover:bg-amber-50'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  filterMode === 'one' ? 'bg-slate-950' : 'bg-amber-500'
                }`}
              />
              <span>ลูกเต็มเหลือ 1 ({oneSummaries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทุกหน้ากว้าง · ท้อง ({summaries.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleExpandAll(true)}
              className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              เปิดหน้ากว้างทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => handleExpandAll(false)}
              className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              ปิดทั้งหมด
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white divide-y divide-slate-200">
          {filterMode === 'all' ? (
            allWidthGroups.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                ไม่มีรายการสต๊อกฟอยล์ที่ใช้งานอยู่
              </div>
            ) : (
              allWidthGroups.map((wg) => renderWidthDropdownGroup('all', wg, 'mixed'))
            )
          ) : (
            <>
              {/* โทนสีแดง: ลูกเต็มเหลือ 0 ลูก */}
              {(filterMode === 'alerts' || filterMode === 'zero') && (
                <div>
                  <div className="px-4 sm:px-6 py-2.5 bg-rose-100/90 border-b border-rose-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-rose-950">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
                      <span>ฟอยล์ลูกเต็มเหลือ 0 ลูก (หมดลูกเต็ม · มีแต่เศษ)</span>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-rose-800 whitespace-nowrap">
                      {zeroSummaries.length} สเปก
                    </span>
                  </div>

                  {zeroWidthGroups.length === 0 ? (
                    <div className="px-6 py-4 text-xs text-emerald-800 bg-emerald-50/50 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>ไม่มีรายการที่ลูกเต็มเหลือ 0 ลูก</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-rose-200/80">
                      {zeroWidthGroups.map((wg) =>
                        renderWidthDropdownGroup('zero', wg, 'red')
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* โทนสีเหลือง: ลูกเต็มเหลือ 1 ลูก */}
              {(filterMode === 'alerts' || filterMode === 'one') && (
                <div>
                  <div className="px-4 sm:px-6 py-2.5 bg-amber-100/90 border-b border-amber-300/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-950">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>ฟอยล์ลูกเต็มเหลือ 1 ลูก (เหลือน้อย · ควรเตรียมสั่ง)</span>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-amber-900 whitespace-nowrap">
                      {oneSummaries.length} สเปก
                    </span>
                  </div>

                  {oneWidthGroups.length === 0 ? (
                    <div className="px-6 py-4 text-xs text-emerald-800 bg-emerald-50/50 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>ไม่มีรายการที่ลูกเต็มเหลือ 1 ลูก</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-amber-200/80">
                      {oneWidthGroups.map((wg) =>
                        renderWidthDropdownGroup('one', wg, 'yellow')
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
          <span>
            กดที่หน้ากว้างเพื่อเปิด-ปิดดร็อปดาวน์ดูท้องฟอยล์ที่หมด/เหลือน้อย และกด &ldquo;ดูในตาราง&rdquo; เพื่อกรองม้วนจริง
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
