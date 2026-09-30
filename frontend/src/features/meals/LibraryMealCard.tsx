import { useState } from 'react';
import { Heart } from 'lucide-react';
import type { PublicVerifier } from '@/types';
import type { SwapOption } from './useMealsWorkspace';
import RecipeLibraryCard from './RecipeLibraryCard';

export default function LibraryMealCard({
  meal, onVerifier, onFavorite,
}: {
  meal: SwapOption;
  onVerifier: (verifier: PublicVerifier) => void;
  onFavorite: (meal: SwapOption) => Promise<void>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const mealTypes = meal.mealTypes?.length ? meal.mealTypes : [meal.mealType];

  return (
    <RecipeLibraryCard
      variant="reusable"
      name={meal.mealName}
      mealType={meal.mealType}
      mealTypes={mealTypes}
      image={meal.image ?? null}
      description={meal.description}
      calories={meal.calories}
      proteinG={meal.proteinG}
      carbsG={meal.carbsG}
      fatG={meal.fatG}
      badges={<>
        <button
          type="button"
          aria-label={meal.isFavorite ? `Remove ${meal.mealName} from favorites` : `Favorite ${meal.mealName}`}
          aria-pressed={meal.isFavorite}
          onClick={() => void onFavorite(meal)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow-sm backdrop-blur-md transition hover:scale-110 dark:bg-black/60"
        >
          <Heart className={`h-3.5 w-3.5 ${meal.isFavorite ? 'fill-current' : ''}`} />
        </button>
        {meal.reuseBasis === 'PROFILE_MATCHED_APPROVAL' && (
          <span className="rounded-full border border-emerald-400/40 bg-black/40 px-2 py-0.5 text-[10px] font-bold text-emerald-200 backdrop-blur-md">Reviewed for a matching health profile</span>
        )}
        {meal.alreadyPlannedInCycle && (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white">In your plan</span>
        )}
        {meal.matchesDietaryPreference === false && (
          <span className="rounded-full border border-[#a64600]/40 bg-[#8c3b00]/90 px-2 py-0.5 text-[9px] font-bold text-white">Outside your dietary preference</span>
        )}
      </>}
      details={meal.riceRole && (
        <p className="mt-0.5 text-[11px] font-semibold text-brand-muted">
          {meal.riceRole === 'PAIR_WITH_RICE'
            ? 'Usually paired with rice'
            : meal.riceRole === 'INCLUDES_RICE'
              ? `Rice included${meal.includedRiceG ? ` · ${meal.includedRiceG} g` : ''}`
              : 'Standalone meal'}
        </p>
      )}
      footer={
        <div className="flex flex-col gap-1.5">
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
              <button type="button" onClick={() => onVerifier(meal.verifier!)} className="text-left text-[11px] text-brand-muted hover:text-brand-green hover:underline">
                PRC {meal.prcLicenseNumber}
              </button>
            )}
          </div>
          {showDetails && (
            <div className="space-y-1 rounded-xl border border-brand-border bg-brand-bgAlt/50 p-3 text-xs text-brand-muted">
              {meal.reuseBasis === 'PROFILE_MATCHED_APPROVAL' && <p>This recipe was approved by a dietitian for the same recorded safety restrictions. Its portion and nutrition targets still need checking before it can enter your plan.</p>}
              <p>Serving: {meal.servingDescription || 'One recipe serving'}</p>
              <p>Suitable slots: {mealTypes.join(', ').toLowerCase()}</p>
              <p>Per serving: {meal.calories} kcal · {meal.proteinG} g protein · {meal.carbsG} g carbs · {meal.fatG} g fat.</p>
              {meal.verifiedBy && <p>Reviewed by {meal.verifiedBy} · PRC {meal.prcLicenseNumber}</p>}
            </div>
          )}
          {meal.cookingLink && (
            <a href={meal.cookingLink.url} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-brand-green hover:underline">
              {meal.cookingLink.kind === 'PANLASANG_RECIPE' ? 'View original Panlasang Pinoy recipe ↗' : 'Watch original cooking video ↗'}
            </a>
          )}
        </div>
      }
    />
  );
}
