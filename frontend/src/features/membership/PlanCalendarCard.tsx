'use client';

import Dropdown from '@/components/ui/Dropdown';
import Card from '@/components/ui/Card';
import { useState, useMemo, useEffect } from 'react';
import { membershipSchedules, manilaDate } from './membership-schedule';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MembershipView } from './MembershipProvider';

interface PlanCalendarCardProps {
  data: Extract<MembershipView, { enabled: true }>;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanCalendarCard({ data }: PlanCalendarCardProps) {
  const schedules = membershipSchedules(data);
  const [selection, setSelection] = useState('current');
  const schedule = schedules.find((item) => item.id === selection) ?? schedules[0];
  const startDate = schedule.start ? new Date(schedule.start) : null;
  const endDate = schedule.end ? new Date(schedule.end) : null;
  const formatTime = (date: Date | null) =>
    date
      ? date.toLocaleTimeString('en-PH', {
          timeZone: 'Asia/Manila',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '';
  const startTimeStr = formatTime(startDate);
  const endTimeStr = formatTime(endDate);
  const initialDay = manilaDate(schedule.start ?? data.serverTime);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(`${initialDay.slice(0, 7)}-01T12:00:00Z`));
  const periodKey = `${schedule.id}:${schedule.start ?? 'not-started'}`;
  useEffect(() => {
    setCurrentMonth(new Date(`${initialDay.slice(0, 7)}-01T12:00:00Z`));
  }, [periodKey, initialDay]);

  const prevMonth = () => {
    setCurrentMonth(new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1, 1, 12)));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 1, 12)));
  };

  const monthLabel = currentMonth.toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });

  // Calculate calendar grid days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getUTCFullYear();
    const month = currentMonth.getUTCMonth();

    // First day of month
    const firstDay = new Date(Date.UTC(year, month, 1, 12));
    // Day of week: 0 = Sun, 1 = Mon, ... 6 = Sat
    // Convert to 0 = Mon, ..., 6 = Sun
    const dayOfWeek = (firstDay.getUTCDay() + 6) % 7;

    // Previous month filler
    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isStart: boolean;
      isEnd: boolean;
      isInRange: boolean;
      isToday: boolean;
    }> = [];

    const prevMonthLastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(year, month - 1, prevMonthLastDate - i, 12));
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
    const lastDate = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const todayStr = manilaDate(data.serverTime);

    const startNorm = schedule.start ? manilaDate(schedule.start) : null;
    const endNorm = schedule.end ? manilaDate(schedule.end) : null;

    for (let day = 1; day <= lastDate; day++) {
      const d = new Date(Date.UTC(year, month, day, 12));
      const dTime = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isStart = dTime === startNorm;
      const isEnd = dTime === endNorm;
      const isInRange = !!startNorm && !!endNorm && dTime >= startNorm && dTime <= endNorm;
      const isToday = dTime === todayStr;

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
      const d = new Date(Date.UTC(year, month + 1, day, 12));
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
  }, [currentMonth, schedule.start, schedule.end, data.serverTime]);

  const formatDateDisplay = (d: Date | null) =>
    d
      ? d.toLocaleDateString('en-PH', {
          timeZone: 'Asia/Manila',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Not started';

  return (
    <Card aria-label="Plan schedule and validity" className="p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-brand-text">Membership period</h2>
      {schedules.length > 1 ? (
        <div className="mt-5">
          <label className="sr-only" htmlFor="membership-schedule">
            Membership period
          </label>
          <Dropdown id="membership-schedule" value={schedule.id} onChange={setSelection}>
            {schedules.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Dropdown>
        </div>
      ) : (
        <p className="mt-2 text-sm text-brand-muted">{schedule.label}</p>
      )}
      {schedule.start && schedule.end && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-brand-text">{monthLabel}</span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-brand-muted">
            {DAYS_OF_WEEK.map((day) => (
              <span key={day} className="py-2">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((cell, index) => (
              <div
                key={index}
                className={[
                  'flex h-9 items-center justify-center text-xs tabular-nums',
                  !cell.isCurrentMonth
                    ? 'text-brand-muted/40'
                    : cell.isStart || cell.isEnd
                      ? 'rounded-full bg-brand-orange font-semibold text-brand-text'
                      : cell.isInRange
                        ? 'bg-brand-green/10 text-brand-text'
                        : 'text-brand-muted',
                  cell.isToday ? 'underline underline-offset-4' : '',
                ].join(' ')}
              >
                {cell.date.getUTCDate()}
              </div>
            ))}
          </div>
        </div>
      )}
      <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-brand-border pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-brand-muted">Start date</dt>
          <dd className="mt-1 text-sm font-medium text-brand-text">{formatDateDisplay(startDate)}</dd>
          {startTimeStr && <dd className="mt-1 text-xs text-brand-muted">{startTimeStr}</dd>}
        </div>
        <div>
          <dt className="text-xs text-brand-muted">End date</dt>
          <dd className="mt-1 text-sm font-medium text-brand-text">
            {endDate ? formatDateDisplay(endDate) : data.level === 'FREE' ? 'No expiry' : 'Not scheduled'}
          </dd>
          {endTimeStr && <dd className="mt-1 text-xs text-brand-muted">{endTimeStr}</dd>}
        </div>
      </dl>
    </Card>
  );
}
