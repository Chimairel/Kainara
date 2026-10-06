'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { useMealActivityCalendarModel } from './useMealActivityCalendarModel';
type Model = Extract<ReturnType<typeof useMealActivityCalendarModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<Model, 'renderMonthCard' | 'threeMonthsData' | 'handlePrevMonth' | 'handleNextMonth' | 'canGoNext'>;
};
export default function MonthlyActivityGrid({ model }: SectionProps) {
  const { renderMonthCard, threeMonthsData, handlePrevMonth, handleNextMonth, canGoNext } = model;

  return (
    <>
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex w-full md:w-auto md:min-w-max items-center justify-center gap-2 sm:gap-4 py-2 px-1 mx-auto">
          {/* Previous Month (Left - Hidden on mobile, visible on desktop) */}
          {renderMonthCard(threeMonthsData.prevMonth, false)}

          {/* Left Chevron (<) */}
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            title="Previous month"
            className="flex h-9 w-9 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-brand-text shadow-sm transition-all hover:border-brand-green hover:bg-brand-bgAlt hover:scale-110 active:scale-95 dark:border-[#173e33] dark:bg-[#0e271f] dark:text-emerald-300 dark:hover:border-emerald-500/50 dark:hover:bg-[#13382c]"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Center Month (Active / Focused - Full width on mobile, centered on desktop) */}
          {renderMonthCard(threeMonthsData.centerMonth, true)}

          {/* Right Chevron (>) */}
          <button
            type="button"
            onClick={handleNextMonth}
            disabled={!canGoNext}
            aria-label="Next month"
            title={canGoNext ? 'Next month' : 'Future month is locked'}
            className={`flex h-9 w-9 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full border transition-all ${
              canGoNext
                ? 'border-brand-border bg-brand-surface text-brand-text shadow-sm hover:border-brand-green hover:bg-brand-bgAlt hover:scale-110 active:scale-95 dark:border-[#173e33] dark:bg-[#0e271f] dark:text-emerald-300 dark:hover:border-emerald-500/50 dark:hover:bg-[#13382c]'
                : 'border-brand-border/30 bg-brand-bgAlt/20 text-brand-muted/30 cursor-not-allowed opacity-30 shadow-none dark:border-[#173e33]/50 dark:bg-[#0e271f]/20 dark:text-emerald-400/20 pointer-events-none'
            }`}
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Next Month (Right - Hidden on mobile, visible on desktop) */}
          {renderMonthCard(threeMonthsData.nextMonth, false)}
        </div>
      </div>
    </>
  );
}
