'use client';
import { summarizeMealIntake } from '@/lib/meal-history-summary';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { formatManilaDate, getManilaDateKey } from '@/lib/manila-date';

import { ActivityTimeRange, MonthColumnData, MealActivityCalendarProps, DayCell } from './MealActivityCalendar.shared';
// Calendar arithmetic uses UTC midnight as a date-only representation of a Manila key.
// Local getters would shift the day/week/month for visitors in other timezones.
function calendarDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function useMealActivityCalendarModel({
  logs,
  selectedDateKey,
  onSelectDateKey,
  className = '',
}: MealActivityCalendarProps) {
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>('Year');
  const [hoveredCell, setHoveredCell] = useState<DayCell | null>(null);
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const yearScrollRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (timeRange !== 'Year') return;
    const scroller = yearScrollRef.current;
    const today = todayCellRef.current;
    if (!scroller || !today) return;
    const centerToday = () => {
      const cellBounds = today.getBoundingClientRect();
      const scrollBounds = scroller.getBoundingClientRect();
      scroller.scrollLeft = Math.max(
        0,
        Math.min(
          scroller.scrollWidth - scroller.clientWidth,
          scroller.scrollLeft + cellBounds.left - scrollBounds.left + cellBounds.width / 2 - scroller.clientWidth / 2
        )
      );
    };
    centerToday();
    const observer = new ResizeObserver(centerToday);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [timeRange]);

  // Group logs by dateKey for fast O(1) lookup
  const logsByDate = useMemo(() => {
    const map = new Map<string, { count: number; calories: number }>();
    logs.forEach((log) => {
      const key = getManilaDateKey(log.loggedAt);
      if (!key) return;
      const existing = map.get(key) || { count: 0, calories: 0 };
      map.set(key, {
        count: existing.count + 1,
        calories: existing.calories + summarizeMealIntake([log]).totalCalories,
      });
    });
    return map;
  }, [logs]);

  // Generate weeks based on timeRange (Year = full 52/53-week calendar year, Week = 1 week)
  const { weeks, monthLabels, totalLoggedDays } = useMemo(() => {
    const todayKey = getManilaDateKey();
    const todayDate = calendarDateFromKey(todayKey);
    const todayYear = todayDate.getUTCFullYear();

    if (timeRange === 'Year') {
      // Full calendar year: start from the Sunday of the week containing Jan 1
      const jan1 = new Date(Date.UTC(todayYear, 0, 1));
      const startDayOfWeek = jan1.getUTCDay(); // 0 = Sunday
      const startDate = new Date(jan1);
      startDate.setUTCDate(jan1.getUTCDate() - startDayOfWeek);

      // End on the Saturday of the week containing Dec 31
      const dec31 = new Date(Date.UTC(todayYear, 11, 31));
      const endDayOfWeek = dec31.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const endDate = new Date(dec31);
      endDate.setUTCDate(dec31.getUTCDate() + (6 - endDayOfWeek));

      const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

      const generatedWeeks: DayCell[][] = [];
      const months: Array<{ label: string; weekIndex: number }> = [];
      const seenMonths = new Set<number>();
      let currentWeek: DayCell[] = [];
      let loggedDaysCount = 0;

      for (let i = 0; i < totalDays; i++) {
        const cellDate = new Date(startDate);
        cellDate.setUTCDate(cellDate.getUTCDate() + i);

        const isCurrentYear = cellDate.getUTCFullYear() === todayYear;
        const cellDateKey = getManilaDateKey(cellDate);
        const isToday = isCurrentYear && cellDateKey === todayKey;
        const isFuture = isCurrentYear && cellDateKey > todayKey;

        const activity = isCurrentYear ? logsByDate.get(cellDateKey) : undefined;
        const mealCount = activity?.count ?? 0;
        const totalCalories = activity?.calories ?? 0;

        if (isCurrentYear && mealCount > 0) {
          loggedDaysCount++;
        }

        const weekIdx = Math.floor(i / 7);

        // Track the first week column that contains the start of each month in this calendar year
        if (isCurrentYear) {
          const monthIdx = cellDate.getUTCMonth();
          if (!seenMonths.has(monthIdx)) {
            seenMonths.add(monthIdx);
            months.push({
              label: formatManilaDate(cellDate, { month: 'short' }),
              weekIndex: weekIdx,
            });
          }
        }

        const cell: DayCell = {
          dateKey: cellDateKey,
          date: cellDate,
          dayOfWeek: cellDate.getUTCDay(),
          monthName: formatManilaDate(cellDate, { month: 'short' }),
          isCurrentMonth: isCurrentYear && cellDate.getUTCMonth() === todayDate.getUTCMonth(),
          mealCount,
          totalCalories,
          isToday,
          isFuture,
          isOutOfBounds: !isCurrentYear,
        };

        currentWeek.push(cell);

        if (currentWeek.length === 7) {
          generatedWeeks.push(currentWeek);
          currentWeek = [];
        }
      }

      return {
        weeks: generatedWeeks,
        monthLabels: months,
        totalLoggedDays: loggedDaysCount,
      };
    }

    if (timeRange === 'Week') {
      // Current week from Sunday to Saturday (7 days)
      const dayOfWeek = todayDate.getUTCDay(); // 0 = Sun
      const startDate = new Date(todayDate);
      startDate.setUTCDate(todayDate.getUTCDate() - dayOfWeek);

      const currentWeek: DayCell[] = [];
      let loggedDaysCount = 0;

      for (let i = 0; i < 7; i++) {
        const cellDate = new Date(startDate);
        cellDate.setUTCDate(cellDate.getUTCDate() + i);

        const cellDateKey = getManilaDateKey(cellDate);
        const isToday = cellDateKey === todayKey;
        const isFuture = cellDateKey > todayKey;

        const activity = logsByDate.get(cellDateKey);
        const mealCount = activity?.count ?? 0;
        const totalCalories = activity?.calories ?? 0;

        if (mealCount > 0) {
          loggedDaysCount++;
        }

        currentWeek.push({
          dateKey: cellDateKey,
          date: cellDate,
          dayOfWeek: cellDate.getUTCDay(),
          monthName: formatManilaDate(cellDate, { month: 'short' }),
          isCurrentMonth: cellDate.getUTCMonth() === todayDate.getUTCMonth(),
          mealCount,
          totalCalories,
          isToday,
          isFuture,
        });
      }

      return {
        weeks: [currentWeek],
        monthLabels: [
          {
            label: formatManilaDate(todayDate, { month: 'short' }),
            weekIndex: 0,
          },
        ],
        totalLoggedDays: loggedDaysCount,
      };
    }

    // Month mode uses threeMonthsData directly
    return {
      weeks: [],
      monthLabels: [],
      totalLoggedDays: 0,
    };
  }, [logsByDate, timeRange]);

  // 3-Month Carousel computation for Month view
  const threeMonthsData = useMemo(() => {
    const todayKey = getManilaDateKey();
    const todayDate = calendarDateFromKey(todayKey);
    const todayYear = todayDate.getUTCFullYear();
    const todayMonthIndex = todayDate.getUTCMonth();

    const offsets = [-1, 0, 1] as const;

    const months: MonthColumnData[] = offsets.map((delta) => {
      const relOffset = monthOffset + delta;
      const totalTargetMonths = todayYear * 12 + todayMonthIndex + relOffset;
      const targetYear = Math.floor(totalTargetMonths / 12);
      const targetMonthIndex = ((totalTargetMonths % 12) + 12) % 12;

      const isFuture = totalTargetMonths > todayYear * 12 + todayMonthIndex;
      const isCurrent = totalTargetMonths === todayYear * 12 + todayMonthIndex;

      const firstDayKey = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-01`;
      const firstDayDate = calendarDateFromKey(firstDayKey);
      const startDayOfWeek = firstDayDate.getUTCDay();

      const daysInMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();

      const rawWeeks: (DayCell | null)[][] = Array.from({ length: 6 }, () => Array(7).fill(null));
      let activeDays = 0;

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dayKey = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const cellDate = calendarDateFromKey(dayKey);
        const dow = cellDate.getUTCDay();

        const slotIndex = startDayOfWeek + (dayNum - 1);
        const weekRow = Math.floor(slotIndex / 7);

        if (weekRow < 6) {
          const isToday = dayKey === todayKey;
          const isCellFuture = isFuture || dayKey > todayKey;

          const activity = logsByDate.get(dayKey);
          const mealCount = isFuture ? 0 : (activity?.count ?? 0);
          const totalCalories = isFuture ? 0 : (activity?.calories ?? 0);

          if (mealCount > 0) {
            activeDays++;
          }

          rawWeeks[weekRow][dow] = {
            dateKey: dayKey,
            date: cellDate,
            dayOfWeek: dow,
            monthName: formatManilaDate(cellDate, { month: 'short' }),
            isCurrentMonth: isCurrent,
            mealCount,
            totalCalories,
            isToday,
            isFuture: isCellFuture,
          };
        }
      }

      const activeWeeks = rawWeeks.filter((row) => row.some((cell) => cell !== null));
      const name = formatManilaDate(firstDayDate, { month: 'long' }).toUpperCase();
      const fullLabel = formatManilaDate(firstDayDate, { month: 'long', year: 'numeric' });

      return {
        year: targetYear,
        monthIndex: targetMonthIndex,
        name,
        fullLabel,
        isFuture,
        isCurrent,
        activeDaysCount: activeDays,
        weeks: activeWeeks,
      };
    });

    return {
      prevMonth: months[0],
      centerMonth: months[1],
      nextMonth: months[2],
    };
  }, [logsByDate, monthOffset]);

  const canGoNext = monthOffset < 0;

  const handlePrevMonth = () => {
    setMonthOffset((prev) => prev - 1);
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setMonthOffset((prev) => prev + 1);
    }
  };

  // Color mapping using NutriMind's theme palette:
  // Level 0: Theme neutral (brand-bgAlt/60 and brand-border/80)
  // Level 1 (1 meal): Brand Forest Green light tint (brand-green/20)
  // Level 2 (2 meals): Rich Brand Forest Green (brand-green/70)
  // Level 3 (3+ meals): Signature brand forest green (brand-green)
  const getCellColor = (cell: DayCell) => {
    if (cell.isFuture) {
      return 'border border-dashed border-brand-border/50 bg-brand-bgAlt/20 text-brand-muted/30 opacity-40 cursor-not-allowed dark:border-[#173e33]/50 dark:bg-[#071914] dark:opacity-30 dark:text-white/20';
    }
    if (cell.mealCount === 0) {
      return 'border border-brand-border/80 bg-brand-bgAlt/60 text-brand-muted/80 hover:border-brand-green/40 hover:bg-brand-bgAlt dark:border-[#173e33] dark:bg-[#0e271f] dark:text-white/50 dark:hover:border-emerald-500/40 dark:hover:bg-[#163930]';
    }

    // High activity / 3+ meals: Signature Forest Pine / Emerald Glow
    if (cell.mealCount >= 3 || cell.totalCalories >= 1800) {
      return 'border border-brand-green bg-brand-green text-white font-black shadow-sm shadow-brand-green/30 dark:border-emerald-300 dark:bg-emerald-500 dark:text-[#040d0a] dark:shadow-[0_0_10px_rgba(16,185,129,0.35)]';
    }
    // Moderate activity / 2 meals: Rich Brand Forest Green
    if (cell.mealCount === 2 || cell.totalCalories >= 1000) {
      return 'border border-brand-green/70 bg-brand-green/70 text-white font-bold dark:border-emerald-400 dark:bg-emerald-600 dark:text-white';
    }
    // Light activity / 1 meal: Warm/rich brand green tint
    return 'border border-brand-green/40 bg-brand-green/20 text-brand-green font-bold dark:border-emerald-500/40 dark:bg-emerald-500/25 dark:text-emerald-300';
  };

  const renderMonthCard = (monthData: MonthColumnData, isCenter: boolean = false) => {
    const todayYear = calendarDateFromKey(getManilaDateKey()).getUTCFullYear();
    const isLocked = monthData.isFuture;

    return (
      <div
        key={`${monthData.year}-${monthData.monthIndex}`}
        className={`flex flex-col items-center select-none transition-all duration-200 ${
          isCenter
            ? 'rounded-[22px] border border-brand-border bg-brand-surface p-3 sm:p-4 shadow-card dark:border-brand-accent/25 dark:bg-white/[0.03] w-full max-w-[320px] md:w-auto'
            : 'hidden md:flex rounded-2xl p-2 sm:p-2.5 opacity-85 hover:opacity-100'
        } ${isLocked ? 'opacity-40 grayscale select-none pointer-events-none cursor-not-allowed' : ''}`}
        aria-label={`${monthData.name} ${monthData.year} calendar`}
      >
        {/* Month Header */}
        <div className={`flex items-center justify-center gap-1.5 text-center ${isCenter ? 'mb-3 h-8' : 'mb-2 h-6'}`}>
          <h4
            className={`font-display font-black uppercase tracking-wider ${
              isCenter
                ? 'text-sm sm:text-base md:text-lg text-brand-text dark:text-white tracking-widest'
                : isLocked
                  ? 'text-xs sm:text-sm text-brand-muted/40 dark:text-white/30'
                  : 'text-xs sm:text-sm text-brand-text/80 dark:text-white/70'
            }`}
          >
            {monthData.name}
          </h4>
          {monthData.year !== todayYear && (
            <span
              className={`font-mono font-bold text-brand-muted/70 dark:text-white/40 ${
                isCenter ? 'text-xs' : 'text-[10px]'
              }`}
            >
              {monthData.year}
            </span>
          )}
          {isLocked && (
            <span
              title="Future month (locked)"
              className="inline-flex items-center gap-1 rounded bg-brand-bgAlt/90 px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-extrabold uppercase text-brand-muted/70 dark:bg-white/[0.04] dark:text-white/30"
            >
              <Lock className="h-2.5 w-2.5" />
              Locked
            </span>
          )}
        </div>

        {/* Horizontal Weekday Headers (Sun .. Sat) */}
        <div
          className={`grid grid-cols-7 text-center select-none ${isCenter ? 'gap-1.5 sm:gap-2 mb-2' : 'gap-1 mb-1.5'}`}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
            <div
              key={dayName}
              className={`flex items-center justify-center font-mono ${
                isCenter
                  ? 'h-6 w-7 sm:h-7 sm:w-8 md:w-9 text-[10px] sm:text-[11px] font-black text-brand-muted dark:text-white/60'
                  : 'h-5 w-5 sm:h-6 sm:w-6 text-[8px] sm:text-[9px] font-bold text-brand-muted/60 dark:text-white/40'
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar Rows of Weeks */}
        <div className={`flex flex-col ${isCenter ? 'gap-1.5 sm:gap-2' : 'gap-1'}`}>
          {monthData.weeks.map((weekRow, rIdx) => (
            <div key={rIdx} className={`grid grid-cols-7 ${isCenter ? 'gap-1.5 sm:gap-2' : 'gap-1'}`}>
              {weekRow.map((cell, cIdx) => {
                if (!cell) {
                  return (
                    <div
                      key={`empty-${cIdx}`}
                      className={`${
                        isCenter ? 'h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9' : 'h-5 w-5 sm:h-6 sm:w-6'
                      } opacity-0 pointer-events-none`}
                      aria-hidden="true"
                    />
                  );
                }

                const isSelected = selectedDateKey === cell.dateKey;
                const isCellDisabled = cell.isFuture || isLocked;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    disabled={isCellDisabled}
                    onClick={() => !isCellDisabled && onSelectDateKey(cell.dateKey)}
                    onMouseEnter={() => !isCellDisabled && setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onFocus={() => !isCellDisabled && setHoveredCell(cell)}
                    onBlur={() => setHoveredCell(null)}
                    aria-label={`${cell.dateKey}: ${cell.mealCount} meals logged`}
                    aria-pressed={isSelected}
                    className={`relative flex items-center justify-center border font-mono font-black transition-all duration-150 outline-none ${
                      isCenter
                        ? 'h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-lg sm:rounded-xl text-[10px] sm:text-xs'
                        : 'h-5 w-5 sm:h-6 sm:w-6 rounded-md text-[8px] sm:text-[9px]'
                    } ${getCellColor(cell)} ${
                      isSelected && !isLocked
                        ? 'ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface dark:ring-brand-accent dark:ring-offset-[#0c1511] z-10 scale-105'
                        : ''
                    } ${
                      !isCellDisabled
                        ? 'hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-green'
                        : 'cursor-not-allowed'
                    }`}
                  >
                    <span>{cell.date.getUTCDate()}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return {
    kind: 'ready' as const,
    className,
    timeRange,
    threeMonthsData,
    totalLoggedDays,
    setTimeRange,
    weeks,
    selectedDateKey,
    onSelectDateKey,
    setHoveredCell,
    getCellColor,
    renderMonthCard,
    handlePrevMonth,
    handleNextMonth,
    canGoNext,
    yearScrollRef,
    todayCellRef,
    monthLabels,
    hoveredCell,
  };
}
