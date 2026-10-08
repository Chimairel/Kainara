'use client';

import AnnouncementBanner from '@/components/shared/AnnouncementBanner';
import type { useDashboardWorkspace } from './useDashboardWorkspace';
import { PortalAnnouncement, announcementPriority } from '@/components/shared/PortalAnnouncements';

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
          <PortalAnnouncement
            priority={generationStatus === 'FAILED' ? announcementPriority.action : announcementPriority.preparation}
          >
            <div role="status">
              <AnnouncementBanner
                ariaLabel="Meal preparation status"
                variant={generationStatus === 'FAILED' ? 'warning' : 'info'}
                title={`${awaitingGenerationCount} meal slot${awaitingGenerationCount === 1 ? '' : 's'} ${generationStatus === 'FAILED' ? 'could not be prepared' : 'still awaiting generation'}.`}
                message={`${
                  generationStatus === 'FAILED'
                    ? currentMeals.length || pendingReview?.meals?.length
                      ? 'Saved candidates remain available.'
                      : 'No meal candidates were saved for this cycle.'
                    : 'The earliest days are first in line.'
                } Empty slots are not available for shopping or logging.`}
                action={
                  generationStatus === 'FAILED' && currentCycle?.id
                    ? {
                        label: isRetryingMissing ? 'Retrying…' : 'Retry missing slots',
                        onClick: () => void retryMissingGeneration(),
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
