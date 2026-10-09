'use client';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SwapMealComparison from '@/features/meals/swap/SwapMealComparison';
import SwapMealOptions from '@/features/meals/swap/SwapMealOptions';
import { getMealTheme } from '@/features/dashboard/DashboardMealRow';
import { NutritionistCredentialCard } from '@/components/user/NutritionistCredentialCard';
import type { PublicVerifier } from '@/types';
import type { DetailData } from './useNutritionistReviews';
import type { useReviewSwap } from './useReviewSwap';
import IngredientEvidenceTable from './IngredientEvidenceTable';
import ReviewNutrientFilters, { REVIEW_NUTRIENT_FIELDS } from './ReviewNutrientFilters';

/** Reuses member swap presentation, with the RND claim and pending-review API adapter. */
export default function ReviewSwapDialog({
  swap,
  meal,
  onNoSuitable,
}: {
  swap: ReturnType<typeof useReviewSwap>;
  meal: DetailData['mealPlan'];
  onNoSuitable?: () => void;
}) {
  const [verifier, setVerifier] = useState<PublicVerifier | null>(null);
  const options = swap.data?.options ?? [];
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
        {swap.filtersEnabled && <ReviewNutrientFilters draft={swap.filterDraft} onChange={swap.setFilterDraft}
          apply={() => void swap.load()} busy={swap.saving || swap.loading} />}
        {swap.data?.summary && <p className="my-3 text-xs text-brand-muted">
          {swap.data.summary.matchedCount} complete-plate matches in the currently eligible certified library.
          {' '}{swap.data.summary.unknownExcludedCount} excluded for missing required nutrients.
          {' '}These limits narrow candidates; the RND still reviews the member’s health context.
        </p>}
        <SwapMealOptions
          calorieSortOnly
          model={{
            ...common,
            swapOptions: options,
            filteredAndSortedOptions: [...options].sort(
              (a, b) => Math.abs(a.calories - meal.calories) - Math.abs(b.calories - meal.calories)
            ),
            miniSort: 'kcal_match',
            setMiniSort: () => {},
            isOptionsLoading: swap.loading,
            swapOptionsError: swap.error,
            handleSelectSwapOption: async (option) => swap.setSelectedId(option.id),
            setSelectedVerifier: setVerifier,
          }}
        />
        {selected && (
          <div className="mt-4">
            {selected.nutrients && <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {REVIEW_NUTRIENT_FIELDS.map(([key, label, unit]) => <div key={key} className="rounded-lg border border-brand-border p-2 text-xs">
                <dt className="text-brand-muted">{label}</dt><dd className="mt-1 font-bold">{selected.nutrients![key] === null ? 'Not recorded' : `${Number(selected.nutrients![key].toFixed(3))} ${unit}`}</dd>
              </div>)}
            </dl>}
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
          disabled={swap.saving || swap.loading}
          onClick={() => void swap.load()}
        >
          Refresh options
        </Button>
        {swap.data?.nextCursor && <Button className="ml-2 mt-3" size="sm" variant="secondary" disabled={swap.saving || swap.loading}
          onClick={() => void swap.load(swap.data!.nextCursor!)}>Next candidates</Button>}
        {swap.data?.searchReceipt && onNoSuitable && <Button className="ml-2 mt-3" size="sm" variant="secondary" disabled={swap.saving || swap.loading}
          onClick={onNoSuitable}>No suitable replacement</Button>}
        {swap.data?.searchReceipt && <p className="mt-2 text-xs text-brand-muted">No suitable replacement opens the rejection dialog. Record why the results are unsuitable; it is not a separate final decision.</p>}
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
