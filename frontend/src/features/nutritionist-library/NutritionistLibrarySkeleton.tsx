import React from 'react';
import { ImageIcon } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';

export function LibraryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Loading meal library grid">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-sm space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-5 w-4/5 rounded-lg" />
                <Skeleton className="h-3.5 w-3/5 rounded" />
              </div>
              <Skeleton className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl">
                <ImageIcon className="h-6 w-6 text-brand-muted/30 dark:text-white/20" aria-hidden="true" />
              </Skeleton>
            </div>

            {/* Macro Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="h-5 w-16 rounded-full" />
              ))}
            </div>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between border-t border-brand-border/40 pt-3">
            <Skeleton className="h-3 w-32 rounded" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
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
