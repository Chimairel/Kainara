import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function GrocerySkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading grocery checklist">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 sm:w-64 rounded-2xl" />
          <Skeleton className="h-4 w-72 sm:w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-28 rounded-2xl" />
          <Skeleton className="h-10 w-32 rounded-2xl" />
        </div>
      </div>

      {/* 2. Search & Filter Bar Skeleton */}
      <section className="rounded-[24px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-card backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Skeleton className="h-11 w-full flex-1 rounded-2xl border border-brand-border/70" />
          <div className="flex min-w-0 items-center gap-1.5 rounded-2xl bg-brand-bgAlt/60 dark:bg-white/[0.04] p-1.5">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-xl" />
            ))}
          </div>
        </div>
      </section>

      {/* 3. Category Groups Skeletons */}
      <div className="flex flex-col gap-5">
        {[...Array(3)].map((_, groupIndex) => (
          <div
            key={groupIndex}
            className="overflow-hidden rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface shadow-card"
          >
            {/* Category Header */}
            <div className="flex items-center justify-between border-b border-brand-border/50 bg-brand-bgAlt/30 px-6 py-4.5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-lg" />
                <Skeleton className="h-5 w-36 rounded-lg" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>

            {/* Checklist Items */}
            <div className="divide-y divide-brand-border/30 px-3 py-2">
              {[...Array(3)].map((_, itemIndex) => (
                <div key={itemIndex} className="flex items-center justify-between px-3 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <Skeleton className="h-5 w-5 rounded-lg shrink-0" />
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-4 w-40 sm:w-56 rounded-md" />
                      <Skeleton className="h-3 w-24 rounded-md" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GrocerySkeleton;
