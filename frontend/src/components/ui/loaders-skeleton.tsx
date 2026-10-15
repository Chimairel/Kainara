"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';
import { usePageLoading } from '@/lib/page-loading';

export interface LoaderSkeletonProps extends HTMLMotionProps<'div'> {
  width?: string | number;
  height?: number;
  borderRadius?: number;
  baseColor?: string;
  highlightColor?: string;
  duration?: number;
}

/** Adapted from the supplied 21st.dev loader; colors follow the portal theme. */
export function LoaderSkeleton({
  className, width = '100%', height = 20, borderRadius = 4,
  baseColor, highlightColor, duration = 1.5, style, ...props
}: LoaderSkeletonProps) {
  const reducedMotion = useReducedMotion();
  usePageLoading(true);
  return (
    <motion.div
      aria-hidden="true"
      {...props}
      data-loader-skeleton=""
      className={cn('relative shrink-0 overflow-hidden', className)}
      style={{ width, height, borderRadius, backgroundColor: baseColor ?? 'var(--skeleton-bg)', ...style }}
    >
      {!reducedMotion && <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(90deg, transparent, ${highlightColor ?? 'var(--skeleton-highlight)'}, transparent)` }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration, ease: 'easeInOut', repeat: Infinity }}
      />}
    </motion.div>
  );
}

export default LoaderSkeleton;
