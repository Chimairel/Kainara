'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { MembershipView } from './MembershipProvider';

interface PlanCalendarCardProps {
  data: Extract<MembershipView, { enabled: true }>;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanCalendarCard({ data }: PlanCalendarCardProps) {
  // 1. Resolve Start Date and End Date from membership data
  const { startDate, endDate, startTimeStr, endTimeStr } = useMemo(() => {
    let start: Date;
    let end: Date;

    const currentSchedule = data.transitions?.current;
    if (data.level === 'TRIAL' || data.level === 'TRIAL_PENDING') {
      start = data.trialStartedAt ? new Date(data.trialStartedAt) : new Date(data.serverTime || Date.now());
      end = data.trialEndsAt
        ? new Date(data.trialEndsAt)
        : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    } else if (currentSchedule) {
      start = new Date(currentSchedule.effectiveFrom);
      end = new Date(currentSchedule.effectiveUntil);
    } else if (data.paidUntil) {
      end = new Date(data.paidUntil);
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      // Default to current month window
      const now = new Date(data.serverTime || Date.now());
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const formatTime = (d: Date) =>
      d.toLocaleTimeString('en-PH', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

    return {
      startDate: start,
      endDate: end,
      startTimeStr: formatTime(start),
      endTimeStr: formatTime(end),
    };
  }, [data]);

  // View state for calendar browsing (defaults to month of start date or current date)
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  });

  // Auto-renew toggle switch state
  const [autoRenew, setAutoRenew] = useState<boolean>(data.autoRenews ?? false);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthLabel = currentMonth.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    year: 'numeric',
  });

  // Calculate calendar grid days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Day of week: 0 = Sun, 1 = Mon, ... 6 = Sat
    // Convert to 0 = Mon, ..., 6 = Sun
    const dayOfWeek = (firstDay.getDay() + 6) % 7;

    // Previous month filler
    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isStart: boolean;
      isEnd: boolean;
      isInRange: boolean;
      isToday: boolean;
    }> = [];

    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDate - i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isStart: false,
        isEnd: false,
        isInRange: false,
        isToday: false,
      });
    }

    // Current month days
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const startNorm = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const endNorm = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();

    for (let day = 1; day <= lastDate; day++) {
      const d = new Date(year, month, day);
      const dTime = d.getTime();
      const isStart = dTime === startNorm;
      const isEnd = dTime === endNorm;
      const isInRange = dTime >= startNorm && dTime <= endNorm;
      const isToday = d.toISOString().split('T')[0] === todayStr;

      days.push({
        date: d,
        isCurrentMonth: true,
        isStart,
        isEnd,
        isInRange,
        isToday,
      });
    }

    // Trailing days from next month to complete 35 or 42 cells grid
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      days.push({
        date: d,
        isCurrentMonth: false,
        isStart: false,
        isEnd: false,
        isInRange: false,
        isToday: false,
      });
    }

    return days;
  }, [currentMonth, startDate, endDate]);

  const formatDateDisplay = (d: Date) =>
    d.toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <section
      aria-label="Plan schedule and validity"
      className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-xs flex flex-col justify-between"
    >
      {/* 1. Header (Adapted from 'Schedule a meeting') */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-bgAlt text-brand-green">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-brand-text">
              Plan Schedule
            </h3>
            <p className="text-xs text-brand-muted">
              Current plan duration, validity, and renewal status.
            </p>
          </div>
        </div>

        {/* 2. Main Two-Column Layout (Calendar on left, Details on right) */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Calendar View */}
          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/30 p-3 sm:p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-display text-xs sm:text-sm font-bold text-brand-text">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center mb-1">
              {DAYS_OF_WEEK.map((day) => (
                <span
                  key={day}
                  className="text-[10px] font-semibold text-brand-muted py-1"
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {calendarDays.map((cell, idx) => {
                const dayNum = cell.date.getDate();

                if (!cell.isCurrentMonth) {
                  return (
                    <div
                      key={idx}
                      className="h-8 flex items-center justify-center text-[11px] text-brand-muted/30"
                    >
                      {dayNum}
                    </div>
                  );
                }

                if (cell.isStart) {
                  return (
                    <div
                      key={idx}
                      className="h-8 flex items-center justify-center relative bg-brand-green/15 dark:bg-brand-green/25 rounded-l-full"
                    >
                      <div className="h-7 w-7 rounded-full bg-white text-neutral-950 font-bold text-[11px] flex items-center justify-center shadow-sm">
                        {dayNum}
                      </div>
                    </div>
                  );
                }

                if (cell.isEnd) {
                  return (
                    <div
                      key={idx}
                      className="h-8 flex items-center justify-center relative bg-brand-green/15 dark:bg-brand-green/25 rounded-r-full"
                    >
                      <div className="h-7 w-7 rounded-full bg-brand-green text-white font-bold text-[11px] flex items-center justify-center shadow-sm">
                        {dayNum}
                      </div>
                    </div>
                  );
                }

                if (cell.isInRange) {
                  return (
                    <div
                      key={idx}
                      className="h-8 flex items-center justify-center bg-brand-green/15 dark:bg-brand-green/25 text-[11px] font-semibold text-brand-green dark:text-emerald-300"
                    >
                      {dayNum}
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`h-8 flex items-center justify-center text-[11px] text-brand-text transition-colors rounded-full hover:bg-brand-bgAlt/50 ${
                      cell.isToday ? 'font-bold underline decoration-brand-green decoration-2' : ''
                    }`}
                  >
                    {dayNum}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Start Date, End Date, and Auto-renew */}
          <div className="space-y-3.5">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1.5">
                Start date<span className="text-brand-accent ml-0.5">*</span>
              </label>
              <div className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-bgAlt/60 px-3.5 py-2.5">
                <span className="text-xs font-medium text-brand-text">
                  {formatDateDisplay(startDate)}
                </span>
                <span className="rounded-md border border-brand-border/70 bg-brand-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-text shadow-xs">
                  {startTimeStr}
                </span>
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1.5">
                End date<span className="text-brand-accent ml-0.5">*</span>
              </label>
              <div className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-bgAlt/60 px-3.5 py-2.5">
                <span className="text-xs font-medium text-brand-text">
                  {formatDateDisplay(endDate)}
                </span>
                <span className="rounded-md border border-brand-border/70 bg-brand-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-text shadow-xs">
                  {endTimeStr}
                </span>
              </div>
            </div>

            {/* Auto-renew switch (Replaces 'Enable AI notes') */}
            <div className="pt-2 border-t border-brand-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-brand-text block">
                    Auto-renew
                  </span>
                  <span className="text-[10px] text-brand-muted block mt-0.5">
                    Renew subscription at cycle end
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoRenew}
                  onClick={() => setAutoRenew(!autoRenew)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-green/20 ${
                    autoRenew ? 'bg-brand-green' : 'bg-brand-border'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      autoRenew ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-brand-muted">
                Dates follow Philippine Standard Time (Asia/Manila). Automatic renewal is managed through your payment provider.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
