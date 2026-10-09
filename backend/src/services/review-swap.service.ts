import { toPublicVerifier } from './meal-plan-presentation.service';
import { toPublicMealImage } from '@/domain/meal-image.policy';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { ReviewRoutingService } from './review-routing.service';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { assertReviewSwapClaim, reviewSwapVersion } from '@/domain/review-swap.policy';
import { isMealWithinSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { queryEligibleLibraryMeals } from './meal-library-candidate-query.service';
import { rejectedSlotRecipes } from './rejected-slot-recipes.service';
import { CertifiedSlotFallbackService } from './certified-slot-fallback.service';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';

export async function listReviewSwapOptions(profileId: string, mealPlanId: string) {
  await ReviewRoutingService.assertMeal(profileId, mealPlanId);
  const plan = await prisma.mealPlan.findUnique({
    where: { id: mealPlanId },
    include: { cycle: { include: { snapshot: true } } },
  });
  if (!plan) throw new AppError('Review case not found.', 404, 'REVIEW_NOT_FOUND');
  assertReviewSwapClaim(plan, profileId);
  if (
    plan.cycle.shoppingStartedAt ||
    plan.cycle.supersededById ||
    !plan.cycle.snapshot ||
    plan.scheduledDate < getStartOfManilaBusinessDay()
  )
    throw new AppError(
      'This cycle is frozen, superseded or unavailable for replacement.',
      409,
      'REVIEW_SWAP_UNAVAILABLE'
    );
  const context = await loadPlanningNutritionContext(prisma, plan.userId, 'Planning profile unavailable.');
  const rejected = await rejectedSlotRecipes(prisma, plan);
  const candidates = await queryEligibleLibraryMeals({
    mealType: plan.mealType,
    userConditions: context.conditions,
    userAllergens: context.allergens,
    profile: { ...context.profile, userId: plan.userId, safetyEntries: context.user.safetyProfileEntries },
    limit: 120,
  });
  return {
    expectedVersion: reviewSwapVersion(plan, context.profile),
    options: candidates
      .filter(
        (meal) =>
          meal.id !== plan.libraryMealId &&
          !rejected.includes({
            libraryMealId: meal.id,
            sourceRawRecipeCandidateId: meal.sourceRawRecipeCandidateId,
            baseRecipeSignature: meal.recipeSignature,
          })
      )
      .filter((meal) =>
        isMealWithinSlotCalorieRange({
          calories: meal.calories,
          dailyCalorieTarget: plan.cycle.snapshot!.dailyCalorieTarget,
          mealType: plan.mealType,
          tolerance: 0.15,
        })
      )
      .map((meal) => ({
        id: meal.id,
        mealName: meal.mealName,
        mealType: meal.mealType,
        mealTypes: meal.applicableMealTypes.map((entry) => entry.mealType),
        riceRole: meal.riceRole,
        image: toPublicMealImage(meal),
        verifier: toPublicVerifier(meal.verifiedByNutritionist),
        verifiedBy: meal.verifiedByNutritionist?.user.name ?? 'Verification recorded; name unavailable',
        prcLicenseNumber: meal.verifiedByNutritionist?.prcLicenseNumber ?? '',
        description: meal.description,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        recipeSignature: meal.recipeSignature,
        evidenceRevision: meal.safetyEvidenceRevision,
        ingredients: meal.ingredients.map((item) => ({
          name: item.ingredientName,
          quantity: item.quantity,
          unit: item.unit,
          source: item.dataSource,
        })),
      })),
  };
}

export async function executeReviewSwap(
  profileId: string,
  mealPlanId: string,
  input: {
    libraryMealId: string;
    expectedVersion: string;
    expectedRecipeSignature: string;
    expectedEvidenceRevision: number;
    note: string;
  }
) {
  await ReviewRoutingService.assertMeal(profileId, mealPlanId);
  const result = await CertifiedSlotFallbackService.replaceWithBestCertified({
    mealPlanId,
    tolerance: 0.15,
    reasonCode: 'RND_SELECTED_REPLACEMENT',
    expectedStatus: 'PENDING_REVIEW',
    selectedLibraryMealId: input.libraryMealId,
    reviewer: { profileId, ...input },
  });
  if (!result.replaced)
    throw new AppError('That replacement is no longer eligible. Refresh the options.', 409, 'REVIEW_SWAP_CHANGED');
  return result;
}
