import { buildComposedServing } from '@/domain/composed-serving.policy';
import {
  getMealSlotCalorieRange,
  isMealWithinSlotCalorieRange,
  isPrimaryMealType,
} from '@/domain/meal-calorie-allocation.policy';
import { chooseCookedRicePortionG } from '@/domain/upcoming-preparation.policy';
import { resolveRecipeRiceRole } from '@/domain/recipe-rice-role.policy';
import { MealType, RecipeRiceRole, RicePreference } from '@prisma/client';
import { type CertifiedLibraryMeal } from './meal-library-candidate-query.service';
import { nutritionFitScore, type NutritionVector } from '@/domain/meal-macro-target.policy';
import { isSnackOnlyRecipe } from '@/domain/recipe-category.policy';
import { effectiveRecipeMealTypes } from '@/domain/meal-applicability.policy';

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
  macroTarget?: NutritionVector & { goal?: string };
  scoreNutrition?: (nutrition: NutritionVector) => number;
}) {
  const { meal, mealType, dailyTarget, ricePreference, hasConditions, riceFood } = input;
  if (!isPrimaryMealType(mealType)) return null;
  if (isSnackOnlyRecipe(meal.mealName)) return null;
  if (
    !effectiveRecipeMealTypes(
      meal.mealName,
      null,
      meal.applicableMealTypes.map((entry) => entry.mealType)
    ).includes(mealType)
  )
    return null;
  const riceRole = resolveRecipeRiceRole(meal);
  if (ricePreference === RicePreference.WITH_RICE && !riceRole.riceRole) return null;
  let pairedRiceG: number | null = null;
  let nutrition = { calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG };
  if (ricePreference !== RicePreference.NO_RICE && riceRole.riceRole === RecipeRiceRole.PAIR_WITH_RICE) {
    // The current condition clearances are scoped to the base serving. A rice
    // composition requires a separately reviewed composed serving signature.
    if ((hasConditions && !input.allowPendingCaseReview) || !riceFood || !meal.recipeSignature) {
      if (ricePreference === RicePreference.WITH_RICE) return null;
      // EITHER may keep the unchanged, cleared base serving when a new rice
      // composition is unavailable. Its calorie range remains enforced.
      return isMealWithinSlotCalorieRange({ calories: meal.calories, mealType, dailyCalorieTarget: dailyTarget })
        ? { ...nutrition, pairedRiceG }
        : null;
    }
    const range = getMealSlotCalorieRange(dailyTarget, mealType);
    pairedRiceG = chooseCookedRicePortionG({
      baseCalories: meal.calories,
      riceCaloriesPer100G: riceFood.calories,
      slotTargetCalories: range.target,
      slotMinimumCalories: range.minimum,
      slotMaximumCalories: range.maximum,
      minHalfCups: riceRole.minHalfCups,
      maxHalfCups: riceRole.maxHalfCups,
    });
    if (input.macroTarget) {
      const portions = [
        ...(ricePreference === 'WITH_RICE' ? [] : [0]),
        ...Array.from(
          { length: riceRole.maxHalfCups - riceRole.minHalfCups + 1 },
          (_, i) => (i + riceRole.minHalfCups) * 75
        ),
      ];
      const options = portions
        .map((g) => ({
          g,
          total: g
            ? buildComposedServing({
                baseRecipeSignature: meal.recipeSignature!,
                baseNutrition: nutrition,
                riceFood,
                cookedRiceG: g,
              }).total
            : nutrition,
        }))
        .filter((o) => o.total.calories >= range.minimum && o.total.calories <= range.maximum)
        .sort(
          (a, b) =>
            (input.scoreNutrition
              ? input.scoreNutrition(a.total) - input.scoreNutrition(b.total)
              : nutritionFitScore(a.total, input.macroTarget!) - nutritionFitScore(b.total, input.macroTarget!)) ||
            a.g - b.g
        );
      pairedRiceG = options[0]?.g || null;
    }
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
  if (ricePreference === RicePreference.NO_RICE && riceRole.riceRole === RecipeRiceRole.INCLUDES_RICE) return null;
  if (ricePreference === RicePreference.WITH_RICE && riceRole.riceRole === RecipeRiceRole.STANDALONE) return null;
  if (!isMealWithinSlotCalorieRange({ calories: nutrition.calories, mealType, dailyCalorieTarget: dailyTarget }))
    return null;
  return { ...nutrition, pairedRiceG };
}
