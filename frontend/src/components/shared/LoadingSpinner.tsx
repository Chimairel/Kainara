'use client';

import React from 'react';
import { LoaderCircle } from '@/components/ui/icons';
import { usePageLoading } from '@/lib/page-loading';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', fullScreen = false, className = '' }) => {
  usePageLoading(true);
  const dimensions = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size];
  const spinner = (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle
        className={`animate-spin motion-reduce:animate-none ${dimensions} text-brand-green dark:text-brand-accent ${className}`}
      />
      <span className="sr-only">Loading...</span>
    </span>
  );

  if (fullScreen) {
    return <div className="flex h-screen w-screen items-center justify-center bg-brand-bg">{spinner}</div>;
  }

  return <div className="flex items-center justify-center p-1">{spinner}</div>;
};

export default LoadingSpinner;
