'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, ChevronDown, CircleAlert } from '@/components/ui/icons';
import { CompactAnnouncementContext } from './AnnouncementBanner';

export const announcementPriority = {
  safety: 10,
  action: 20,
  review: 30,
  checkin: 40,
  preparation: 50,
  plan: 60,
  information: 70,
} as const;

type Entry = { id: string; priority: number; host: HTMLDivElement; summary: string };
const Registration = createContext<{
  add: (entry: Entry) => void;
  remove: (id: string) => void;
} | null>(null);
const Entries = createContext<readonly Entry[]>([]);

/** Keep page-owned notices and actions in one ordered area below the portal header. */
export function PortalAnnouncementsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const registration = useMemo(
    () => ({
      add: (entry: Entry) => setEntries((current) => [...current.filter((item) => item.id !== entry.id), entry]),
      remove: (id: string) => setEntries((current) => current.filter((item) => item.id !== id)),
    }),
    []
  );
  return (
    <Registration.Provider value={registration}>
      <Entries.Provider value={entries}>{children}</Entries.Provider>
    </Registration.Provider>
  );
}

function AnnouncementMount({ host }: { host: HTMLDivElement }) {
  return (
    <div
      ref={(node) => {
        if (node && host.parentNode !== node) node.appendChild(host);
      }}
    />
  );
}

export function PortalAnnouncements() {
  const entries = useContext(Entries);
  if (!entries.length) return null;
  const ordered = [...entries].sort((a, b) => a.priority - b.priority);
  const needsAttention = ordered[0].priority <= announcementPriority.action;
  const Icon = needsAttention ? CircleAlert : Bell;
  return (
    <section aria-label="Account and meal plan notices" className="w-full px-4 pt-3 md:px-5">
      <details className="group rounded-2xl bg-brand-bgAlt">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl bg-[#8c3b00] px-4 py-3 text-sm text-white group-open:rounded-b-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green [&::-webkit-details-marker]:hidden">
          <Icon className="h-5 w-5 shrink-0 text-white/90" aria-hidden="true" />
          <span className="min-w-0 flex-1 font-semibold leading-5">{ordered[0].summary}</span>
          <span className="shrink-0 text-xs tabular-nums text-white/85">
            {entries.length} {entries.length === 1 ? 'update' : 'updates'}
          </span>
          <span className="hidden shrink-0 text-xs font-semibold sm:inline">
            <span className="group-open:hidden">View updates</span>
            <span className="hidden group-open:inline">Hide updates</span>
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-white/85 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="custom-scrollbar max-h-72 overflow-y-auto overscroll-contain border-t border-brand-border/60 px-4">
          <div className="divide-y divide-brand-border/60">
            {ordered.map((entry) => (
              <AnnouncementMount key={entry.id} host={entry.host} />
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

export function PortalAnnouncement({
  priority,
  summary = 'Your plan and account updates',
  children,
}: {
  priority: number;
  summary?: string;
  children: ReactNode;
}) {
  const registration = useContext(Registration);
  const id = useId();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!registration) return;
    const target = document.createElement('div');
    setHost(target);
    return () => registration.remove(id);
  }, [registration, id]);
  useEffect(() => {
    if (registration && host) registration.add({ id, priority, host, summary });
  }, [registration, id, priority, host, summary]);
  // Standalone workspaces retain their notices without requiring a portal layout.
  if (!registration) return <>{children}</>;
  return host
    ? createPortal(
        <CompactAnnouncementContext.Provider value={true}>{children}</CompactAnnouncementContext.Provider>,
        host
      )
    : null;
}
