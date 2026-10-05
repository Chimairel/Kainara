import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function ApprovedReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading approved reviews archive">
      {/* 1. Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-2xl" />
          <Skeleton className="h-4 w-80 sm:w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-32 rounded-2xl" />
        </div>
      </div>

      {/* 2. Filter & Search Strip */}
      <div className="flex items-center justify-between gap-3 rounded-[24px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-card">
        <Skeleton className="h-10 flex-1 max-w-md rounded-2xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* 3. Grid of approved meal cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 shadow-card space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <Skeleton className="h-6 w-4/5 rounded-xl" />
              <div className="flex items-center gap-2.5 pt-1">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </div>

            <div className="space-y-3 border-t border-brand-border/40 pt-3.5">
              <div className="grid grid-cols-4 gap-2">
                {[...Array(4)].map((_, j) => (
                  <Skeleton key={j} className="h-8 rounded-xl" />
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-3.5 w-28 rounded" />
                <Skeleton className="h-9 w-24 rounded-2xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApprovedReviewsSkeleton;
