import React, { useState, useMemo } from 'react';
import { PuSandwichCutRecord } from '../types';
import {
  groupPuSandwichByThaiColors,
  PrimaryColorGroup,
  SubColorVariantGroup,
  ThicknessGroup,
} from '../utils/thaiColorCategorizer';
import { formatMeters } from '../utils/formatters';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  Scale,
  FileText,
  AlertTriangle,
  Factory,
  ShieldCheck,
  Tag,
  Filter,
} from 'lucide-react';

interface PuSandwichColorBreakdownProps {
  records: PuSandwichCutRecord[];
  className?: string;
  defaultExpanded?: boolean;
}

export const PuSandwichColorBreakdown: React.FC<PuSandwichColorBreakdownProps> = ({
  records,
  className = '',
  defaultExpanded = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<'all' | 'เหล็กนอก' | 'เหล็กBlue Scope' | 'อื่นๆ'>('all');
  const [expandedColors, setExpandedColors] = useState<Record<string, boolean>>({});

  // Group all records by Thai base color
  const allGroups = useMemo(() => groupPuSandwichByThaiColors(records), [records]);

  // Filter groups according to search & origin
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return allGroups
      .map((group) => {
        // Filter sub-variants
        const filteredSubs = group.subVariants
          .map((sub) => {
            // Origin check
            const matchesOrigin =
              selectedOrigin === 'all' || sub.steelOrigins.includes(selectedOrigin);
            if (!matchesOrigin) return null;

            // Filter thicknesses if origin is selected
            const matchingThicknesses =
              selectedOrigin === 'all'
                ? sub.thicknesses
                : sub.thicknesses.filter((t) => t.steelOrigin === selectedOrigin);

            if (matchingThicknesses.length === 0) return null;

            // Search query matches group baseColor, subColor, steelOrigin, or thickness
            if (q) {
              const matchesText =
                group.baseColor.toLowerCase().includes(q) ||
                group.displayLabel.toLowerCase().includes(q) ||
                sub.subColor.toLowerCase().includes(q) ||
                sub.steelOrigins.some((orig) => orig.toLowerCase().includes(q)) ||
                matchingThicknesses.some((t) => t.thickness.toLowerCase().includes(q));

              if (!matchesText) return null;
            }

            const subTotalLength = matchingThicknesses.reduce((acc, t) => acc + t.totalLengthMeters, 0);
            const subTotalWeight = matchingThicknesses.reduce((acc, t) => acc + t.totalWeightKg, 0);
            const subTotalNgKg = matchingThicknesses.reduce((acc, t) => acc + t.totalNgKg, 0);
            const subTotalNgM = matchingThicknesses.reduce((acc, t) => acc + t.totalNgMeters, 0);
            const subTotalCount = matchingThicknesses.reduce((acc, t) => acc + t.count, 0);

            return {
              ...sub,
              count: subTotalCount,
              totalLengthMeters: Math.round(subTotalLength * 10) / 10,
              totalWeightKg: Math.round(subTotalWeight * 100) / 100,
              totalNgKg: Math.round(subTotalNgKg * 100) / 100,
              totalNgMeters: Math.round(subTotalNgM * 10) / 10,
              thicknesses: matchingThicknesses,
            };
          })
          .filter(Boolean) as SubColorVariantGroup[];

        if (filteredSubs.length === 0) return null;

        // Recompute group aggregates based on filtered sub-variants
        const totalCount = filteredSubs.reduce((acc, s) => acc + s.count, 0);
        const totalLength = filteredSubs.reduce((acc, s) => acc + s.totalLengthMeters, 0);
        const totalWeight = filteredSubs.reduce((acc, s) => acc + s.totalWeightKg, 0);
        const totalNgKg = filteredSubs.reduce((acc, s) => acc + s.totalNgKg, 0);
        const totalNgMeters = filteredSubs.reduce((acc, s) => acc + s.totalNgMeters, 0);
        const ngPercent = totalWeight > 0 ? (totalNgKg / totalWeight) * 100 : 0;

        return {
          ...group,
          count: totalCount,
          totalLengthMeters: Math.round(totalLength * 10) / 10,
          totalWeightKg: Math.round(totalWeight * 100) / 100,
          totalTons: Math.round((totalWeight / 1000) * 100) / 100,
          totalNgKg: Math.round(totalNgKg * 100) / 100,
          totalNgMeters: Math.round(totalNgMeters * 10) / 10,
          ngPercent: Math.round(ngPercent * 100) / 100,
          subVariants: filteredSubs,
        } as PrimaryColorGroup;
      })
      .filter(Boolean) as PrimaryColorGroup[];
  }, [allGroups, searchQuery, selectedOrigin]);

  const toggleExpand = (baseColor: string) => {
    setExpandedColors((prev) => ({
      ...prev,
      [baseColor]: prev[baseColor] !== undefined ? !prev[baseColor] : !defaultExpanded,
    }));
  };

  const isColorExpanded = (baseColor: string) => {
    if (expandedColors[baseColor] !== undefined) {
      return expandedColors[baseColor];
    }
    return defaultExpanded;
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredGroups.forEach((g) => {
      next[g.baseColor] = true;
    });
    setExpandedColors(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    filteredGroups.forEach((g) => {
      next[g.baseColor] = false;
    });
    setExpandedColors(next);
  };

  // Grand summary for current filtered view
  const grandTotalMeters = useMemo(
    () => filteredGroups.reduce((acc, g) => acc + g.totalLengthMeters, 0),
    [filteredGroups]
  );
  const grandTotalWeight = useMemo(
    () => filteredGroups.reduce((acc, g) => acc + g.totalWeightKg, 0),
    [filteredGroups]
  );
  const grandTotalCount = useMemo(
    () => filteredGroups.reduce((acc, g) => acc + g.count, 0),
    [filteredGroups]
  );

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden ${className}`}>
      {/* Component Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-slate-950 uppercase">
                แยกตามสีภาษาไทย
              </span>
              <span className="text-xs text-emerald-200/90 font-medium hidden sm:inline">
                สีหลัก · สีย่อยคอยล์ · ความหนา
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
              สรุปคอยล์แยกตามสีหลัก สีย่อย และความหนา
            </h3>
          </div>
        </div>

        {/* Global Expand / Collapse All */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={expandAll}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
          >
            กางทั้งหมด
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
          >
            หุบทั้งหมด
          </button>
        </div>
      </div>

      {/* Control Toolbar: Quick Color Chips + Search & Origin Filter */}
      <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3">
        {/* Search & Origin Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาสีหลัก, สีย่อย (เช่น ขาว AW, AW/Z.cool), ความหนา 0.35, แหล่งเหล็ก..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                ล้าง
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600 font-medium">แหล่งเหล็ก:</span>
            <select
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value as any)}
              className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-2 outline-none cursor-pointer text-slate-800"
            >
              <option value="all">ทั้งหมด ({records.length} SO)</option>
              <option value="เหล็กนอก">เหล็กนอก</option>
              <option value="เหล็กBlue Scope">เหล็กBlue Scope</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
          </div>
        </div>

        {/* Quick Color Summary Chips */}
        {allGroups.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs scrollbar-thin">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1">สีหลัก:</span>
            {allGroups.map((g) => {
              const isSelected = searchQuery === g.baseColor;
              return (
                <button
                  key={g.baseColor}
                  type="button"
                  onClick={() => setSearchQuery(isSelected ? '' : g.baseColor)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                      : `${g.colorMeta.chipClass} hover:opacity-90`
                  }`}
                  title={`คลิกเพื่อกรองเฉพาะ ${g.displayLabel}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: g.colorMeta.dotColor }}
                  />
                  <span>{g.displayLabel}</span>
                  <span className="text-[10px] opacity-80 font-mono">
                    ({formatMeters(g.totalLengthMeters)} ม.)
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Aggregate Bar */}
      <div className="px-4 py-2 bg-emerald-50/60 border-b border-emerald-100 flex flex-wrap items-center justify-between text-xs text-emerald-950 font-mono">
        <div className="flex items-center gap-2">
          <span>
            รวม <strong>{filteredGroups.length}</strong> กลุ่มสีหลัก
          </span>
          <span className="text-emerald-300">•</span>
          <span>
            ยอดผลิต <strong>{formatMeters(grandTotalMeters)}</strong> เมตร
          </span>
          <span className="text-emerald-300">•</span>
          <span>
            น้ำหนัก <strong>{formatMeters(grandTotalWeight)}</strong> กก. (≈ {(grandTotalWeight / 1000).toFixed(2)} ตัน)
          </span>
        </div>
        <div className="text-[11px] text-emerald-800 font-bold">
          {grandTotalCount} ใบสั่งตัด SO
        </div>
      </div>

      {/* List of Primary Color Groups */}
      <div className="p-3 sm:p-5 space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">ไม่พบข้อมูลสีคอยล์ตามเงื่อนไขที่เลือก</p>
            <p className="text-xs text-slate-400">ลองล้างคำค้นหาหรือเปลี่ยนตัวกรองแหล่งเหล็ก</p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const expanded = isColorExpanded(group.baseColor);

            return (
              <div
                key={group.baseColor}
                className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs transition-all duration-200 hover:border-slate-300 bg-white"
                style={{ borderLeftWidth: '5px', borderLeftColor: group.colorMeta.barColor || '#94a3b8' }}
              >
                {/* 1. Primary Color Card Header (Clickable Compact Accordion) */}
                <div
                  onClick={() => toggleExpand(group.baseColor)}
                  className={`p-2.5 sm:p-3 cursor-pointer flex flex-wrap items-center justify-between gap-2.5 transition-colors ${
                    expanded ? 'bg-slate-100/90 border-b border-slate-200' : 'bg-slate-50/70 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Color Swatch Dot */}
                    <div
                      className="w-7 h-7 rounded-lg border border-black/20 flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: group.colorMeta.dotColor }}
                    >
                      <span className="text-[11px] font-bold text-slate-700/80">
                        {group.baseColor.slice(0, 1)}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                          {group.displayLabel}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold font-mono">
                          {group.subVariants.length} สีย่อย
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          ({group.count} SO)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5 max-w-md sm:max-w-xl">
                        {group.subVariants.map((s) => `${s.subColor}${s.steelOrigins.length > 0 ? ` [${s.steelOrigins.join(', ')}]` : ''}`).join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Summary Metrics & Toggle Arrow */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    {/* Meters (Primary Metric) */}
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block leading-tight">ยอดผลิต</span>
                      <span className="text-sm sm:text-base font-black font-mono text-emerald-800 leading-tight">
                        {formatMeters(group.totalLengthMeters)}{' '}
                        <span className="text-[10px] font-normal text-slate-500">ม.</span>
                      </span>
                    </div>

                    {/* Weight (Secondary Metric) */}
                    <div className="text-right hidden sm:block">
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block leading-tight">น้ำหนัก</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-slate-800 leading-tight">
                        {formatMeters(group.totalWeightKg)}{' '}
                        <span className="text-[9px] font-normal text-slate-400">กก.</span>
                      </span>
                      <span className="text-[9px] text-emerald-700 font-semibold block font-mono leading-none">
                        ≈ {group.totalTons} ตัน
                      </span>
                    </div>

                    {/* NG Rate */}
                    {group.totalNgMeters > 0 && (
                      <div className="text-right hidden md:block">
                        <span className="text-[9px] text-rose-400 uppercase font-semibold block leading-tight">NG</span>
                        <span className="text-xs font-bold font-mono text-rose-600 leading-tight">
                          {formatMeters(group.totalNgMeters)} ม. ({group.ngPercent.toFixed(1)}%)
                        </span>
                      </div>
                    )}

                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* 2. Sub-Variants Breakdown (Inside Expanded Card) */}
                {expanded && (
                  <div className="p-3.5 sm:p-5 space-y-4 bg-white divide-y divide-slate-100">
                    {group.subVariants.map((sub, sIdx) => {
                      return (
                        <div key={sub.subColor} className={sIdx > 0 ? 'pt-4' : ''}>
                          {/* Sub-variant title and badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm sm:text-base text-slate-900 font-sans">
                                {sub.subColor}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {sub.steelOrigins.map((orig) => {
                                  const isBs = orig.includes('Blue Scope');
                                  const isExt = orig.includes('เหล็กนอก');
                                  return (
                                    <span
                                      key={orig}
                                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                                        isBs
                                          ? 'bg-sky-50 text-sky-800 border-sky-300'
                                          : isExt
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                            : 'bg-slate-100 text-slate-700 border-slate-300'
                                      }`}
                                    >
                                      {orig}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-slate-600 font-medium">
                                รวมสีย่อยนี้: <strong className="text-emerald-800">{formatMeters(sub.totalLengthMeters)} ม.</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-600">
                                <strong>{formatMeters(sub.totalWeightKg)} กก.</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">{sub.count} SO</span>
                            </div>
                          </div>

                          {/* Thickness Breakdown Table for this Sub-variant */}
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="py-2 px-3">ความหนา</th>
                                  <th className="py-2 px-3">แหล่งเหล็ก</th>
                                  <th className="py-2 px-3 text-center">จำนวน SO</th>
                                  <th className="py-2 px-3 text-right">ความยาวผลิต (เมตร)</th>
                                  <th className="py-2 px-3 text-right">น้ำหนักใช้ (กก.)</th>
                                  <th className="py-2 px-3 text-right">NG ที่เสีย (ม. / กก.)</th>
                                  <th className="py-2 px-3">เบอร์คอยล์ที่ใช้</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono">
                                {sub.thicknesses.map((th) => (
                                  <tr key={`${th.thickness}-${th.steelOrigin}`} className="hover:bg-slate-50/70 transition-colors">
                                    {/* ความหนา */}
                                    <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-900 font-sans font-bold">
                                        {th.thickness}
                                      </span>
                                    </td>

                                    {/* แหล่งเหล็ก */}
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                          th.steelOrigin.includes('Blue Scope')
                                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                                            : th.steelOrigin.includes('เหล็กนอก')
                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                              : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}
                                      >
                                        {th.steelOrigin}
                                      </span>
                                    </td>

                                    {/* จำนวน SO */}
                                    <td className="py-2 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                                      {th.count} ใบงาน
                                    </td>

                                    {/* ความยาวผลิต (เมตร) */}
                                    <td className="py-2 px-3 text-right font-black text-emerald-800 whitespace-nowrap">
                                      {formatMeters(th.totalLengthMeters)} ม.
                                    </td>

                                    {/* น้ำหนักใช้ (กก.) */}
                                    <td className="py-2 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                      {formatMeters(th.totalWeightKg)} กก.
                                    </td>

                                    {/* NG ที่เสีย */}
                                    <td className="py-2 px-3 text-right whitespace-nowrap">
                                      {th.totalNgMeters > 0 || th.totalNgKg > 0 ? (
                                        <span className="text-rose-600 font-bold">
                                          {formatMeters(th.totalNgMeters)} ม.{' '}
                                          <span className="text-[10px] text-rose-400">
                                            ({formatMeters(th.totalNgKg)} กก.)
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )}
                                    </td>

                                    {/* เบอร์คอยล์ที่ใช้ */}
                                    <td className="py-2 px-3 text-slate-600 font-sans text-[11px]">
                                      {th.coilNumbers.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {th.coilNumbers.slice(0, 4).map((c) => (
                                            <span
                                              key={c}
                                              className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px]"
                                            >
                                              #{c}
                                            </span>
                                          ))}
                                          {th.coilNumbers.length > 4 && (
                                            <span className="text-[10px] text-slate-400 font-mono self-center">
                                              +{th.coilNumbers.length - 4} ม้วน
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
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
          })
        )}
      </div>
    </div>
  );
};
