import { MEAL_EXTENDED_NUTRIENTS } from './meal-nutrient-completion.policy';
import { publishedExtendedNutrients } from './review-plate-nutrients.policy';

const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const macros = ['calories', 'proteinG', 'carbsG', 'fatG'] as const;

/** Recover an existing complete standardized calculation; never estimate a missing amount or nutrient. */
export function existingRecipeExtendedFill(row: {
  sourceName: string;
  ingredients: unknown;
  publishedNutrition: unknown;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}) {
  if (row.sourceName !== 'DEMO_STANDARD_PORTION') return null;
  const published = object(row.publishedNutrition),
    calculation = object(published?.demoPreparation);
  const nutrition = object(calculation?.nutrition);
  if (
    !published ||
    !calculation ||
    !nutrition ||
    calculation.complete !== true ||
    calculation.estimated !== true ||
    calculation.clinicalCertification !== false ||
    typeof calculation.signature !== 'string' ||
    !macros.every((key) => finite(nutrition[key]) && finite(row[key]) && Math.abs(nutrition[key] - row[key]!) <= 0.011)
  )
    return null;
  const ingredients = Array.isArray(row.ingredients) ? row.ingredients.map(object) : [];
  const prepared = Array.isArray(calculation.prepared) ? calculation.prepared.map(object) : [];
  if (
    !ingredients.length ||
    ingredients.length !== prepared.length ||
    ingredients.some((ingredient, i) => {
      const evidence = prepared[i];
      return (
        !ingredient ||
        !evidence ||
        ingredient.foodItemId !== evidence.foodItemId ||
        ingredient.name !== evidence.name ||
        ingredient.unit !== 'g' ||
        !finite(ingredient.quantity) ||
        ingredient.quantity <= 0 ||
        ingredient.quantity !== evidence.gramsPerServing ||
        ingredient.quantity !== evidence.quantity
      );
    })
  )
    return null;
  const before = publishedExtendedNutrients(published);
  const fill = Object.fromEntries(
    MEAL_EXTENDED_NUTRIENTS.flatMap((key) =>
      before[key] == null && published[key] == null && finite(nutrition[key]) ? [[key, nutrition[key]]] : []
    )
  );
  return Object.keys(fill).length
    ? { fill, calculationSignature: calculation.signature, basis: 'EXISTING_STANDARDIZED_DEMO_CALCULATION' as const }
    : null;
}
