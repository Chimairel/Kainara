import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import { SkeletonHeader, SkeletonMetrics } from '@/components/shared/WorkspaceSkeleton';

export function NutritionistProfileSkeleton() {
  return (
    <div
      className="portal-page max-w-5xl space-y-6 text-left"
      aria-label="Loading professional profile"
      aria-busy="true"
    >
      <SkeletonHeader />
      <Card className="rounded-[28px] p-0">
        <div className="flex justify-between gap-3 border-b border-brand-border px-6 py-2.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <div className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Skeleton className="h-28 w-28 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-3">
              <Skeleton className="h-7 w-52 max-w-full" />
              <Skeleton className="h-5 w-44 max-w-full rounded-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-32 self-center rounded-xl" />
        </div>
      </Card>
      <SkeletonMetrics className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card className="space-y-5 rounded-3xl p-6">
            <Skeleton className="h-5 w-44 max-w-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-full rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
            <Skeleton className="ml-auto h-11 w-36 rounded-2xl" />
          </Card>
          <Card className="space-y-4 rounded-3xl p-6">
            <Skeleton className="h-5 w-44 max-w-full" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-6 lg:col-span-5">
          <div className="space-y-3">
            <Skeleton className="h-5 w-44 max-w-full" />
            <Card className="space-y-4 p-6">
              <Skeleton className="mx-auto h-28 w-28 rounded-full" />
              <Skeleton className="mx-auto h-6 w-40 max-w-full" />
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-11 w-full rounded-2xl" />
            </Card>
          </div>
          <Card className="space-y-3 rounded-2xl p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </Card>
        </div>
      </div>
    </div>
  );
}
export default NutritionistProfileSkeleton;
