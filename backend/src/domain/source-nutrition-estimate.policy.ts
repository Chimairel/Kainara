export const DEMO_NUTRITION_ESTIMATE_VERSION = 'CODEX_SIMILAR_RECIPE_ESTIMATE_V1';

export function hasDemoNutritionEstimate(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const audit = (value as Record<string, unknown>).dataCompletionAudit;
  return Boolean(
    audit &&
    typeof audit === 'object' &&
    !Array.isArray(audit) &&
    Array.isArray((audit as Record<string, unknown>).operations) &&
    ((audit as Record<string, unknown>).operations as unknown[]).includes(DEMO_NUTRITION_ESTIMATE_VERSION)
  );
}

export type SourceNutrition = { calories: number; proteinG: number; carbsG: number; fatG: number };
export type ComparableRecipe = {
  id: string;
  recipeName: string;
  category: string | null;
  mealType: string;
  ingredients: readonly { name: string }[];
  nutrition: SourceNutrition;
};

const generic = new Set([
  'recipe',
  'style',
  'easy',
  'simple',
  'filipino',
  'pinoy',
  'homemade',
  'with',
  'and',
  'the',
  'for',
  'how',
  'make',
  'best',
  'delicious',
  'special',
]);

function terms(value: string): Set<string> {
  return new Set(
    value
      .normalize('NFKC')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= 3 && !generic.has(term))
  );
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const item of left) if (right.has(item)) count++;
  return count;
}

function recipeTerms(recipe: Pick<ComparableRecipe, 'recipeName' | 'ingredients'>) {
  return { title: terms(recipe.recipeName), ingredients: terms(recipe.ingredients.map((item) => item.name).join(' ')) };
}

export function isPlausiblePublishedNutrition(value: SourceNutrition): boolean {
  return (
    Number.isFinite(value.calories) &&
    value.calories >= 80 &&
    value.calories <= 1800 &&
    [value.proteinG, value.carbsG, value.fatG].every(
      (number) => Number.isFinite(number) && number >= 0 && number <= 250
    )
  );
}

/** Transparent capstone estimate. Donor IDs are retained for review; no source-published value is overwritten. */
export function estimateFromComparableRecipes(
  target: Omit<ComparableRecipe, 'nutrition'>,
  donors: readonly ComparableRecipe[]
): { nutrition: SourceNutrition; donorIds: string[]; fallback: boolean } | null {
  const eligible = donors.filter((donor) => donor.id !== target.id && isPlausiblePublishedNutrition(donor.nutrition));
  if (!eligible.length) return null;
  const targetTerms = recipeTerms(target);
  const ranked = eligible
    .map((donor) => {
      const donorTerms = recipeTerms(donor);
      const score =
        overlap(targetTerms.title, donorTerms.title) * 4 +
        overlap(targetTerms.ingredients, donorTerms.ingredients) * 2 +
        Number(target.mealType === donor.mealType) * 3 +
        Number(Boolean(target.category && donor.category && target.category === donor.category)) * 2;
      return { donor, score };
    })
    .sort((left, right) => right.score - left.score || left.donor.id.localeCompare(right.donor.id));
  const comparable = ranked.filter((item) => item.score >= 5).slice(0, 3);
  const chosen = comparable.length
    ? comparable
    : ranked.filter((item) => item.donor.mealType === target.mealType).slice(0, 3);
  if (!chosen.length) return null;
  const weightTotal = chosen.reduce((total, item) => total + Math.max(item.score, 1), 0);
  const nutrition = Object.fromEntries(
    (['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((key) => [
      key,
      Math.round(
        (chosen.reduce((total, item) => total + item.donor.nutrition[key] * Math.max(item.score, 1), 0) / weightTotal) *
          1000
      ) / 1000,
    ])
  ) as SourceNutrition;
  return { nutrition, donorIds: chosen.map((item) => item.donor.id), fallback: comparable.length === 0 };
}
