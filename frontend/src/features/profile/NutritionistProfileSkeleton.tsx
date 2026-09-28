import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function NutritionistProfileSkeleton() {
  return (
    <div className="portal-page max-w-4xl space-y-6 text-left" aria-label="Loading professional profile">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-36 rounded-full" />
        <Skeleton className="h-8 w-56 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-brand-border/60 pb-3">
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-6 shadow-card space-y-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44 rounded-lg" />
            <Skeleton className="h-3.5 w-32 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <Skeleton className="h-3.5 w-20 rounded" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>

        <div className="flex justify-end pt-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default NutritionistProfileSkeleton;
