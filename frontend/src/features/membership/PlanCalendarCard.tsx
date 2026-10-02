'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { KainaraLogo } from '@/components/shared/KainaraLogo';
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
      className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#071914] text-[#0d2820] dark:text-white shadow-xl p-6 sm:p-8 flex flex-col justify-between"
    >
      {/* 1. Retro Wave Organic Corner Accent (3-tone curved stripes from landing page) */}
      <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-32 w-32 sm:h-40 sm:w-40 overflow-hidden rounded-tr-[28px] sm:rounded-tr-[36px] z-0 opacity-80 dark:opacity-75">
        <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
          <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
          <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
          <path
            d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z"
            className="fill-[#1b4e41] dark:fill-[#164639]"
          />
        </svg>
      </div>

      {/* 2. Curved Stripe Accent in Bottom Corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-1 -left-1 z-0 h-24 w-24 select-none opacity-25 dark:opacity-20"
      >
        <svg viewBox="0 0 96 96" fill="none" className="h-full w-full block">
          <path d="M 88 104 C 80 52 44 16 -8 8" stroke="#f09e6c" strokeWidth="12" strokeLinecap="round" />
          <path d="M 72 104 C 66 62 34 30 -8 24" stroke="#eb6a38" strokeWidth="10" strokeLinecap="round" />
        </svg>
      </div>

      {/* 3. Watermarked Kainara Logo Seal */}
      <div className="pointer-events-none absolute -bottom-6 -right-6 hidden sm:flex items-center justify-center opacity-10 dark:opacity-15 z-0">
        <KainaraLogo size={120} variant="multicolor" />
      </div>

      {/* Main Content inside Card */}
      <div className="relative z-10">
        {/* Header (Adapted from 'Schedule a meeting') */}
        <div className="flex items-center gap-3 pb-3.5 border-b border-[#dce4e0]/80 dark:border-[#173e33]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0a201a] text-brand-green shadow-xs">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base sm:text-lg font-black tracking-[-0.02em] text-[#0d2820] dark:text-white">
              Plan Schedule
            </h3>
            <p className="text-xs text-[#5a746a] dark:text-white/60">
              Current plan duration, validity, and renewal status.
            </p>
          </div>
        </div>

        {/* Main Two-Column Layout (Calendar on left, Details on right) */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Calendar View Sub-card */}
          <div className="rounded-[24px] border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/70 p-3 sm:p-4 shadow-sm backdrop-blur-sm">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-xl text-[#5a746a] dark:text-white/70 hover:text-[#0d2820] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#13382c] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-display text-xs sm:text-sm font-bold text-[#0d2820] dark:text-white">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-xl text-[#5a746a] dark:text-white/70 hover:text-[#0d2820] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#13382c] transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center mb-1">
              {DAYS_OF_WEEK.map((day) => (
                <span
                  key={day}
                  className="text-[10px] font-semibold text-[#5a746a] dark:text-emerald-200/60 py-1"
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
                      className="h-8 flex items-center justify-center text-[11px] text-neutral-300 dark:text-neutral-700 select-none"
                    >
                      {dayNum}
                    </div>
                  );
                }

                if (cell.isStart) {
                  return (
                    <div
                      key={idx}
                      className="h-8 flex items-center justify-center relative bg-brand-green/20 dark:bg-brand-green/30 rounded-l-full"
                    >
                      <div className="h-7 w-7 rounded-full bg-white text-neutral-950 font-bold text-[11px] flex items-center justify-center shadow-md">
                        {dayNum}
                      </div>
                    </div>
                  );
                }

                if (cell.isEnd) {
                  return (
                    <div
                      key={idx}
                      className="h-8 flex items-center justify-center relative bg-brand-green/20 dark:bg-brand-green/30 rounded-r-full"
                    >
                      <div className="h-7 w-7 rounded-full bg-brand-green text-white font-bold text-[11px] flex items-center justify-center shadow-md">
                        {dayNum}
                      </div>
                    </div>
                  );
                }

                if (cell.isInRange) {
                  return (
                    <div
                      key={idx}
                      className="h-8 flex items-center justify-center bg-brand-green/20 dark:bg-brand-green/30 text-[11px] font-bold text-brand-green dark:text-emerald-300"
                    >
                      {dayNum}
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`h-8 flex items-center justify-center text-[11px] text-[#0d2820] dark:text-white transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-[#13382c] ${
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
              <label className="block text-xs font-semibold text-[#0d2820] dark:text-white mb-1.5">
                Start date<span className="text-brand-accent ml-0.5">*</span>
              </label>
              <div className="flex items-center justify-between rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/70 px-4 py-3 shadow-xs">
                <span className="text-xs font-semibold text-[#0d2820] dark:text-white">
                  {formatDateDisplay(startDate)}
                </span>
                <span className="rounded-xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#071914] px-2.5 py-1 font-mono text-[11px] font-bold text-[#0d2820] dark:text-emerald-200 shadow-2xs">
                  {startTimeStr}
                </span>
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-semibold text-[#0d2820] dark:text-white mb-1.5">
                End date<span className="text-brand-accent ml-0.5">*</span>
              </label>
              <div className="flex items-center justify-between rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/70 px-4 py-3 shadow-xs">
                <span className="text-xs font-semibold text-[#0d2820] dark:text-white">
                  {formatDateDisplay(endDate)}
                </span>
                <span className="rounded-xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#071914] px-2.5 py-1 font-mono text-[11px] font-bold text-[#0d2820] dark:text-emerald-200 shadow-2xs">
                  {endTimeStr}
                </span>
              </div>
            </div>

            {/* Auto-renew switch (Replaces 'Enable AI notes') */}
            <div className="pt-2 border-t border-[#dce4e0]/80 dark:border-[#173e33]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#0d2820] dark:text-white block">
                    Auto-renew
                  </span>
                  <span className="text-[10px] text-[#5a746a] dark:text-white/60 block mt-0.5">
                    Renew subscription at cycle end
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoRenew}
                  onClick={() => setAutoRenew(!autoRenew)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-green/20 ${
                    autoRenew ? 'bg-brand-green' : 'bg-neutral-300 dark:bg-neutral-700'
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
              <p className="mt-2 text-[10px] leading-relaxed text-[#5a746a] dark:text-white/60">
                Dates follow Philippine Standard Time (Asia/Manila). Automatic renewal is managed through your payment provider.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
