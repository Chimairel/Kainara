import { getMealSlotCalorieRange, type PrimaryMealType } from './meal-calorie-allocation.policy';

// A recorded source serving can be halved or doubled for a general-wellness
// plan. This scales its published totals; it never supplies missing nutrition.
export const SOURCE_SERVING_MIN_SCALE = 0.5;
export const SOURCE_SERVING_MAX_SCALE = 2;

export function sourceServingScale(input: {
  calories: number;
  dailyCalorieTarget: number;
  mealType: PrimaryMealType;
}): number | null {
  if (!Number.isFinite(input.calories) || input.calories <= 0) return null;
  const range = getMealSlotCalorieRange(input.dailyCalorieTarget, input.mealType);
  if (input.calories >= range.minimum && input.calories <= range.maximum) return 1;
  const scale = Math.round((range.target / input.calories) * 1000) / 1000;
  if (scale < SOURCE_SERVING_MIN_SCALE || scale > SOURCE_SERVING_MAX_SCALE) return null;
  const adjusted = Math.round(input.calories * scale * 1000) / 1000;
  return adjusted >= range.minimum && adjusted <= range.maximum ? scale : null;
}

export function scalePublishedAmount(value: number, scale: number): number {
  return Math.round(value * scale * 1000) / 1000;
}
