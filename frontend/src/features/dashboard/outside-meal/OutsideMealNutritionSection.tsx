'use client';

import { CheckCircle2, Flame, Info } from 'lucide-react';

import type { useOutsideMealFormModel } from './useOutsideMealFormModel';
type Model = Extract<ReturnType<typeof useOutsideMealFormModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<Model, 'baseNutrition' | 'applyPortionMultiplier' | 'selectedSuggestion' | 'manual' | 'setManual'>;
};
export default function OutsideMealNutritionSection({ model }: SectionProps) {
  const { baseNutrition, applyPortionMultiplier, selectedSuggestion, manual, setManual } = model;

  return (
    <>
      <div className="rounded-2xl border border-brand-border/70 bg-brand-surface/70 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-brand-green" />
            <span className="text-xs font-bold text-brand-text">Nutritional Values (Estimated)</span>
          </div>
          <div className="flex items-center gap-2">
            {baseNutrition && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-brand-muted font-medium mr-0.5 hidden sm:inline">Portion:</span>
                {[0.5, 1, 1.5, 2].map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => applyPortionMultiplier(factor)}
                    className="rounded-lg border border-brand-border/70 bg-brand-bgAlt/60 px-2 py-0.5 text-[10px] font-bold text-brand-muted hover:border-brand-green hover:text-brand-green transition"
                  >
                    {factor}x
                  </button>
                ))}
              </div>
            )}
            {selectedSuggestion && (
              <span className="flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold text-brand-green">
                <CheckCircle2 className="h-3 w-3" />
                {selectedSuggestion.kind === 'ELIGIBLE_LIBRARY'
                  ? 'Verified recipe'
                  : selectedSuggestion.kind === 'KNOWN_CATALOG'
                    ? 'Catalog reference'
                    : selectedSuggestion.kind === 'FNRI_FOOD'
                      ? 'FNRI per 100g'
                      : 'Reference'}
              </span>
            )}
          </div>
        </div>

        {/* 4 Numeric Inputs side-by-side with theme macro badges */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-2 transition focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green">
            <div className="mb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-brand-green" />
                Calories
              </span>
              <span className="font-semibold text-brand-muted/70">kcal</span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={manual.calories}
              onChange={(e) => setManual((prev) => ({ ...prev, calories: e.target.value }))}
              className="w-full bg-transparent px-0.5 py-0.5 text-xs font-bold text-brand-text outline-none"
            />
          </div>

          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-2 transition focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green">
            <div className="mb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--macro-protein)' }} />
                Protein
              </span>
              <span className="font-semibold text-brand-muted/70">g</span>
            </div>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              value={manual.proteinG}
              onChange={(e) => setManual((prev) => ({ ...prev, proteinG: e.target.value }))}
              className="w-full bg-transparent px-0.5 py-0.5 text-xs font-bold text-macro-protein outline-none"
            />
          </div>

          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-2 transition focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green">
            <div className="mb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--macro-carbs)' }} />
                Carbs
              </span>
              <span className="font-semibold text-brand-muted/70">g</span>
            </div>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              value={manual.carbsG}
              onChange={(e) => setManual((prev) => ({ ...prev, carbsG: e.target.value }))}
              className="w-full bg-transparent px-0.5 py-0.5 text-xs font-bold text-macro-carbs outline-none"
            />
          </div>

          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-2 transition focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green">
            <div className="mb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--macro-fat)' }} />
                Fat
              </span>
              <span className="font-semibold text-brand-muted/70">g</span>
            </div>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              value={manual.fatG}
              onChange={(e) => setManual((prev) => ({ ...prev, fatG: e.target.value }))}
              className="w-full bg-transparent px-0.5 py-0.5 text-xs font-bold text-macro-fat outline-none"
            />
          </div>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-brand-muted">
          <Info className="h-3 w-3 shrink-0" />
          Values are editable. Tweak any numbers above or enter your own nutrition-label or menu values.
        </p>
      </div>
    </>
  );
}
