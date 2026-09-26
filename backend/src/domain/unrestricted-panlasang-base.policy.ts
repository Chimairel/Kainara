import type { Prisma } from '@prisma/client';
import { adaptUserSafetyRestrictions, type StructuredSafetyRestrictionEntry } from './structured-restriction.adapter';

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
}): boolean {
  const restrictions = adaptUserSafetyRestrictions({
    healthConditions: input.conditions,
    allergies: input.allergens,
    otherConditions: input.otherConditions,
    otherAllergies: input.otherAllergies,
    safetyEntries: input.safetyEntries,
  });
  if (restrictions.requiresReview || restrictions.conditions.length || restrictions.allergies.length ||
      restrictions.customConditions.length || restrictions.customFoodRestrictions.length) return false;
  const source = input.source;
  if (!source || source.id !== input.candidateId || source.sourceName !== 'PANLASANG_PINOY' ||
      source.status !== 'AVAILABLE' || !source.publishedNutrition) return false;
  if (![source.calories, source.proteinG, source.carbsG, source.fatG].every(
    (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
  ) || (source.calories ?? 0) <= 0) return false;
  if (!Array.isArray(source.ingredients) || !source.ingredients.length ||
      source.ingredients.length !== input.preparedIngredients.length) return false;
  return source.ingredients.every((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const ingredient = item as Record<string, unknown>;
    const prepared = input.preparedIngredients[index];
    return ingredient.excludedFromPlanning !== true &&
      typeof ingredient.name === 'string' && ingredient.name.trim().length > 0 &&
      typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity) && ingredient.quantity > 0 &&
      typeof ingredient.unit === 'string' && ingredient.unit.trim().length > 0 &&
      prepared?.ingredientName.normalize('NFKC').trim().toLowerCase() === ingredient.name.normalize('NFKC').trim().toLowerCase() &&
      prepared.quantity === ingredient.quantity &&
      prepared.unit?.normalize('NFKC').trim().toLowerCase() === ingredient.unit.normalize('NFKC').trim().toLowerCase();
  });
}
