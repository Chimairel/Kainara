import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import { SkeletonHeader, SkeletonMacros } from '@/components/shared/WorkspaceSkeleton';

export function OutsideMealQueueSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading outside food estimates" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="space-y-3 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="h-3 w-28 max-w-full" />
              </div>
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="border-t border-brand-border/40 pt-3">
            <SkeletonMacros />
          </div>
        </Card>
      ))}
    </div>
  );
}
export default function OutsideMealsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading outside meal reviews" aria-busy="true">
      <SkeletonHeader />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <OutsideMealQueueSkeleton />
        <Card className="min-w-0 space-y-4 p-6">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-6 w-48 max-w-full" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </Card>
      </div>
    </div>
  );
}
