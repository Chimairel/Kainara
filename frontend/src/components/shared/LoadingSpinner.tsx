import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  fullScreen = false,
  className = '',
}) => {
  const dimensions = {
    sm: { size: 'h-4 w-4', stroke: 3.5, r: 14 },
    md: { size: 'h-8 w-8', stroke: 3, r: 14 },
    lg: { size: 'h-12 w-12', stroke: 2.8, r: 14 },
  }[size];

  const spinner = (
    <svg
      className={`animate-spin ${dimensions.size} text-brand-green dark:text-brand-accent ${className}`}
      viewBox="0 0 36 36"
      fill="none"
      role="status"
    >
      <circle
        cx="18"
        cy="18"
        r={dimensions.r}
        stroke="currentColor"
        strokeWidth={dimensions.stroke}
        className="opacity-20"
      />
      <circle
        cx="18"
        cy="18"
        r={dimensions.r}
        stroke="currentColor"
        strokeWidth={dimensions.stroke}
        strokeLinecap="round"
        strokeDasharray="60 100"
        className="opacity-90"
      />
      <span className="sr-only">Loading...</span>
    </svg>
  );

  if (fullScreen) {
    return <div className="flex h-screen w-screen items-center justify-center bg-brand-bg">{spinner}</div>;
  }

  return <div className="flex items-center justify-center p-1">{spinner}</div>;
};

export default LoadingSpinner;
