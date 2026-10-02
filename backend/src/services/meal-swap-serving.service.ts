import { buildComposedServing } from '@/domain/composed-serving.policy';
import {
  getMealSlotCalorieRange,
  isMealWithinSlotCalorieRange,
  isPrimaryMealType,
} from '@/domain/meal-calorie-allocation.policy';
import { chooseCookedRicePortionG } from '@/domain/upcoming-preparation.policy';
import { MealType, RecipeRiceRole, RicePreference, RiceRoleReviewStatus } from '@prisma/client';
import { type CertifiedLibraryMeal } from './meal-library-candidate-query.service';

export type SwapRiceFood = {
  id: string;
  name: string;
  source: string;
  compositionRevision?: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export function resolveReplacementServing(input: {
  meal: CertifiedLibraryMeal;
  mealType: MealType;
  dailyTarget: number;
  ricePreference: RicePreference;
  hasConditions: boolean;
  riceFood: SwapRiceFood | null;
  allowPendingCaseReview?: boolean;
}) {
  const { meal, mealType, dailyTarget, ricePreference, hasConditions, riceFood } = input;
  if (!isPrimaryMealType(mealType)) return null;
  let pairedRiceG: number | null = null;
  let nutrition = { calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG };
  if (ricePreference !== RicePreference.NO_RICE && meal.riceRole === RecipeRiceRole.PAIR_WITH_RICE) {
    // The current condition clearances are scoped to the base serving. A rice
    // composition requires a separately reviewed composed serving signature.
    if (
      (hasConditions && !input.allowPendingCaseReview) ||
      meal.riceRoleReviewStatus !== RiceRoleReviewStatus.REVIEWED ||
      !riceFood ||
      !meal.recipeSignature
    )
      return null;
    const range = getMealSlotCalorieRange(dailyTarget, mealType);
    pairedRiceG = chooseCookedRicePortionG({
      baseCalories: meal.calories,
      riceCaloriesPer100G: riceFood.calories,
      slotTargetCalories: range.target,
      slotMinimumCalories: range.minimum,
      slotMaximumCalories: range.maximum,
      minHalfCups: meal.riceMinHalfCups,
      maxHalfCups: meal.riceMaxHalfCups,
    });
    if (!pairedRiceG) {
      if (ricePreference === RicePreference.WITH_RICE) return null;
    }
    if (pairedRiceG)
      nutrition = buildComposedServing({
        baseRecipeSignature: meal.recipeSignature,
        baseNutrition: nutrition,
        riceFood,
        cookedRiceG: pairedRiceG,
      }).total;
  }
  if (ricePreference === RicePreference.NO_RICE && meal.riceRole === RecipeRiceRole.INCLUDES_RICE) return null;
  if (ricePreference === RicePreference.WITH_RICE && meal.riceRole === RecipeRiceRole.STANDALONE) return null;
  if (!isMealWithinSlotCalorieRange({ calories: nutrition.calories, mealType, dailyCalorieTarget: dailyTarget }))
    return null;
  return { ...nutrition, pairedRiceG };
}
