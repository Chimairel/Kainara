import { useState } from 'react';
import type { PublicVerifier } from '@/types';
import type { SwapOption } from './useMealsWorkspace';
import MealImage from '@/components/user/MealImage';
import { getMealBannerTheme } from '@/components/user/MealCard';
import { Heart } from 'lucide-react';

export default function LibraryMealCard({
  meal,
  onVerifier,
  onFavorite,
}: {
  meal: SwapOption;
  onVerifier: (verifier: PublicVerifier) => void;
  onFavorite: (meal: SwapOption) => Promise<void>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const applicableMealTypes = meal.mealTypes?.length ? meal.mealTypes : [meal.mealType];
  const primaryType = applicableMealTypes[0] || meal.mealType;
  const bannerTheme = getMealBannerTheme(primaryType);

  return (
    <article
      className={`group relative flex h-full flex-col justify-between rounded-3xl bg-brand-surface p-3.5 sm:p-4 ${bannerTheme.shadow} ${bannerTheme.hoverShadow} transition-all duration-300 hover:-translate-y-1`}
    >
      {/* Upper Banner with Cropped Circular Food Plate on Left */}
      <div className={`relative h-40 sm:h-44 w-full overflow-hidden rounded-2xl ${bannerTheme.bannerBg}`}>
        {/* Circular Plate on Left - Enlarge and crop so parts cut out */}
        <div
          className={`absolute -left-9 sm:-left-12 top-1/2 -translate-y-1/2 h-52 w-52 sm:h-56 sm:w-56 rounded-full ${bannerTheme.plateBorder} bg-white dark:bg-[#071914] shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.45)] overflow-hidden transition-transform duration-300 group-hover:scale-105`}
        >
          <div className="relative h-full w-full rounded-full overflow-hidden">
            <MealImage
              image={meal.image}
              mealName={meal.mealName}
              mealType={meal.mealType}
              className="!rounded-full !border-0 h-full w-full object-cover"
              variant="thumbnail"
              hideRepresentativeBadge
              showAttributionLinks
            />
          </div>
        </div>

        {/* Top Right Badges & Favorite Heart */}
        <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5 z-10 max-w-[55%]">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 dark:bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-text shadow-sm backdrop-blur-md">
              {applicableMealTypes.join(' · ')}
            </span>
            <button
              type="button"
              aria-label={meal.isFavorite ? `Remove ${meal.mealName} from favorites` : `Favorite ${meal.mealName}`}
              aria-pressed={meal.isFavorite}
              onClick={() => onFavorite(meal)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-black/60 text-rose-500 shadow-sm backdrop-blur-md transition hover:scale-110"
            >
              <Heart className={`h-3.5 w-3.5 ${meal.isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>

          {meal.reuseBasis === 'PROFILE_MATCHED_APPROVAL' && (
            <span className="w-fit rounded-full border border-emerald-400/40 bg-black/40 px-2 py-0.5 text-[10px] font-bold text-emerald-200 backdrop-blur-md">
              Reviewed for a matching health profile
            </span>
          )}

          {meal.alreadyPlannedInCycle && (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
              In your plan
            </span>
          )}

          {meal.matchesDietaryPreference === false && (
            <span className="rounded-full border border-[#a64600]/40 bg-[#8c3b00]/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs backdrop-blur-md">
              Outside your dietary preference
            </span>
          )}
        </div>
      </div>

      {/* Lower Details: Title, Description, and Colorful Macro Pills */}
      <div className="flex-1 flex flex-col justify-between mt-3">
        <div>
          <h3 className="text-base font-bold font-display tracking-tight text-brand-text leading-snug line-clamp-1">
            {meal.mealName}
          </h3>

          {meal.riceRole && (
            <p className="text-[11px] font-semibold text-brand-muted mt-0.5">
              {meal.riceRole === 'PAIR_WITH_RICE'
                ? 'Usually paired with rice'
                : meal.riceRole === 'INCLUDES_RICE'
                  ? `Rice included${meal.includedRiceG ? ` · ${meal.includedRiceG} g` : ''}`
                  : 'Standalone meal'}
            </p>
          )}

          {meal.description && (
            <p className="text-xs text-brand-muted line-clamp-1 mt-0.5">{meal.description}</p>
          )}
        </div>

        {/* Macro Chips Row - Theme Colors */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-brand-text border border-black/10 dark:border-white/10">
            <span className="text-[10px]">🔥</span> {Math.round(meal.calories)} kcal
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#08705b]/10 dark:bg-[#10b981]/15 px-2.5 py-1 text-[11px] font-bold text-[#08705b] dark:text-[#34d399] border border-[#08705b]/20 dark:border-[#10b981]/30">
            {Math.round(meal.proteinG)}g P
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#18b9d2]/10 dark:bg-[#38bdf8]/15 px-2.5 py-1 text-[11px] font-bold text-[#0b7788] dark:text-[#38bdf8] border border-[#18b9d2]/20 dark:border-[#38bdf8]/30">
            {Math.round(meal.carbsG)}g C
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eb6a38]/10 dark:bg-[#eb6a38]/15 px-2.5 py-1 text-[11px] font-bold text-[#c74614] dark:text-[#f09e6c] border border-[#eb6a38]/20 dark:border-[#eb6a38]/30">
            {Math.round(meal.fatG)}g F
          </span>
        </div>

        {/* Footer actions / details toggle */}
        <div className="mt-3 pt-2.5 border-t border-brand-border/40 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-expanded={showDetails}
              onClick={() => setShowDetails((current) => !current)}
              className="text-left font-semibold text-brand-green hover:underline"
            >
              {showDetails ? 'Hide details' : 'View details'}
            </button>
            {meal.verifier && (
              <button
                type="button"
                onClick={() => onVerifier(meal.verifier!)}
                className="text-left text-[11px] text-brand-muted hover:text-brand-green hover:underline"
              >
                PRC {meal.prcLicenseNumber}
              </button>
            )}
          </div>

          {showDetails && (
            <div className="rounded-xl border border-brand-border bg-brand-bgAlt/50 p-3 text-xs text-brand-muted space-y-1">
              {meal.reuseBasis === 'PROFILE_MATCHED_APPROVAL' && (
                <p>This recipe was approved by a dietitian for the same recorded safety restrictions. Its portion and nutrition targets still need checking before it can enter your plan.</p>
              )}
              <p>Serving: {meal.servingDescription || 'One recipe serving'}</p>
              <p>Suitable slots: {applicableMealTypes.join(', ').toLowerCase()}</p>
              <p>
                Per serving: {meal.calories} kcal · {meal.proteinG} g protein · {meal.carbsG} g carbs · {meal.fatG} g fat.
              </p>
              {meal.verifiedBy && (
                <p>Reviewed by {meal.verifiedBy} · PRC {meal.prcLicenseNumber}</p>
              )}
            </div>
          )}

          {meal.cookingLink && (
            <a
              href={meal.cookingLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-green hover:underline truncate"
            >
              {meal.cookingLink.kind === 'PANLASANG_RECIPE' ? 'View original Panlasang Pinoy recipe ↗' : 'Watch original cooking video ↗'}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
