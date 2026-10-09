import {
  AIConfidenceFlag,
  AssuranceTier,
  HealthConditionType,
  MealCandidateProvenance,
  MealPlanStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { lockUserProfile } from './profile-revision.service';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import {
  getMealSlotCalorieDeviation,
  isMealWithinSlotCalorieRange,
  isPrimaryMealType,
} from '@/domain/meal-calorie-allocation.policy';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
  isProfileApprovedLibraryMealCompatible,
  queryEligibleLibraryMeals,
} from './meal-library-candidate-query.service';
import { buildBaseServingPersistence } from './meal-plan-serving.service';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { scorePreparationCandidate } from '@/domain/upcoming-preparation.policy';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { assertRecipeNotRejectedForSlot, rejectedSlotRecipes } from './rejected-slot-recipes.service';
import {
  assertReviewSwapClaim,
  reviewSwapVersion,
  requiresExplicitReplacementReview,
} from '@/domain/review-swap.policy';
import { currentReviewProfile, lockRecipeLineage } from './meal-review-context.service';
import { ReviewRoutingService } from './review-routing.service';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { admittedLibraryBaseIds } from './meal-base-admission.service';
import { AppError } from '@/errors/AppError';
import { assertCurrentMealReviewContext } from './meal-case-context.service';

export class CertifiedSlotFallbackService {
  static async replaceWithBestCertified(input: {
    mealPlanId: string;
    tolerance: number;
    reasonCode: string;
    expectedStatus?: MealPlanStatus;
    selectedLibraryMealId?: string;
    reviewer?: {
      expectedContextKey?: string;
      profileId: string;
      expectedVersion: string;
      expectedRecipeSignature: string;
      expectedEvidenceRevision: number;
      note: string;
    };
  }): Promise<{ replaced: boolean; replacementPlanId: string | null }> {
    const target = await prisma.mealPlan.findUnique({
      where: { id: input.mealPlanId },
      include: { cycle: { include: { snapshot: true } } },
    });
    if (!target || !target.cycle.snapshot) return { replaced: false, replacementPlanId: null };
    if (!input.reviewer && requiresExplicitReplacementReview(target))
      return { replaced: false, replacementPlanId: null };
    if (!isPrimaryMealType(target.mealType)) return { replaced: false, replacementPlanId: null };
    const slotType = target.mealType;
    if (target.cycle.shoppingStartedAt) return { replaced: false, replacementPlanId: null };
    if (input.expectedStatus && target.status !== input.expectedStatus) {
      return { replaced: false, replacementPlanId: null };
    }
    const pinnedSelection = await prisma.mealPlan.findFirst({
      where: {
        planGroupId: target.planGroupId,
        scheduledDate: target.scheduledDate,
        mealType: target.mealType,
        status: MealPlanStatus.APPROVED,
        userSelectionPinnedAt: { not: null },
      },
      select: { id: true },
    });
    if (pinnedSelection) return { replaced: false, replacementPlanId: null };

    const context = await loadPlanningNutritionContext(
      prisma,
      target.userId,
      'User profile is unavailable for fallback.'
    );
    const usedIds = new Set(
      (
        await prisma.mealPlan.findMany({
          where: {
            planGroupId: target.planGroupId,
            libraryMealId: { not: null },
            status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] },
          },
          select: { libraryMealId: true },
        })
      ).flatMap((meal) => (meal.libraryMealId ? [meal.libraryMealId] : []))
    );
    const rejectedRecipes = await rejectedSlotRecipes(prisma, target);
    const candidates = await queryEligibleLibraryMeals({
      mealType: slotType,
      userConditions: context.conditions,
      userAllergens: context.allergens,
      profile: { ...context.profile, userId: target.userId, safetyEntries: context.user.safetyProfileEntries },
      limit: 120,
    });
    const ranked = candidates
      .filter((candidate) => candidate.id !== target.libraryMealId)
      .filter(
        (candidate) =>
          !rejectedRecipes.includes({
            libraryMealId: candidate.id,
            sourceRawRecipeCandidateId: candidate.sourceRawRecipeCandidateId,
            baseRecipeSignature: candidate.recipeSignature,
          })
      )
      .filter((candidate) =>
        isMealWithinSlotCalorieRange({
          calories: candidate.calories,
          dailyCalorieTarget: target.cycle.snapshot!.dailyCalorieTarget,
          mealType: slotType,
          tolerance: input.tolerance,
        })
      )
      .sort((left, right) => {
        const repetition = Number(usedIds.has(left.id)) - Number(usedIds.has(right.id));
        if (repetition) return repetition;
        return (
          getMealSlotCalorieDeviation({
            calories: left.calories,
            dailyCalorieTarget: target.cycle.snapshot!.dailyCalorieTarget,
            mealType: slotType,
          }) -
            getMealSlotCalorieDeviation({
              calories: right.calories,
              dailyCalorieTarget: target.cycle.snapshot!.dailyCalorieTarget,
              mealType: slotType,
            }) ||
          left.usageCount - right.usageCount ||
          left.id.localeCompare(right.id)
        );
      });
    const candidate = input.selectedLibraryMealId
      ? ranked.find((meal) => meal.id === input.selectedLibraryMealId)
      : ranked[0];
    if (!candidate) return { replaced: false, replacementPlanId: null };

    const ranking = scorePreparationCandidate({
      activeClearanceCoverage: true,
      allergenDeclarationsComplete: true,
      ingredientsResolved: candidate.ingredients.every((ingredient) => Boolean(ingredient.foodItemId)),
      nutrientsComplete: [candidate.calories, candidate.proteinG, candidate.carbsG, candidate.fatG].every(
        Number.isFinite
      ),
      dietCompatible: true,
      remainingReviews: 0,
      calorieDeviationRatio:
        getMealSlotCalorieDeviation({
          calories: candidate.calories,
          dailyCalorieTarget: target.cycle.snapshot.dailyCalorieTarget,
          mealType: slotType,
        }) / target.cycle.snapshot.dailyCalorieTarget,
      mealTypeMatch: true,
      ricePreference: target.cycle.snapshot.ricePreference,
      riceRole: candidate.riceRole,
      riceRoleReviewStatus: candidate.riceRoleReviewStatus,
      usedInRecentCycle: usedIds.has(candidate.id),
    });
    const conditions = context.conditions.filter(
      (condition): condition is HealthConditionType => condition !== HealthConditionType.NONE
    );

    return prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, target.userId);
      if (input.reviewer) await assertCurrentMealReviewContext(target.id, input.reviewer.expectedContextKey, tx, input.reviewer.profileId);
      const currentContext = await loadPlanningNutritionContext(tx, target.userId, 'Planning profile missing.');
      if (
        currentContext.profile.revision !== context.profile.revision ||
        currentContext.profile.safetyRevision !== context.profile.safetyRevision
      )
        throw new Error('Planning context changed during fallback selection.');
      const latestTarget = await tx.mealPlan.findUniqueOrThrow({ where: { id: target.id } });
      if (!input.reviewer && requiresExplicitReplacementReview(latestTarget))
        return { replaced: false, replacementPlanId: null };
      if (!input.reviewer) {
        const pendingSlot = await tx.mealPlan.findMany({
          where: {
            planGroupId: target.planGroupId,
            scheduledDate: target.scheduledDate,
            mealType: target.mealType,
            status: MealPlanStatus.PENDING_REVIEW,
          },
          select: { status: true, selectionEvidence: true },
        });
        if (pendingSlot.some(requiresExplicitReplacementReview)) return { replaced: false, replacementPlanId: null };
      }
      const reviewer = input.reviewer ? await currentReviewProfile(tx, input.reviewer.profileId) : null;
      if (input.reviewer) {
        if (!reviewer) throw new AppError('A currently eligible RND is required.', 403, 'REVIEWER_INELIGIBLE');
        await ReviewRoutingService.assertMeal(input.reviewer.profileId, target.id, tx);
        assertReviewSwapClaim(latestTarget, input.reviewer.profileId);
        const currentCycle = await tx.mealPlanCycle.findUniqueOrThrow({ where: { id: target.planGroupId } });
        if (
          currentCycle.shoppingStartedAt ||
          currentCycle.supersededById ||
          latestTarget.scheduledDate < getStartOfManilaBusinessDay()
        )
          throw new AppError('This plan is no longer available for replacement.', 409, 'REVIEW_SWAP_UNAVAILABLE');
        if (reviewSwapVersion(latestTarget, currentContext.profile) !== input.reviewer.expectedVersion)
          throw new AppError('Meal or profile changed. Refresh before swapping.', 409, 'REVIEW_SWAP_CHANGED');
      }
      if (input.expectedStatus && latestTarget.status !== input.expectedStatus) {
        return { replaced: false, replacementPlanId: null };
      }
      const currentPinnedSelection = await tx.mealPlan.findFirst({
        where: {
          planGroupId: target.planGroupId,
          scheduledDate: target.scheduledDate,
          mealType: target.mealType,
          status: MealPlanStatus.APPROVED,
          userSelectionPinnedAt: { not: null },
        },
        select: { id: true },
      });
      if (currentPinnedSelection) return { replaced: false, replacementPlanId: null };
      if (input.reviewer) {
        const key = await lockRecipeLineage(tx, candidate.id);
        const lineage = await tx.mealReviewLineage.findUnique({ where: { key }, select: { state: true } });
        if (lineage && lineage.state !== 'PUBLISHED')
          throw new AppError('Replacement is withheld from use.', 409, 'REVIEW_SWAP_CHANGED');
      }
      const latest = await tx.mealLibrary.findUniqueOrThrow({
        where: { id: candidate.id },
        include: certifiedLibraryMealInclude,
      });
      if (input.reviewer && !(await admittedLibraryBaseIds([latest], tx)).has(latest.id))
        throw new AppError('Replacement verification changed.', 409, 'REVIEW_SWAP_CHANGED');
      if (
        input.reviewer &&
        (latest.recipeSignature !== input.reviewer.expectedRecipeSignature ||
          latest.safetyEvidenceRevision !== input.reviewer.expectedEvidenceRevision ||
          !isMealWithinSlotCalorieRange({
            calories: latest.calories,
            dailyCalorieTarget: target.cycle.snapshot!.dailyCalorieTarget,
            mealType: slotType,
            tolerance: input.tolerance,
          }))
      )
        throw new AppError('Replacement evidence changed. Refresh before swapping.', 409, 'REVIEW_SWAP_CHANGED');
      await assertRecipeNotRejectedForSlot(tx, target, {
        libraryMealId: latest.id,
        sourceRawRecipeCandidateId: latest.sourceRawRecipeCandidateId,
        baseRecipeSignature: latest.recipeSignature,
      });
      const currentProfile = {
        ...context.profile,
        userId: target.userId,
        safetyEntries: context.user.safetyProfileEntries,
      };
      const certified = isCertifiedLibraryMealCompatible(latest, context.conditions, context.allergens, currentProfile);
      const profileApproved =
        !certified &&
        isProfileApprovedLibraryMealCompatible(latest, context.conditions, context.allergens, currentProfile);
      if (!certified && !profileApproved) {
        throw new Error('Certified fallback evidence changed during selection.');
      }
      const profileScope = profileApproved
        ? mealApprovalSafetyScope({
            conditions: context.conditions,
            allergens: context.allergens,
            otherConditions: context.profile.otherConditions,
            otherAllergies: context.profile.otherAllergies,
            safetyEntries: context.user.safetyProfileEntries,
          })
        : null;
      const approval = profileApproved
        ? latest.profileApprovals.find(
            (item) =>
              item.safetyScopeKey === profileScope?.key &&
              !item.flaggedAt &&
              item.recipeSignature === latest.recipeSignature &&
              item.evidenceRevision === latest.safetyEvidenceRevision
          )
        : null;
      if (profileApproved && !approval) throw new Error('Approval changed during fallback selection.');
      const ingredients = latest.ingredients.map((ingredient) => ({
        ingredientName: ingredient.ingredientName,
        category: ingredient.category,
        foodItemId: ingredient.foodItemId,
        dataSource: ingredient.dataSource,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      }));
      const serving = buildBaseServingPersistence({
        ...latest,
        mealType: slotType,
        recipeSignature: latest.recipeSignature,
        ingredients,
        evidenceSource: input.reviewer
          ? 'RND_SELECTED_REPLACEMENT_PENDING_REVIEW'
          : 'CERTIFIED_DEADLINE_OR_REJECTION_FALLBACK',
      });
      const replacement = await tx.mealPlan.create({
        data: {
          planGroupId: target.planGroupId,
          userId: target.userId,
          status: input.reviewer ? MealPlanStatus.PENDING_REVIEW : MealPlanStatus.APPROVED,
          candidateProvenance: MealCandidateProvenance.CERTIFIED_LIBRARY,
          libraryMealId: latest.id,
          profileApprovalId: input.reviewer ? null : (approval?.id ?? null),
          nutritionistId: input.reviewer
            ? null
            : (approval?.reviewerNutritionistId ?? latest.safetyReviewedByNutritionistId),
          nutritionistNote: null,
          claimedByNutritionistId: input.reviewer?.profileId ?? null,
          claimedAt: input.reviewer ? latestTarget.claimedAt : null,
          planType: target.planType,
          mealType: slotType,
          mealName: latest.mealName,
          description: latest.description,
          calories: latest.calories,
          proteinG: latest.proteinG,
          carbsG: latest.carbsG,
          fatG: latest.fatG,
          aiConfidenceFlag: AIConfidenceFlag.SAFE,
          scheduledDate: target.scheduledDate,
          reviewedAt: input.reviewer ? null : (approval?.approvedAt ?? latest.safetyReviewedAt),
          requiresSafetyRevalidation: Boolean(input.reviewer),
          safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          highRiskReviewRequired: target.cycle.assuranceTier === AssuranceTier.ENHANCED,
          reviewApprovalCount: input.reviewer ? 0 : 1,
          candidateRank: 1,
          rankingScore: ranking.score,
          rankingReasonCodes: [...ranking.reasonCodes, input.reasonCode],
          fallbackAvailable: ranked.length > 1,
          selectionEvidence: {
            schemaVersion: 1,
            source: 'VERIFIED_LIBRARY',
            fallbackReasonCode: input.reasonCode,
            rankingScore: ranking.score,
            rankingReasonCodes: ranking.reasonCodes,
            capturedAt: new Date().toISOString(),
          } as Prisma.InputJsonObject,
          ingredients: { create: ingredients },
          ...serving,
        },
      });
      for (const condition of input.reviewer ? [] : conditions) {
        const clearance = latest.conditionClearances.find(
          (item) =>
            item.condition === condition &&
            item.state === 'ACTIVE' &&
            item.recipeSignature === latest.recipeSignature &&
            item.evidenceRevision === latest.safetyEvidenceRevision &&
            (!item.userScopeId || item.userScopeId === target.userId) &&
            (!item.expiresAt || item.expiresAt > new Date())
        );
        if (!clearance) throw new Error('Certified fallback condition clearance changed during selection.');
        await tx.mealPlanClearanceUsage.create({
          data: {
            mealPlanId: replacement.id,
            clearanceId: clearance.id,
            condition,
            composedServingSignature: replacement.composedServingSignature,
          },
        });
      }
      if (input.reviewer) {
        assertReviewSwapClaim(latestTarget, input.reviewer.profileId);
        const changed = await tx.mealPlan.updateMany({
          where: {
            id: target.id,
            status: 'PENDING_REVIEW',
            supersededByMealPlanId: null,
            claimedByNutritionistId: input.reviewer.profileId,
            claimedAt: latestTarget.claimedAt,
          },
          data: {
            status: 'CANCELLED',
            supersededByMealPlanId: replacement.id,
            fallbackAvailable: true,
            claimedByNutritionistId: null,
            claimedAt: null,
          },
        });
        if (changed.count !== 1)
          throw new AppError('The review changed. Refresh the queue.', 409, 'REVIEW_SWAP_CHANGED');
      } else
        await tx.mealPlan.update({
          where: { id: target.id },
          data: {
            status:
              target.status === MealPlanStatus.REJECTED || target.status === MealPlanStatus.DISPUTED
                ? target.status
                : MealPlanStatus.CANCELLED,
            supersededByMealPlanId: replacement.id,
            fallbackAvailable: true,
          },
        });
      await tx.mealLibrary.update({ where: { id: latest.id }, data: { usageCount: { increment: 1 } } });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer?.userId ?? null,
          ...(reviewer ? { actorName: reviewer.user.name, actorRole: 'NUTRITIONIST' as const } : {}),
          action: input.reviewer
            ? 'MEAL_PLAN_SLOT_REPLACED_PENDING_REVIEW'
            : 'MEAL_PLAN_SLOT_CERTIFIED_FALLBACK_SELECTED',
          entityType: 'MealPlan',
          entityId: replacement.id,
          metadata: {
            supersededMealPlanId: target.id,
            reasonCode: input.reasonCode,
            ...(input.reviewer
              ? {
                  rationale: input.reviewer.note,
                  reviewerProfileId: input.reviewer.profileId,
                  original: {
                    ingredients: await tx.mealIngredient.findMany({
                      where: { mealPlanId: target.id },
                      select: { ingredientName: true, quantity: true, unit: true, foodItemId: true, dataSource: true },
                    }),
                    mealName: target.mealName,
                    calories: target.calories,
                    proteinG: target.proteinG,
                    carbsG: target.carbsG,
                    fatG: target.fatG,
                  },
                  replacement: {
                    status: replacement.status,
                    ingredients,
                    mealName: latest.mealName,
                    calories: latest.calories,
                    proteinG: latest.proteinG,
                    carbsG: latest.carbsG,
                    fatG: latest.fatG,
                    recipeSignature: latest.recipeSignature,
                    evidenceRevision: latest.safetyEvidenceRevision,
                  },
                }
              : {}),
          },
        },
      });
      if (input.reviewer) {
        await tx.groceryList.updateMany({
          where: { userId: target.userId, planGroupId: target.planGroupId },
          data: { isStale: true },
        });
      }
      return { replaced: true, replacementPlanId: replacement.id };
    });
  }
}
