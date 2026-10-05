import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function NutritionistProfileSkeleton() {
  return (
    <div className="portal-page max-w-4xl space-y-6 text-left" aria-label="Loading professional profile">
      {/* 1. Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-60 rounded-2xl" />
        <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
      </div>

      {/* 2. Tabs */}
      <div className="flex gap-2 border-b border-brand-border/60 pb-3">
        <Skeleton className="h-10 w-36 rounded-2xl" />
        <Skeleton className="h-10 w-32 rounded-2xl" />
      </div>

      {/* 3. Profile Card */}
      <div className="rounded-[28px] sm:rounded-[36px] border border-brand-border bg-brand-surface p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-18 w-18 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-36 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-11 w-full rounded-2xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-11 w-full rounded-2xl" />
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>

        <div className="flex justify-end pt-2">
          <Skeleton className="h-11 w-32 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default NutritionistProfileSkeleton;
