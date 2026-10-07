'use client';

import { Children, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './Marquee.module.css';

type MarqueeProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode;
  reverse?: boolean;
  vertical?: boolean;
  pauseOnHover?: boolean;
  paused?: boolean;
  repeat?: number;
};

/** Adapted from Sean Hello / ReUI's 21st.dev 3D testimonials marquee. */
export function Marquee({
  children,
  className,
  reverse = false,
  vertical = false,
  pauseOnHover = false,
  paused = false,
  repeat = 2,
  ...props
}: MarqueeProps) {
  const items = Children.toArray(children);
  return (
    <div
      {...props}
      data-slot="marquee"
      data-paused={paused || undefined}
      className={cn(styles.marquee, vertical && styles.vertical, pauseOnHover && styles.pauseOnHover, className)}
    >
      {Array.from({ length: Math.max(2, repeat) }, (_, index) => (
        <div
          key={index}
          aria-hidden={index > 0 || undefined}
          inert={index > 0 || undefined}
          className={cn(styles.track, reverse && styles.reverse)}
        >
          {items}
        </div>
      ))}
    </div>
  );
}
