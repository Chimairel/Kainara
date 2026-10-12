'use client';

import React from 'react';
import { usePageLoading } from '@/lib/page-loading';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = '', children, ...props }: SkeletonProps) {
  usePageLoading(true);
  const rounding = /(?:^|\s)!?rounded(?:-\S+)?(?=\s|$)/.test(className) ? '' : 'rounded-md';
  return (
    <div
      className={`animate-pulse ${rounding} bg-[#10201b]/[0.085] border border-[#10201b]/[0.04] dark:bg-[#173e33]/50 dark:border-[#173e33]/30 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Skeleton;
