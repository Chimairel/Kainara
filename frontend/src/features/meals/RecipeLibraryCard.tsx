import { PlanMealCardSurface } from '@/components/user/PlanMealCardSurface';
import { MealMacros } from '@/components/user/MealMacros';
import { formatMealTitle } from '@/lib/meal-title';
import type { PublicMealImage } from '@/types';
import type { ReactNode } from 'react';

type RecipeLibraryCardProps = {
  variant: 'catalogue' | 'reusable' | 'planned' | 'nutritionist';
  name: string;
  mealType: string;
  mealTypes?: string[];
  image: PublicMealImage | null;
  description?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  badges?: ReactNode;
  details?: ReactNode;
  footer?: ReactNode;
};

/** Shared recipe presentation. Callers retain their own eligibility, review, and action rules. */
export default function RecipeLibraryCard({
  variant,
  name,
  mealType,
  mealTypes,
  image,
  description,
  calories,
  proteinG,
  carbsG,
  fatG,
  badges,
  details,
  footer,
}: RecipeLibraryCardProps) {
  const types = mealTypes?.length ? mealTypes : [mealType];

  return (
    <article data-library-variant={variant} className="h-full">
      <PlanMealCardSurface
        mealType={mealType}
        mealName={name}
        image={image}
        compact={variant !== 'nutritionist'}
        showAttributionLinks
        badgesClassName={variant === 'nutritionist' ? 'max-w-[55%]' : 'sm:max-w-[55%]'}
        badges={
          <>
            <span className="inline-flex items-center rounded-md bg-brand-bgAlt px-1.5 py-0.5 text-xs font-semibold capitalize text-brand-muted sm:rounded-full sm:bg-white/95 sm:px-3 sm:py-1 sm:text-[11px] sm:font-black sm:uppercase sm:tracking-wider sm:text-brand-text sm:shadow-sm sm:backdrop-blur-md sm:dark:bg-black/60">
              {types.join(' · ')}
            </span>
            {badges}
          </>
        }
      >
        <div className="flex flex-1 flex-col justify-between p-2 pt-2.5">
          <div>
            <h3 className="break-words font-display text-base font-bold leading-snug tracking-tight text-brand-text sm:line-clamp-2">
              {formatMealTitle(name)}
            </h3>
            {description && <p className="mt-0.5 line-clamp-2 text-xs text-brand-muted">{description}</p>}
            {details}
          </div>
          <div>
            {calories != null ? (
              <MealMacros calories={calories} proteinG={proteinG} carbsG={carbsG} fatG={fatG} className="mt-2.5" />
            ) : (
              <p className="mt-2 text-[11px] italic text-brand-muted">Serving evidence pending clinical portioning</p>
            )}
            {footer && (
              <div className={`mt-3 border-t border-brand-border/40 text-xs ${variant === 'nutritionist' ? 'pt-2.5' : 'sm:pt-2.5 max-sm:[&_a]:inline-flex max-sm:[&_a]:min-h-11 max-sm:[&_a]:items-center'}`}>
                {footer}
              </div>
            )}
          </div>
        </div>
      </PlanMealCardSurface>
    </article>
  );
}
