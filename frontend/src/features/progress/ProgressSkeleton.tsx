import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading progress data">
      {/* 1. Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:w-56 rounded-2xl" />
          <Skeleton className="h-4 w-72 sm:w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-10 w-40 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 2. Workspace Tabs Skeleton */}
      <div className="flex gap-2 border-b border-brand-border/60 pb-3">
        <Skeleton className="h-10 w-36 rounded-2xl" />
        <Skeleton className="h-10 w-40 rounded-2xl" />
      </div>

      {/* 3. Metric Cards Grid (4-column) */}
      <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl sm:rounded-3xl border border-brand-border/80 bg-brand-surface p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-3.5 w-24 rounded" />
          </div>
        ))}
      </section>

      {/* 4. Weight Progress Graph Card Skeleton */}
      <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 sm:p-7 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-40 rounded-lg" />
              <Skeleton className="h-3 w-52 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-9 w-36 rounded-2xl" />
          </div>
        </div>

        {/* Chart Canvas Skeleton */}
        <div className="flex h-56 w-full flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 dark:bg-brand-surface/20 p-5">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          {/* Simulated chart line */}
          <div className="flex items-end justify-between gap-3 h-32 px-4">
            <Skeleton className="h-20 w-8 rounded-t-lg opacity-40" />
            <Skeleton className="h-24 w-8 rounded-t-lg opacity-50" />
            <Skeleton className="h-18 w-8 rounded-t-lg opacity-40" />
            <Skeleton className="h-28 w-8 rounded-t-lg opacity-60" />
            <Skeleton className="h-22 w-8 rounded-t-lg opacity-50" />
            <Skeleton className="h-32 w-8 rounded-t-lg opacity-70" />
            <Skeleton className="h-26 w-8 rounded-t-lg opacity-60" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-2.5 w-12 rounded" />
            <Skeleton className="h-2.5 w-12 rounded" />
            <Skeleton className="h-2.5 w-12 rounded" />
            <Skeleton className="h-2.5 w-12 rounded" />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-brand-border/50 pt-3">
          <Skeleton className="h-3.5 w-48 rounded" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      {/* 5. Weekly Weight Log History Table Skeleton */}
      <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 sm:p-7 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border/50 pb-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-48 rounded-lg" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-brand-border/30">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3.5 px-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-28 rounded" />
                {i === 0 && <Skeleton className="h-4 w-12 rounded" />}
              </div>
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3.5 w-36 rounded hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProgressSkeleton;
