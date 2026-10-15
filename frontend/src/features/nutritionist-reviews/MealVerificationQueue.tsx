'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { useState } from 'react';
import { QueueHeader, QueueList, QueueRow, QueueSkeleton, queueLabel } from '@/components/shared/WorkspaceQueue';

export type MealCandidate = {
  kind: 'LIBRARY_MEAL' | 'RAW_RECIPE' | 'GENERATED_RECIPE' | 'FLAGGED_RECIPE';
  id: string;
  revisionKey: string;
  name: string;
  description: string | null;
  mealType: string;
  source: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  ingredients: unknown;
  status: 'PENDING' | 'REJECTED' | 'FLAGGED';
  reviewerInvolved?: boolean;
  incidentNumber?: number;
  authoredByMe?: boolean;
  imageUrl?: string | null;
  riceRole?: string | null;
  riceMinHalfCups?: number;
  riceMaxHalfCups?: number;
  claimedByMe: boolean;
  claimedByOther: boolean;
};

export default function MealVerificationQueue({
  queue,
  selectedId,
  expanded,
  busy,
  isLoading,
  error,
  onSelect,
  onRetry,
}: {
  queue: MealCandidate[];
  selectedId: string | null;
  expanded: boolean;
  busy: boolean;
  isLoading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = queue.filter((item) => item.claimedByMe ||
    [item.name, item.mealType, item.source, item.status].some((value) => queueLabel(value).includes(query))
  ).sort((a,b) => Number(b.claimedByMe) - Number(a.claimedByMe));

  return (
    <aside
      aria-label="Meal verification navigation"
      className={`${selectedId ? 'hidden md:flex' : 'flex'} ${expanded ? '!hidden' : ''} h-full min-h-0 w-full min-w-0 flex-col border-brand-border/70 p-4 md:w-[38%] md:min-w-[280px] md:max-w-[400px] md:border-r`}
    >
      <QueueHeader
        title="Meal verification"
        count={queue.length}
        search={search}
        onSearch={setSearch}
        searchLabel="Search recipes"
        description="Inspect new recipes and resolve flagged recipes in one queue."
      />
      {error && (
        <FeedbackNotice className="my-3">
          {error}{' '}
          <button type="button" disabled={busy || isLoading} onClick={onRetry} className="ml-2 font-bold underline">
            Retry
          </button>
        </FeedbackNotice>
      )}
      {isLoading ? (
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <QueueSkeleton />
        </div>
      ) : visible.length ? (
        <QueueList label="Recipes awaiting verification">
          {visible.map((item) => {
            const id = `${item.kind}:${item.id}`;
            return (
              <QueueRow
                key={id}
                title={item.name}
                selected={selectedId === id}
                disabled={busy}
                onSelect={() => onSelect(id)}
              >
                <span className="block text-brand-muted">
                  {queueLabel(item.mealType)} · {queueLabel(item.source)}
                  {item.calories != null ? ` · ${Math.round(item.calories)} kcal` : ''}
                </span>
                <span
                  className={`block font-semibold ${item.status === 'REJECTED' ? 'text-red-700 dark:text-red-400' : 'text-[#8c3b00] dark:text-[#ff8a3d]'}`}
                >
                  {item.kind === 'FLAGGED_RECIPE' ? 'Flagged' : item.status === 'PENDING' ? 'New' : 'Rejected'}
                </span>
                {item.claimedByOther && <span className="block text-brand-muted">Being reviewed by another RND</span>}
                {item.claimedByMe && <span className="block text-brand-green">Claimed by you</span>}
                {(item.authoredByMe || item.reviewerInvolved) && <span className="block text-brand-muted">Independent RND needed</span>}
              </QueueRow>
            );
          })}
        </QueueList>
      ) : (
        !error && (
          <p role="status" className="p-4 text-sm text-brand-muted">
            {queue.length
              ? 'No recipes match your search.'
              : 'Queue clear. No base meals await verification in this queue.'}
          </p>
        )
      )}
    </aside>
  );
}
