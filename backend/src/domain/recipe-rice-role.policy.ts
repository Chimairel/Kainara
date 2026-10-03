import { RecipeRiceRole } from '@prisma/client';
import { isStandaloneRecipe } from './recipe-category.policy';

export interface RiceRoleProposal {
  riceRole: RecipeRiceRole | null;
  includedRiceG: number | null;
  reasonCode: 'EXPLICIT_RICE_INGREDIENT' | 'STANDALONE_CATEGORY' | 'ULAM_PAIRING_PROPOSAL' | 'UNCLASSIFIED';
}

export function riceIngredientsInRecipe<T extends { name: string }>(ingredients: readonly T[]): T[] {
  return ingredients.filter(
    ({ name }) =>
      /\b(rice|kanin|malagkit)\b/iu.test(name.normalize('NFKC')) &&
      !/\b(flour|noodles?|sticks?|vermicelli|starch|milk|paper|vinegar|wine)\b/iu.test(name)
  );
}

/** Import/audit proposal only. Never call this to decide a serving at request time. */
export function proposeRiceRole(input: {
  name: string;
  category?: string | null;
  ingredients: readonly { name: string; quantity?: number | null; unit?: string | null }[];
}): RiceRoleProposal {
  const riceIngredients = riceIngredientsInRecipe(input.ingredients);
  if (riceIngredients.length) {
    const includedRiceG = riceIngredients.every((ingredient) =>
      Boolean(ingredient.quantity && ingredient.quantity > 0 && /^(g|grams?)$/iu.test(ingredient.unit?.trim() ?? ''))
    )
      ? riceIngredients.reduce((sum, ingredient) => sum + ingredient.quantity!, 0)
      : null;
    return { riceRole: RecipeRiceRole.INCLUDES_RICE, includedRiceG, reasonCode: 'EXPLICIT_RICE_INGREDIENT' };
  }

  if (isStandaloneRecipe(input.name, input.category)) {
    return { riceRole: RecipeRiceRole.STANDALONE, includedRiceG: null, reasonCode: 'STANDALONE_CATEGORY' };
  }
  const text = `${input.name} ${input.category ?? ''}`.normalize('NFKC').toLowerCase();
  // Positive dish evidence is required. An unfamiliar recipe is never an ulam by default.
  if (
    /\b(?:main course|main dish|ulam|adobo|sinigang|tinola|nilaga|bulalo|menudo|afritada|mechado|kaldereta|caldereta|paksiw|sisig|pinakbet|bicol express|laing|kare[ -]kare|inihaw|lechon|chops?|ribs?|chicken|pork|beef|fish|tilapia|bangus|salmon|tuna|shrimp|prawn|squid|seafood|crab|lamb|turkey|goat|vegetable|tofu|tokwa|fishcake)\b/u.test(
      text
    )
  ) {
    return { riceRole: RecipeRiceRole.PAIR_WITH_RICE, includedRiceG: null, reasonCode: 'ULAM_PAIRING_PROPOSAL' };
  }
  return { riceRole: null, includedRiceG: null, reasonCode: 'UNCLASSIFIED' };
}

/** Read the saved label. Ingredient evidence only prevents adding rice twice. */
export function resolveRecipeRiceRole(meal: {
  mealName: string;
  riceRole: RecipeRiceRole | null;
  riceRoleReviewStatus: string;
  includedRiceG: number | null;
  riceMinHalfCups: number;
  riceMaxHalfCups: number;
  ingredients: readonly {
    ingredientName: string;
    quantity: number | null;
    unit: string | null;
    foodItem?: { name: string } | null;
  }[];
}) {
  const riceIngredients = riceIngredientsInRecipe(
    meal.ingredients.map((ingredient) => ({
      name: ingredient.foodItem?.name ?? ingredient.ingredientName,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    }))
  );
  // Measured rice in the base serving must never receive a second rice side,
  // even if an old reviewed role incorrectly calls the dish rice-compatible.
  if (riceIngredients.length && meal.riceRole !== 'INCLUDES_RICE') {
    return {
      riceRole: RecipeRiceRole.INCLUDES_RICE,
      includedRiceG: null,
      minHalfCups: 0,
      maxHalfCups: 0,
      basis: 'RICE_INGREDIENT_GUARD' as const,
    };
  }
  return {
    riceRole: meal.riceRole,
    includedRiceG: meal.includedRiceG,
    minHalfCups: meal.riceMinHalfCups,
    maxHalfCups: meal.riceMaxHalfCups,
    basis: !meal.riceRole
      ? ('UNCLASSIFIED' as const)
      : meal.riceRoleReviewStatus === 'REVIEWED'
        ? ('REVIEWED_RECIPE' as const)
        : ('SAVED_CLASSIFICATION' as const),
  };
}
