import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

/** Shared loading shapes. Callers choose the same layout and breakpoints as the loaded page. */
export function SkeletonHeader({ actions = 0 }: { actions?: number }) {
  return (
    <header className="workspace-header" aria-hidden="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-60 max-w-full sm:h-9 rounded-lg" />
          <Skeleton className="h-5 w-full max-w-2xl rounded" />
        </div>
        {actions > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: actions }, (_, i) => (
              <Skeleton key={i} className="h-11 w-32 rounded-2xl" />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function SkeletonTabs({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex gap-1.5 rounded-[22px] border border-brand-border/70 bg-brand-surface p-1.5 shadow-sm"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-11 min-w-0 flex-1 rounded-2xl" />
      ))}
    </div>
  );
}

export function SkeletonDaySelector() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex max-w-full items-center gap-1.5 rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card sm:gap-2"
    >
      <Skeleton className="h-10 w-8 shrink-0 rounded-xl sm:h-12 sm:w-10" />
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="flex min-w-[66px] flex-1 flex-col items-center gap-1.5 rounded-xl px-2 py-2 sm:min-w-[76px] sm:px-4 sm:py-3"
          >
            <Skeleton className="h-2 w-6" />
            <Skeleton className="h-5 w-6" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-8 shrink-0 rounded-xl sm:h-12 sm:w-10" />
    </div>
  );
}

export function SkeletonMacros() {
  return (
    <div aria-hidden="true" className="flex flex-wrap gap-1.5">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-6 w-14 rounded-full" />
      ))}
    </div>
  );
}

export function SkeletonMealTile({ footer = false }: { footer?: boolean }) {
  return (
    <article
      aria-hidden="true"
      className="flex h-full min-w-0 flex-col rounded-3xl bg-brand-surface p-2 shadow-card sm:p-2.5"
    >
      <div className="relative h-40 overflow-hidden rounded-2xl sm:h-44">
        <Skeleton className="absolute inset-0 h-full w-full rounded-2xl" />
        <Skeleton className="absolute -left-9 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full sm:-left-12 sm:h-56 sm:w-56" />
        <div className="absolute right-2.5 top-2.5 space-y-1.5">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="ml-auto h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-2 pt-2.5">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <SkeletonMacros />
        {footer && (
          <div className="flex items-center justify-between gap-2 border-t border-brand-border/40 pt-2.5">
            <Skeleton className="h-3 w-28 max-w-full" />
            <Skeleton className="h-11 w-14 rounded-2xl" />
          </div>
        )}
      </div>
    </article>
  );
}

export function SkeletonMetrics({ className = 'grid grid-cols-2 gap-3 lg:grid-cols-4' }: { className?: string }) {
  return (
    <section aria-hidden="true" className={className}>
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i} variant="metric" className="min-w-0 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-8 w-24 max-w-full" />
          <Skeleton className="mt-1 h-4 w-24 max-w-full" />
        </Card>
      ))}
    </section>
  );
}

export function SkeletonTable({ columns = 5, rows = 4 }: { columns?: number; rows?: number }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
      <div className="flex gap-4 border-b border-brand-border px-4 py-4">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 min-w-0 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-brand-border/40 px-4 py-4">
          <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          <Skeleton className="h-4 min-w-0 flex-[3]" />
          {Array.from({ length: columns - 2 }, (_, j) => (
            <Skeleton key={j} className="h-4 min-w-0 flex-1" />
          ))}
        </div>
      ))}
      <div className="flex justify-between gap-4 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
