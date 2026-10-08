import prisma from '@/lib/prisma';
import { isReviewClaimActive } from '@/domain/nutritionist-review.policy';
import { AppError } from '@/errors/AppError';
import { adminMealInputSchema, type AdminMealInput } from '@/validation/admin-meal.schemas';
import { calculateLibraryNutritionEvidence } from './nutritionist-library-nutrition-evidence.service';
import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';
import { suspendMealClearancesForEvidenceChange } from './condition-clearance.service';
import { persistDeterministicLibraryClassification } from './meal-library-publication.service';
import {
  reviewContext,
  reviewActor,
  rndUserId,
  assertVersion,
  recordReviewDecision,
} from './meal-review-context.service';

/** Corrections remain held; every material change has immutable before/after snapshots. */
export async function correctHeldRecipe(
  profileId: string,
  mealId: string,
  expectedVersion: string,
  rationale: string,
  proposed: AdminMealInput
) {
  const input = adminMealInputSchema.parse(proposed);
  const userId = await rndUserId(profileId);
  return prisma.$transaction(
    async (tx) => {
      const actor = await reviewActor(tx, userId, profileId);
      const before = await reviewContext(tx, mealId, true);
      if (!before.incident || before.incident.closedAt)
        throw new AppError('Corrections require an active held case.', 409, 'REVIEW_CASE_CLOSED');
      assertVersion(before.reviewVersion, expectedVersion);
      if (isReviewClaimActive(before.incident) && before.incident.claimedByNutritionistId !== profileId)
        throw new AppError(
          'Release the active review claim before correcting this recipe.',
          409,
          'REVIEW_CLAIM_CONFLICT'
        );
      const old = before.meals.find((meal) => meal.id === mealId)!;
      const ids = input.ingredients.map((item) => item.foodItemId);
      if (new Set(ids).size !== ids.length)
        throw new AppError('Combine repeated foods into one measured serving amount.', 422, 'DUPLICATE_INGREDIENT');
      const foods = await tx.foodItem.findMany({ where: { id: { in: ids }, source: 'FNRI' } });
      if (foods.length !== ids.length)
        throw new AppError('Every ingredient must map to a current FNRI food.', 422, 'FNRI_INGREDIENT_REQUIRED');
      const byId = new Map(foods.map((food) => [food.id, food]));
      const totals = {
        ...calculateLibraryNutritionEvidence(input.ingredients, foods),
        sugarG: null,
        phosphorusMg: null,
        saturatedFatG: null,
      };
      const ingredients = input.ingredients.map((item, position) => ({
        foodItemId: item.foodItemId,
        ingredientName: byId.get(item.foodItemId)!.name,
        category: byId.get(item.foodItemId)!.category,
        quantity: item.gramsPerServing,
        unit: 'g',
        position,
        dataSource: 'FNRI' as const,
      }));
      const signature = buildMealLibraryRecipeSignature({
        mealName: input.mealName,
        mealType: input.mealType,
        ...totals,
        ingredients,
      });
      const duplicate = await tx.mealLibrary.findUnique({
        where: { recipeSignature: signature },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== mealId)
        throw new AppError('This recipe already exists.', 409, 'DUPLICATE_MEAL');
      await recordReviewDecision(tx, before, actor, 'CORRECTION_BEFORE', rationale);
      await tx.mealLibraryIngredient.deleteMany({ where: { mealLibraryId: mealId } });
      await tx.mealLibrarySafetyDeclaration.deleteMany({ where: { mealLibraryId: mealId } });
      const meal = await tx.mealLibrary.update({
        where: { id: mealId },
        data: {
          mealName: input.mealName,
          mealType: input.mealType,
          description: `${input.summary}\n\nPreparation instructions:\n${input.instructions}`,
          ...totals,
          nutritionServingDescription: input.nutritionServingDescription,
          recipeSignature: signature,
          nutritionEvidenceSource: 'NUTRITIONIST_EDITED',
          authoredByNutritionistId: profileId,
          safetyEvidenceStatus: 'STALE',
          safetyEvidenceRevision: { increment: 1 },
          certifiedEvidenceRevision: null,
          safetyReviewedByNutritionistId: null,
          safetyReviewedAt: null,
          safetyInvalidatedAt: new Date(),
          conditionDeclarationState: 'NOT_REVIEWED',
          allergenDeclarationState: 'NOT_REVIEWED',
          suitableConditions: [],
          allergenFree: [],
          dietaryTags: [],
          ingredients: { create: ingredients },
        },
        include: { ingredients: true },
      });
      await persistDeterministicLibraryClassification(tx, mealId);
      await suspendMealClearancesForEvidenceChange(
        tx,
        mealId,
        'Governed recipe correction requires fresh condition evidence.'
      );
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          entityType: 'MealLibrary',
          entityId: mealId,
          action: 'NUTRITION_EVIDENCE_PREPARED',
          metadata: {
            revision: meal.safetyEvidenceRevision,
            previousRevision: old.safetyEvidenceRevision,
            recipeSignature: signature,
            portionBasis: input.nutritionBasis,
            totals,
            ingredients: meal.ingredients.map((item) => ({
              ingredientId: item.id,
              foodItemId: item.foodItemId,
              compositionRevision: byId.get(item.foodItemId!)!.compositionRevision,
              gramsPerServing: item.quantity,
            })),
          },
        },
      });
      await tx.mealReviewIncident.update({
        where: { id: before.incident.id },
        data: {
          claimedByNutritionistId: null,
          claimedAt: null,
          excludedReviewerIds: [...new Set([...(before.incident.excludedReviewerIds as string[]), profileId])],
        },
      });
      const after = await reviewContext(tx, mealId);
      await recordReviewDecision(tx, after, actor, 'CORRECTED', rationale, {
        previousVersion: before.reviewVersion,
        confirmationsInvalidated: true,
      });
      return { reviewVersion: after.reviewVersion, state: before.incident.state, safetyEvidenceStatus: 'STALE' };
    },
    { maxWait: 10_000, timeout: 30_000 }
  );
}
