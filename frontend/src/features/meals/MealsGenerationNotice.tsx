'use client';

import Button from '@/components/ui/Button';
import { Clock3 } from 'lucide-react';
import type { useMealsPage } from './useMealsPage';

type Props = {
  model: Pick<
    ReturnType<typeof useMealsPage>,
    | 'activeTab'
    | 'isLoading'
    | 'awaitingGenerationCount'
    | 'clinicalEvidenceRequired'
    | 'isReportPending'
    | 'displayedPlanDays'
    | 'pendingReview'
    | 'activeGenerationStatus'
    | 'displayedMealCount'
    | 'generationCycleId'
    | 'retryMissingGeneration'
    | 'isRetryingMissing'
  >;
};
export default function MealsGenerationNotice({ model }: Props) {
  const {
    activeTab,
    isLoading,
    awaitingGenerationCount,
    clinicalEvidenceRequired,
    isReportPending,
    displayedPlanDays,
    pendingReview,
    activeGenerationStatus,
    displayedMealCount,
    generationCycleId,
    retryMissingGeneration,
    isRetryingMissing,
  } = model;

  return (
    <>
      {activeTab === 'plan' &&
        !isLoading &&
        awaitingGenerationCount > 0 &&
        !clinicalEvidenceRequired &&
        !isReportPending &&
        (displayedPlanDays.length > 0 || Boolean(pendingReview)) && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/15 px-4 py-3 text-sm text-brand-text"
          >
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-text" />
            <div>
              <p>
                {awaitingGenerationCount} meal slot{awaitingGenerationCount === 1 ? '' : 's'}{' '}
                {activeGenerationStatus === 'FAILED' ? 'could not be prepared' : 'still awaiting generation'}.{' '}
                {activeGenerationStatus === 'FAILED'
                  ? displayedMealCount > 0
                    ? 'Saved candidates remain available while you retry the missing slots.'
                    : 'No meal candidates were saved for this cycle.'
                  : 'KAINARA fills the earliest days first as AI capacity becomes available.'}{' '}
                Empty slots cannot be reviewed, logged, swapped, or added to groceries yet.
              </p>
              {activeGenerationStatus === 'FAILED' && generationCycleId && (
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => void retryMissingGeneration(generationCycleId)}
                  disabled={isRetryingMissing}
                >
                  {isRetryingMissing ? 'Retrying…' : 'Retry missing slots'}
                </Button>
              )}
            </div>
          </div>
        )}
    </>
  );
}
