import Skeleton from '@/components/ui/Skeleton';

export default function OutsideMealsLoading() {
  return (
    <div className="portal-page flex flex-col gap-6 text-left" aria-label="Loading outside meal reviews">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-2xl" />
          <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-32 rounded-2xl" />
        </div>
      </div>

      {/* 2. 2-column layout */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="flex flex-col gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-[24px] sm:rounded-[28px] border border-brand-border bg-brand-surface p-5 shadow-card space-y-3.5"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-5 w-44 rounded-lg" />
                  <Skeleton className="h-3.5 w-60 rounded" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex gap-2">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-5 w-16 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 shadow-card space-y-4">
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
