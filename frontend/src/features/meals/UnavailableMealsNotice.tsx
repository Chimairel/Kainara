import type { CycleMetaSnapshot } from '@/features/dashboard/model';
import Button from '@/components/ui/Button';

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
    <section
      role="status"
      className="rounded-xl border border-status-pending-text/30 bg-status-pending-bg/15 p-4 text-sm text-brand-text"
    >
      <p className="font-semibold">
        {upcoming ? 'Upcoming plan' : 'Current plan'}: {cycle.unavailableMealCount} unavailable meal
        {cycle.unavailableMealCount === 1 ? '' : 's'}
      </p>
      <p className="mt-1">
        {retired > 0 ? 'Old test recipes were removed from planning. ' : ''}These slots are excluded from meals, logging
        and shopping until suitable replacements are ready. Other cleared meals remain available.
      </p>
      {retired > 0 && onRepair && (
        <Button variant="secondary" className="mt-3" onClick={onRepair} disabled={isRepairing}>
          {isRepairing ? 'Replacing…' : 'Replace retired meals'}
        </Button>
      )}
    </section>
  );
}
