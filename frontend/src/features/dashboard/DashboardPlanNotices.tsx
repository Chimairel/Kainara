'use client';

import Button from '@/components/ui/Button';
import type { useDashboardWorkspace } from './useDashboardWorkspace';

type Props = {
  model: Pick<
    ReturnType<typeof useDashboardWorkspace>,
    | 'isLoading'
    | 'awaitingGenerationCount'
    | 'isReportPending'
    | 'clinicalEvidenceRequired'
    | 'currentMeals'
    | 'pendingReview'
    | 'generationStatus'
    | 'currentCycle'
    | 'retryMissingGeneration'
    | 'isRetryingMissing'
  >;
};
export default function DashboardPlanNotices({ model }: Props) {
  const {
    isLoading,
    awaitingGenerationCount,
    isReportPending,
    clinicalEvidenceRequired,
    currentMeals,
    pendingReview,
    generationStatus,
    currentCycle,
    retryMissingGeneration,
    isRetryingMissing,
  } = model;

  return (
    <>
      {!isLoading &&
        awaitingGenerationCount > 0 &&
        !isReportPending &&
        !clinicalEvidenceRequired &&
        (currentMeals.length > 0 || Boolean(pendingReview?.meals?.length)) && (
          <div
            role="status"
            className="rounded-xl border border-status-pending-text/30 bg-status-pending-bg/15 p-4 text-sm text-brand-text"
          >
            {awaitingGenerationCount} meal slot{awaitingGenerationCount === 1 ? '' : 's'}{' '}
            {generationStatus === 'FAILED' ? 'could not be prepared' : 'still awaiting generation'}.{' '}
            {generationStatus === 'FAILED'
              ? currentMeals.length || pendingReview?.meals?.length
                ? 'Saved candidates remain available.'
                : 'No meal candidates were saved for this cycle.'
              : 'The earliest days are first in line.'}{' '}
            Empty slots are not available for shopping or logging.
            {generationStatus === 'FAILED' && currentCycle?.id && (
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => void retryMissingGeneration()}
                disabled={isRetryingMissing}
              >
                {isRetryingMissing ? 'Retrying…' : 'Retry missing slots'}
              </Button>
            )}
          </div>
        )}
    </>
  );
}
