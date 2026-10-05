import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import MealLibraryLayout from '@/components/shared/MealLibraryLayout';
import { SkeletonHeader, SkeletonMealTile, SkeletonTabs } from '@/components/shared/WorkspaceSkeleton';

export function LibraryGridSkeleton({
  count = 6,
  variant = 'staff',
}: {
  count?: number;
  variant?: 'staff' | 'member';
}) {
  return (
    <div aria-label="Loading meal library grid" aria-busy="true">
      <MealLibraryLayout label="Loading recipe cards">
        {Array.from({ length: count }, (_, i) => (
          <SkeletonMealTile key={i} footer={variant === 'staff'} />
        ))}
      </MealLibraryLayout>
    </div>
  );
}
export function NutritionistLibrarySkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading meal library catalog" aria-busy="true">
      <SkeletonHeader actions={1} />
      <div className="w-full max-w-xs">
        <SkeletonTabs count={2} />
      </div>
      <Card className="rounded-[22px] p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-11 w-full rounded-2xl" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-brand-border/40 pt-3">
          <Skeleton className="h-5 w-56 max-w-full" />
          <Skeleton className="h-5 w-28" />
        </div>
      </Card>
      <LibraryGridSkeleton />
    </div>
  );
}
export default NutritionistLibrarySkeleton;
