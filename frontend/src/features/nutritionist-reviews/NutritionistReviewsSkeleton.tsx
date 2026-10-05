import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function ReviewQueueSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading review queue items">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-brand-border/70 bg-brand-surface/70 p-4 shadow-sm space-y-3">
          {/* Top Row: Type and Priority badges */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-12 rounded" />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-3/4 rounded-lg" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>

          {/* User info & timestamp */}
          <div className="flex items-center justify-between border-t border-brand-border/40 pt-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
            <Skeleton className="h-3 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5 text-left" aria-label="Loading review details">
      {/* Header card with meal title, author, claim/actions */}
      <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-7 w-64 rounded-xl" />
            <Skeleton className="h-4 w-44 rounded-lg" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-10 w-28 rounded-2xl" />
            <Skeleton className="h-10 w-32 rounded-2xl" />
          </div>
        </div>

        {/* 4 Macro Metrics grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/50 p-3.5 text-center"
            >
              <Skeleton className="h-3 w-16 mx-auto rounded" />
              <Skeleton className="h-6 w-20 mx-auto rounded-lg" />
              <Skeleton className="h-2 w-20 mx-auto rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* 2-column content cards: Ingredients & Clinical Check */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Ingredients Card */}
        <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-brand-border/50 pb-3">
            <Skeleton className="h-5 w-36 rounded-lg" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="space-y-2.5 pt-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-brand-border/40 bg-brand-bgAlt/30 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-32 rounded" />
                </div>
                <Skeleton className="h-3.5 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Clinical Safety & Allergen checks */}
        <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-brand-border/50 pb-3">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="space-y-3 pt-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-brand-border/40 bg-brand-bgAlt/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NutritionistReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading nutritionist review workspace">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-60 sm:w-72 rounded-2xl" />
          <Skeleton className="h-4 w-72 sm:w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-28 rounded-2xl" />
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>
      </div>

      {/* 2. Workspace Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[24px] border border-brand-border/70 bg-brand-surface/85 p-2 shadow-card">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-40 rounded-xl" />
      </div>

      {/* 3. Split Workspace Container Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Queue Column */}
        <div className="flex flex-col gap-3 rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface/70 p-5 shadow-card lg:col-span-4">
          <div className="flex items-center justify-between border-b border-brand-border/50 pb-3">
            <Skeleton className="h-5 w-24 rounded-lg" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <ReviewQueueSkeleton count={4} />
        </div>

        {/* Right: Detail Inspection */}
        <div className="lg:col-span-8">
          <ReviewDetailSkeleton />
        </div>
      </div>
    </div>
  );
}

export default NutritionistReviewsSkeleton;
