import { ReviewRoutingService } from './review-routing.service';
import { assertMealSlotCalories } from '@/domain/generated-plan-calories.policy';
import prisma from '@/lib/prisma';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { MealIngredientDataSource, MealPlanStatus, NotificationType, Prisma } from '@prisma/client';
import { lockUserProfile } from './profile-revision.service';

import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { getReviewClaimCutoff } from '@/domain/nutritionist-review.policy';
import { GroceryService } from '@/services/grocery.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { isGeneratedBaseVerified } from './meal-base-verification.service';
import { publishProfileMatchedMealApproval } from './meal-profile-approval-publication.service';

import { ClinicalEvidenceService } from './clinical-evidence.service';

import { assertObservedSourceStillAvailable } from './observed-source-guard.service';
import { AppError } from '@/errors/AppError';

async function findScopeMatchedPendingPlans(
  tx: Prisma.TransactionClient,
  where: Prisma.MealPlanWhereInput,
  safetyScopeKey: string
) {
  const candidates = await tx.mealPlan.findMany({
    where,
    include: {
      clinicalEvidence: { select: { id: true } },
      cycle: { select: { snapshot: { select: { profileRevision: true, safetyRevision: true } } } },
      user: {
        include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true },
      },
    },
  });
  return candidates
    .filter((candidate) => {
      const profile = candidate.user.userProfile;
      if (
        !profile ||
        candidate.clinicalEvidence.length ||
        candidate.cycle.snapshot?.profileRevision !== profile.revision ||
        candidate.cycle.snapshot?.safetyRevision !== profile.safetyRevision
      )
        return false;
      const scope = mealApprovalSafetyScope({
        conditions: candidate.user.healthConditions.map((item) => item.condition),
        allergens: candidate.user.allergies.map((item) => item.allergen),
        otherConditions: profile.otherConditions,
        otherAllergies: profile.otherAllergies,
        safetyEntries: candidate.user.safetyProfileEntries,
      });
      return scope.supported && scope.key === safetyScopeKey;
    })
    .map(({ id, userId, mealName, reviewApprovalCount }) => ({ id, userId, mealName, reviewApprovalCount }));
}

export async function approveMealPlan(
  nutritionistProfileId: string,
  mealPlanId: string,
  note?: string,
  updates?: {
    mealName?: string;
    description?: string;
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    ingredients?: { name: string; category?: string; dataSource?: MealIngredientDataSource }[];
  }
) {
  await ReviewRoutingService.assertMeal(nutritionistProfileId, mealPlanId);
  const now = new Date();
  const claimCutoff = getReviewClaimCutoff(now);
  const plan = await prisma.mealPlan.findUnique({
    where: { id: mealPlanId },
    include: {
      ingredients: true,
      servingComponents: true,
      cycle: { include: { snapshot: true } },
      user: {
        include: {
          healthConditions: true,
          allergies: true,
          userProfile: true,
          safetyProfileEntries: true,
        },
      },
    },
  });

  if (!plan) throw new Error('Meal plan not found.');
  if (plan.candidateProvenance === 'AI_FROM_SCRATCH' && !(await isGeneratedBaseVerified(plan.baseRecipeSignature))) {
    throw new Error('The generated base recipe must pass meal verification before case approval.');
  }
  const approvedScope = mealApprovalSafetyScope({
    conditions: plan.user.healthConditions.map((item) => item.condition),
    allergens: plan.user.allergies.map((item) => item.allergen),
    otherConditions: plan.user.userProfile?.otherConditions,
    otherAllergies: plan.user.userProfile?.otherAllergies,
    safetyEntries: plan.user.safetyProfileEntries,
  });
  const clinicalRequirements = await ClinicalEvidenceService.assertReadyForMealPlanning(plan.userId);
  await ClinicalProfileReviewService.assertReadyForMealPlanning(plan.userId);
  const clinicalDocumentIds = [...new Set(clinicalRequirements.flatMap((item) => item.readyDocumentIds))];
  const clinicalDocuments = clinicalDocumentIds.length
    ? await prisma.clinicalDocument.findMany({
        where: { id: { in: clinicalDocumentIds }, userId: plan.userId },
        select: { id: true, revision: true, sha256: true, area: true, documentType: true, validUntil: true },
      })
    : [];
  if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
    throw new Error('Only PENDING_REVIEW meals can be approved.');
  }

  if (plan.claimedByNutritionistId !== nutritionistProfileId || !plan.claimedAt || plan.claimedAt < claimCutoff) {
    throw new Error('You must hold an active claim before approving this meal. Please reopen it from the queue.');
  }
  const reviewer = await prisma.nutritionistProfile.findUnique({
    where: { id: nutritionistProfileId },
    select: { userId: true },
  });
  if (!reviewer) throw new Error('Nutritionist profile not found.');
  // Approval certifies the exact saved plate. Recipe changes must go through
  // a new draft and independent base verification, never overwrite this plan.
  if (updates && Object.keys(updates).length) {
    throw new AppError(
      'Approve the saved recipe unchanged. Create a recipe draft in the meal library for alterations, or replace this case meal with a reviewed recipe.',
      422,
      'MEAL_APPROVAL_RECIPE_CHANGE_NOT_ALLOWED'
    );
  }
  const { mealName, description, calories, proteinG, carbsG, fatG } = plan;

  const planning = await loadPlanningNutritionContext(prisma, plan.userId, 'Planning profile missing.');
  assertMealSlotCalories(
    calories,
    plan.cycle.snapshot?.dailyCalorieTarget ?? planning.profile.dailyCalorieTarget ?? 2000,
    plan.mealType
  );

  const coalescedApprovedUserIds = await prisma.$transaction(
    async (tx) => {
      await lockUserProfile(tx, plan.userId);
      await ReviewRoutingService.assertMeal(nutritionistProfileId, mealPlanId, tx);
      if (!(await ClinicalProfileReviewService.hasCurrentApproval(plan.userId, tx)))
        throw new Error('The health details changed and need a new profile confirmation.');
      const healthDetails = await tx.clinicalContextResponse.findMany({
        where: { userId: plan.userId },
        select: { area: true, responses: true, revision: true },
      });
      await assertObservedSourceStillAvailable(tx, plan.sourceRawRecipeCandidateId);
      await loadPlanningNutritionContext(tx, plan.userId, 'Planning profile missing.');
      const currentProfile = await tx.userProfile.findUniqueOrThrow({ where: { userId: plan.userId } });
      if ('user' in plan && currentProfile.revision !== plan.user.userProfile?.revision)
        throw new Error('User information changed. Reopen this review.');
      await tx.groceryList.updateMany({ where: { userId: plan.userId }, data: { isStale: true } });
      // Compare-and-set the decision while this reviewer still owns a live
      // claim. A competing or expired decision changes zero rows and rolls the
      // entire transaction back before a library record can be published.
      const decision = await tx.mealPlan.updateMany({
        where: {
          id: mealPlanId,
          status: MealPlanStatus.PENDING_REVIEW,
          reviewApprovalCount: plan.reviewApprovalCount,
          baseRecipeSignature: plan.baseRecipeSignature,
          composedServingSignature: plan.composedServingSignature,
          claimedByNutritionistId: nutritionistProfileId,
          claimedAt: { gte: claimCutoff },
        },
        data: {
          status: MealPlanStatus.APPROVED,
          mealName,
          description,
          calories,
          proteinG,
          carbsG,
          fatG,
          nutritionistId: nutritionistProfileId,
          nutritionistNote: note || null,
          reviewedAt: now,
          requiresSafetyRevalidation: false,
          safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          reviewApprovalCount: 1,
          claimedByNutritionistId: null,
          claimedAt: null,
        },
      });

      if (decision.count !== 1) {
        throw new Error('The active claim expired or this meal was already reviewed. Please refresh the queue.');
      }

      await tx.mealPlanReviewDecision.create({
        data: {
          mealPlanId,
          nutritionistProfileId,
          stage: plan.reviewApprovalCount > 0 ? 'RECHECK' : 'PRIMARY',
          decision: 'APPROVE',
          rationale: note?.trim() || null,
          evidenceSnapshot: {
            mealName,
            composedServingSignature: plan.composedServingSignature,
            servingComponents: plan.servingComponents.map(
              ({ componentType, quantityG, foodItemId, evidenceSource }) => ({
                componentType,
                quantityG,
                foodItemId,
                evidenceSource,
              })
            ),
            calories,
            proteinG,
            carbsG,
            fatG,
            policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
            healthDetails: healthDetails.map((item) => ({ ...item, provenance: 'USER_REPORTED' })),
            clinicalDocuments: clinicalDocuments.map(({ id, revision, sha256, area, documentType, validUntil }) => ({
              id,
              revision,
              sha256,
              area,
              documentType,
              validUntil,
            })),
          },
        },
      });
      if (clinicalDocuments.length) {
        await tx.mealPlanClinicalEvidence.createMany({
          data: clinicalDocuments.map((document) => ({
            mealPlanId,
            clinicalDocumentId: document.id,
            documentRevision: document.revision,
            documentSha256: document.sha256,
          })),
          skipDuplicates: true,
        });
      }

      const coalescedApprovedUsers: string[] = [];
      if (plan.reviewWorkKey && !updates && clinicalDocuments.length === 0 && approvedScope.supported) {
        const dependentWhere: Prisma.MealPlanWhereInput = {
          id: { not: mealPlanId },
          ...(healthDetails.length ? { userId: plan.userId } : {}),
          reviewWorkKey: plan.reviewWorkKey,
          status: MealPlanStatus.PENDING_REVIEW,
          reviewApprovalCount: { in: [0, 1] },
          claimedByNutritionistId: null,
          cycle: { profileAdaptationState: 'CURRENT' },
        };
        const matched = await findScopeMatchedPendingPlans(tx, dependentWhere, approvedScope.key);
        const dependents = [];
        const routed = (await ReviewRoutingService.config(tx)).enabled;
        for (const candidate of matched) {
          // Routed cases keep cross-member decisions independent. Same-member
          // duplicates can share a decision under the existing locked profile.
          if (routed && candidate.userId !== plan.userId) continue;
          try {
            await ReviewRoutingService.assertMeal(nutritionistProfileId, candidate.id, tx);
            dependents.push(candidate);
          } catch (error) {
            if (!(error instanceof AppError) || error.errorCode !== 'REVIEW_NOT_FOUND') throw error;
          }
        }

        if (dependents.length) {
          const dependentIds = dependents.map((item) => item.id);
          await tx.mealPlan.updateMany({
            where: { id: { in: dependentIds } },
            data: {
              status: MealPlanStatus.APPROVED,
              nutritionistId: nutritionistProfileId,
              nutritionistNote: note || null,
              reviewedAt: now,
              requiresSafetyRevalidation: false,
              safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
              reviewApprovalCount: 1,
              claimedByNutritionistId: null,
              claimedAt: null,
            },
          });
          await tx.mealPlanReviewDecision.createMany({
            data: dependents.map((item) => ({
              mealPlanId: item.id,
              nutritionistProfileId,
              stage: item.reviewApprovalCount > 0 ? ('RECHECK' as const) : ('PRIMARY' as const),
              decision: 'APPROVE' as const,
              rationale: null,
              evidenceSnapshot: {
                coalescedFromMealPlanId: mealPlanId,
                reviewWorkKey: plan.reviewWorkKey,
                policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
              },
            })),
          });
          await tx.groceryList.updateMany({
            where: { userId: { in: dependents.map((item) => item.userId) } },
            data: { isStale: true },
          });
          await tx.notification.createMany({
            data: dependents.map((item) => ({
              userId: item.userId,
              title: 'Meal Plan Approved ✅',
              message: `Your meal "${item.mealName}" has been approved by a Registered Dietitian.`,
              type: NotificationType.PLAN_APPROVED,
            })),
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: reviewer.userId,
              action: 'COALESCED_MEAL_REVIEW_PUBLISHED',
              entityType: 'MealPlanReviewWork',
              entityId: plan.reviewWorkKey,
              metadata: {
                sourceMealPlanId: mealPlanId,
                dependentMealPlanIds: dependentIds,
                policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
              },
            },
          });
          coalescedApprovedUsers.push(...dependents.map((item) => item.userId));
        }
      }

      await tx.nutritionistProfile.update({
        where: { id: nutritionistProfileId },
        data: { totalVerified: { increment: 1 } },
      });

      await tx.notification.create({
        data: {
          userId: plan.userId,
          title: 'Meal Plan Approved ✅',
          message: `Your meal "${mealName}" has been approved by a Registered Dietitian.${note ? ` Note: ${note}` : ''}`,
          type: NotificationType.PLAN_APPROVED,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'MEAL_PLAN_APPROVED',
          entityType: 'MealPlan',
          entityId: mealPlanId,
          metadata: {
            policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
            reusableEvidencePublished: false,
            reusableEvidenceRequiresExplicitAction: true,
          },
        },
      });
      return [...new Set(coalescedApprovedUsers)];
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  // The grocery list is a derived projection of the user's approved current
  // plan. Rebuild it immediately after approval so users never have to issue
  // a second "generate" command. This runs after the approval transaction:
  // a projection failure must not roll back or misreport a valid clinical
  // review decision.
  try {
    for (const affectedUserId of [...new Set([plan.userId, ...coalescedApprovedUserIds])]) {
      await GroceryService.generateGroceryList(affectedUserId);
    }
  } catch (error) {
    console.error('[NutritionistService] Grocery projection refresh failed after approval:', error);
  }

  // Profile-matched reuse is a separate projection of this finalized RND
  // decision. Failure leaves the patient's approval intact and the recipe
  // unavailable to other users until a later retry or certification.
  if (approvedScope.supported && plan.user.userProfile) {
    try {
      await publishProfileMatchedMealApproval({
        mealPlanId,
        nutritionistProfileId,
        approvedProfileRevision: plan.user.userProfile.revision,
      });
    } catch (error) {
      console.error('[NutritionistService] Profile-matched meal publication failed:', error);
    }
  }

  return { success: true };
}
