import type { Prisma } from '@prisma/client';
import { adaptUserSafetyRestrictions, type StructuredSafetyRestrictionEntry } from './structured-restriction.adapter';
import { isInvalidSourceIngredientLabel } from './source-ingredient-fnri-match.policy';
import {
  scalePublishedAmount,
  SOURCE_SERVING_MAX_SCALE,
  SOURCE_SERVING_MIN_SCALE,
} from './source-serving-adjustment.policy';

type SourceRecipe = {
  id: string;
  sourceName: string;
  status: string;
  publishedNutrition: Prisma.JsonValue | null;
  ingredients: Prisma.JsonValue;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

/** General wellness route only; a source recipe never grants condition/allergy clearance. */
export function isUnrestrictedPanlasangBaseEligible(input: {
  source: SourceRecipe | null | undefined;
  candidateId?: string;
  conditions: readonly string[];
  allergens: readonly string[];
  otherConditions?: string | null;
  otherAllergies?: string | null;
  safetyEntries?: readonly StructuredSafetyRestrictionEntry[];
  preparedIngredients: readonly { ingredientName: string; quantity?: number | null; unit?: string | null }[];
  servingScale?: number;
  preparedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
}): boolean {
  const restrictions = adaptUserSafetyRestrictions({
    healthConditions: input.conditions,
    allergies: input.allergens,
    otherConditions: input.otherConditions,
    otherAllergies: input.otherAllergies,
    safetyEntries: input.safetyEntries,
  });
  if (
    restrictions.requiresReview ||
    restrictions.conditions.length ||
    restrictions.allergies.length ||
    restrictions.customConditions.length ||
    restrictions.customFoodRestrictions.length
  )
    return false;
  const source = input.source;
  const sourceNutrition = source?.publishedNutrition;
  // Assumed demonstration preparations require an explicit RND decision.
  if (
    sourceNutrition &&
    typeof sourceNutrition === 'object' &&
    !Array.isArray(sourceNutrition) &&
    sourceNutrition.demoPreparation
  )
    return false;
  if (
    !source ||
    source.id !== input.candidateId ||
    source.sourceName !== 'PANLASANG_PINOY' ||
    source.status !== 'AVAILABLE' ||
    !source.publishedNutrition
  )
    return false;
  if (
    ![source.calories, source.proteinG, source.carbsG, source.fatG].every(
      (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    ) ||
    (source.calories ?? 0) <= 0
  )
    return false;
  const scale = input.servingScale ?? 1;
  if (!Number.isFinite(scale) || scale < SOURCE_SERVING_MIN_SCALE || scale > SOURCE_SERVING_MAX_SCALE) return false;
  if (scale !== 1) {
    if (
      !input.preparedNutrition ||
      !(['calories', 'proteinG', 'carbsG', 'fatG'] as const).every(
        (key) => Math.abs(input.preparedNutrition![key] - scalePublishedAmount(source[key]!, scale)) <= 0.01
      )
    )
      return false;
  }
  if (!Array.isArray(source.ingredients)) return false;
  if (
    source.ingredients.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        (item as Record<string, unknown>).excludedFromPlanning === true &&
        (typeof (item as Record<string, unknown>).name !== 'string' ||
          !isInvalidSourceIngredientLabel((item as Record<string, unknown>).name as string))
    )
  )
    return false;
  const sourceIngredients = source.ingredients.filter(
    (item) =>
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      (item as Record<string, unknown>).excludedFromPlanning !== true
  );
  if (!sourceIngredients.length || sourceIngredients.length !== input.preparedIngredients.length) return false;
  return sourceIngredients.every((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const ingredient = item as Record<string, unknown>;
    const prepared = input.preparedIngredients[index];
    const unit = typeof ingredient.unit === 'string' && ingredient.unit.trim() ? ingredient.unit.trim() : undefined;
    const quantity =
      unit && typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity) && ingredient.quantity > 0
        ? scalePublishedAmount(ingredient.quantity, scale)
        : undefined;
    return (
      typeof ingredient.name === 'string' &&
      ingredient.name.trim().length > 0 &&
      prepared?.ingredientName.normalize('NFKC').trim().toLowerCase() ===
        ingredient.name.normalize('NFKC').trim().toLowerCase() &&
      (prepared.quantity ?? undefined) === quantity &&
      (prepared.unit?.normalize('NFKC').trim().toLowerCase() || undefined) === unit?.normalize('NFKC').toLowerCase()
    );
  });
}
