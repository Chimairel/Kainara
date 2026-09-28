import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function ApprovedReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading approved reviews archive">
      {/* Page Header */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-8 w-60 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded" />
      </div>

      {/* Grid of approved meal cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-sm space-y-4"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <Skeleton className="h-5 w-3/4 rounded-lg" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3.5 w-28 rounded" />
              </div>
            </div>

            <div className="space-y-2 border-t border-brand-border/40 pt-3">
              <div className="grid grid-cols-4 gap-2">
                {[...Array(4)].map((_, j) => (
                  <Skeleton key={j} className="h-8 rounded-lg" />
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApprovedReviewsSkeleton;
