import { MealTile, MealMacros } from '@/components/user/MealCardPresentation';
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
      <MealTile
        mealType={mealType}
        mealName={name}
        image={image}
        showAttributionLinks
        badgesClassName="max-w-[55%]"
        badges={
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-text shadow-sm backdrop-blur-md dark:bg-black/60">
              {types.join(' · ')}
            </span>
            {badges}
          </>
        }
      >
        <div className="flex flex-1 flex-col justify-between p-2 pt-2.5">
          <div>
            <h3 className="line-clamp-2 font-display text-base font-bold leading-snug tracking-tight text-brand-text">
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
            {footer && <div className="mt-3 border-t border-brand-border/40 pt-2.5 text-xs">{footer}</div>}
          </div>
        </div>
      </MealTile>
    </article>
  );
}
