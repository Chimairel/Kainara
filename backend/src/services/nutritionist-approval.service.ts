import { assertMealSlotCalories } from '@/domain/generated-plan-calories.policy';
import prisma from '@/lib/prisma';
import { MealIngredientDataSource, MealPlanStatus, NotificationType, Prisma } from '@prisma/client';
import { lockUserProfile } from './profile-revision.service';

import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { getReviewClaimCutoff } from '@/domain/nutritionist-review.policy';
import { GroceryService } from '@/services/grocery.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { isGeneratedBaseVerified } from './meal-base-verification.service';
import { replacePlanBaseServing } from './meal-plan-serving.service';
import { publishProfileMatchedMealApproval } from './meal-profile-approval-publication.service';

import { ClinicalEvidenceService } from './clinical-evidence.service';

import { assertObservedSourceStillAvailable } from './observed-source-guard.service';

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
    .map(({ id, userId, mealName }) => ({ id, userId, mealName }));
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
  const now = new Date();
  const claimCutoff = getReviewClaimCutoff(now);
  const plan = await prisma.mealPlan.findUnique({
    where: { id: mealPlanId },
    include: {
      ingredients: true,
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
  if (
    plan.highRiskReviewRequired &&
    plan.reviewApprovalCount === 1 &&
    plan.firstApprovedByNutritionistId === nutritionistProfileId
  ) {
    throw new Error('A different nutritionist must perform the second high-risk review.');
  }

  const reviewer = await prisma.nutritionistProfile.findUnique({
    where: { id: nutritionistProfileId },
    select: { userId: true, canLeadReview: true },
  });
  if (!reviewer) throw new Error('Nutritionist profile not found.');
  if (plan.highRiskReviewRequired && plan.reviewApprovalCount === 1 && !reviewer.canLeadReview) {
    throw new Error('Lead review capability is required for this second review.');
  }

  const mealName = updates?.mealName !== undefined ? updates.mealName : plan.mealName;
  const description = updates?.description !== undefined ? updates.description : plan.description;
  const calories = updates?.calories !== undefined ? updates.calories : plan.calories;
  const proteinG = updates?.proteinG !== undefined ? updates.proteinG : plan.proteinG;
  const carbsG = updates?.carbsG !== undefined ? updates.carbsG : plan.carbsG;
  const fatG = updates?.fatG !== undefined ? updates.fatG : plan.fatG;

  assertMealSlotCalories(calories, plan.user.userProfile?.dailyCalorieTarget ?? 2000, plan.mealType);

  if (plan.highRiskReviewRequired && plan.reviewApprovalCount === 0) {
    await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, plan.userId);
        await assertObservedSourceStillAvailable(tx, plan.sourceRawRecipeCandidateId);
        const currentProfile = await tx.userProfile.findUniqueOrThrow({ where: { userId: plan.userId } });
        if ('user' in plan && currentProfile.revision !== plan.user.userProfile?.revision)
          throw new Error('User information changed. Reopen this review.');
        const firstDecision = await tx.mealPlan.updateMany({
          where: {
            id: mealPlanId,
            status: MealPlanStatus.PENDING_REVIEW,
            reviewApprovalCount: 0,
            claimedByNutritionistId: nutritionistProfileId,
            claimedAt: { gte: claimCutoff },
          },
          data: {
            mealName,
            description,
            calories,
            proteinG,
            carbsG,
            fatG,
            nutritionistNote: note || null,
            reviewApprovalCount: 1,
            firstApprovedByNutritionistId: nutritionistProfileId,
            firstApprovedAt: now,
            claimedByNutritionistId: null,
            claimedAt: null,
          },
        });
        if (firstDecision.count !== 1) {
          throw new Error('The active claim expired or this meal was already reviewed. Please refresh the queue.');
        }

        if (updates?.ingredients) {
          await tx.mealIngredient.deleteMany({ where: { mealPlanId } });
          await tx.mealIngredient.createMany({
            data: updates.ingredients.map((ingredient) => ({
              mealPlanId,
              ingredientName: ingredient.name,
              category: ingredient.category || 'PANTRY',
              dataSource: ingredient.dataSource || MealIngredientDataSource.FNRI,
            })),
          });
        }
        const reviewedIngredients = await tx.mealIngredient.findMany({
          where: { mealPlanId },
          orderBy: { id: 'asc' },
        });
        await replacePlanBaseServing(tx, mealPlanId, {
          mealName,
          mealType: plan.mealType,
          calories,
          proteinG,
          carbsG,
          fatG,
          ingredients: reviewedIngredients,
          evidenceSource: 'RND_REVIEWED_PLAN',
        });

        await tx.mealPlanReviewDecision.create({
          data: {
            mealPlanId,
            nutritionistProfileId,
            stage: 'PRIMARY',
            decision: 'APPROVE',
            rationale: note?.trim() || null,
            evidenceSnapshot: {
              mealName,
              calories,
              proteinG,
              carbsG,
              fatG,
              policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
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

        if (plan.reviewWorkKey && !updates && clinicalDocuments.length === 0 && approvedScope.supported) {
          const dependents = await findScopeMatchedPendingPlans(
            tx,
            {
              id: { not: mealPlanId },
              reviewWorkKey: plan.reviewWorkKey,
              status: MealPlanStatus.PENDING_REVIEW,
              reviewApprovalCount: 0,
              claimedByNutritionistId: null,
              cycle: { profileAdaptationState: 'CURRENT' },
            },
            approvedScope.key
          );
          if (dependents.length) {
            await tx.mealPlan.updateMany({
              where: { id: { in: dependents.map((item) => item.id) } },
              data: {
                reviewApprovalCount: 1,
                firstApprovedByNutritionistId: nutritionistProfileId,
                firstApprovedAt: now,
                claimedByNutritionistId: null,
                claimedAt: null,
              },
            });
            await tx.mealPlanReviewDecision.createMany({
              data: dependents.map((item) => ({
                mealPlanId: item.id,
                nutritionistProfileId,
                stage: 'PRIMARY' as const,
                decision: 'APPROVE' as const,
                rationale: null,
                evidenceSnapshot: {
                  coalescedFromMealPlanId: mealPlanId,
                  reviewWorkKey: plan.reviewWorkKey,
                  policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                },
              })),
            });
            await tx.notification.createMany({
              data: dependents.map((item) => ({
                userId: item.userId,
                title: 'Additional safety review in progress',
                message: `Your meal "${item.mealName}" passed its first review and is awaiting an independent second nutritionist review.`,
                type: NotificationType.REVIEW_REQUEST,
              })),
            });
          }
        }

        await tx.auditEvent.create({
          data: {
            actorUserId: reviewer.userId,
            action: 'MEAL_PLAN_FIRST_HIGH_RISK_APPROVAL',
            entityType: 'MealPlan',
            entityId: mealPlanId,
            metadata: { policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION },
          },
        });
        await tx.notification.create({
          data: {
            userId: plan.userId,
            title: 'Additional safety review in progress',
            message: `Your meal "${mealName}" passed its first review and is awaiting an independent second nutritionist review.`,
            type: NotificationType.REVIEW_REQUEST,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return { success: true, awaitingSecondReview: true };
  }

  const coalescedApprovedUserIds = await prisma.$transaction(
    async (tx) => {
      await lockUserProfile(tx, plan.userId);
      await assertObservedSourceStillAvailable(tx, plan.sourceRawRecipeCandidateId);
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
          reviewApprovalCount: plan.highRiskReviewRequired ? 2 : 1,
          claimedByNutritionistId: null,
          claimedAt: null,
        },
      });

      if (decision.count !== 1) {
        throw new Error('The active claim expired or this meal was already reviewed. Please refresh the queue.');
      }

      if (updates?.ingredients) {
        await tx.mealIngredient.deleteMany({
          where: { mealPlanId },
        });
        await tx.mealIngredient.createMany({
          data: updates.ingredients.map((ing) => ({
            mealPlanId,
            ingredientName: ing.name,
            category: ing.category || 'PANTRY',
            dataSource: ing.dataSource || MealIngredientDataSource.FNRI,
          })),
        });
      }
      const reviewedIngredients = await tx.mealIngredient.findMany({ where: { mealPlanId }, orderBy: { id: 'asc' } });
      await replacePlanBaseServing(tx, mealPlanId, {
        mealName,
        mealType: plan.mealType,
        calories,
        proteinG,
        carbsG,
        fatG,
        ingredients: reviewedIngredients,
        evidenceSource: 'RND_REVIEWED_PLAN',
      });

      await tx.mealPlanReviewDecision.create({
        data: {
          mealPlanId,
          nutritionistProfileId,
          stage: plan.highRiskReviewRequired ? 'SECONDARY' : 'PRIMARY',
          decision: 'APPROVE',
          rationale: note?.trim() || null,
          evidenceSnapshot: {
            mealName,
            calories,
            proteinG,
            carbsG,
            fatG,
            policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
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
          reviewWorkKey: plan.reviewWorkKey,
          status: MealPlanStatus.PENDING_REVIEW,
          reviewApprovalCount: plan.highRiskReviewRequired ? 1 : 0,
          claimedByNutritionistId: null,
          cycle: { profileAdaptationState: 'CURRENT' },
        };
        if (plan.highRiskReviewRequired) {
          dependentWhere.firstApprovedByNutritionistId = { not: nutritionistProfileId };
        }
        const dependents = await findScopeMatchedPendingPlans(tx, dependentWhere, approvedScope.key);

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
              reviewApprovalCount: plan.highRiskReviewRequired ? 2 : 1,
              claimedByNutritionistId: null,
              claimedAt: null,
            },
          });
          await tx.mealPlanReviewDecision.createMany({
            data: dependents.map((item) => ({
              mealPlanId: item.id,
              nutritionistProfileId,
              stage: plan.highRiskReviewRequired ? ('SECONDARY' as const) : ('PRIMARY' as const),
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
          action: plan.highRiskReviewRequired ? 'MEAL_PLAN_SECOND_HIGH_RISK_APPROVAL' : 'MEAL_PLAN_APPROVED',
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
