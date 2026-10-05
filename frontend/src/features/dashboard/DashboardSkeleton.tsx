import Skeleton from '@/components/ui/Skeleton';
import { SkeletonDaySelector, SkeletonHeader } from '@/components/shared/WorkspaceSkeleton';

export function DashboardSkeleton({ includeHeader = false }: { includeHeader?: boolean }) {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading daily dashboard" aria-busy="true">
      {includeHeader && <SkeletonHeader actions={2} />}
      <SkeletonDaySelector />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.4fr)]" aria-hidden="true">
        <div className="flex min-h-full min-w-0 flex-col justify-between rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-6">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="my-6 flex items-center gap-5 sm:gap-6">
            <Skeleton className="h-[152px] w-[152px] max-w-[55%] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-5">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20 max-w-full" />
                  <Skeleton className="h-7 w-24 max-w-full" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="mb-5 ml-auto h-4 w-36 max-w-full" />
          <div className="space-y-5 border-t border-brand-border/50 pt-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-6 h-4 w-3/4" />
        </div>
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-44" />
          </div>
          <div className="space-y-4 pl-7 sm:pl-10 lg:pl-11">
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative rounded-3xl border border-brand-border bg-brand-surface p-4 sm:p-5">
                <div className="mb-3 flex justify-between gap-2 sm:hidden">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="-ml-7 h-24 w-24 shrink-0 rounded-full sm:-ml-10 sm:h-32 sm:w-32 lg:h-36 lg:w-36" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="hidden h-3 w-20 sm:block" />
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
                <div className="mt-3 border-t border-brand-border/40 pt-3 sm:mt-0 sm:border-0 sm:pt-0">
                  <Skeleton className="ml-auto h-11 w-full rounded-full sm:h-9 sm:w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
export default DashboardSkeleton;
