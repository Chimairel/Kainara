import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getMealBannerTheme } from '@/lib/meal-banner-theme';
import { getMealTheme } from '@/lib/compact-meal-theme';
import MealImage from './MealImage';

/** Presentation only. Approval, logging, swap and navigation actions belong to callers. */
export function MealTileFrame({
  mealType,
  index = 0,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { mealType: string; index?: number }) {
  const theme = getMealBannerTheme(mealType, index);
  return (
    <div
      {...props}
      className={cn(
        'group relative flex h-full flex-col justify-between rounded-3xl bg-brand-surface p-2 transition-all duration-300 hover:-translate-y-1 sm:p-2.5',
        theme.shadow,
        theme.hoverShadow,
        className
      )}
    />
  );
}

export function MealBanner({ mealType, children }: { mealType: string; children: ReactNode }) {
  return (
    <div
      className={cn('relative h-40 w-full overflow-hidden rounded-2xl sm:h-44', getMealBannerTheme(mealType).bannerBg)}
    >
      {children}
    </div>
  );
}

/** Shared plan/library tile; badges, details and role-specific actions are slots. */
export function MealTile({
  mealType,
  mealName,
  image,
  ingredients,
  index = 0,
  badges,
  children,
  showAttributionLinks = false,
  badgesClassName,
}: {
  mealType: string;
  mealName: string;
  image?: ComponentProps<typeof MealImage>['image'];
  ingredients?: ComponentProps<typeof MealImage>['ingredients'];
  index?: number;
  badges?: ReactNode;
  children: ReactNode;
  showAttributionLinks?: boolean;
  badgesClassName?: string;
}) {
  const theme = getMealBannerTheme(mealType, index);
  return (
    <MealTileFrame mealType={mealType} index={index}>
      <MealBanner mealType={mealType}>
        <div
          className={cn(
            'absolute -left-9 top-1/2 h-52 w-52 -translate-y-1/2 overflow-hidden rounded-full bg-white shadow-md transition-transform duration-300 group-hover:scale-105 sm:-left-12 sm:h-56 sm:w-56 dark:bg-[#071914]',
            theme.plateBorder
          )}
        >
          <MealImage
            image={image}
            mealName={mealName}
            mealType={mealType}
            ingredients={ingredients}
            variant="thumbnail"
            hideRepresentativeBadge
            showAttributionLinks={showAttributionLinks}
            className="!h-full !w-full !rounded-full !border-0 object-cover"
          />
        </div>
        <div className={cn('absolute right-2.5 top-2.5 z-10 flex flex-col items-end gap-1.5', badgesClassName)}>
          {badges}
        </div>
      </MealBanner>
      {children}
    </MealTileFrame>
  );
}

export function MealPlate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative shrink-0 rounded-full bg-white p-1.5 shadow-lg dark:bg-[#12362c]', className)}>
      <div className="relative h-full w-full overflow-hidden rounded-full">{children}</div>
    </div>
  );
}

export function compactMealClasses(mealType: string, index = 0) {
  const theme = getMealTheme(mealType, index);
  return cn(
    'dashboard-meal group relative overflow-visible text-white',
    theme.cardBg,
    theme.borderColor,
    theme.shadow,
    theme.hoverShadow
  );
}

export function MealMacros({
  calories,
  proteinG,
  carbsG,
  fatG,
  className,
  variant = 'pills',
}: {
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  className?: string;
  variant?: 'pills' | 'line';
}) {
  const values = [
    {
      value: calories,
      unit: ' kcal',
      label: 'Energy',
      color: 'border-black/10 bg-black/[0.04] text-brand-text dark:border-white/10 dark:bg-white/[0.06]',
    },
    {
      value: proteinG,
      unit: variant === 'line' ? 'g protein' : 'g P',
      label: 'Protein',
      color: 'border-brand-green/20 bg-brand-green/10 text-brand-green dark:text-emerald-300',
    },
    {
      value: carbsG,
      unit: variant === 'line' ? 'g carbs' : 'g C',
      label: 'Carbohydrates',
      color: 'border-brand-cyan/20 bg-brand-cyan/10 text-[#0b7788] dark:text-sky-300',
    },
    {
      value: fatG,
      unit: variant === 'line' ? 'g fat' : 'g F',
      label: 'Fat',
      color: 'border-brand-accent/20 bg-brand-accent/10 text-[#c74614] dark:text-[#f09e6c]',
    },
  ].filter((item) => item.value != null);
  return (
    <div
      className={cn(
        variant === 'line'
          ? 'flex flex-wrap gap-x-1 text-xs font-medium text-white/90'
          : 'flex flex-wrap items-center gap-1.5 text-[11px] font-bold sm:gap-2',
        className
      )}
    >
      {values.map((item, i) => (
        <span
          key={item.label}
          className={
            variant === 'pills' ? cn('inline-flex items-center rounded-full border px-2.5 py-1', item.color) : undefined
          }
        >
          {variant === 'line' && i > 0 && <span aria-hidden="true">· </span>}
          {Math.round(item.value!)}
          {item.unit}
        </span>
      ))}
    </div>
  );
}
