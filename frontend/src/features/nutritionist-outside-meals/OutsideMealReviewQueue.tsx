'use client';
import { useState } from 'react';
import { formatManilaDate } from '@/lib/manila-date';
import { QueueHeader, QueueList, QueueRow, QueueSkeleton } from '@/components/shared/WorkspaceQueue';
import type { useOutsideMealReviewsPanelModel } from './useOutsideMealReviewsPanelModel';

type Model = ReturnType<typeof useOutsideMealReviewsPanelModel>;
export default function OutsideMealReviewQueue({ model, expanded }: { model: Model; expanded: boolean }) {
  const [search, setSearch] = useState('');
  const rows = model.rows.filter((row) =>
    row.outsideMealLogItem.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <aside
      aria-label="Outside food navigation"
      className={`${expanded ? 'hidden' : 'flex'} h-full min-h-0 w-full flex-col border-brand-border/70 p-4 md:w-[38%] md:min-w-[280px] md:max-w-[400px] md:border-r`}
    >
      <QueueHeader
        title="Feedback requests"
        count={model.rows.length}
        search={search}
        onSearch={setSearch}
        searchLabel="Search logged food"
        description="Advice on food already logged. Nutrition stays in the member’s tracker."
      />
      {model.isLoading ? (
        <QueueSkeleton />
      ) : (
        <QueueList label="Outside food feedback requests">
          {rows.map((row) => (
            <QueueRow
              key={row.id}
              title={row.outsideMealLogItem.name}
              selected={model.selected?.id === row.id}
              disabled={model.busy}
              onSelect={() => model.selectReview(row)}
            >
              <span className="block text-brand-muted">
                {row.outsideMealLogItem.mealLog.mealType} ·{' '}
                {formatManilaDate(new Date(row.outsideMealLogItem.mealLog.loggedAt), {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="block text-brand-muted">
                {row.outsideMealLogItem.calories == null
                  ? 'Nutrition not recorded'
                  : `${Math.round(row.outsideMealLogItem.calories)} kcal`}
              </span>
              {row.claimStatus.claimedByOther && (
                <span className="block">Being handled by {row.claimStatus.claimedByName ?? 'another RND'}</span>
              )}
            </QueueRow>
          ))}
          {!rows.length && (
            <p className="py-6 text-sm text-brand-muted">
              {search ? 'No matching food logs.' : 'No feedback requests waiting.'}
            </p>
          )}
        </QueueList>
      )}
    </aside>
  );
}
