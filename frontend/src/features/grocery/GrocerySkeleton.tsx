import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import { SkeletonTable, SkeletonTabs } from '@/components/shared/WorkspaceSkeleton';

export function GrocerySkeleton() {
  return (
    <div className="flex flex-col gap-5 text-left" aria-label="Loading grocery checklist" aria-busy="true">
      <SkeletonTabs count={2} />
      <Card className="rounded-[28px] p-6 sm:rounded-[32px] sm:p-7">
        <div className="pl-14 sm:pl-24">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-5 w-52 max-w-full rounded-full" />
            <Skeleton className="h-11 w-32 rounded-2xl" />
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="mt-3.5 h-3 w-full rounded-full" />
        </div>
      </Card>
      <Card className="rounded-[24px] p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Skeleton className="h-11 w-full flex-1 rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl sm:w-56" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-brand-border/40 pt-3">
          <div className="w-full max-w-xs">
            <SkeletonTabs count={3} />
          </div>
          <Skeleton className="h-3 w-32" />
        </div>
      </Card>
      <SkeletonTable />
    </div>
  );
}
export default GrocerySkeleton;
