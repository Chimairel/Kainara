import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import { SkeletonHeader, SkeletonMacros } from '@/components/shared/WorkspaceSkeleton';

export function ApprovedReviewsSkeleton({ includeHeader = true }: { includeHeader?: boolean }) {
  return (
    <div className="space-y-6 text-left" aria-label="Loading approved reviews archive" aria-busy="true">
      {includeHeader && <SkeletonHeader actions={1} />}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-4 w-24" />
                <SkeletonMacros />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-52 max-w-full" />
                <Skeleton className="h-3 w-40 max-w-full" />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-brand-border/40 pt-2.5 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
export default ApprovedReviewsSkeleton;
