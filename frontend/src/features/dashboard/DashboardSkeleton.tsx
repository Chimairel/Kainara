import React from 'react';
import { ImageIcon } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading daily dashboard">
      {/* 1. Portal Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-60 sm:w-72 rounded-2xl" />
          <Skeleton className="h-4 w-80 sm:w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-10 w-36 sm:w-40 rounded-2xl" />
          <Skeleton className="h-10 w-28 sm:w-32 rounded-2xl" />
        </div>
      </div>

      {/* 2. Dashboard Hero Banner Card Skeleton */}
      <div className="relative overflow-hidden rounded-[28px] border border-brand-border/80 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/10 p-6 text-left shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-3 max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <Skeleton className="h-6 w-36 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <Skeleton className="h-7 w-64 sm:w-80 rounded-xl" />
            <Skeleton className="h-4 w-full max-w-md rounded-lg" />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
          <div className="shrink-0 self-start md:self-center">
            <Skeleton className="h-12 w-44 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* 3. Day Selector Strip Skeleton */}
      <div className="mx-auto flex max-w-full items-center gap-1.5 sm:gap-2 rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card">
        <Skeleton className="h-10 w-8 sm:h-12 sm:w-10 shrink-0 rounded-xl sm:rounded-2xl" />
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className={`flex min-w-[66px] sm:min-w-[76px] flex-1 flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-2 sm:px-4 py-2 sm:py-3 gap-1.5 ${
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
        <Skeleton className="h-10 w-8 sm:h-12 sm:w-10 shrink-0 rounded-xl sm:rounded-2xl" />
      </div>

      {/* 4. Daily Intake & Macro Summary Skeleton Card */}
      <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 sm:p-7 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border/50 pb-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <Skeleton className="h-3.5 w-60 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/30 p-4 space-y-2 text-center"
            >
              <Skeleton className="h-3 w-16 mx-auto rounded" />
              <Skeleton className="h-6 w-20 mx-auto rounded-lg" />
              <Skeleton className="h-2 w-24 mx-auto rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* 5. 3 Modern Meal Cards Skeleton (Breakfast, Lunch, Dinner) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-card space-y-4"
          >
            <div className="space-y-3.5">
              {/* Slot Header */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>

              {/* Meal Image Surface */}
              <Skeleton className="flex h-44 sm:h-48 w-full items-center justify-center rounded-2xl">
                <ImageIcon className="h-8 w-8 text-brand-muted/30 dark:text-white/20" aria-hidden="true" />
              </Skeleton>

              {/* Meal Title & Metadata */}
              <div className="space-y-1.5 pt-1">
                <Skeleton className="h-5 w-4/5 rounded-lg" />
                <Skeleton className="h-3.5 w-1/2 rounded" />
              </div>

              {/* Nutrition Macros Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 border-t border-brand-border/40 pt-3.5">
              <Skeleton className="h-10 flex-1 rounded-2xl" />
              <Skeleton className="h-10 w-24 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardSkeleton;
