'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { useDashboardWorkspace } from './useDashboardWorkspace';

type Props = {
  model: Pick<
    ReturnType<typeof useDashboardWorkspace>,
    'daySelectors' | 'selectedDayOffset' | 'setSelectedDayOffset' | 'activeDashboardPillRef'
  >;
};
export default function DashboardDateNavigation({ model }: Props) {
  const { daySelectors, selectedDayOffset, setSelectedDayOffset, activeDashboardPillRef } = model;

  return (
    <>
      {daySelectors.length > 0 && (
        <div
          className="mx-auto flex max-w-full items-center gap-1.5 sm:gap-2 rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card"
          aria-label="Meal plan dates"
        >
          <button
            type="button"
            onClick={() => {
              const currentIndex = daySelectors.findIndex((item) => item.offset === selectedDayOffset);
              if (currentIndex > 0) setSelectedDayOffset(daySelectors[currentIndex - 1].offset);
            }}
            disabled={daySelectors.findIndex((item) => item.offset === selectedDayOffset) === 0}
            className="flex h-10 w-8 sm:h-12 sm:w-10 shrink-0 items-center justify-center text-brand-muted hover:text-brand-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl sm:rounded-2xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-20"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth">
            {daySelectors.map((item) => {
              const isSelected = selectedDayOffset === item.offset;
              return (
                <button
                  key={item.offset}
                  ref={isSelected ? activeDashboardPillRef : undefined}
                  onClick={() => setSelectedDayOffset(item.offset)}
                  aria-pressed={isSelected}
                  className={`flex min-w-[66px] sm:min-w-[76px] flex-1 snap-center flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-2 sm:px-4 py-2 sm:py-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${
                    isSelected
                      ? 'border-transparent bg-brand-accent text-black font-extrabold shadow-md shadow-brand-accent/20'
                      : item.isPast
                        ? 'border-transparent bg-black/[0.04] text-slate-400 hover:bg-black/[0.07] hover:text-slate-600 dark:bg-white/[0.03] dark:text-zinc-500 dark:hover:bg-white/[0.07] dark:hover:text-zinc-300'
                        : 'border-transparent bg-transparent text-brand-muted hover:bg-brand-bgAlt/60 hover:text-brand-text'
                  }`}
                >
                  <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-[0.14em]">
                    {item.dayLabel}
                    {item.isToday && !isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-green" title="Today" />
                    )}
                  </span>
                  <span className="mt-0.5 sm:mt-1 font-display text-lg sm:text-xl font-black leading-none">
                    {item.dateLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const currentIndex = daySelectors.findIndex((item) => item.offset === selectedDayOffset);
              if (currentIndex >= 0 && currentIndex < daySelectors.length - 1) {
                setSelectedDayOffset(daySelectors[currentIndex + 1].offset);
              }
            }}
            disabled={daySelectors.findIndex((item) => item.offset === selectedDayOffset) === daySelectors.length - 1}
            className="flex h-10 w-8 sm:h-12 sm:w-10 shrink-0 items-center justify-center text-brand-muted hover:text-brand-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl sm:rounded-2xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-20"
            aria-label="Next day"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
