'use client';

import { formatManilaDate } from '@/lib/manila-date';

import type { useMealActivityCalendarModel } from './useMealActivityCalendarModel';
type Model = Extract<ReturnType<typeof useMealActivityCalendarModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'yearScrollRef'
    | 'weeks'
    | 'selectedDateKey'
    | 'todayCellRef'
    | 'onSelectDateKey'
    | 'setHoveredCell'
    | 'getCellColor'
    | 'monthLabels'
  >;
};
export default function YearlyActivityGrid({ model }: SectionProps) {
  const {
    yearScrollRef,
    weeks,
    selectedDateKey,
    todayCellRef,
    onSelectDateKey,
    setHoveredCell,
    getCellColor,
    monthLabels,
  } = model;

  return (
    <>
      <div ref={yearScrollRef} aria-label="Year activity calendar" className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="inline-block min-w-full">
          {/* Grid Container */}
          <div className="flex gap-1.5">
            {/* Day of Week Axis (Sun, Mon, Tue, Wed, Thu, Fri, Sat) */}
            <div className="flex w-7 sm:w-8 flex-shrink-0 flex-col justify-between pr-2 text-[9px] font-mono text-brand-muted dark:text-white/30 select-none py-0.5">
              <span>Sun</span>
              <span>Tue</span>
              <span>Thu</span>
              <span>Sat</span>
            </div>

            {/* Weeks Columns */}
            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="flex flex-col gap-1">
                  {week.map((cell) => {
                    if (cell.isOutOfBounds) {
                      return (
                        <div
                          key={cell.dateKey}
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 pointer-events-none"
                          aria-hidden="true"
                        />
                      );
                    }

                    const isSelected = selectedDateKey === cell.dateKey;
                    return (
                      <button
                        key={cell.dateKey}
                        ref={cell.isToday ? todayCellRef : undefined}
                        aria-current={cell.isToday ? 'date' : undefined}
                        type="button"
                        disabled={cell.isFuture}
                        onClick={() => onSelectDateKey(cell.dateKey)}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onFocus={() => setHoveredCell(cell)}
                        onBlur={() => setHoveredCell(null)}
                        title={
                          cell.isFuture
                            ? `${formatManilaDate(cell.date, { month: 'short', day: 'numeric' })}: Upcoming (Locked)`
                            : `${cell.dateKey}: ${cell.mealCount} meals logged`
                        }
                        aria-label={
                          cell.isFuture
                            ? `${cell.dateKey}: Upcoming (Locked)`
                            : `${cell.dateKey}: ${cell.mealCount} meals logged`
                        }
                        aria-pressed={isSelected}
                        className={`relative h-3.5 w-3.5 rounded-[4px] border transition-all duration-150 outline-none sm:h-4 sm:w-4 ${getCellColor(
                          cell
                        )} ${
                          isSelected
                            ? 'ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface dark:ring-brand-accent dark:ring-offset-[#0c1511] z-10 scale-110'
                            : ''
                        } ${!cell.isFuture ? 'focus-visible:ring-2 focus-visible:ring-brand-green hover:scale-110' : ''}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Month Labels along the bottom */}
          <div className="mt-2 flex gap-1.5 h-4 select-none">
            {/* Spacer matching Day of Week Axis */}
            <div className="w-7 sm:w-8 flex-shrink-0 pr-2" aria-hidden="true" />

            {/* Week-aligned month label slots */}
            <div className="flex gap-1 relative">
              {weeks.map((_, weekIndex) => {
                const month = monthLabels.find((m) => m.weekIndex === weekIndex);
                return (
                  <div key={`m-col-${weekIndex}`} className="relative w-3.5 sm:w-4 flex-shrink-0">
                    {month && (
                      <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] font-mono font-bold text-brand-muted dark:text-white/60">
                        {month.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
