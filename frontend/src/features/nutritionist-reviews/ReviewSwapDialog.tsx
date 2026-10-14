'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SwapMealComparison from '@/features/meals/swap/SwapMealComparison';
import SwapMealOptions from '@/features/meals/swap/SwapMealOptions';
import SwapNutritionTable from '@/features/meals/SwapNutritionTable';
import { getMealTheme } from '@/features/dashboard/DashboardMealRow';
import { NutritionistCredentialCard } from '@/components/user/NutritionistCredentialCard';
import type { PublicVerifier } from '@/types';
import type { DetailData } from './useNutritionistReviews';
import type { useReviewSwap } from './useReviewSwap';
import IngredientEvidenceTable from './IngredientEvidenceTable';
import ReviewNutrientFilters, { REVIEW_NUTRIENT_FIELDS, nutrientFilterLabels } from './ReviewNutrientFilters';
import { Search } from '@/components/ui/icons';

/** Reuses member swap presentation, with the RND claim and pending-review API adapter. */
export default function ReviewSwapDialog({
  swap,
  meal,
  onNoSuitable,
  onFindReplacement,
}: {
  swap: ReturnType<typeof useReviewSwap>;
  meal: DetailData['mealPlan'];
  onNoSuitable?: () => void;
  onFindReplacement?: () => void;
}) {
  const [verifier, setVerifier] = useState<PublicVerifier | null>(null);
  const [sort, setSort] = useState<'best_match' | 'kcal_match'>('best_match');
  useEffect(() => setVerifier(null), [meal.id, swap.open, swap.data]);
  const options = swap.data?.options ?? [];
  const hasRanking = options.some((option) => option.nutritionFitScore !== undefined);
  const activeSort = hasRanking ? sort : 'kcal_match';
  const selected = swap.selected;
  const common = {
    activeSwapMeal: meal,
    confirmSwapMeal: selected,
    isSwapping: swap.saving,
    setGroceryDeltaAcknowledged: () => {},
  };
  return (
    <>
      <Modal
        isOpen={swap.open}
        onClose={swap.close}
        layer="canvas"
        size="3xl"
        title="Swap meal"
        description="Choose an eligible replacement. It stays pending until you separately approve or reject it."
        footer={
          <>
            <Button variant="secondary" disabled={swap.saving} onClick={swap.close}>
              Cancel
            </Button>
            <Button
              disabled={swap.saving || !selected || swap.note.trim().length < 10}
              isLoading={swap.saving}
              onClick={() => void swap.submit()}
            >
              Confirm swap
            </Button>
          </>
        }
      >
        <SwapMealComparison
          model={{
            ...common,
            currentTheme: getMealTheme(meal.mealType),
            replacementTheme: selected ? getMealTheme(selected.mealType) : null,
            setConfirmSwapMeal: () => swap.setSelectedId(''),
            setSwapPreview: () => {},
          }}
        />
        {selected && (
          <section aria-label="Meal nutrition comparison" className="mt-5 border-b border-brand-border/60 pb-4">
            <h3 className="font-display text-base font-bold">Nutrition comparison</h3>
            <p className="mt-1 text-xs leading-5 text-brand-muted">
              One serving, including any paired rice. Missing values are not recorded; they are not zero.
            </p>
            {selected.nutritionBasis === 'CALCULATED_DEMO' && (
              <p className="mt-2 text-xs font-semibold text-brand-muted">
                Replacement values are calculated from a standardized demonstration recipe. They require RND review.
              </p>
            )}
            {!!selected.estimatedNutrientKeys?.length && (
              <p className="mt-2 text-xs font-semibold text-brand-muted">
                Estimated replacement values:{' '}
                {REVIEW_NUTRIENT_FIELDS.filter(([key]) => selected.estimatedNutrientKeys?.includes(key))
                  .map(([, label]) => label)
                  .join(', ')}
                . Review these approximations before deciding.
              </p>
            )}
            {!!meal.estimatedNutrientKeys?.length && (
              <p className="mt-2 text-xs font-semibold text-brand-muted">
                Current meal includes the nutrient estimates saved with its RND-selected replacement.
              </p>
            )}
            <SwapNutritionTable
              before={{
                ...meal.nutrients,
                calories: meal.calories,
                proteinG: meal.proteinG,
                carbsG: meal.carbsG,
                fatG: meal.fatG,
              }}
              after={{
                ...selected.nutrients,
                calories: selected.calories,
                proteinG: selected.proteinG,
                carbsG: selected.carbsG,
                fatG: selected.fatG,
              }}
              fields={selected.nutrients ? REVIEW_NUTRIENT_FIELDS : undefined}
              beforeLabel="Current meal"
              afterLabel="Replacement"
              showChange
              compact={false}
            />
          </section>
        )}
        {swap.filtersEnabled && (
          <form
            className="mt-6 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void swap.interpretAndSearch();
            }}
          >
            <label htmlFor="review-swap-search" className="block text-sm font-semibold">
              Filter candidates with AI
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface p-2 focus-within:ring-2 focus-within:ring-brand-green">
              <Search aria-hidden="true" className="ml-2 h-5 w-5 shrink-0 text-brand-muted" />
              <input
                id="review-swap-search"
                value={swap.filterText}
                onChange={(event) => swap.setFilterText(event.target.value)}
                maxLength={500}
                disabled={swap.saving || swap.interpreting}
                placeholder="e.g. sugar under 10 g and sodium at most 500 mg"
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-brand-text outline-none placeholder:text-brand-muted"
              />
              <Button
                type="submit"
                size="sm"
                disabled={swap.saving || swap.loading || swap.interpreting || !swap.filterText?.trim()}
                isLoading={swap.interpreting}
              >
                Filter
              </Button>
            </div>
            <p className="text-xs leading-5 text-brand-muted">
              AI translates your request into nutrient limits per serving, including rice. Unknown values are excluded.
              You can also enter limits below.
            </p>
            {swap.data?.filters && (
              <ul aria-label="Applied nutrient limits" className="flex flex-wrap gap-2 pt-1">
                {nutrientFilterLabels(swap.data.filters).map((label) => (
                  <li
                    key={label}
                    className="rounded-lg bg-brand-green/10 px-3 py-1.5 text-xs font-semibold text-brand-text"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </form>
        )}
        {swap.filtersEnabled && (
          <ReviewNutrientFilters
            draft={swap.filterDraft}
            onChange={swap.setFilterDraft}
            apply={() => void swap.load()}
            busy={swap.saving || swap.loading || swap.interpreting}
          />
        )}
        {swap.data?.summary && (
          <p className="my-3 text-xs text-brand-muted">
            {swap.data.summary.matchedCount} complete-plate{' '}
            {swap.data.summary.matchedCount === 1 ? 'candidate' : 'candidates'} for RND review.{' '}
            {swap.data.summary.unknownExcludedCount} library records excluded for missing required nutrients. These
            limits narrow candidates; the RND still reviews the member’s health context.
          </p>
        )}
        {!swap.loading && !swap.error && swap.data && options.length === 0 && (
          <div className="my-5 space-y-3 text-sm">
            <p className="font-semibold">No replacements match this search.</p>
            <p className="max-w-[65ch] leading-6 text-brand-muted">
              Find a replacement from stored recipes, then AI if needed. It will still need review. Library nutrient
              filters do not apply to this broader search; your member’s saved restrictions and planning targets do.
            </p>
            {onFindReplacement && (
              <Button variant="secondary" disabled={swap.saving} onClick={onFindReplacement}>
                Reject and find replacement
              </Button>
            )}
          </div>
        )}
        {(swap.loading || swap.error || !swap.data || options.length > 0) && (
          <SwapMealOptions
            calorieSortOnly={!hasRanking}
            totalAvailable={swap.data?.summary?.matchedCount}
            model={{
              ...common,
              swapOptions: options,
              filteredAndSortedOptions:
                activeSort === 'best_match'
                  ? options
                  : [...options].sort(
                      (a, b) => Math.abs(a.calories - meal.calories) - Math.abs(b.calories - meal.calories)
                    ),
              miniSort: activeSort,
              setMiniSort: setSort,
              isOptionsLoading: swap.loading || swap.interpreting,
              swapOptionsError: swap.error,
              handleSelectSwapOption: async (option) => swap.setSelectedId(option.id),
              setSelectedVerifier: setVerifier,
            }}
          />
        )}
        {selected && (
          <div className="mt-4">
            <IngredientEvidenceTable ingredients={selected.ingredients} />
          </div>
        )}
        <label className="mt-4 block text-xs font-bold">
          Replacement rationale (at least 10 characters)
          <textarea
            value={swap.note}
            onChange={(event) => swap.setNote(event.target.value)}
            disabled={swap.saving}
            rows={2}
            maxLength={1000}
            className="mt-2 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm font-normal"
          />
        </label>
        <Button
          className="mt-3"
          size="sm"
          variant="secondary"
          disabled={swap.saving || swap.loading || swap.interpreting}
          onClick={() => void swap.load()}
        >
          Refresh options
        </Button>
        {swap.data?.nextCursor && (
          <Button
            className="ml-2 mt-3"
            size="sm"
            variant="secondary"
            disabled={swap.saving || swap.loading}
            onClick={() => void swap.load(swap.data!.nextCursor!)}
          >
            Next candidates
          </Button>
        )}
        {swap.data?.searchReceipt && onNoSuitable && (
          <Button
            className="ml-2 mt-3"
            size="sm"
            variant="secondary"
            disabled={swap.saving || swap.loading}
            onClick={onNoSuitable}
          >
            Reject and leave unavailable
          </Button>
        )}
        {swap.data?.searchReceipt && (
          <p className="mt-2 text-xs text-brand-muted">
            Leaving unavailable records a rejection and stops automatic replacement. A reason is required.
          </p>
        )}
      </Modal>
      <Modal
        isOpen={Boolean(verifier) && swap.open}
        onClose={() => setVerifier(null)}
        layer="canvas"
        size="lg"
        title="Recorded RND credentials"
      >
        {verifier && <NutritionistCredentialCard verifier={verifier} />}
      </Modal>
    </>
  );
}
