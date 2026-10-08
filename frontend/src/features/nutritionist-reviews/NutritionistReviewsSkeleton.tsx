import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import SplitWorkspace, { WorkspaceListPane } from '@/components/shared/SplitWorkspace';
import { SkeletonHeader, SkeletonMacros, SkeletonTabs } from '@/components/shared/WorkspaceSkeleton';

export function ReviewQueueSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading review queue items" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="space-y-3 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex items-center gap-2 border-t border-brand-border/40 pt-2.5">
            <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}
export function ReviewDetailSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading review details" aria-busy="true">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap justify-between gap-3">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <Skeleton className="mt-4 h-7 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-5">
          <SkeletonMacros />
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-4 p-6">
            <Skeleton className="h-5 w-40 max-w-full" />
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-16 w-full rounded-xl" />
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
export function NutritionistReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-5 text-left" aria-label="Loading RND review workspace" aria-busy="true">
      <SkeletonHeader />
      <SkeletonTabs count={3} />
      <div className="w-full max-w-lg">
        <SkeletonTabs count={3} />
      </div>
      <SplitWorkspace className="md:h-[calc(100vh-270px)] md:min-h-[640px] rounded-3xl">
        <WorkspaceListPane>
          <Skeleton className="mb-4 h-5 w-24" />
          <ReviewQueueSkeleton count={5} />
        </WorkspaceListPane>
        <div className="hidden min-w-0 flex-1 p-4 md:block sm:p-6">
          <Card className="space-y-6 rounded-3xl p-6 sm:p-8">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-16 w-full rounded-xl" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </Card>
        </div>
      </SplitWorkspace>
    </div>
  );
}
export default NutritionistReviewsSkeleton;
