import type { DietaryPreference } from '@prisma/client';
import { foodExclusionKey, screenFoodExclusions } from './food-exclusion.policy';
import {
  classifyMealIngredients,
  hasDefiniteDietaryConflict,
  type IngredientClassificationInput,
} from './meal-ingredient-classification.policy';

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface GeneratedMealValidationInput {
  ingredients: readonly IngredientClassificationInput[];
  dietaryPreference: DietaryPreference;
  allergens: readonly string[];
  customAllergies?: readonly string[];
}

export interface GeneratedMealValidationResult {
  accepted: boolean;
  definiteConflicts: string[];
  reviewReasons: string[];
  classification: ReturnType<typeof classifyMealIngredients>;
}

export function validateGeneratedMealCandidate(input: GeneratedMealValidationInput): GeneratedMealValidationResult {
  const classification = classifyMealIngredients(input.ingredients);
  const definiteConflicts: string[] = [];
  const reviewReasons: string[] = [];
  const requestedAllergens = new Set(input.allergens.filter((value) => value !== 'NONE'));
  for (const allergen of classification.detectedAllergens) {
    if (requestedAllergens.has(allergen)) definiteConflicts.push(`ALLERGEN_${allergen}`);
  }

  const ingredientText = input.ingredients
    .map((ingredient) => normalize(`${ingredient.name} ${ingredient.compositionFoodName ?? ''}`))
    .join(' | ');
  for (const allergy of input.customAllergies ?? []) {
    const normalized = normalize(allergy);
    if (normalized.length >= 3 && ingredientText.includes(normalized)) {
      definiteConflicts.push(`CUSTOM_ALLERGEN_${normalized.toUpperCase().replace(/ /gu, '_')}`);
    }
  }
  const exclusions = screenFoodExclusions(input.ingredients, input.customAllergies ?? []);
  definiteConflicts.push(...exclusions.conflicts.map((key) => `FOOD_EXCLUSION_${key}`));
  if ((input.customAllergies ?? []).some((value) => foodExclusionKey(value)) && !exclusions.complete)
    reviewReasons.push('FOOD_EXCLUSION_EVIDENCE_INCOMPLETE');

  if (hasDefiniteDietaryConflict(classification, input.dietaryPreference)) {
    definiteConflicts.push(`DIETARY_${input.dietaryPreference}`);
  }
  if (classification.status !== 'COMPLETE') {
    reviewReasons.push('INGREDIENT_CLASSIFICATION_INCOMPLETE');
  }

  return {
    accepted: definiteConflicts.length === 0 && !reviewReasons.includes('FOOD_EXCLUSION_EVIDENCE_INCOMPLETE'),
    definiteConflicts: [...new Set(definiteConflicts)].sort(),
    reviewReasons,
    classification,
  };
}

export function splitCustomRestrictions(value?: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
