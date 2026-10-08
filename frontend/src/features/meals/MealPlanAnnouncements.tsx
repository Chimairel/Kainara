'use client';

import AnnouncementBanner from '@/components/shared/AnnouncementBanner';
import { announcementPriority, PortalAnnouncement } from '@/components/shared/PortalAnnouncements';

export default function MealPlanAnnouncements({
  pendingCount = 0,
  isStarterPlan = false,
  nextCycleDay,
  upcomingOnly = false,
}: {
  pendingCount?: number;
  isStarterPlan?: boolean;
  nextCycleDay?: string | null;
  upcomingOnly?: boolean;
}) {
  return (
    <>
      {pendingCount > 0 && (
        <PortalAnnouncement priority={announcementPriority.review}>
          <AnnouncementBanner
            ariaLabel="Meal review status"
            variant="warning"
            title={`${pendingCount} meal${pendingCount === 1 ? '' : 's'} pending RND review.`}
            message={`${upcomingOnly ? 'Upcoming meals' : 'Pending meals'} are previews. Open a preview to see its ingredients; logging becomes available after approval.`}
          />
        </PortalAnnouncement>
      )}
      {isStarterPlan && (
        <PortalAnnouncement priority={announcementPriority.plan}>
          <AnnouncementBanner
            ariaLabel="Starter plan status"
            variant="blue"
            title="You’re on a starter plan."
            message={
              nextCycleDay
                ? `Your full 7-day cycle begins on ${nextCycleDay}.`
                : 'This plan bridges to your next full weekly cycle.'
            }
          />
        </PortalAnnouncement>
      )}
    </>
  );
}
