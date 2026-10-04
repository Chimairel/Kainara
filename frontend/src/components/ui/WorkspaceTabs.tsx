'use client';

import type { ReactNode } from 'react';
import { useId } from 'react';
import Link from 'next/link';
import MotionActiveIndicator from './motion/MotionActiveIndicator';

export default function WorkspaceTabs<T extends string>({
  value,
  onChange,
  items,
  label,
  className = '',
  tone = 'accent',
}: {
  value: T;
  onChange?: (value: T) => void;
  items: ReadonlyArray<{
    value: T;
    label: ReactNode;
    href?: string;
    icon?: ReactNode;
    count?: ReactNode;
    countLabel?: string;
  }>;
  label: string;
  className?: string;
  tone?: 'accent' | 'green';
}) {
  const id = useId();
  return (
    <nav
      aria-label={label}
      className={`flex w-full gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/85 p-1.5 shadow-sm ${className}`}
    >
      {items.map((item) => {
        const active = value === item.value;
        const classes = `group relative flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 font-display text-xs font-extrabold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green sm:text-sm ${active ? (tone === 'green' ? 'text-white dark:text-[#07100d]' : 'text-[#07100d]') : 'text-brand-muted hover:bg-brand-bgAlt/70 hover:text-brand-text'}`;
        const content = (
          <>
            {active && (
              <MotionActiveIndicator
                layoutId={`workspace-tabs-${id}`}
                className={`rounded-2xl shadow-sm ${tone === 'green' ? 'bg-brand-green dark:bg-emerald-500' : 'bg-brand-accent'}`}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              {item.icon}
              {item.label}
              {item.count != null && (
                <span
                  aria-label={item.countLabel}
                  className="rounded-full bg-brand-bgAlt/25 px-1.5 py-0.5 font-mono text-[9px]"
                >
                  {item.count}
                </span>
              )}
            </span>
          </>
        );
        return item.href ? (
          <Link key={item.value} href={item.href} aria-current={active ? 'page' : undefined} className={classes}>
            {content}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange?.(item.value)}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
