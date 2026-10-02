import { ConditionClearanceState, NotificationType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { recipeFamilyWhere } from './meal-recipe-family.service';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { ConditionClearanceService, enforceClearanceCircuitBreakers } from './condition-clearance.service';

const REVIEW_INTERVAL_MS = 365 * 24 * 60 * 60 * 1000;

export async function listDueProfileApprovals(nutritionistProfileId: string) {
  await reviewer(nutritionistProfileId);
  const now = new Date();
  return prisma.mealLibraryProfileApproval.findMany({
    where: { OR: [{ flaggedAt: { not: null } }, { reviewDueAt: { lte: now } }] },
    select: {
      id: true,
      mealLibraryId: true,
      reviewDueAt: true,
      flaggedAt: true,
      flagReason: true,
      scopeSnapshot: true,
      mealLibrary: { select: { mealName: true, status: true } },
    },
    orderBy: [{ flaggedAt: 'desc' }, { reviewDueAt: 'asc' }],
    take: 100,
  });
}

function recordedCaseScope(snapshot: Prisma.JsonValue): Prisma.JsonValue | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  return (snapshot as Record<string, Prisma.JsonValue>).recordedCaseScope ?? null;
}

async function reviewer(nutritionistProfileId: string) {
  const profile = await prisma.nutritionistProfile.findUnique({
    where: { id: nutritionistProfileId },
    include: { user: { select: { id: true, role: true, isSuspended: true } } },
  });
  if (!profile || !isNutritionistEligibleForReview(profile)) {
    throw new Error('Only a currently verified nutritionist may review approvals.');
  }
  return profile;
}

/** One recipe may have several independently reviewed ingredient/serving variants. */
export async function listMealApprovals(mealLibraryId: string) {
  const variants = await prisma.mealLibrary.findMany({
    where: await recipeFamilyWhere(prisma, mealLibraryId),
    select: {
      id: true,
      mealName: true,
      mealType: true,
      recipeSignature: true,
      safetyEvidenceRevision: true,
      status: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      nutritionServingDescription: true,
      ingredients: { orderBy: { position: 'asc' }, select: { ingredientName: true, quantity: true, unit: true } },
      profileApprovals: {
        include: {
          reviewerNutritionist: { include: { user: { select: { name: true, role: true, isSuspended: true } } } },
        },
        orderBy: { approvedAt: 'desc' },
      },
      conditionClearances: {
        include: { resolvedByNutritionist: { select: { user: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { addedAt: 'asc' },
  });
  return variants.map((variant) => ({
    ...variant,
    approvals: [
      ...variant.profileApprovals.map((approval) => ({
        id: approval.id,
        kind: 'PROFILE' as const,
        scope: approval.scopeSnapshot,
        caseScope: approval.scopeSnapshot,
        reviewerName: approval.reviewerNutritionist.user.name,
        reviewedAt: approval.approvedAt,
        reviewDueAt: approval.reviewDueAt,
        status: approval.flaggedAt
          ? 'FLAGGED'
          : variant.status !== 'APPROVED' ||
              approval.recipeSignature !== variant.recipeSignature ||
              approval.evidenceRevision !== variant.safetyEvidenceRevision ||
              approval.reviewPolicyVersion !== MEAL_PLAN_SAFETY_POLICY_VERSION ||
              !isNutritionistEligibleForReview(approval.reviewerNutritionist)
            ? 'STALE'
            : approval.reviewDueAt <= new Date()
              ? 'REVIEW_DUE'
              : 'ACTIVE',
        flagReason: approval.flagReason,
      })),
      ...variant.conditionClearances.map((clearance) => ({
        id: clearance.id,
        kind: 'CONDITION' as const,
        scope: { conditions: [clearance.condition], userScoped: Boolean(clearance.userScopeId) },
        caseScope: recordedCaseScope(clearance.evidenceSnapshot),
        reviewerName: clearance.resolvedByNutritionist?.user.name ?? null,
        reviewedAt: clearance.activatedAt,
        reviewDueAt: clearance.auditDueAt,
        status: clearance.suspensionReason?.startsWith('APPROVAL_FLAGGED:')
          ? 'FLAGGED'
          : variant.status !== 'APPROVED' ||
              clearance.recipeSignature !== variant.recipeSignature ||
              clearance.evidenceRevision !== variant.safetyEvidenceRevision
            ? 'STALE'
            : clearance.state === ConditionClearanceState.ACTIVE &&
                clearance.auditDueAt &&
                clearance.auditDueAt <= new Date()
              ? 'REVIEW_DUE'
              : clearance.state,
        flagReason: clearance.suspensionReason?.startsWith('APPROVAL_FLAGGED:')
          ? clearance.suspensionReason.slice('APPROVAL_FLAGGED:'.length)
          : null,
      })),
    ],
    profileApprovals: undefined,
    conditionClearances: undefined,
  }));
}

/** Read-only case preview. A reusable approval never inherits the user's current profile. */
export async function getMealApprovalCaseDetails(input: {
  mealLibraryId: string;
  kind: 'PROFILE' | 'CONDITION';
  approvalId: string;
}) {
  const approval =
    input.kind === 'PROFILE'
      ? await prisma.mealLibraryProfileApproval.findFirst({
          where: { id: input.approvalId, mealLibraryId: input.mealLibraryId },
          select: { scopeSnapshot: true, approvedAt: true, recipeSignature: true, evidenceRevision: true },
        })
      : await prisma.mealConditionClearance.findFirst({
          where: { id: input.approvalId, mealLibraryId: input.mealLibraryId },
          select: {
            condition: true,
            userScopeId: true,
            activatedAt: true,
            recipeSignature: true,
            evidenceRevision: true,
            evidenceSnapshot: true,
          },
        });
  if (!approval) throw new Error('Approval not found for this meal.');

  const meal = await prisma.mealLibrary.findUniqueOrThrow({
    where: { id: input.mealLibraryId },
    select: {
      id: true,
      mealName: true,
      mealType: true,
      description: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      nutritionServingDescription: true,
      recipeSignature: true,
      safetyEvidenceRevision: true,
      ingredients: {
        orderBy: { position: 'asc' },
        select: { ingredientName: true, quantity: true, unit: true, dataSource: true },
      },
    },
  });
  const plan = await prisma.mealPlan.findFirst({
    where:
      input.kind === 'PROFILE'
        ? { profileApprovalId: input.approvalId, libraryMealId: input.mealLibraryId, status: 'APPROVED' }
        : {
            libraryMealId: input.mealLibraryId,
            status: 'APPROVED',
            clearanceUsages: { some: { clearanceId: input.approvalId } },
          },
    orderBy: { reviewedAt: 'asc' },
    select: {
      id: true,
      mealName: true,
      description: true,
      nutritionistNote: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      ingredients: { select: { ingredientName: true, quantity: true, unit: true, dataSource: true } },
      clinicalEvidence: {
        select: {
          clinicalDocument: {
            select: {
              area: true,
              documentType: true,
              status: true,
              validUntil: true,
              facts: {
                where: { reviewStatus: 'CONFIRMED' },
                select: { code: true, valueText: true, valueNumber: true, unit: true },
              },
            },
          },
        },
      },
      cycle: {
        select: {
          snapshot: {
            select: {
              goal: true,
              dailyCalorieTarget: true,
              dietaryPreference: true,
              ricePreference: true,
            },
          },
        },
      },
      user: {
        select: {
          name: true,
          userProfile: { select: { age: true, biologicalSex: true } },
          healthConditions: { select: { condition: true } },
          allergies: { select: { allergen: true } },
        },
      },
    },
  });
  const scopedUser =
    !plan && 'userScopeId' in approval && approval.userScopeId
      ? await prisma.user.findUnique({
          where: { id: approval.userScopeId },
          select: {
            name: true,
            userProfile: { select: { age: true, biologicalSex: true } },
            healthConditions: { select: { condition: true } },
            allergies: { select: { allergen: true } },
          },
        })
      : null;
  const linkedUser = plan?.user ?? scopedUser;
  return {
    meal,
    recordedScope:
      input.kind === 'PROFILE'
        ? 'scopeSnapshot' in approval
          ? approval.scopeSnapshot
          : null
        : {
            conditions: 'condition' in approval ? [approval.condition] : [],
            userScoped: 'userScopeId' in approval && Boolean(approval.userScopeId),
          },
    recordedCaseScope:
      'scopeSnapshot' in approval
        ? approval.scopeSnapshot
        : 'evidenceSnapshot' in approval
          ? recordedCaseScope(approval.evidenceSnapshot)
          : null,
    recordedAt:
      input.kind === 'PROFILE'
        ? 'approvedAt' in approval
          ? approval.approvedAt
          : null
        : 'activatedAt' in approval
          ? approval.activatedAt
          : null,
    approvalMatchesCurrentRecipe:
      approval.recipeSignature === meal.recipeSignature && approval.evidenceRevision === meal.safetyEvidenceRevision,
    originatingPlan: plan
      ? {
          mealName: plan.mealName,
          description: plan.description,
          nutritionistNote: plan.nutritionistNote,
          calories: plan.calories,
          proteinG: plan.proteinG,
          carbsG: plan.carbsG,
          fatG: plan.fatG,
          ingredients: plan.ingredients,
        }
      : null,
    reviewedPlanProfile: plan?.cycle.snapshot
      ? {
          goal: plan.cycle.snapshot.goal,
          dailyCalorieTarget: plan.cycle.snapshot.dailyCalorieTarget,
          dietaryPreference: plan.cycle.snapshot.dietaryPreference,
          ricePreference: plan.cycle.snapshot.ricePreference,
        }
      : null,
    reviewedClinicalDocuments:
      plan?.clinicalEvidence.map((entry) => ({
        area: entry.clinicalDocument.area,
        documentType: entry.clinicalDocument.documentType,
        status: entry.clinicalDocument.status,
        validUntil: entry.clinicalDocument.validUntil,
        facts: entry.clinicalDocument.facts,
      })) ?? [],
    linkedUserCurrentProfile: linkedUser
      ? {
          name: linkedUser.name,
          age: linkedUser.userProfile?.age ?? null,
          sex: linkedUser.userProfile?.biologicalSex ?? null,
          conditions: linkedUser.healthConditions.map((item) => item.condition),
          allergies: linkedUser.allergies.map((item) => item.allergen),
        }
      : null,
  };
}

/** A scoped flag suspends only plans that actually used this approval. */
export async function flagMealApproval(input: {
  nutritionistProfileId: string;
  mealLibraryId: string;
  kind: 'PROFILE' | 'CONDITION';
  approvalId: string;
  reason: string;
}) {
  const actor = await reviewer(input.nutritionistProfileId);
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 1000) throw new Error('Give a reason of 10 to 1000 characters.');
  const now = new Date();
  return prisma.$transaction(
    async (tx) => {
      const meal = await tx.mealLibrary.findUnique({
        where: { id: input.mealLibraryId },
        select: { status: true },
      });
      if (meal?.status !== 'APPROVED') throw new Error('A flagged meal cannot receive a separate approval flag.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
      let users: Array<{ userId: string }>;
      if (input.kind === 'PROFILE') {
        const approval = await tx.mealLibraryProfileApproval.findUnique({ where: { id: input.approvalId } });
        if (!approval || approval.mealLibraryId !== input.mealLibraryId)
          throw new Error('Approval not found for this meal.');
        if (approval.flaggedAt) throw new Error('This approval is already flagged.');
        await tx.mealLibraryProfileApproval.update({
          where: { id: approval.id },
          data: { flaggedAt: now, flagReason: reason, flaggedByNutritionistId: actor.id },
        });
        users = await tx.mealPlan.findMany({
          where: { profileApprovalId: approval.id, status: 'APPROVED' },
          select: { userId: true },
          distinct: ['userId'],
        });
        await tx.mealPlan.updateMany({
          where: { profileApprovalId: approval.id, status: 'APPROVED' },
          data: { requiresSafetyRevalidation: true },
        });
      } else {
        const clearance = await tx.mealConditionClearance.findUnique({ where: { id: input.approvalId } });
        if (!clearance || clearance.mealLibraryId !== input.mealLibraryId)
          throw new Error('Approval not found for this meal.');
        if (
          clearance.state !== ConditionClearanceState.ACTIVE &&
          clearance.state !== ConditionClearanceState.REVIEW_DUE
        ) {
          throw new Error('Only an active or review-due approval can be flagged.');
        }
        await tx.mealConditionClearance.update({
          where: { id: clearance.id },
          data: {
            state: ConditionClearanceState.SUSPENDED,
            suspendedAt: now,
            suspensionReason: `APPROVAL_FLAGGED:${reason}`.slice(0, 240),
          },
        });
        users = await tx.mealPlan.findMany({
          where: { clearanceUsages: { some: { clearanceId: clearance.id } }, status: 'APPROVED' },
          select: { userId: true },
          distinct: ['userId'],
        });
        await tx.mealPlan.updateMany({
          where: { clearanceUsages: { some: { clearanceId: clearance.id } }, status: 'APPROVED' },
          data: { requiresSafetyRevalidation: true },
        });
      }
      if (users.length) {
        await tx.groceryList.updateMany({
          where: { userId: { in: users.map((user) => user.userId) } },
          data: { isStale: true },
        });
        await tx.notification.createMany({
          data: users.map((user) => ({
            userId: user.userId,
            type: NotificationType.MEAL_FLAGGED,
            title: 'A meal in your plan needs another review',
            message:
              'One meal approval is temporarily unavailable while a nutritionist checks it. Review your plan and grocery list for the current options.',
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'MEAL_APPROVAL_FLAGGED',
          entityType: input.kind === 'PROFILE' ? 'MealLibraryProfileApproval' : 'MealConditionClearance',
          entityId: input.approvalId,
          metadata: { mealLibraryId: input.mealLibraryId, reason, affectedUsers: users.length },
        },
      });
      return { flaggedAt: now, affectedUsers: users.length };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

/** Explicit RND recheck; a flag and an overdue date are cleared together. */
export async function recheckProfileApproval(input: {
  nutritionistProfileId: string;
  mealLibraryId: string;
  approvalId: string;
  rationale: string;
}) {
  const actor = await reviewer(input.nutritionistProfileId);
  const rationale = input.rationale.trim();
  if (rationale.length < 10 || rationale.length > 1000) {
    throw new Error('Record review findings in 10 to 1000 characters.');
  }
  const now = new Date();
  return prisma.$transaction(
    async (tx) => {
      const approval = await tx.mealLibraryProfileApproval.findUnique({
        where: { id: input.approvalId },
        include: { mealLibrary: true },
      });
      if (!approval || approval.mealLibraryId !== input.mealLibraryId)
        throw new Error('Approval not found for this meal.');
      if (!approval.flaggedAt && approval.reviewDueAt > now) throw new Error('This approval is already current.');
      if (
        approval.mealLibrary.status !== 'APPROVED' ||
        approval.recipeSignature !== approval.mealLibrary.recipeSignature ||
        approval.evidenceRevision !== approval.mealLibrary.safetyEvidenceRevision
      ) {
        throw new Error('Recipe evidence changed. Review a new variant instead.');
      }
      const result = await tx.mealLibraryProfileApproval.update({
        where: { id: approval.id },
        data: {
          reviewerNutritionistId: actor.id,
          approvedAt: now,
          reviewDueAt: new Date(now.getTime() + REVIEW_INTERVAL_MS),
          flaggedAt: null,
          flagReason: null,
          flaggedByNutritionistId: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'MEAL_APPROVAL_RECHECKED',
          entityType: 'MealLibraryProfileApproval',
          entityId: approval.id,
          metadata: {
            priorReviewerId: approval.reviewerNutritionistId,
            priorFlagReason: approval.flagReason,
            rationale,
          },
        },
      });
      return result;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function recheckConditionApproval(input: {
  nutritionistProfileId: string;
  mealLibraryId: string;
  approvalId: string;
  rationale: string;
}) {
  await reviewer(input.nutritionistProfileId);
  await enforceClearanceCircuitBreakers();
  const prior = await prisma.mealConditionClearance.findUnique({ where: { id: input.approvalId } });
  if (!prior || prior.mealLibraryId !== input.mealLibraryId) throw new Error('Approval not found for this meal.');
  if (prior.state !== 'SUSPENDED' && prior.state !== 'REVIEW_DUE') {
    throw new Error('This approval is already current or cannot be rechecked here.');
  }
  return ConditionClearanceService.submitManualDecision({
    nutritionistProfileId: input.nutritionistProfileId,
    mealLibraryId: prior.mealLibraryId,
    condition: prior.condition,
    userScopeId: prior.userScopeId,
    decision: 'APPROVE',
    rationale: input.rationale,
  });
}
