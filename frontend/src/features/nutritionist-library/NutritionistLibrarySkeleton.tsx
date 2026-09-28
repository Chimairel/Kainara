import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function LibraryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading meal library grid"
    >
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-[22px] border border-brand-border/70 bg-brand-surface p-5 shadow-sm space-y-4"
        >
          <div className="space-y-3">
            {/* Top image placeholder */}
            <Skeleton className="h-40 w-full rounded-2xl" />

            {/* Slot & calories header */}
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>

            {/* Meal Title & description */}
            <div className="space-y-2">
              <Skeleton className="h-5 w-4/5 rounded-lg" />
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>

            {/* Macros */}
            <Skeleton className="h-4 w-44 rounded" />
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between border-t border-brand-border/40 pt-3">
            <div className="space-y-1">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
            <Skeleton className="h-8 w-16 rounded-xl" />
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-8 w-56 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* 2. Section Navigation Tabs */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-brand-border/70 bg-brand-surface/85 p-1.5 shadow-card">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-2 ${
              i === 0 ? 'bg-brand-accent/20 border border-brand-accent/30' : 'bg-transparent'
            }`}
          >
            <Skeleton className="h-3.5 w-28 rounded" />
          </div>
        ))}
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border/70 bg-brand-surface/85 p-3 shadow-card">
        <Skeleton className="h-10 min-w-[240px] flex-1 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* 4. Recipe Cards Grid */}
      <LibraryGridSkeleton count={6} />
    </div>
  );
}

export default NutritionistLibrarySkeleton;
