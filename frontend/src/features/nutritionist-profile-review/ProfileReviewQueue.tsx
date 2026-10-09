'use client';

import Skeleton from '@/components/ui/Skeleton';

import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';
type Model = Extract<ReturnType<typeof useProfileWorkPanelModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'detail' | 'expanded' | 'isLoading' | 'people' | 'busy' | 'openPerson'> };
export default function ProfileReviewQueue({ model }: SectionProps) {
  const { detail, expanded, isLoading, people, busy, openPerson } = model;

  return (
    <>
      <aside
        className={`${detail ? 'hidden lg:flex' : 'flex'} ${expanded ? '!hidden' : ''} w-full lg:w-[27%] shrink-0 flex-col border-r border-brand-border/70 p-5`}
      >
        <div className="mb-4 rounded-2xl border border-brand-border/80 bg-brand-surface p-5">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-brand-green">
            Member profile queue
          </p>
          <div className="mt-2">
            <h2 className="font-display text-lg font-black">Members awaiting review</h2>
          </div>
          <p className="mt-2 text-xs text-brand-muted">
            One person can have a profile task, documents to review, or both.
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading member profile queue">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 space-y-2.5">
                  <Skeleton className="h-4.5 w-32 rounded" />
                  <Skeleton className="h-3.5 w-48 rounded" />
                  <Skeleton className="h-3.5 w-28 rounded" />
                </div>
              ))}
            </div>
          ) : people.length > 0 ? (
            people.map((person) => (
              <button
                key={person.userId}
                type="button"
                disabled={busy}
                onClick={() => void openPerson(person.userId)}
                aria-pressed={detail?.userId === person.userId}
                className={`w-full rounded-2xl border p-4 text-left text-xs ${detail?.userId === person.userId ? 'border-brand-green bg-brand-green/10' : 'border-brand-border/70 hover:border-brand-green/40'}`}
              >
                <strong className="block text-sm text-brand-text">{person.name}</strong>
                <span className="mt-1 block text-brand-muted">
                  Conditions: {person.conditions.filter((item) => item !== 'NONE').join(', ') || 'none'} · Allergies:{' '}
                  {person.allergies.filter((item) => item !== 'NONE').join(', ') || 'none'}
                </span>
                <span className="mt-2 block font-semibold text-brand-green">
                  {person.profileStatus
                    ? `Profile: ${person.profileStatus.replace(/_/g, ' ').toLowerCase()}`
                    : 'Profile decision not pending'}{' '}
                  · {person.documentCount} document{person.documentCount === 1 ? '' : 's'}
                </span>
              </button>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-brand-border p-6 text-sm text-brand-muted">
              Profile queue is clear.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
