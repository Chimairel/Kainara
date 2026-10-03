import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import type { Prisma } from '@prisma/client';
import { COOKED_RICE_HALF_CUP_GRAMS } from '@/domain/rice-portion.policy';
import { buildComposedServing } from '@/domain/composed-serving.policy';
import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';
import { resolveRecipeRiceRole } from '@/domain/recipe-rice-role.policy';

export interface BaseServingInput {
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  recipeSignature?: string | null;
  ingredients: readonly {
    ingredientName: string;
    foodItemId?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }[];
  evidenceSource: string;
}

export function buildBaseServingPersistence(input: BaseServingInput) {
  const baseRecipeSignature =
    input.recipeSignature ??
    buildMealLibraryRecipeSignature({
      mealName: input.mealName,
      mealType: input.mealType,
      calories: input.calories,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      ingredients: input.ingredients,
    });
  return {
    baseRecipeSignature,
    composedServingSignature: baseRecipeSignature,
    servingComponents: {
      create: {
        componentType: 'BASE_RECIPE' as const,
        position: 0,
        quantityG: null,
        calories: input.calories,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
        evidenceSource: input.evidenceSource,
      },
    },
  };
}

export async function replacePlanBaseServing(
  tx: Prisma.TransactionClient,
  mealPlanId: string,
  input: BaseServingInput
) {
  const persistence = buildBaseServingPersistence(input);
  await tx.mealPlanServingComponent.deleteMany({ where: { mealPlanId } });
  await tx.mealPlanServingComponent.create({ data: { mealPlanId, ...persistence.servingComponents.create } });
  await tx.mealPlan.update({
    where: { id: mealPlanId },
    data: {
      baseRecipeSignature: persistence.baseRecipeSignature,
      composedServingSignature: persistence.composedServingSignature,
    },
  });
  return persistence;
}

/**
 * Adds rice to an admitted dish as plan evidence, without a new library recipe.
 * Requires the saved rice-pairing label and preserves the ingredient no-double-rice guard.
 */
export async function composePlanWithPairedRice(
  tx: Prisma.TransactionClient,
  input: { mealPlanId: string; cookedRiceG: number; fnriRiceFoodItemId: string }
) {
  const plan = await tx.mealPlan.findUniqueOrThrow({
    where: { id: input.mealPlanId },
    include: {
      libraryMeal: { include: { ingredients: { include: { foodItem: { select: { name: true } } } } } },
      ingredients: true,
      sourceRawRecipeCandidate: {
        include: { libraryVariants: { where: { status: 'FLAGGED' }, select: { id: true }, take: 1 } },
      },
      servingComponents: { orderBy: { position: 'asc' } },
      clearanceUsages: { include: { clearance: { select: { composedServingSignature: true } } } },
    },
  });
  let riceRole;
  if (plan.libraryMeal) {
    if (plan.libraryMeal.status !== 'APPROVED' || plan.libraryMeal.recipeSignature !== plan.baseRecipeSignature)
      throw new Error('Rice requires a current, available base recipe.');
    riceRole = resolveRecipeRiceRole(plan.libraryMeal);
  } else {
    const source = plan.sourceRawRecipeCandidate;
    if (
      plan.candidateProvenance !== 'RAW_RECIPE_CORPUS' ||
      source?.sourceName !== 'PANLASANG_PINOY' ||
      source.status !== 'AVAILABLE' ||
      source.libraryVariants.length
    )
      throw new Error('Rice requires an available source recipe.');
    if (plan.status === 'APPROVED') {
      const context = await loadPlanningNutritionContext(tx, plan.userId, 'Profile missing.');
      const evidence = plan.selectionEvidence as { servingScale?: number } | null;
      const base = plan.servingComponents.find((component) => component.componentType === 'BASE_RECIPE');
      if (
        !base ||
        !isUnrestrictedPanlasangBaseEligible({
          source,
          candidateId: source.id,
          conditions: context.conditions,
          allergens: context.allergens,
          otherConditions: context.otherConditions,
          otherAllergies: context.otherAllergies,
          safetyEntries: context.user.safetyProfileEntries,
          preparedIngredients: plan.ingredients,
          servingScale: evidence?.servingScale,
          preparedNutrition: base,
        })
      )
        throw new Error('This source serving requires case review before use.');
    }
    riceRole = resolveRecipeRiceRole({
      mealName: plan.mealName,
      riceRole: source.riceRole,
      riceRoleReviewStatus: source.riceRoleReviewStatus,
      includedRiceG: source.includedRiceG,
      riceMinHalfCups: 1,
      riceMaxHalfCups: 3,
      ingredients: plan.ingredients,
    });
  }
  if (riceRole.riceRole !== 'PAIR_WITH_RICE') throw new Error('Only a rice-compatible dish can receive a rice side.');
  const halfCups = input.cookedRiceG / COOKED_RICE_HALF_CUP_GRAMS;
  if (!Number.isInteger(halfCups) || halfCups < riceRole.minHalfCups || halfCups > riceRole.maxHalfCups) {
    throw new Error('Rice must use half-cup steps within the allowed portion range.');
  }
  if (!plan.baseRecipeSignature) throw new Error('Plan has no current base recipe signature.');
  const baseComponent = plan.servingComponents.find((component) => component.componentType === 'BASE_RECIPE');
  if (!baseComponent) throw new Error('Plan has no current base serving component.');
  const rice = await tx.foodItem.findUniqueOrThrow({ where: { id: input.fnriRiceFoodItemId } });
  if (rice.source !== 'FNRI' || rice.name.toLowerCase() !== 'rice, well-milled, boiled')
    throw new Error('Select the governed cooked-rice food record.');
  const composed = buildComposedServing({
    baseRecipeSignature: plan.baseRecipeSignature,
    baseNutrition: {
      calories: baseComponent.calories,
      proteinG: baseComponent.proteinG,
      carbsG: baseComponent.carbsG,
      fatG: baseComponent.fatG,
    },
    riceFood: rice,
    cookedRiceG: input.cookedRiceG,
  });
  if (
    plan.clearanceUsages.some((usage) => usage.clearance.composedServingSignature !== composed.composedServingSignature)
  ) {
    throw new Error('This rice composition requires explicit condition clearance for the composed serving.');
  }
  await tx.mealPlanServingComponent.deleteMany({ where: { mealPlanId: plan.id, componentType: 'COOKED_RICE' } });
  await tx.mealPlanServingComponent.create({
    data: {
      mealPlanId: plan.id,
      componentType: 'COOKED_RICE',
      position: 1,
      foodItemId: rice.id,
      quantityG: input.cookedRiceG,
      ...composed.riceNutrition,
      evidenceSource: `FNRI:${rice.compositionRevision}`,
    },
  });
  await tx.mealPlan.update({
    where: { id: plan.id },
    data: { ...composed.total, composedServingSignature: composed.composedServingSignature },
  });
  await tx.mealPlanClearanceUsage.updateMany({
    where: { mealPlanId: plan.id },
    data: { composedServingSignature: composed.composedServingSignature },
  });
  return composed;
}
