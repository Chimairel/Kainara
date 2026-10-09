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

/** Reuses member swap presentation, with the RND claim and pending-review API adapter. */
export default function ReviewSwapDialog({
  swap,
  meal,
}: {
  swap: ReturnType<typeof useReviewSwap>;
  meal: DetailData['mealPlan'];
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
