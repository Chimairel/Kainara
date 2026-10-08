'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const announcementPriority = {
  safety: 10,
  action: 20,
  review: 30,
  checkin: 40,
  preparation: 50,
  plan: 60,
  information: 70,
} as const;

type Entry = { id: string; priority: number; host: HTMLDivElement };
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
  return (
    <section
      aria-label="Account and meal plan notices"
      className="w-full space-y-2 border-b border-brand-border/40 bg-brand-bg/80 px-4 py-2.5 md:px-5"
    >
      {[...entries]
        .sort((a, b) => a.priority - b.priority)
        .map((entry) => (
          <AnnouncementMount key={entry.id} host={entry.host} />
        ))}
    </section>
  );
}

export function PortalAnnouncement({ priority, children }: { priority: number; children: ReactNode }) {
  const registration = useContext(Registration);
  const id = useId();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!registration) return;
    const target = document.createElement('div');
    setHost(target);
    registration.add({ id, priority, host: target });
    return () => registration.remove(id);
  }, [registration, id, priority]);
  // Standalone workspaces retain their notices without requiring a portal layout.
  if (!registration) return <>{children}</>;
  return host ? createPortal(children, host) : null;
}
