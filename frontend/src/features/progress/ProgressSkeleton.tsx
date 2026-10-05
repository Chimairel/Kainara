import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import { SkeletonHeader, SkeletonMetrics, SkeletonTable, SkeletonTabs } from '@/components/shared/WorkspaceSkeleton';

type Props = {
  includeHeader?: boolean;
  section?: 'overview' | 'history' | 'profile' | 'safety';
  mode?: 'progress' | 'health' | 'planning';
};
export function ProgressSkeleton({ includeHeader = false, section = 'overview', mode = 'progress' }: Props) {
  return (
    <div className="text-left" aria-label="Loading progress data" aria-busy="true">
      {includeHeader && (
        <div className="mb-6 space-y-6">
          <SkeletonHeader actions={2} />
          <SkeletonTabs count={2} />
        </div>
      )}
      {section === 'overview' ? (
        <>
          <div className="mb-6">
            <SkeletonMetrics />
          </div>
          <Card className="mb-6 p-4 sm:p-6">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                  <Skeleton className="h-5 w-36" />
                </div>
                <Skeleton className="mt-1 ml-9 h-4 w-40 max-w-[calc(100%-36px)]" />
              </div>
              <Skeleton className="h-11 w-40 self-end rounded-2xl" />
            </div>
            <div className="rounded-2xl border border-brand-border/70 p-3 sm:p-5">
              <Skeleton className="h-[260px] w-full rounded-xl sm:h-60" />
              <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-brand-border/60 pt-3">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
          </Card>
          <Card className="mb-8 p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap justify-between gap-3 border-b border-brand-border/50 pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Skeleton className="h-8 w-8 shrink-0 rounded-xl" />
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-4 w-60 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <SkeletonTable columns={6} rows={4} />
          </Card>
        </>
      ) : section === 'history' ? (
        <div className="space-y-5">
          <div className="flex justify-end">
            <Skeleton className="h-11 w-40 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-28 max-w-full" />
                <Skeleton className="mt-3 h-7 w-20" />
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <Skeleton className="mb-5 h-5 w-40" />
            <SkeletonTable columns={6} />
          </Card>
        </div>
      ) : (
        <Card className="mb-8 p-6">
          <Skeleton className="mb-5 h-5 w-48 max-w-full" />
          {section === 'safety' ? (
            <div className="space-y-5">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-11 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: mode === 'planning' ? 4 : 8 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-28 max-w-full" />
                  <Skeleton className="h-11 w-full rounded-2xl" />
                </div>
              ))}
            </div>
          )}
          <Skeleton className="mt-6 ml-auto h-11 w-36 rounded-2xl" />
        </Card>
      )}
    </div>
  );
}
export default ProgressSkeleton;
