'use client';

import type { OutsideMealModalProps as Props } from '../outside-meal-modal.types';
import Button from '@/components/ui/Button';

import RiceAccompanimentSelect from '@/components/user/RiceAccompanimentSelect';

import type { MealType } from '@/types';

import { mealLabels } from '@/features/dashboard/outside-meal/OutsideMealForm.shared';

import { useOutsideMealFormModel } from '@/features/dashboard/outside-meal/useOutsideMealFormModel';
import OutsideMealSearchSection from '@/features/dashboard/outside-meal/OutsideMealSearchSection';
import OutsideMealNutritionSection from '@/features/dashboard/outside-meal/OutsideMealNutritionSection';
import OutsideMealPhotoSection from '@/features/dashboard/outside-meal/OutsideMealPhotoSection';
import OutsideMealConfirmationSection from '@/features/dashboard/outside-meal/OutsideMealConfirmationSection';
export default function OutsideMealForm(props: Props) {
  const model = useOutsideMealFormModel(props);

  const {
    handleSubmit,
    setRiceGrams,
    selectedSuggestion,
    baseNutrition,
    portionGrams,
    riceReference,
    selectedRicePairing,
    riceGrams,
    ricePlatePreview,
    imageError,
  } = model;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(false);
      }}
      className="text-left"
    >
      <fieldset disabled={props.isLoading} aria-busy={props.isLoading} className="flex min-w-0 flex-col gap-5">
        {/* 1. Meal Category Segmented Control */}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-2 font-display text-sm font-semibold text-brand-text">
            Meal category <span className="text-xs font-normal text-brand-muted">(required)</span>
          </legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-brand-bgAlt p-1 text-center sm:grid-cols-4">
            {(Object.keys(mealLabels) as MealType[]).map((type) => {
              const isSelected = props.mealType === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => props.onMealTypeChange(type)}
                  className={`min-h-11 rounded-lg px-2 py-2 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green/40 ${
                    isSelected
                      ? 'bg-brand-accent text-brand-dark'
                      : 'text-brand-muted hover:text-brand-text hover:bg-brand-surface/70'
                  }`}
                >
                  {mealLabels[type]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Food or Meal Eaten with Autocomplete + Inline Portion */}
        <OutsideMealSearchSection model={model} />

        {/* 3. Nutritional Values (Estimated) */}
        <OutsideMealNutritionSection model={model} />

        {riceReference && baseNutrition && (
          <div className="space-y-1.5 rounded-xl border border-brand-border/60 bg-brand-bgAlt/30 p-2.5">
            {selectedRicePairing === 'RICE_INCLUDED' && (
              <p className="text-[11px] text-brand-muted">
                The recipe estimate already includes its listed rice. If your rice portion differs, edit the nutrition
                estimate above. Use this field only for rice added beyond the recipe serving.
              </p>
            )}
            <RiceAccompanimentSelect
              id="outside-meal-rice"
              grams={riceGrams}
              onChange={setRiceGrams}
              rice={riceReference}
              extra={selectedRicePairing === 'RICE_INCLUDED'}
            />
            {ricePlatePreview && (
              <p className="text-xs font-semibold text-brand-text">
                Plate preview: {Math.round(ricePlatePreview.calories)} kcal ·{' '}
                {Math.round(ricePlatePreview.carbsG * 10) / 10}g carbs. Rice appears as its own FNRI item in the
                confirmation.
              </p>
            )}
          </div>
        )}

        {/* Optional preparation context and saved-log photo */}
        <OutsideMealPhotoSection model={model} />

        {/* 5. AI Assistant Fallback */}
        <OutsideMealConfirmationSection model={model} />

        {/* Preview does not commit a food log. */}
        <div className="space-y-3 border-t border-brand-border pt-5">
          <p className="text-xs text-brand-muted">Preview first. Your intake changes only after you save.</p>
          <Button
            type="submit"
            variant="primary"
            className="min-h-11 w-full text-sm"
            disabled={
              props.isLoading ||
              !props.mealName.trim() ||
              Boolean(imageError) ||
              (selectedSuggestion?.kind === 'FNRI_FOOD' && !(Number(portionGrams) > 0))
            }
          >
            Preview nutrition
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
