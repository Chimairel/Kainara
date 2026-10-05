import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getMealTheme } from '@/lib/compact-meal-theme';

export function DashboardMealPlate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative shrink-0 rounded-full bg-white dark:bg-[#12362c]', className)}>
      <div className="relative h-full w-full overflow-hidden rounded-full">{children}</div>
    </div>
  );
}

export function dashboardMealCardClasses(mealType: string, index = 0) {
  const theme = getMealTheme(mealType, index);
  return cn(
    'dashboard-meal group relative overflow-visible text-white',
    theme.cardBg,
    theme.borderColor,
    theme.shadow,
    theme.hoverShadow
  );
}

/** Dedicated compact meal design; callers keep their existing actions and status badges. */
export function DashboardMealCardSurface({
  as: Element = 'article',
  mealType,
  index = 0,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'article' | 'details' | 'div'; mealType: string; index?: number }) {
  return <Element {...props} className={cn(dashboardMealCardClasses(mealType, index), className)} />;
}
