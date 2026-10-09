'use client';
import MealImage from '@/components/user/MealImage';
import type { PublicMealImage } from '@/types';
import IngredientEvidenceTable from '../IngredientEvidenceTable';
import type { DetailData } from '../useNutritionistReviews';
import ReusableReviewReferences from '../ReusableReviewReferences';

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
        <h3 className="text-base font-bold">{meal.mealName}</h3>
        <p className="text-xs text-brand-muted">{meal.mealType} · Saved recipe evidence</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-brand-border">
        <MealImage
          mealName={meal.mealName}
          mealType={meal.mealType}
          image={(meal as { image?: PublicMealImage | null }).image ?? null}
          variant="card"
          className="h-52 w-full"
          showAttributionLinks
        />
      </div>
      <p className="text-sm text-brand-muted">{meal.description || 'No description recorded.'}</p>
      <dl className="grid grid-cols-4 gap-3 text-sm">
        {(
          [
            ['Energy', meal.calories, 'kcal'],
            ['Protein', meal.proteinG, 'g'],
            ['Carbs', meal.carbsG, 'g'],
            ['Fat', meal.fatG, 'g'],
          ] as const
        ).map(([label, value, unit]) => (
          <div key={label}>
            <dt className="text-xs text-brand-muted">{label}</dt>
            <dd className="font-bold">
              {value.toFixed(1)} {unit}
            </dd>
          </div>
        ))}
      </dl>
      <IngredientEvidenceTable ingredients={ingredients} />
      {model.detailData.reviewReferences && <ReusableReviewReferences references={model.detailData.reviewReferences} />}
    </section>
  );
}
