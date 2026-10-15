'use client';
import { formatMealTitle } from '@/lib/meal-title';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { useState } from 'react';
import { WorkspaceListPane } from '@/components/shared/SplitWorkspace';
import { QueueHeader, QueueList, QueueRow, QueueSkeleton, queueLabel } from '@/components/shared/WorkspaceQueue';
import Button from '@/components/ui/Button';
import { Clock, Lock, ShieldCheck } from '@/components/ui/icons';
import { formatPhilippineDate, formatPhilippineDateTime } from '@/lib/formatters';
import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';

type Props = { review: ReturnType<typeof useNutritionistReviews>; caseFilter: string; expanded: boolean };

function recordedDate(value: string | null | undefined) {
  return value && Number.isFinite(new Date(value).getTime()) ? formatPhilippineDate(value) : 'not recorded';
}

export default function CaseReviewQueue({ review, expanded }: Props) {
  const { queue, queueError, fetchQueue, isLoading, selectedMealId, errorMsg, handleSelectMeal } = review;
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visibleQueue = queue.filter((meal) => meal.claimStatus.claimedByMe ||
    [meal.mealName, meal.user.name].some((value) => queueLabel(value).includes(query))
  ).sort((a, b) => Number(b.claimStatus.claimedByMe) - Number(a.claimStatus.claimedByMe));

  return (
    <WorkspaceListPane visible={!selectedMealId} className={expanded ? '!hidden' : ''}>
      <QueueHeader
        title="Case queue"
        count={queue.length}
        search={search}
        onSearch={setSearch}
        searchLabel="Search meals or members"
        description="Select a meal to preview its evidence. Claim it when ready to decide."
      />
      {queueError && (
        <FeedbackNotice tone="warning" role="alert" className="my-3">
          <p>{queueError}</p>
          {queue.length > 0 && (
            <p className="text-xs text-brand-muted">Showing the last loaded queue. Refresh before choosing new work.</p>
          )}
          <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => void fetchQueue()}>
            Retry queue
          </Button>
        </FeedbackNotice>
      )}
      {isLoading ? (
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <QueueSkeleton />
        </div>
      ) : queueError && queue.length === 0 ? null : !visibleQueue.length ? (
        <div className="p-4 text-sm text-brand-muted">
          {queue.length ? (
            <p role="status">No cases match your search.</p>
          ) : (
            <>
              <p className="font-semibold text-brand-text">Queue clear</p>
              <p role={errorMsg ? 'alert' : 'status'} className="mt-1 text-xs">
                {errorMsg || 'No meals awaiting review in this queue.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <QueueList label="Meals awaiting case approval">
          {visibleQueue.map((meal) => {
            const claimLabel = meal.claimStatus.claimedByMe ? 'Claimed by you'
              : meal.claimStatus.claimedByOther ? 'Being reviewed'
              : meal.claimStatus.coolingDownForMe ? `Your claim expired. Available after ${meal.claimStatus.cooldownUntil && Number.isFinite(new Date(meal.claimStatus.cooldownUntil).getTime()) ? formatPhilippineDateTime(meal.claimStatus.cooldownUntil) : 'the cooldown'}.` : null;
            const ClaimIcon = meal.claimStatus.claimedByMe ? ShieldCheck : meal.claimStatus.claimedByOther ? Lock : Clock;
            return (
            <QueueRow
              key={meal.id}
              title={formatMealTitle(meal.mealName)}
              selected={selectedMealId === meal.id}
              disabled={meal.claimStatus.claimedByOther || meal.claimStatus.coolingDownForMe}
              onSelect={() => {
                if (!meal.claimStatus.claimedByOther && !meal.claimStatus.coolingDownForMe) handleSelectMeal(meal.id);
              }}
            >
              <span className="flex items-center gap-2 text-brand-muted">
                <span className="min-w-0 break-words">{meal.user.name}</span>
                {claimLabel && <span role="img" aria-label={claimLabel} title={claimLabel} className={`shrink-0 ${meal.claimStatus.claimedByMe ? 'text-brand-green' : ''}`}><ClaimIcon aria-hidden="true" className="h-3.5 w-3.5" /></span>}
              </span>
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-brand-text">
                <span className="whitespace-nowrap">Shop by {recordedDate(meal.shoppingDeadlineAt)}</span>
                <span className="whitespace-nowrap">Cook {recordedDate(meal.cookDeadlineAt)}</span>
              </span>
            </QueueRow>
            );
          })}
        </QueueList>
      )}
    </WorkspaceListPane>
  );
}
