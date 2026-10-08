'use client';

import AnnouncementBanner from '@/components/shared/AnnouncementBanner';
import type { useMealsPage } from './useMealsPage';
import { PortalAnnouncement, announcementPriority } from '@/components/shared/PortalAnnouncements';

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
          <PortalAnnouncement
            priority={
              activeGenerationStatus === 'FAILED' ? announcementPriority.action : announcementPriority.preparation
            }
          >
            <div role="status">
              <AnnouncementBanner
                ariaLabel="Meal preparation status"
                variant={activeGenerationStatus === 'FAILED' ? 'warning' : 'info'}
                title={`${awaitingGenerationCount} meal slot${awaitingGenerationCount === 1 ? '' : 's'} ${activeGenerationStatus === 'FAILED' ? 'could not be prepared' : 'still awaiting generation'}.`}
                message={`${
                  activeGenerationStatus === 'FAILED'
                    ? displayedMealCount > 0
                      ? 'Saved candidates remain available while you retry the missing slots.'
                      : 'No meal candidates were saved for this cycle.'
                    : 'KAINARA fills the earliest days first as AI capacity becomes available.'
                } Empty slots cannot be reviewed, logged, swapped, or added to groceries yet.`}
                action={
                  activeGenerationStatus === 'FAILED' && generationCycleId
                    ? {
                        label: isRetryingMissing ? 'Retrying…' : 'Retry missing slots',
                        onClick: () => void retryMissingGeneration(generationCycleId),
                        disabled: isRetryingMissing,
                      }
                    : undefined
                }
              />
            </div>
          </PortalAnnouncement>
        )}
    </>
  );
}
