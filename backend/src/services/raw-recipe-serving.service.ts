import { RicePreference, type MealType } from '@prisma/client';
import { getMealSlotCalorieRange, isPrimaryMealType } from '@/domain/meal-calorie-allocation.policy';
import { proposeRiceRole } from '@/domain/recipe-rice-role.policy';
import { COOKED_RICE_HALF_CUP_GRAMS } from '@/domain/rice-portion.policy';
import { chooseCookedRicePortionG } from '@/domain/upcoming-preparation.policy';
import { sourceServingScale, scalePublishedAmount } from '@/domain/source-serving-adjustment.policy';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';
import type { SwapRiceFood } from './meal-swap-serving.service';

/** Choose a complete plate while preserving the published dish as its base. */
export function rawRecipeServing(input: {
  candidate: RecipeCandidateProjection;
  mealType: MealType;
  dailyCalorieTarget: number;
  ricePreference?: RicePreference;
  riceFood?: SwapRiceFood | null;
}) {
  const { candidate, mealType, dailyCalorieTarget, riceFood } = input;
  if (
    candidate.state !== 'ACTIVE' ||
    !candidate.nutrition ||
    !isPrimaryMealType(mealType) ||
    !Object.values(candidate.nutrition).every((value) => Number.isFinite(value) && value >= 0) ||
    candidate.nutrition.calories <= 0
  )
    return null;
  const preference = input.ricePreference ?? RicePreference.FLEXIBLE;
  const role = proposeRiceRole({
    name: candidate.displayName,
    category: candidate.category,
    ingredients: candidate.ingredients,
  }).riceRole;
  if (preference === 'NO_RICE' && role === 'INCLUDES_RICE') return null;
  if (preference === 'WITH_RICE' && role === 'STANDALONE') return null;
  const range = getMealSlotCalorieRange(dailyCalorieTarget, mealType);
  let servingScale: number | null = null;
  let pairedRiceG: number | null = null;
  if (role === 'PAIR_WITH_RICE' && preference !== 'NO_RICE' && riceFood && candidate.provenance === 'PANLASANG_PINOY') {
    const options = [1, 2, 3].flatMap((halfCups) => {
      const riceCalories = (riceFood.calories * halfCups * COOKED_RICE_HALF_CUP_GRAMS) / 100;
      const scale = Math.round(((range.target - riceCalories) / candidate.nutrition!.calories) * 1000) / 1000;
      return scale >= 0.5 && scale <= 2 ? [scale] : [];
    });
    // First try the unchanged dish; scaling is a fallback, not an altered recipe.
    for (const scale of [1, ...options.sort((a, b) => Math.abs(a - 1) - Math.abs(b - 1))]) {
      const riceG = chooseCookedRicePortionG({
        baseCalories: scalePublishedAmount(candidate.nutrition.calories, scale),
        riceCaloriesPer100G: riceFood.calories,
        slotTargetCalories: range.target,
        slotMinimumCalories: range.minimum,
        slotMaximumCalories: range.maximum,
        minHalfCups: 1,
        maxHalfCups: 3,
      });
      if (riceG) {
        servingScale = scale;
        pairedRiceG = riceG;
        break;
      }
    }
  }
  if (servingScale === null) {
    if (preference === 'WITH_RICE' && role === 'PAIR_WITH_RICE') return null;
    servingScale =
      candidate.provenance === 'PANLASANG_PINOY'
        ? sourceServingScale({ calories: candidate.nutrition.calories, dailyCalorieTarget, mealType })
        : 1;
  }
  if (servingScale === null) return null;
  const nutrition = {
    calories: scalePublishedAmount(candidate.nutrition.calories, servingScale),
    proteinG: scalePublishedAmount(candidate.nutrition.proteinG, servingScale),
    carbsG: scalePublishedAmount(candidate.nutrition.carbsG, servingScale),
    fatG: scalePublishedAmount(candidate.nutrition.fatG, servingScale),
  };
  const plateCalories = nutrition.calories + (pairedRiceG && riceFood ? (riceFood.calories * pairedRiceG) / 100 : 0);
  if (plateCalories < range.minimum || plateCalories > range.maximum) return null;
  return {
    ...candidate,
    nutrition,
    riceRole: role,
    servingScale,
    pairedRiceG,
    plateCalories,
    ingredients: candidate.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: ingredient.quantity === undefined ? undefined : scalePublishedAmount(ingredient.quantity, servingScale),
    })),
  };
}
