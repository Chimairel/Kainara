import MealImage from '@/components/user/MealImage';
import { getMealBannerTheme } from '@/lib/meal-banner-theme';
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
  const theme = getMealBannerTheme(mealType);
  const types = mealTypes?.length ? mealTypes : [mealType];
  const nutrient = (value: number | null | undefined, unit: string, className: string) =>
    value == null ? null : (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${className}`}
      >
        {Math.round(value)}
        {unit}
      </span>
    );

  return (
    <article
      className={`group relative flex h-full flex-col justify-between rounded-3xl bg-brand-surface p-2 sm:p-2.5 ${theme.shadow} ${theme.hoverShadow} transition-all duration-300 hover:-translate-y-1`}
      data-library-variant={variant}
    >
      <div className={`relative h-40 w-full overflow-hidden rounded-2xl sm:h-44 ${theme.bannerBg}`}>
        <div
          className={`absolute -left-9 top-1/2 h-52 w-52 -translate-y-1/2 overflow-hidden rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-transform duration-300 group-hover:scale-105 sm:-left-12 sm:h-56 sm:w-56 dark:bg-[#071914] dark:shadow-[0_8px_20px_rgba(0,0,0,0.45)] ${theme.plateBorder}`}
        >
          <MealImage
            image={image}
            mealName={name}
            mealType={mealType}
            className="!h-full !w-full !rounded-full !border-0 object-cover"
            variant="thumbnail"
            hideRepresentativeBadge
            showAttributionLinks
          />
        </div>
        <div className="absolute right-2.5 top-2.5 z-10 flex max-w-[55%] flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-text shadow-sm backdrop-blur-md dark:bg-black/60">
            {types.join(' · ')}
          </span>
          {badges}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-2 pt-2.5">
        <div>
          <h3 className="line-clamp-2 font-display text-base font-bold leading-snug tracking-tight text-brand-text">
            {name}
          </h3>
          {description && <p className="mt-0.5 line-clamp-2 text-xs text-brand-muted">{description}</p>}
          {details}
        </div>
        <div>
          {calories != null ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 text-[11px] font-bold text-brand-text dark:border-white/10 dark:bg-white/[0.06]">
                🔥 {Math.round(calories)} kcal
              </span>
              {nutrient(
                proteinG,
                'g P',
                'border-[#08705b]/20 bg-[#08705b]/10 text-[#08705b] dark:border-[#10b981]/30 dark:bg-[#10b981]/15 dark:text-[#34d399]'
              )}
              {nutrient(
                carbsG,
                'g C',
                'border-[#18b9d2]/20 bg-[#18b9d2]/10 text-[#0b7788] dark:border-[#38bdf8]/30 dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]'
              )}
              {nutrient(
                fatG,
                'g F',
                'border-[#eb6a38]/20 bg-[#eb6a38]/10 text-[#c74614] dark:border-[#eb6a38]/30 dark:bg-[#eb6a38]/15 dark:text-[#f09e6c]'
              )}
            </div>
          ) : (
            <p className="mt-2 text-[11px] italic text-brand-muted">Serving evidence pending clinical portioning</p>
          )}
          {footer && <div className="mt-3 border-t border-brand-border/40 pt-2.5 text-xs">{footer}</div>}
        </div>
      </div>
    </article>
  );
}
