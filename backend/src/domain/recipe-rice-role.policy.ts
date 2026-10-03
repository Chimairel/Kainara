import { RecipeRiceRole } from '@prisma/client';
import { isSnackOnlyRecipe, isStandaloneRecipe } from './recipe-category.policy';

export interface RiceRoleProposal {
  riceRole: RecipeRiceRole;
  includedRiceG: number | null;
  reasonCode: 'EXPLICIT_RICE_INGREDIENT' | 'STANDALONE_CATEGORY' | 'ULAM_PAIRING_PROPOSAL';
}

/** Classifier proposal only. An RND review is required to mark the role reviewed. */
export function proposeRiceRole(input: {
  name: string;
  category?: string | null;
  ingredients: readonly { name: string; quantity?: number | null; unit?: string | null }[];
}): RiceRoleProposal {
  const riceIngredients = input.ingredients.filter((ingredient) => {
    const name = ingredient.name.normalize('NFKC');
    return (
      /\b(rice|kanin|malagkit)\b/iu.test(name) && !/\b(flour|noodles?|starch|milk|paper|vinegar|wine)\b/iu.test(name)
    );
  });
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
  return { riceRole: RecipeRiceRole.PAIR_WITH_RICE, includedRiceG: null, reasonCode: 'ULAM_PAIRING_PROPOSAL' };
}

/** Read-time serving classification. This never creates a recipe or reviewer decision. */
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
  const classification = proposeRiceRole({
    name: meal.mealName,
    ingredients: meal.ingredients.map((ingredient) => ({
      name: ingredient.foodItem?.name ?? ingredient.ingredientName,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    })),
  });
  // Measured rice in the base serving must never receive a second rice side,
  // even if an old reviewed role incorrectly calls the dish rice-compatible.
  if (
    meal.riceRoleReviewStatus === 'REVIEWED' &&
    meal.riceRole &&
    !(isSnackOnlyRecipe(meal.mealName) && meal.riceRole === 'PAIR_WITH_RICE') &&
    !(classification.riceRole === 'INCLUDES_RICE' && meal.riceRole !== 'INCLUDES_RICE')
  ) {
    return {
      riceRole: meal.riceRole,
      includedRiceG: meal.includedRiceG,
      minHalfCups: meal.riceMinHalfCups,
      maxHalfCups: meal.riceMaxHalfCups,
      basis: 'REVIEWED_RECIPE' as const,
    };
  }
  return {
    riceRole: classification.riceRole,
    includedRiceG: classification.includedRiceG,
    minHalfCups: 1,
    maxHalfCups: 3,
    basis: 'INGREDIENT_CLASSIFICATION' as const,
  };
}
