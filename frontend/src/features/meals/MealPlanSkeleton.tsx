import Skeleton from '@/components/ui/Skeleton';
import { SkeletonDaySelector, SkeletonMacros, SkeletonMealTile } from '@/components/shared/WorkspaceSkeleton';

export function MealPlanSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading meal plan schedule" aria-busy="true">
      <SkeletonDaySelector />
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 px-1 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <SkeletonMacros />
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonMealTile key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
export default MealPlanSkeleton;
