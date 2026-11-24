import React from 'react';
import { WIDTH_SPECIFICATIONS } from '../types';
import { getPatternStyle } from '../utils/patternStyles';

interface RollIdentityBadgesProps {
  width?: number | string | null;
  pattern?: string | null;
  lotNumber?: string | null;
  rollNumber?: string | null;
  variant?: 'header' | 'card' | 'row';
  showWidthDesc?: boolean;
  isSpecVerified?: boolean;
  hasLotRollConflict?: boolean;
}

export const RollIdentityBadges: React.FC<RollIdentityBadgesProps> = ({
  width,
  pattern,
  lotNumber,
  rollNumber,
  variant = 'card',
  showWidthDesc = false,
  isSpecVerified = true,
  hasLotRollConflict = false,
}) => {
  const numWidth = Number(width);
  const hasWidth = Number.isFinite(numWidth) && numWidth > 0;
  const trimmedPattern = String(pattern || '').trim();
  const hasPattern = trimmedPattern.length > 0;
  const pStyle = hasPattern ? getPatternStyle(trimmedPattern) : null;
  const widthDesc = hasWidth ? WIDTH_SPECIFICATIONS[numWidth] : undefined;

  if (variant === 'header') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-200 border border-sky-400/40 font-mono">
          <span>กว้าง {hasWidth ? `${numWidth} มม.` : '-'}</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-white border border-slate-600">
          {pStyle && <span className={`w-2 h-2 rounded-full shrink-0 ${pStyle.dotClass}`} />}
          <span>ลาย{hasPattern ? trimmedPattern : '-'}</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-amber-400/40 font-mono">
          <span>ล็อต {lotNumber || '-'}</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-mono font-black">
          <span>เบอร์ #{rollNumber || '-'}</span>
        </span>
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono font-bold ${
            hasWidth
              ? 'bg-sky-50 text-sky-900 border-sky-200'
              : 'bg-rose-50 text-rose-700 border-rose-300'
          }`}
          title="หน้ากว้างฟอยล์"
        >
          {hasWidth ? `${numWidth} มม.` : 'ไม่ระบุกว้าง'}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-bold ${
            pStyle ? pStyle.highlightClass : 'bg-rose-50 text-rose-700 border-rose-300'
          }`}
          title="ลายท้องฟอยล์"
        >
          {pStyle && <span className={`w-2 h-2 rounded-full shrink-0 ${pStyle.dotClass}`} />}
          <span>{hasPattern ? `ลาย${trimmedPattern}` : 'ไม่ระบุลาย'}</span>
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono font-bold ${
            hasLotRollConflict
              ? 'bg-rose-100 text-rose-900 border-rose-400'
              : 'bg-slate-900 text-white border-slate-800'
          }`}
          title="เลขล็อต"
        >
          {lotNumber || '-'}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono font-black ${
            hasLotRollConflict
              ? 'bg-rose-100 text-rose-900 border-rose-400'
              : 'bg-amber-100 text-amber-950 border-amber-300'
          }`}
          title="เบอร์ม้วน"
        >
          #{rollNumber || '-'}
        </span>
        {!isSpecVerified && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold"
            title="รายการเก่าที่ยังไม่มีสเปกหน้ากว้าง/ลายบันทึกไว้ในฐานข้อมูล"
          >
            ⚠️ ไม่มีตราสเปกเดิม
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-950 border border-sky-300 px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold shadow-2xs">
        <span className="text-[10px] font-bold text-sky-700">หน้ากว้าง</span>
        <span>{hasWidth ? `${numWidth} มม.` : '-'}</span>
        {showWidthDesc && widthDesc && (
          <span className="font-sans font-semibold text-sky-700">({widthDesc})</span>
        )}
      </span>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-xs font-extrabold shadow-2xs ${
          pStyle ? pStyle.highlightClass : 'bg-white text-slate-700 border-slate-300'
        }`}
      >
        {pStyle && (
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/70 ${pStyle.dotClass}`} />
        )}
        <span>ลาย{hasPattern ? trimmedPattern : '-'}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 bg-black text-white px-2.5 py-1 rounded-lg border border-slate-800 shadow-2xs">
        <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">ล็อต</span>
        <span className="lot-number-display text-sm sm:text-base font-black text-white leading-none">
          {lotNumber || '-'}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 bg-black text-amber-300 px-2.5 py-1 rounded-lg border border-slate-800 shadow-2xs">
        <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">เบอร์</span>
        <span className="lot-number-display text-sm sm:text-base font-black leading-none">
          #{rollNumber || '-'}
        </span>
      </span>
    </div>
  );
};
