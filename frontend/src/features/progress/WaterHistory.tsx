'use client';

import { useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { formatManilaDate, manilaDateFromKey } from '@/lib/manila-date';

export type WaterHistoryData = {
  timeZone: 'Asia/Manila';
  startDate: string;
  endDate: string;
  days: Array<{
    date: string;
    totalMl: number;
    entryCount: number;
    entries: Array<{ id: string; amountMl: number; loggedAt: string }>;
  }>;
};

const amount = (value: number) => `${value.toLocaleString('en-US')} mL`;
const fullDate = (date: string) => formatManilaDate(manilaDateFromKey(date), { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

export default function WaterHistory({ data }: { data?: WaterHistoryData }) {
  const [selection, setSelection] = useState<string | null>(null);
  const selected = data?.days.find(day => day.date === selection) ?? data?.days.at(-1);
  const maximum = Math.max(250, ...(data?.days.map(day => day.totalMl) ?? []));
  const scale = Math.ceil(maximum / 250) * 250;

  return (
    <Card className="mt-6 p-5 text-left sm:p-6">
      <section id="water-history" aria-labelledby="water-history-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 id="water-history-title" className="font-display text-lg font-semibold text-brand-text">Water history</h3>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-brand-muted">
              Your logged water over the last 7 days. Select a day to see its entries. Dates follow Philippine time.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm font-semibold text-brand-green underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green">
            Log water on Dashboard
          </Link>
        </div>
        {!data || !selected ? (
          <p className="mt-6 text-sm text-brand-muted">Water history is unavailable. Refresh Progress to try again.</p>
        ) : (
          <>
            <div className="mt-6 flex justify-between text-xs text-brand-muted" aria-hidden="true">
              <span>Logged water · mL</span><span>Chart maximum: {amount(scale)}</span>
            </div>
            <div role="group" aria-label="Daily logged water" className="mt-3 grid grid-cols-7 gap-1 sm:gap-3">
              {data.days.map(day => {
                const active = day.date === selected.date;
                return (
                  <button key={day.date} type="button" aria-pressed={active}
                    aria-label={`${fullDate(day.date)}: ${day.entryCount ? `${amount(day.totalMl)}, ${day.entryCount} ${day.entryCount === 1 ? 'entry' : 'entries'}` : 'no log'}`}
                    onClick={() => setSelection(day.date)}
                    className={`group flex min-w-0 flex-col items-center rounded-xl px-1 pb-3 pt-2 text-brand-text outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green motion-reduce:transition-none ${active ? 'bg-brand-green/10' : 'hover:bg-brand-bgAlt'}`}>
                    <span className="flex h-36 w-full items-end justify-center border-b border-brand-border" aria-hidden="true">
                      <span className={`w-5 rounded-t-md sm:w-8 ${day.entryCount ? active ? 'bg-brand-green' : 'bg-brand-cyan' : 'border border-dashed border-brand-border bg-brand-bgAlt'}`}
                        style={{ height: day.entryCount ? `${Math.max(2, day.totalMl / scale * 100)}%` : '4px' }} />
                    </span>
                    <span className="mt-3 text-xs font-medium" aria-hidden="true">
                      {formatManilaDate(manilaDateFromKey(day.date), { weekday: 'short' })}
                    </span>
                    <span className="mt-1 text-xs tabular-nums" aria-hidden="true">
                      {formatManilaDate(manilaDateFromKey(day.date), { day: 'numeric' })}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 border-t border-brand-border pt-5" aria-live="polite" aria-atomic="true">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold text-brand-text">{fullDate(selected.date)}</h4>
                <p className="text-sm font-semibold tabular-nums text-brand-text">{selected.entryCount ? `${amount(selected.totalMl)} logged` : 'No log'}</p>
              </div>
              {!selected.entryCount ? (
                <p className="mt-3 text-sm text-brand-muted">No water was logged on this day.</p>
              ) : (
                <>
                  <ol aria-label="Saved water entries" className="mt-3 max-h-56 overflow-y-auto overscroll-contain divide-y divide-brand-border custom-scrollbar">
                    {selected.entries.map(entry => (
                      <li key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                        <time dateTime={entry.loggedAt} className="text-brand-muted">
                          {formatManilaDate(entry.loggedAt, { hour: 'numeric', minute: '2-digit' })}
                        </time>
                        <span className="font-medium tabular-nums text-brand-text">{amount(entry.amountMl)}</span>
                      </li>
                    ))}
                  </ol>
                  {selected.entryCount > selected.entries.length && <p className="mt-2 text-xs text-brand-muted">
                    Showing the latest {selected.entries.length} of {selected.entryCount} entries. The daily total includes all saved entries.
                  </p>}
                </>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-brand-muted">“No log” means no entry was saved. Totals reflect current entries after any removals or resets.</p>
          </>
        )}
      </section>
    </Card>
  );
}
