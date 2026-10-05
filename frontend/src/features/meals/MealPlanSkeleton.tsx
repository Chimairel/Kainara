import React from 'react';
import { ImageIcon } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';

export function MealPlanSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading meal plan schedule">
      {/* 1. Day Selector Strip Skeleton */}
      <section className="mx-auto flex max-w-full items-center gap-1.5 sm:gap-2 rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card">
        {/* Prev arrow button skeleton */}
        <Skeleton className="h-10 w-8 sm:h-12 sm:w-10 shrink-0 rounded-xl sm:rounded-2xl border border-brand-border/70" />

        {/* 7-day pill skeletons */}
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className={`flex min-w-[70px] sm:min-w-[88px] flex-1 flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-2 sm:px-3 py-2 sm:py-2.5 gap-1.5 ${
                i === 0
                  ? 'border-brand-green/30 bg-brand-green/10 dark:border-brand-green/40 dark:bg-brand-green/10'
                  : 'border-brand-border/60 bg-brand-bgAlt/50 dark:border-[#173e33] dark:bg-[#0e271f]'
              }`}
            >
              <Skeleton className="h-2.5 w-8 rounded" />
              <Skeleton className="h-5 w-6 rounded" />
              <Skeleton className="h-2 w-10 rounded" />
            </div>
          ))}
        </div>

        {/* Next arrow button skeleton */}
        <Skeleton className="h-10 w-8 sm:h-12 sm:w-10 shrink-0 rounded-xl sm:rounded-2xl border border-brand-border/70" />
      </section>

      {/* 2. Day Plan Card Container Skeleton */}
      <section className="overflow-hidden rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface shadow-card">
        {/* Day Header with sum targets */}
        <div className="flex flex-col justify-between gap-3 border-b border-brand-border/60 bg-brand-bgAlt/35 px-5 py-4.5 sm:px-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-44 rounded-xl" />
            <Skeleton className="h-3.5 w-32 rounded-lg" />
          </div>

          {/* Macro pills */}
          <div className="flex gap-2 flex-wrap items-center">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>

        {/* 3 Meal Cards Grid */}
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-3 sm:p-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex h-full flex-col justify-between rounded-[24px] sm:rounded-[28px] border border-brand-border/80 bg-brand-surface p-5 shadow-sm space-y-4"
            >
              <div className="space-y-3.5">
                {/* Image Placeholder */}
                <Skeleton className="flex h-40 sm:h-44 w-full items-center justify-center rounded-2xl">
                  <ImageIcon className="h-7 w-7 text-brand-muted/30 dark:text-white/20" aria-hidden="true" />
                </Skeleton>

                {/* Card Top Row: Meal type label & status badge */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-4 w-18 rounded-lg" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>

                {/* Meal Title & description */}
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-4/5 rounded-lg" />
                  <Skeleton className="h-3.5 w-1/2 rounded" />
                </div>

                {/* Macro Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
              </div>

              {/* Bottom Row: Actions */}
              <div className="flex items-center justify-between border-t border-brand-border/40 pt-3">
                <Skeleton className="h-9 w-20 rounded-2xl" />
                <Skeleton className="h-9 w-24 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default MealPlanSkeleton;
