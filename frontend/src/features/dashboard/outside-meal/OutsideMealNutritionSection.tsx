'use client';

import Input from '@/components/ui/Input';
import { displayMacros } from '../outside-meal-input';
import type { useOutsideMealFormModel } from './useOutsideMealFormModel';

type Model = ReturnType<typeof useOutsideMealFormModel>;
type SectionProps = {
  model: Pick<Model, 'baseNutrition' | 'applyPortionMultiplier' | 'selectedSuggestion' | 'manual' | 'setManual' | 'portionGrams'>;
};
const fields = [
  { key: 'calories', label: 'Calories', unit: 'kcal', step: '1' },
  { key: 'proteinG', label: 'Protein', unit: 'g', step: '0.1' },
  { key: 'carbsG', label: 'Carbs', unit: 'g', step: '0.1' },
  { key: 'fatG', label: 'Fat', unit: 'g', step: '0.1' },
] as const;

export default function OutsideMealNutritionSection({ model }: SectionProps) {
  const { baseNutrition, applyPortionMultiplier, selectedSuggestion, manual, setManual, portionGrams } = model;
  const factor = selectedSuggestion?.kind === 'FNRI_FOOD' ? Number(portionGrams) / 100 : 1;
  const reference = baseNutrition && factor > 0
    ? displayMacros({ calories: baseNutrition.calories * factor, proteinG: baseNutrition.proteinG * factor,
      carbsG: baseNutrition.carbsG * factor, fatG: baseNutrition.fatG * factor }) : null;
  const unchanged = reference && fields.every(({ key }) => manual[key] === reference[key]);
  const sourceLabel = unchanged && selectedSuggestion?.kind === 'FNRI_FOOD' ? 'FNRI composition'
    : unchanged && selectedSuggestion?.kind === 'ELIGIBLE_LIBRARY' ? 'Saved library serving'
    : selectedSuggestion && baseNutrition ? 'Your entered values' : 'Enter label or menu values';

  return (
    <section className="space-y-4 border-t border-brand-border pt-5" aria-labelledby="outside-nutrition-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="outside-nutrition-heading" className="font-display text-base font-bold text-brand-text">Nutrition for your portion</h3>
          <p className="mt-1 text-xs leading-relaxed text-brand-muted" aria-live="polite">{sourceLabel}</p>
        </div>
        {baseNutrition && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Scale reference portion">
            {[0.5, 1, 1.5, 2].map((amount) => (
              <button key={amount} type="button" onClick={() => applyPortionMultiplier(amount)}
                aria-label={`Use ${amount} times the reference portion`}
                className="min-h-10 min-w-10 rounded-lg border border-brand-border bg-brand-bgAlt px-2 text-xs font-bold text-brand-text transition-colors hover:border-brand-green hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40">
                {amount}×
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map(({ key, label, unit, step }) => (
          <Input key={key} id={`outside-${key}`} label={`${label} (${unit})`} type="number" min="0" step={step}
            inputMode="decimal" placeholder="—" value={manual[key]}
            onChange={(event) => setManual((previous) => ({ ...previous, [key]: event.target.value }))}
            className="!min-h-11 !bg-brand-bgAlt !text-base !font-semibold !shadow-none !backdrop-blur-none tabular-nums" />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-brand-muted">
        Leave these blank to check saved references, or enter all four values for the portion you ate.
        Edited values are recorded as your input, not as a verified source.
      </p>
    </section>
  );
}
