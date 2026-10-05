import Skeleton from '@/components/ui/Skeleton';

export default function UserPortalLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56 rounded-2xl" />
            <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-10 w-36 rounded-2xl" />
          </div>
        </div>
        <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 sm:p-8 shadow-card">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-brand-border/50 pb-4">
              <Skeleton className="h-6 w-44 rounded-lg" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
