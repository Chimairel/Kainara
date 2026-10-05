import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getMealBannerTheme } from '@/lib/meal-banner-theme';
import MealImage from './MealImage';

/** Presentation only. Approval, logging, swap and navigation actions belong to callers. */
function PlanMealCardFrame({
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

function PlanMealBanner({ mealType, index, children }: { mealType: string; index: number; children: ReactNode }) {
  return (
    <div
      className={cn(
        'relative h-40 w-full overflow-hidden rounded-2xl sm:h-44',
        getMealBannerTheme(mealType, index).bannerBg
      )}
    >
      {children}
    </div>
  );
}

/** Shared plan/library tile; badges, details and role-specific actions are slots. */
export function PlanMealCardSurface({
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
    <PlanMealCardFrame mealType={mealType} index={index}>
      <PlanMealBanner mealType={mealType} index={index}>
        <div
          className={cn(
            'absolute -left-9 top-1/2 h-52 w-52 -translate-y-1/2 overflow-hidden rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105 sm:-left-12 sm:h-56 sm:w-56 dark:bg-[#071914]',
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
      </PlanMealBanner>
      {children}
    </PlanMealCardFrame>
  );
}
