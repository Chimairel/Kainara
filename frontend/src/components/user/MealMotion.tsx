'use client';

import { useSyncExternalStore, type HTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';

const mealMotionQuery = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';
const getSnapshot = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(mealMotionQuery).matches);
const getServerSnapshot = () => false;
function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(mealMotionQuery);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

/** Keep mobile meal details immediate; desktop follows the member's motion preference. */
export function useMealMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

type MealMotionDivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'
> &
  Pick<HTMLMotionProps<'div'>, 'layoutId' | 'initial' | 'animate' | 'exit' | 'transition'> & { enabled: boolean };

export function MealMotionDiv({ enabled, layoutId, initial, animate, exit, transition, ...props }: MealMotionDivProps) {
  return enabled ? (
    <motion.div
      {...props}
      layoutId={layoutId}
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
    />
  ) : (
    <div {...props} />
  );
}

export function MealMotionPresence({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? <AnimatePresence>{children}</AnimatePresence> : <>{children}</>;
}
