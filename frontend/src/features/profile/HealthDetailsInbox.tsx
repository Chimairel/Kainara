'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, FileCheck2, MessageSquare, Search } from 'lucide-react';
import { ProfileSettingsSurface } from '@/components/user/ProfileSettingsSection';

export type HealthInboxItem = {
  id: string;
  title: string;
  sender: string;
  status: string;
  kind: 'question' | 'correction' | 'details' | 'assessment';
  needsResponse: boolean;
  historical: boolean;
  date?: string;
};

/** Selection is owned by the workspace; mounted readers retain their unsent drafts. */
export default function HealthDetailsInbox({
  items,
  selectedId,
  disabled = false,
  onSelect,
  children,
}: {
  items: HealthInboxItem[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [mobileReader, setMobileReader] = useState(false);
  const reader = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const wasReading = useRef(false);
  useEffect(() => {
    const mobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px)').matches;
    if (mobile && mobileReader) reader.current?.focus({ preventScroll: true });
    else if (mobile && wasReading.current) rows.current.get(selectedId)?.focus({ preventScroll: true });
    wasReading.current = mobileReader;
  }, [mobileReader, selectedId]);
  const outstanding = items.filter((item) => item.needsResponse).length;
  const visible = items.filter(
    (item) =>
      (filter === 'all' || (filter === 'response' ? item.needsResponse : item.historical)) &&
      `${item.title} ${item.sender} ${item.status}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selected = items.find((item) => item.id === selectedId);
  return (
    <ProfileSettingsSurface className="overflow-hidden">
      <section aria-label="Health forms inbox">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-xl font-semibold">
            Your forms <span className="ml-1 text-sm font-normal tabular-nums text-brand-muted">{items.length}</span>
          </h2>
          <p className="text-sm text-brand-muted" role="status">
            {outstanding ? `${outstanding} need your response` : 'No responses needed'}
          </p>
        </div>
        <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)]">
          <nav
            aria-label="Health form list"
            className={`${mobileReader ? 'hidden lg:block' : ''} border-b border-brand-border bg-brand-bgAlt/40 lg:border-b-0 lg:border-r`}
          >
            <div className="space-y-3 p-4">
              <label className="relative block">
                <Search
                  aria-hidden="true"
                  size={16}
                  className="pointer-events-none absolute left-3 top-3.5 text-brand-muted"
                />
                <input
                  type="search"
                  aria-label="Search health forms"
                  placeholder="Search forms or RND"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-brand-border bg-brand-surface py-2 pl-9 pr-3 text-sm placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-green/40"
                />
              </label>
              <div className="flex gap-1" aria-label="Filter health forms">
                {(
                  [
                    ['all', 'All'],
                    ['response', 'To respond'],
                    ['history', 'History'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${filter === value ? 'bg-brand-accentSoft text-brand-black' : 'text-brand-muted hover:bg-brand-surface hover:text-brand-text'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="max-h-64 overflow-y-auto border-t border-brand-border lg:max-h-[38rem]">
              {visible.map((item) => {
                const Icon =
                  item.kind === 'question' ? MessageSquare : item.kind === 'details' ? ClipboardList : FileCheck2;
                return (
                  <li key={item.id} className="border-b border-brand-border last:border-b-0">
                    <button
                      type="button"
                      disabled={disabled}
                      ref={(node) => {
                        if (node) rows.current.set(item.id, node);
                        else rows.current.delete(item.id);
                      }}
                      aria-current={selectedId === item.id ? 'true' : undefined}
                      aria-label={[item.sender, item.title, item.status, item.date].filter(Boolean).join(' · ')}
                      onClick={() => {
                        onSelect(item.id);
                        setMobileReader(true);
                      }}
                      className={`group flex w-full items-start gap-3 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green ${selectedId === item.id ? 'bg-brand-accentSoft/20' : 'hover:bg-brand-surface'}`}
                    >
                      <Icon aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-brand-muted" />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs text-brand-muted">{item.sender}</span>
                          {item.date && <span className="shrink-0 text-xs text-brand-muted">{item.date}</span>}
                        </span>
                        <span className="block break-words text-sm font-semibold leading-snug">{item.title}</span>
                        <span
                          className={`block text-xs ${item.needsResponse ? 'font-semibold text-brand-green' : 'text-brand-muted'}`}
                        >
                          {item.status}
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" size={14} className="mt-1 shrink-0 text-brand-muted" />
                    </button>
                  </li>
                );
              })}
              {!visible.length && (
                <li className="px-5 py-8 text-sm text-brand-muted">
                  {search
                    ? 'No forms match your search.'
                    : filter === 'response'
                      ? 'You have no forms needing a response.'
                      : 'No forms in this view.'}
                </li>
              )}
            </ul>
          </nav>
          <div
            ref={reader}
            tabIndex={-1}
            aria-label={selected?.title ?? 'Form reader'}
            className={`${mobileReader ? '' : 'hidden lg:block'} min-w-0 p-5 outline-none sm:p-7 lg:p-8`}
          >
            <button
              type="button"
              onClick={() => setMobileReader(false)}
              className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-green lg:hidden"
            >
              <ArrowLeft aria-hidden="true" size={16} />
              Back to forms
            </button>
            {selected ? children : <p className="py-12 text-sm text-brand-muted">Choose a form to read or respond.</p>}
          </div>
        </div>
      </section>
    </ProfileSettingsSurface>
  );
}
