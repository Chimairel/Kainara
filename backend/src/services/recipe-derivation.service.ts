import { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import prisma from '@/lib/prisma';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { recipeDerivationKind } from '@/domain/recipe-derivation.policy';
import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';
import { persistDeterministicLibraryClassification } from './meal-library-publication.service';
import { libraryBaseRevisionKey } from './meal-base-admission.service';
import { calculateLibraryNutritionEvidence } from './nutritionist-library-nutrition-evidence.service';
import type { RecipeDerivationInput } from '@/validation/recipe-derivation.schemas';

/** New evidence is a draft; no source approval, clearance, or patient slot is copied. */
export async function createRecipeDerivation(profileId: string, parentId: string, input: RecipeDerivationInput) {
  const actor = await prisma.nutritionistProfile.findUnique({ where: { id: profileId }, include: { user: true } });
  if (!actor || !isNutritionistEligibleForReview(actor))
    throw new AppError('A currently eligible nutritionist is required.', 403, 'REVIEWER_INELIGIBLE');
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
      const parent = await tx.mealLibrary.findUnique({
        where: { id: parentId },
        include: { ingredients: true, sourceRawRecipeCandidate: true },
      });
      if (!parent) throw new AppError('Parent recipe not found.', 404, 'RECIPE_NOT_FOUND');
      if (parent.safetyEvidenceRevision !== input.expectedRevision)
        throw new AppError('Recipe changed. Refresh before submitting a new version.', 409, 'RECIPE_REVISION_CONFLICT');
      const ids = input.ingredients.map((item) => item.foodItemId);
      if (new Set(ids).size !== ids.length)
        throw new AppError('Combine repeated foods into one per-serving amount.', 422, 'RECIPE_DUPLICATE_FOOD');
      const foods = await tx.foodItem.findMany({ where: { id: { in: ids }, source: { in: ['FNRI', 'USDA_FDC'] } } });
      const byId = new Map(foods.map((food) => [food.id, food]));
      if (byId.size !== ids.length)
        throw new AppError('Select every ingredient from the FNRI or USDA catalogue.', 422, 'RECIPE_FOOD_REQUIRED');
      const ingredients = input.ingredients.map((item, position) => {
        const food = byId.get(item.foodItemId)!;
        return {
          foodItemId: food.id,
          ingredientName: food.name,
          category: food.category,
          quantity: item.grams,
          unit: 'g',
          position,
          dataSource: food.source === 'USDA_FDC' ? ('USDA_FDC' as const) : ('FNRI' as const),
        };
      });
      const nutrition = calculateLibraryNutritionEvidence(
        input.ingredients.map((item) => ({ foodItemId: item.foodItemId, gramsPerServing: item.grams })),
        foods
      );
      const kind = recipeDerivationKind(parent.ingredients, ingredients);
      const imageUrl = input.imageUrl;
      if (kind === 'ADAPTED' && input.mealName.trim().toLowerCase() === parent.mealName.trim().toLowerCase())
        throw new AppError('Give an adapted recipe a distinct name.', 422, 'RECIPE_NAME_REQUIRED');
      if (kind === 'ADAPTED' && !imageUrl)
        throw new AppError('Provide an image matching the adapted recipe.', 422, 'RECIPE_IMAGE_REQUIRED');
      const description = `${input.summary.replace(/(?:^|\n)\s*Source:\s*https:\/\/[^\n]+/g, '').trim()}\n\nPreparation instructions:\n${input.instructions}`;
      const signature = buildMealLibraryRecipeSignature({
        mealName: input.mealName,
        mealType: input.mealType,
        ...nutrition,
        ingredients,
      });
      const duplicate = await tx.mealLibrary.findUnique({
        where: { recipeSignature: signature },
        select: { id: true },
      });
      if (duplicate)
        throw new AppError(
          'This exact recipe and serving already exist. Open the existing entry instead.',
          409,
          'RECIPE_EXISTS'
        );
      const meal = await tx.mealLibrary.create({
        data: {
          parentMealId: parent.id,
          recipeFamilyId: kind === 'SERVING_VERSION' ? (parent.recipeFamilyId ?? parent.id) : null,
          derivationKind: kind,
          authoredByNutritionistId: actor.id,
          adaptedImageUrl: imageUrl,
          verifiedByNutritionistId: null,
          mealName: input.mealName,
          description,
          mealType: input.mealType,
          ...nutrition,
          recipeSignature: signature,
          status: 'APPROVED',
          safetyEvidenceStatus: 'INCOMPLETE',
          safetyEvidenceRevision: 1,
          safetyEvidenceOrigin: 'NUTRITIONIST_DRAFT',
          suitableConditions: [],
          allergenFree: [],
          dietaryTags: [],
          nutritionServingDescription: 'One recipe serving',
          nutritionEvidenceSource: 'NUTRITIONIST_EDITED',
          riceRole: input.riceRole,
          riceRoleReviewStatus: 'PROPOSED',
          includedRiceG: input.riceRole === 'INCLUDES_RICE' ? input.includedRiceG : null,
          riceMinHalfCups: input.riceMinHalfCups,
          riceMaxHalfCups: input.riceMaxHalfCups,
          ingredients: { create: ingredients },
          applicableMealTypes: {
            create: { mealType: input.mealType, source: 'NUTRITIONIST_REVIEW', reviewStatus: 'REVIEWED' },
          },
        },
        include: { ingredients: true },
      });
      await persistDeterministicLibraryClassification(tx, meal.id);
      await tx.mealBaseVerification.create({
        data: {
          targetKind: 'LIBRARY_MEAL',
          targetId: meal.id,
          revisionKey: libraryBaseRevisionKey(signature, description),
          status: 'PENDING',
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'NUTRITION_EVIDENCE_PREPARED',
          entityType: 'MealLibrary',
          entityId: meal.id,
          metadata: {
            revision: 1,
            recipeSignature: signature,
            portionBasis: 'Measured edible grams per recipe serving',
            totals: nutrition,
            ingredients: meal.ingredients.map((ingredient) => {
              const food = byId.get(ingredient.foodItemId!)!;
              return {
                ingredientId: ingredient.id,
                foodItemId: food.id,
                foodName: food.name,
                source: food.source,
                compositionRevision: food.compositionRevision,
                gramsPerServing: ingredient.quantity,
              };
            }),
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'RECIPE_DERIVATION_SUBMITTED',
          entityType: 'MealLibrary',
          entityId: meal.id,
          metadata: {
            parentMealId: parent.id,
            parentRevision: parent.safetyEvidenceRevision,
            kind,
            rationale: input.rationale,
            ingredientCompositionRevisions: foods.map((food) => ({
              foodItemId: food.id,
              revision: food.compositionRevision,
            })),
            imageMatchesRecipe: input.imageMatchesRecipe,
          },
        },
      });
      const reviewers = await tx.nutritionistProfile.findMany({
        where: {
          isVerified: true,
          prcLicenseExpiry: { gt: new Date() },
          id: { not: actor.id },
          user: { role: 'NUTRITIONIST', isSuspended: false },
        },
        select: { userId: true },
      });
      if (reviewers.length)
        await tx.notification.createMany({
          data: reviewers.map((reviewer) => ({
            userId: reviewer.userId,
            type: 'REVIEW_REQUEST' as const,
            title: 'Recipe awaiting independent review',
            message: `${meal.mealName} was submitted as ${kind === 'ADAPTED' ? 'an adapted recipe' : 'a new serving version'}. Open meal verification to review it.`,
          })),
        });
      return meal;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
