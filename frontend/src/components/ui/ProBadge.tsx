'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md';
  animate?: boolean;
  showIcon?: boolean;
}

export const ProBadge: React.FC<ProBadgeProps> = ({
  size = 'md',
  animate = true,
  showIcon = true,
  children,
  className = '',
  ...props
}) => {
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden rounded-full p-[1.5px] shadow-xs select-none',
        className
      )}
      {...props}
    >
      {/* Animated rotating conic gradient border beam */}
      {animate && (
        <span
          className="pointer-events-none absolute inset-[-150%] animate-[spin_4s_linear_infinite]"
          style={{
            background:
              'conic-gradient(from 0deg, #eb6a38 0deg, #f09e6c 90deg, #10b981 180deg, #34d399 270deg, #eb6a38 360deg)',
          }}
          aria-hidden="true"
        />
      )}
      {!animate && (
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#eb6a38] via-[#f09e6c] to-[#1b4e41]"
          aria-hidden="true"
        />
      )}

      {/* Inner capsule body */}
      <span
        className={cn(
          'relative z-10 flex items-center rounded-full bg-[#082e25] font-mono font-bold uppercase tracking-wider text-[#f09e6c]',
          size === 'sm' ? 'gap-1 px-2 py-0.5 text-[9px]' : 'gap-1.5 px-3 py-1 text-xs'
        )}
      >
        {showIcon && (
          <Sparkles
            className={cn(
              'shrink-0 text-[#eb6a38] transition-transform',
              animate && 'animate-pulse',
              size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'
            )}
            aria-hidden="true"
          />
        )}
        <span>{children || 'Pro'}</span>
      </span>
    </span>
  );
};

export default ProBadge;
