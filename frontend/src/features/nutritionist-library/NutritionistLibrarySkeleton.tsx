import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function LibraryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading meal library grid">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-[24px] sm:rounded-[32px] border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-card space-y-4"
        >
          <div className="space-y-3.5">
            {/* Top image placeholder */}
            <Skeleton className="h-44 w-full rounded-2xl" />

            {/* Slot & calories header */}
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-5 w-24 rounded-lg" />
              <Skeleton className="h-5 w-20 rounded-lg" />
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>

            {/* Meal Title & description */}
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-4/5 rounded-lg" />
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>

            {/* Macros */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between border-t border-brand-border/40 pt-3">
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <Skeleton className="h-9 w-24 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NutritionistLibrarySkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading meal library catalog">
      {/* 1. Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-60 sm:w-72 rounded-2xl" />
          <Skeleton className="h-4 w-72 sm:w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 2. Filter & Category Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[24px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-card">
        <Skeleton className="h-10 flex-1 max-w-md rounded-2xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </div>

      {/* 3. Grid of library meals */}
      <LibraryGridSkeleton count={6} />
    </div>
  );
}

export default NutritionistLibrarySkeleton;
