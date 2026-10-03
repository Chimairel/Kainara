import { MealType, type MealApplicabilityReviewStatus } from '@prisma/client';
import { isSnackOnlyRecipe } from './recipe-category.policy';

/** Narrow stale primary-slot metadata for identifiable desserts; never grant a new primary slot. */
export function effectiveRecipeMealTypes(
  name: string,
  category: string | null | undefined,
  declared: readonly MealType[]
): MealType[] {
  return isSnackOnlyRecipe(name, category) ? [MealType.SNACK] : [...declared];
}

export interface PersistedMealApplicability {
  mealType: MealType;
  reviewStatus?: MealApplicabilityReviewStatus;
}

/**
 * Request-time matching consumes persisted applicability only. The legacy
 * singular mealType is a display/default value and must not erase additional
 * reviewed or classified slot facts.
 */
export function isMealApplicableToType(
  applicableMealTypes: readonly PersistedMealApplicability[] | null | undefined,
  requested: MealType
): boolean {
  return Boolean(applicableMealTypes?.some((entry) => entry.mealType === requested));
}

/** Import/classification proposal. Request-time guards only narrow persisted slot facts. */
export function proposeMealTypeApplicability(input: {
  name: string;
  category?: string | null;
  primaryMealType: MealType;
}): MealType[] {
  const text = `${input.name} ${input.category ?? ''}`.normalize('NFKC').toLowerCase();
  if (isSnackOnlyRecipe(input.name, input.category)) return [MealType.SNACK];
  const types = new Set<MealType>([input.primaryMealType]);

  if (
    /\b(breakfast|silog|tapa|tocino|longganisa|omelet|omelette|pancake|french toast|champorado|lugaw)\b/u.test(text)
  ) {
    types.add(MealType.BREAKFAST);
  }
  if (/\b(snack|merienda|dessert|cookie|cake|bread|muffin|candy|shake|smoothie)\b/u.test(text)) {
    types.add(MealType.SNACK);
  }
  if (/\b(soup|stew|ulam|main course|pasta|noodle|fish|chicken|pork|beef|vegetable)\b/u.test(text)) {
    types.add(MealType.LUNCH);
    types.add(MealType.DINNER);
  }

  return [...types].sort(
    (left, right) => Object.values(MealType).indexOf(left) - Object.values(MealType).indexOf(right)
  );
}
