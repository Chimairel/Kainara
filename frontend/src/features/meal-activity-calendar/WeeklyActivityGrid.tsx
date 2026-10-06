'use client';

import { formatManilaDate } from '@/lib/manila-date';

import type { useMealActivityCalendarModel } from './useMealActivityCalendarModel';
type Model = Extract<ReturnType<typeof useMealActivityCalendarModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<Model, 'weeks' | 'selectedDateKey' | 'onSelectDateKey' | 'setHoveredCell' | 'getCellColor'>;
};
export default function WeeklyActivityGrid({ model }: SectionProps) {
  const { weeks, selectedDateKey, onSelectDateKey, setHoveredCell, getCellColor } = model;

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-3 py-2">
        {weeks[0]?.map((cell) => {
          const isSelected = selectedDateKey === cell.dateKey;
          const weekdayName = formatManilaDate(cell.date, { weekday: 'short' });
          const dateNum = formatManilaDate(cell.date, { month: 'numeric', day: 'numeric' });
          return (
            <button
              key={cell.dateKey}
              type="button"
              disabled={cell.isFuture}
              onClick={() => onSelectDateKey(cell.dateKey)}
              onMouseEnter={() => setHoveredCell(cell)}
              onMouseLeave={() => setHoveredCell(null)}
              onFocus={() => setHoveredCell(cell)}
              onBlur={() => setHoveredCell(null)}
              aria-label={`${cell.dateKey}: ${cell.mealCount} meals logged`}
              aria-pressed={isSelected}
              className={`group flex flex-col items-center gap-1.5 rounded-2xl border p-2 sm:p-3 transition-all duration-150 text-center outline-none ${
                isSelected
                  ? 'border-brand-green bg-brand-green/5 ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface dark:border-brand-green dark:bg-emerald-500/10 dark:ring-brand-green dark:ring-offset-[#0e271f]'
                  : 'border-brand-border/60 bg-brand-bgAlt/30 hover:border-brand-border hover:bg-brand-bgAlt/60 dark:border-[#173e33] dark:bg-[#0e271f]/40 dark:hover:border-emerald-500/40 dark:hover:bg-[#13382c]'
              }`}
            >
              <span className="text-[11px] sm:text-xs font-black uppercase text-brand-muted dark:text-white/40">
                {weekdayName}
              </span>
              <span className="font-mono text-[10px] sm:text-[11px] font-bold text-brand-text dark:text-white/80">
                {dateNum}
              </span>
              <div
                className={`mt-1 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition-all duration-150 ${getCellColor(
                  cell
                )}`}
              >
                {cell.mealCount > 0 ? (
                  <span className="font-mono text-xs sm:text-sm font-black">{cell.mealCount}</span>
                ) : (
                  <span className="text-[10px] opacity-40">0</span>
                )}
              </div>
              <span className="mt-0.5 font-mono text-[8.5px] sm:text-[10px] font-bold text-brand-muted dark:text-white/40 truncate w-full">
                {cell.mealCount > 0 ? (
                  <>
                    <span>{Math.round(cell.totalCalories)}</span>
                    <span className="hidden sm:inline"> kcal</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
