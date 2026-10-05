import React, { useEffect, useRef, useState } from 'react';

export interface KpiSlideCard {
  id: string;
  label: string;
  value: string;
  unit?: string;
  /** tailwind classes for icon box e.g. bg-amber-50 text-amber-600 */
  iconClass?: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  valueClass?: string;
}

interface KpiSlideRowProps {
  title?: string;
  cards: KpiSlideCard[];
  /** wider cards on mobile */
  cardWidthClass?: string;
}

/** แถวการ์ด KPI เลื่อนแนวนอน (snap) — ใช้บนมือถือไม่รกจอ */
export const KpiSlideRow: React.FC<KpiSlideRowProps> = ({
  title,
  cards,
  cardWidthClass = 'w-[72vw] max-w-[260px] sm:w-[200px]',
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || cards.length === 0) return;
    const onScroll = () => {
      const cardW = el.scrollWidth / cards.length;
      const idx = Math.round(el.scrollLeft / Math.max(cardW, 1));
      setActive(Math.min(cards.length - 1, Math.max(0, idx)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [cards.length]);

  if (cards.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {title && (
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            {title}
          </span>
          <span className="text-[10px] text-slate-400 sm:hidden">เลื่อนดู →</span>
        </div>
      )}
      <div
        ref={scrollerRef}
        className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <div
            key={card.id}
            className={`snap-center shrink-0 ${cardWidthClass} bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col min-h-[108px]`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">
                {card.label}
              </span>
              {card.icon && (
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    card.iconClass || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {card.icon}
                </div>
              )}
            </div>
            <div
              className={`mt-2 text-xl sm:text-2xl font-bold font-mono tracking-tight ${
                card.valueClass || 'text-slate-900'
              }`}
            >
              {card.value}
              {card.unit ? (
                <span className="text-xs font-normal text-slate-400 ml-1">{card.unit}</span>
              ) : null}
            </div>
            {card.footer && <div className="mt-auto pt-2 text-[11px] text-slate-500">{card.footer}</div>}
          </div>
        ))}
      </div>
      {cards.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {cards.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-label={`การ์ด ${i + 1}`}
              onClick={() => {
                const el = scrollerRef.current;
                if (!el) return;
                const cardW = el.scrollWidth / cards.length;
                el.scrollTo({ left: cardW * i, behavior: 'smooth' });
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                active === i ? 'w-4 bg-amber-500' : 'w-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
