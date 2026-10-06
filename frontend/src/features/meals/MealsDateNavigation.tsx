'use client';

import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { useMealsPage } from './useMealsPage';

type Props = {
  model: Pick<
    ReturnType<typeof useMealsPage>,
    | 'activeTab'
    | 'isLoading'
    | 'displayedPlanDays'
    | 'selectedPlanDay'
    | 'setSelectedPlanDateKey'
    | 'selectedPlanDayIndex'
    | 'activePlanPillRef'
  >;
};
export default function MealsDateNavigation({ model }: Props) {
  const {
    activeTab,
    isLoading,
    displayedPlanDays,
    selectedPlanDay,
    setSelectedPlanDateKey,
    selectedPlanDayIndex,
    activePlanPillRef,
  } = model;

  return (
    <>
      {activeTab === 'plan' && !isLoading && displayedPlanDays.length > 0 && selectedPlanDay && (
        <section
          className="mx-auto flex max-w-full items-center gap-1.5 sm:gap-2 rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card"
          aria-label="Select a meal-plan day"
        >
          <button
            type="button"
            onClick={() =>
              setSelectedPlanDateKey(displayedPlanDays[selectedPlanDayIndex - 1]?.dateKey ?? selectedPlanDay.dateKey)
            }
            disabled={selectedPlanDayIndex === 0}
            className="flex h-10 w-8 sm:h-12 sm:w-10 shrink-0 items-center justify-center text-brand-muted hover:text-brand-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl sm:rounded-2xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-20"
            aria-label="Previous plan day"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth">
            {displayedPlanDays.map((day) => {
              const isSelected = day.dateKey === selectedPlanDay.dateKey;
              const parsedDate = manilaDateFromKey(day.dateKey);
              const todayKey = getManilaDateKey(new Date());
              const isToday = day.dateKey === todayKey;
              const isPast = day.dateKey < todayKey;
              const dayLabel = formatManilaDate(parsedDate, { weekday: 'short' });
              const dateLabel = formatManilaDate(parsedDate, { day: 'numeric' });

              return (
                <button
                  key={day.dateKey}
                  ref={isSelected ? activePlanPillRef : undefined}
                  type="button"
                  onClick={() => setSelectedPlanDateKey(day.dateKey)}
                  aria-pressed={isSelected}
                  className={`flex min-w-[66px] sm:min-w-[76px] flex-1 snap-center flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-2 sm:px-4 py-2 sm:py-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${
                    isSelected
                      ? 'border-transparent bg-brand-accent text-black font-extrabold shadow-md shadow-brand-accent/20'
                      : isPast
                        ? 'border-transparent bg-black/[0.04] text-slate-400 hover:bg-black/[0.07] hover:text-slate-600 dark:bg-white/[0.03] dark:text-zinc-500 dark:hover:bg-white/[0.07] dark:hover:text-zinc-300'
                        : 'border-transparent bg-transparent text-brand-muted hover:bg-brand-bgAlt/60 hover:text-brand-text'
                  }`}
                >
                  <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-[0.14em]">
                    {dayLabel}
                    {isToday && !isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-green" title="Today" />
                    )}
                  </span>
                  <span className="mt-0.5 sm:mt-1 font-display text-lg sm:text-xl font-black leading-none">
                    {dateLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedPlanDateKey(displayedPlanDays[selectedPlanDayIndex + 1]?.dateKey ?? selectedPlanDay.dateKey)
            }
            disabled={selectedPlanDayIndex === displayedPlanDays.length - 1}
            className="flex h-10 w-8 sm:h-12 sm:w-10 shrink-0 items-center justify-center text-brand-muted hover:text-brand-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl sm:rounded-2xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-20"
            aria-label="Next plan day"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </section>
      )}
    </>
  );
}
