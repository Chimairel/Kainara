'use client';

import { formatMealTitle } from '@/lib/meal-title';

import Button from '@/components/ui/Button';

import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import NutritionistCredentialModal from '@/components/user/NutritionistCredentialModal';
import { AlertTriangle, Check } from 'lucide-react';

import SwapImpactDetails from './SwapImpactDetails';

import { Props } from '@/features/meals/swap/MealsWorkspaceModals.shared';

import { useMealsWorkspaceModalsModel } from '@/features/meals/swap/useMealsWorkspaceModalsModel';
import SwapMealComparison from '@/features/meals/swap/SwapMealComparison';
import SwapMealOptions from '@/features/meals/swap/SwapMealOptions';
export function MealsWorkspaceModals({ workspace }: Props) {
  const model = useMealsWorkspaceModalsModel({ workspace });

  const {
    selectedVerifier,
    setSelectedVerifier,
    activeSwapMeal,
    isSwapping,
    setActiveSwapMeal,
    setSwapOptions,
    setConfirmSwapMeal,
    setSwapOptionsError,
    setSwapPreview,
    confirmSwapMeal,
    setGroceryDeltaAcknowledged,
    isCheckingPreview,
    previewError,
    swapPreview,
    groceryDeltaAcknowledged,
    handleConfirmSwapAnyway,
  } = model;
  return (
    <>
      {selectedVerifier && (
        <NutritionistCredentialModal
          isOpen={true}
          onClose={() => setSelectedVerifier(null)}
          verifier={selectedVerifier}
        />
      )}

      {/* Swap Options Modal */}
      {activeSwapMeal && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (isSwapping) return;
            setActiveSwapMeal(null);
            setSwapOptions([]);
            setConfirmSwapMeal(null);
            setSwapOptionsError(null);
            setSwapPreview(null);
          }}
          title={`Swap ${formatMealTitle(activeSwapMeal.mealName)}`}
          description={`Replace the whole ${activeSwapMeal.mealType.toLowerCase()} plate, including any rice. Each option includes a freshly calculated rice portion where suitable; nutrition totals include rice.`}
          size="3xl"
        >
          <div className="space-y-4 text-left" aria-busy={isSwapping}>
            {/* TOP ROW: BALANCED COMPARISON STAGE */}
            <SwapMealComparison model={model} />

            {/* DEDICATED SWAP IMPACT SECTION */}
            {confirmSwapMeal && (
              <div className="relative overflow-hidden rounded-[24px] border border-brand-border/80 bg-gradient-to-br from-brand-surface via-brand-surface/95 to-brand-bgAlt/50 p-4 sm:p-5 shadow-xs space-y-3.5">
                {/* Bottom Corner Stripe Accent */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-2 -left-2 z-0 h-20 w-20 select-none opacity-20 dark:opacity-15"
                >
                  <svg viewBox="0 0 96 96" fill="none" className="h-full w-full block">
                    <path d="M 88 104 C 80 52 44 16 -8 8" stroke="#f09e6c" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 72 104 C 66 62 34 30 -8 24" stroke="#eb6a38" strokeWidth="10" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="relative z-10 space-y-3">
                  {/* Preview status & Warnings */}
                  {isCheckingPreview ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-brand-muted">
                      <LoadingSpinner size="sm" />
                      <span>Projecting daily balance & grocery impact...</span>
                    </div>
                  ) : previewError ? (
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{previewError}</span>
                    </div>
                  ) : swapPreview ? (
                    <div className="space-y-3">
                      {swapPreview.warningRequired && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>
                            <span className="font-bold">Notice:</span> Day total will be{' '}
                            <span className="font-extrabold">{swapPreview.projectedDayTotal} kcal</span> (target:{' '}
                            {swapPreview.dailyTarget} kcal).
                          </span>
                        </div>
                      )}

                      <SwapImpactDetails
                        analysis={swapPreview.nutritionAnalysis}
                        additions={swapPreview.shoppingNeeds}
                        removals={swapPreview.shoppingRemovals}
                      />

                      {swapPreview.groceryDeltaAcknowledgmentRequired && (
                        <label className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold cursor-pointer text-amber-900 dark:text-amber-200">
                          <input
                            disabled={isSwapping}
                            type="checkbox"
                            checked={groceryDeltaAcknowledged}
                            onChange={(e) => setGroceryDeltaAcknowledged(e.target.checked)}
                            className="mt-0.5 rounded border-amber-400 text-brand-green focus:ring-brand-green"
                          />
                          <span>I reviewed the grocery changes above. Shopping has already started.</span>
                        </label>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* BOTTOM SECTION: MINI MEAL LIBRARY BROWSER */}
            <SwapMealOptions model={model} />

            {/* STICKY BOTTOM CONFIRMATION ACTION BAR */}
            {confirmSwapMeal && (
              <div className="sticky -bottom-6 -mx-6 px-6 py-3.5 bg-brand-surface/95 dark:bg-[#071914]/95 backdrop-blur-md border-t border-brand-border/80 shadow-lg z-30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-brand-muted hidden sm:flex items-center gap-2">
                  {swapPreview?.warningRequired ? (
                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      Notice: Planning estimate differences detected
                    </span>
                  ) : isCheckingPreview ? (
                    <span className="flex items-center gap-1.5 text-brand-muted">
                      <LoadingSpinner size="sm" />
                      Calculating daily balance...
                    </span>
                  ) : swapPreview?.groceryDeltaAcknowledgmentRequired && !groceryDeltaAcknowledged ? (
                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      Grocery review acknowledgment required
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Check className="h-3.5 w-3.5" />
                      Plate compatible with daily schedule
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmSwapMeal(null);
                      setSwapPreview(null);
                      setGroceryDeltaAcknowledged(false);
                    }}
                    disabled={isSwapping}
                    className="text-xs h-9 px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleConfirmSwapAnyway(groceryDeltaAcknowledged)}
                    disabled={
                      isSwapping ||
                      isCheckingPreview ||
                      !swapPreview ||
                      (Boolean(swapPreview?.groceryDeltaAcknowledgmentRequired) && !groceryDeltaAcknowledged)
                    }
                    className="text-xs font-bold h-9 px-5 shadow-sm"
                  >
                    Confirm Swap
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
