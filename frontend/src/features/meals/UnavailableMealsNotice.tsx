import type { CycleMetaSnapshot } from '@/features/dashboard/model';
import AnnouncementBanner from '@/components/shared/AnnouncementBanner';
import { PortalAnnouncement, announcementPriority } from '@/components/shared/PortalAnnouncements';

export default function UnavailableMealsNotice({
  cycle,
  upcoming = false,
  onRepair,
  isRepairing = false,
}: {
  cycle: CycleMetaSnapshot;
  upcoming?: boolean;
  onRepair?: () => void;
  isRepairing?: boolean;
}) {
  if (!cycle?.unavailableMealCount) return null;
  const retired = cycle.retiredMealCount ?? 0;
  return (
    <PortalAnnouncement priority={announcementPriority.safety}>
      <div role="status">
        <AnnouncementBanner
          variant="warning"
          title={`${upcoming ? 'Upcoming plan' : 'Current plan'}: ${cycle.unavailableMealCount} unavailable meal${cycle.unavailableMealCount === 1 ? '' : 's'}`}
          message={`${retired > 0 ? 'Old test recipes were removed from planning. ' : ''}These slots are excluded from meals, logging and shopping until suitable replacements are ready. Other cleared meals remain available.`}
          action={
            retired > 0 && onRepair
              ? {
                  label: isRepairing ? 'Replacing…' : 'Replace retired meals',
                  onClick: onRepair,
                  disabled: isRepairing,
                }
              : undefined
          }
        />
      </div>
    </PortalAnnouncement>
  );
}
