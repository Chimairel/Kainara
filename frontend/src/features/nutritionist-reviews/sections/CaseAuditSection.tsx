'use client';
import { formatMealTitle } from '@/lib/meal-title';
import MealImage from '@/components/user/MealImage';
import IngredientEvidenceTable from '../IngredientEvidenceTable';
import type { DetailData } from '../useNutritionistReviews';
import ReusableReviewReferences from '../ReusableReviewReferences';
import { REVIEW_NUTRIENT_FIELDS } from '../ReviewNutrientFilters';

/** Saved evidence is read-only. Notes never alter the approved recipe. */
export default function CaseAuditSection({
  model,
  paper = false,
}: {
  model: { detailData: DetailData | null };
  paper?: boolean;
}) {
  if (!model.detailData) return null;
  const { mealPlan: meal, ingredients } = model.detailData;
  return (
    <section className={paper ? 'space-y-5' : 'space-y-5 rounded-2xl border border-brand-border bg-brand-surface p-5'}>
      <div className="border-b border-brand-border pb-3">
        <h3 className="text-base font-bold">{formatMealTitle(meal.mealName)}</h3>
        <p className="text-xs text-brand-muted">{meal.mealType} · Saved recipe evidence</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-brand-border">
        <MealImage
          mealName={meal.mealName}
          mealType={meal.mealType}
          image={meal.image ?? null}
          variant="card"
          className="h-52 w-full"
          showAttributionLinks
        />
      </div>
      <p className="text-sm text-brand-muted">{meal.description || 'No description recorded.'}</p>
      <section aria-label="Meal nutrition facts">
        <h3 className="mb-3 text-base font-bold">Nutrition facts</h3>
        <p className="mb-3 text-xs text-brand-muted">One meal, including any paired rice.</p>
        <dl className="grid grid-cols-2 gap-x-6 text-sm">
          {REVIEW_NUTRIENT_FIELDS.map(([key, label, unit]) => {
            const values = { ...meal.nutrients, calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG };
            const value = values[key];
            return <div key={key} className="flex items-baseline justify-between gap-3 border-b border-brand-border/50 py-2">
              <dt className="text-brand-muted">{label}</dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums">
                {typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${Math.round(value * 10) / 10} ${unit}` : 'Not recorded'}
              </dd>
            </div>;
          })}
        </dl>
      </section>
      <IngredientEvidenceTable ingredients={ingredients} />
      {model.detailData.reviewReferences && <ReusableReviewReferences references={model.detailData.reviewReferences} />}
    </section>
  );
}
