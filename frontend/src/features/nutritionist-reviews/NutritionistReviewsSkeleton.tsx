import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function ReviewQueueSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading review queue items">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-brand-border/70 bg-brand-surface/70 p-4 shadow-sm space-y-3"
        >
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
            <Skeleton className="h-4 w-3/4 rounded" />
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
      <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-6 w-56 rounded-lg" />
            <Skeleton className="h-3.5 w-40 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>

        {/* 4 Macro Metrics grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3"
            >
              <Skeleton className="h-3 w-14 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-2 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 2-column content cards: Ingredients & Clinical Check */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Ingredients Card */}
        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <div className="space-y-2.5 pt-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-brand-border/40 bg-brand-bgAlt/30 p-2.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3.5 w-28 rounded" />
                </div>
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Clinical Safety & Allergen checks */}
        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <div className="space-y-2.5 pt-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-brand-border/50 bg-brand-bgAlt/40 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3.5 w-32 rounded" />
                </div>
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision / Action footer card */}
      <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-card space-y-3">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function NutritionistReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading nutritionist review workspace">
      {/* 1. Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* 2. Workspace Navigation Tabs Skeleton */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-border/70 bg-brand-surface/85 p-1.5 shadow-card">
        <div className="grid w-full grid-cols-1 sm:grid-cols-3 gap-1.5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 ${
                i === 0
                  ? 'border-brand-accent/40 bg-brand-accent/15'
                  : 'border-transparent bg-transparent'
              }`}
            >
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Secondary Filter Pills Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-brand-border/70 bg-brand-surface/85 p-1.5 shadow-card">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-2 ${
              i === 0 ? 'bg-brand-accent/20 border border-brand-accent/30' : 'bg-transparent'
            }`}
          >
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* 4. Split Workspace: Queue (1/3) + Detail (2/3) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Queue Sidebar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-brand-border/70 bg-brand-surface/60 p-4 shadow-card lg:col-span-4">
          <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <Skeleton className="h-3 w-48 rounded" />
          <div className="mt-1">
            <ReviewQueueSkeleton count={4} />
          </div>
        </div>

        {/* Right Column: Case Inspection Detail */}
        <div className="lg:col-span-8">
          <ReviewDetailSkeleton />
        </div>
      </div>
    </div>
  );
}

export default NutritionistReviewsSkeleton;
