import { RicePreference, type MealType } from '@prisma/client';
import { getMealSlotCalorieRange, isPrimaryMealType } from '@/domain/meal-calorie-allocation.policy';
import { resolveRecipeRiceRole } from '@/domain/recipe-rice-role.policy';
import { COOKED_RICE_HALF_CUP_GRAMS } from '@/domain/rice-portion.policy';
import { chooseCookedRicePortionG } from '@/domain/upcoming-preparation.policy';
import { sourceServingScale, scalePublishedAmount } from '@/domain/source-serving-adjustment.policy';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';
import type { SwapRiceFood } from './meal-swap-serving.service';
import { nutritionFitScore, type NutritionVector } from '@/domain/meal-macro-target.policy';
import { effectiveRecipeMealTypes } from '@/domain/meal-applicability.policy';

/** Choose a complete plate while preserving the published dish as its base. */
type ServingInput = {
  candidate: RecipeCandidateProjection;
  mealType: MealType;
  dailyCalorieTarget: number;
  ricePreference?: RicePreference;
  riceFood?: SwapRiceFood | null;
  macroTarget?: NutritionVector & { goal?: string };
};

export function rawRecipeServing(input: ServingInput) {
  const legacy = calorieServing(input);
  if (!input.macroTarget || !legacy || !input.candidate.nutrition || input.candidate.provenance !== 'PANLASANG_PINOY')
    return legacy;
  const range = getMealSlotCalorieRange(input.dailyCalorieTarget, input.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER');
  const riceAllowed = legacy.riceRole === 'PAIR_WITH_RICE' && input.ricePreference !== 'NO_RICE' && input.riceFood;
  const riceAmounts = riceAllowed ? [...(input.ricePreference === 'WITH_RICE' ? [] : [0]), 75, 150, 225] : [0];
  const options = riceAmounts.flatMap((riceG) => {
    const rice = input.riceFood;
    const riceCalories = rice ? (rice.calories * riceG) / 100 : 0;
    const exact = Math.round(((range.target - riceCalories) / input.candidate.nutrition!.calories) * 1000) / 1000;
    return [...new Set([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, exact])]
      .filter((scale) => scale >= 0.5 && scale <= 2)
      .flatMap((scale) => {
        const n = input.candidate.nutrition!;
        const nutrition = {
          calories: scalePublishedAmount(n.calories, scale),
          proteinG: scalePublishedAmount(n.proteinG, scale),
          carbsG: scalePublishedAmount(n.carbsG, scale),
          fatG: scalePublishedAmount(n.fatG, scale),
        };
        const total = {
          calories: nutrition.calories + riceCalories,
          proteinG: nutrition.proteinG + ((rice?.proteinG ?? 0) * riceG) / 100,
          carbsG: nutrition.carbsG + ((rice?.carbsG ?? 0) * riceG) / 100,
          fatG: nutrition.fatG + ((rice?.fatG ?? 0) * riceG) / 100,
        };
        if (total.calories < range.minimum || total.calories > range.maximum) return [];
        return [
          {
            ...legacy,
            nutrition,
            servingScale: scale,
            pairedRiceG: riceG || null,
            plateCalories: total.calories,
            ingredients: input.candidate.ingredients.map((i) => ({
              ...i,
              quantity: i.quantity === undefined ? undefined : scalePublishedAmount(i.quantity, scale),
            })),
            score: nutritionFitScore(total, input.macroTarget!) + Math.abs(scale - 1) * 0.05,
          },
        ];
      });
  });
  return (
    options.sort((a, b) => a.score - b.score || Math.abs(a.servingScale - 1) - Math.abs(b.servingScale - 1))[0] ??
    legacy
  );
}

function calorieServing(input: ServingInput) {
  const { candidate, mealType, dailyCalorieTarget, riceFood } = input;
  if (
    candidate.state !== 'ACTIVE' ||
    !candidate.nutrition ||
    !isPrimaryMealType(mealType) ||
    !effectiveRecipeMealTypes(candidate.displayName, candidate.category, candidate.applicableMealTypes).includes(
      mealType
    ) ||
    !Object.values(candidate.nutrition).every((value) => Number.isFinite(value) && value >= 0) ||
    candidate.nutrition.calories <= 0
  )
    return null;
  const preference = input.ricePreference ?? RicePreference.FLEXIBLE;
  const role = resolveRecipeRiceRole({
    mealName: candidate.displayName,
    riceRole: candidate.riceRole,
    riceRoleReviewStatus: candidate.riceRoleReviewStatus ?? 'NOT_REVIEWED',
    includedRiceG: candidate.includedRiceG ?? null,
    riceMinHalfCups: 1,
    riceMaxHalfCups: 3,
    ingredients: candidate.ingredients.map((i) => ({
      ingredientName: i.name,
      quantity: i.quantity ?? null,
      unit: i.unit ?? null,
    })),
  }).riceRole;
  if (preference === 'WITH_RICE' && !role) return null;
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
