'use client';

import React from 'react';
import KainaraLogo from '@/components/shared/KainaraLogo';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface PortalLoadingStateProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
  fillContainer?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function PortalLoadingState({
  message,
  className = '',
  fullScreen = false,
  fillContainer = false,
  size = 'lg',
}: PortalLoadingStateProps) {
  // This full-page fallback is server-rendered before auth hydration. Keep its
  // SVG reference identical in both renders, including after a dev refresh.
  const gradId = 'kainara-portal-orbital-gradient';

  // If used for a small inline widget
  if (size === 'sm') {
    return (
      <div
        className={`flex items-center justify-center p-3 text-brand-text ${className}`}
        aria-busy="true"
        aria-live="polite"
        aria-label={message || 'Loading'}
      >
        <div className="flex items-center gap-2.5">
          <LoadingSpinner size="sm" />
          {message && <span className="text-xs font-medium text-brand-muted">{message}</span>}
        </div>
      </div>
    );
  }

  const heightClass = fullScreen
    ? 'fixed inset-0 z-50 h-screen w-screen bg-brand-bg'
    : fillContainer
      ? 'absolute inset-0 w-full'
      : 'min-h-[50vh] w-full';

  return (
    <div
      className={`flex ${heightClass} items-center justify-center text-brand-text select-none ${className}`}
      aria-busy="true"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div className="relative flex flex-col items-center justify-center px-4 text-center">
        {/* Atmospheric ambient glow */}
        <div
          className="absolute -top-10 h-36 w-36 rounded-full bg-brand-green/20 dark:bg-brand-accent/20 blur-3xl pointer-events-none animate-pulse"
          aria-hidden="true"
        />

        {/* Central Logo & Orbital Ring */}
        <div className="relative flex items-center justify-center">
          {/* Orbital animated SVG ring */}
          <svg
            className="animate-spin h-24 w-24 sm:h-28 sm:w-28 text-brand-border/40"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
            style={{ animationDuration: '2.4s' }}
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--brand-accent, #eb6a38)" />
                <stop offset="55%" stopColor="var(--brand-green, #08705b)" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Subtle background track */}
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="4 6"
              className="opacity-30 dark:opacity-20"
            />

            {/* Glowing gradient arc */}
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke={`url(#${gradId})`}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="80 180"
            />
          </svg>

          {/* Center Brand Emblem */}
          <div className="absolute flex items-center justify-center">
            <KainaraLogo size={42} variant="multicolor" ariaLabel="KAINARA" />
          </div>
        </div>

        {/* Brand Label */}
        <div className="mt-5 flex flex-col items-center">
          <span className="font-display text-[10px] sm:text-[11px] font-black uppercase tracking-[0.28em] text-brand-green dark:text-brand-accent">
            KAINARA
          </span>

          {/* Dynamic Message or Tagline */}
          <p className="mt-1 text-xs sm:text-sm font-medium text-brand-text/90 max-w-xs leading-snug">
            {message || 'Personalized Nutrition and Meal Planner'}
          </p>
        </div>

        {/* Continuous Shimmer Progress Capsule */}
        <div
          className="mt-3.5 h-1 w-28 sm:w-36 overflow-hidden rounded-full bg-brand-border/40 dark:bg-zinc-800 relative"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-accent/80 dark:via-brand-accent to-transparent"
            style={{ animation: 'shimmer 1.8s infinite' }}
          />
        </div>
      </div>
    </div>
  );
}
