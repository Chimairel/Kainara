import Skeleton from '@/components/ui/Skeleton';

export default function OutsideMealsLoading() {
  return (
    <div className="portal-page flex flex-col gap-6 text-left" aria-label="Loading outside meal reviews">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded" />
      </div>

      {/* 2-column layout */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-56 rounded" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex gap-2">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-4 w-14 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-card space-y-4">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
