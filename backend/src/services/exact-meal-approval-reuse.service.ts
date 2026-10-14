import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { object, reusableClinicalContextKey, REVIEW_REFERENCE_POLICY } from '@/domain/reusable-review-reference.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { loadMealReviewContexts } from './meal-case-context.service';
import { matchingReviewKeys } from './reusable-review-reference.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { lockUserProfile } from './profile-revision.service';
import { userInclude } from './clinical-profile-review.context';
import { healthDetailsRequirements } from '@/domain/health-details.policy';

const referenceInclude = {
  decision: {
    include: {
      nutritionistProfile: { include: { user: true } },
      mealPlan: {
        select: {
          status: true,
          requiresSafetyRevalidation: true,
          safetyPolicyVersion: true,
          profileApproval: { select: { flaggedAt: true } },
          reviewDecisions: { orderBy: { submittedAt: 'desc' as const }, take: 1, select: { id: true } },
        },
      },
    },
  },
} satisfies Prisma.MealReviewReferenceInclude;

/** Reuse an immutable decision, never impersonate its RND with a new human decision. */
export async function reconcileExactMealApprovals(
  userId: string,
  cycleId: string,
  client: Prisma.TransactionClient = prisma
): Promise<Set<string>> {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return new Set();
  const signingSecret = env.JWT_SECRET;
  if (!signingSecret) return new Set();
  const available = await client.mealReviewReference.findFirst({
    where: {
      policyVersion: { in: [REVIEW_REFERENCE_POLICY, 'EXACT_REVIEW_REFERENCE_V1'] },
    },
    select: { id: true },
  });
  if (
    !available &&
    !(await client.mealPlan.findFirst({
      where: {
        userId,
        planGroupId: cycleId,
        status: 'APPROVED',
        selectionEvidence: { path: ['exactApprovalReuse', 'policyVersion'], equals: REVIEW_REFERENCE_POLICY },
      },
      select: { id: true },
    }))
  )
    return new Set();
  // Legacy fingerprints also require their immutable full context to satisfy the stronger current match.
  const reconcile = async (tx: Prisma.TransactionClient) => {
    await lockUserProfile(tx, userId);
    const valid = new Set<string>();
    if (!(await ClinicalProfileReviewService.hasCurrentApproval(userId, tx))) return valid;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
    const detailsReady = healthDetailsRequirements(user).every((requirement) => requirement.state === 'READY');
    const cycle = await tx.mealPlanCycle.findFirst({
      where: {
        id: cycleId,
        userId,
        profileAdaptationState: 'CURRENT',
        status: { notIn: ['SUPERSEDED', 'COMPLETED'] },
        supersededById: null,
      },
      select: { id: true },
    });
    if (!cycle) return valid;
    const plans = await tx.mealPlan.findMany({
      where: {
        userId,
        planGroupId: cycleId,
        supersededByMealPlanId: null,
        OR: [
          {
            status: 'PENDING_REVIEW',
            reviewApprovalCount: 0,
            claimedByNutritionistId: null,
            reviewDecisions: { none: {} },
          },
          {
            status: 'APPROVED',
            selectionEvidence: { path: ['exactApprovalReuse', 'policyVersion'], equals: REVIEW_REFERENCE_POLICY },
          },
        ],
      },
      select: { id: true, status: true, selectionEvidence: true, requiresSafetyRevalidation: true },
    });
    if (!plans.length) return valid;
    const contexts = await loadMealReviewContexts(
      plans.map((plan) => plan.id),
      tx
    );
    for (const plan of plans) {
      const reuse = object(object(plan.selectionEvidence).exactApprovalReuse);
      // An invalidated approval needs a fresh decision, not automatic resurrection.
      if (plan.status === 'PENDING_REVIEW' && Object.keys(reuse).length) continue;
      const opened = contexts.get(plan.id);
      const documentsCurrent = (
        Array.isArray(opened?.snapshot.clinicalDocuments) ? opened.snapshot.clinicalDocuments : []
      ).every((value) => !object(value).validUntil || new Date(String(object(value).validUntil)) > new Date());
      const keys =
        opened?.guidanceReady && detailsReady && documentsCurrent ? await matchingReviewKeys(tx, opened) : null;
      const rows = keys
        ? await tx.mealReviewReference.findMany({
            where: {
              servingKey: keys.servingKey,
              OR: [
                { policyVersion: REVIEW_REFERENCE_POLICY, contextKey: keys.contextKey },
                { policyVersion: 'EXACT_REVIEW_REFERENCE_V1', contextKey: keys.legacyContextKey ?? '' },
              ],
              ...(typeof reuse.referenceId === 'string' ? { id: reuse.referenceId } : {}),
            },
            include: referenceInclude,
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : [];
      const reference = rows.find((row) => {
        const source = row.decision.mealPlan;
        const savedContext = object(row.decision.evidenceSnapshot).reviewContext;
        // V1 already compares resolved answers. Compare full immutable clinical context again under V2
        // to add document content digests; never substitute today's source member profile.
        if (
          row.policyVersion !== REVIEW_REFERENCE_POLICY &&
          (!savedContext ||
            !opened ||
            reusableClinicalContextKey(savedContext, [], signingSecret) !==
              reusableClinicalContextKey(opened.snapshot, [], signingSecret))
        )
          return false;
        return (
          row.decision.decision === 'APPROVE' &&
          source.status === 'APPROVED' &&
          !source.requiresSafetyRevalidation &&
          source.safetyPolicyVersion === MEAL_PLAN_SAFETY_POLICY_VERSION &&
          !source.profileApproval?.flaggedAt &&
          source.reviewDecisions[0]?.id === row.decisionId &&
          isNutritionistEligibleForReview(row.decision.nutritionistProfile)
        );
      });
      if (!reference || !keys) {
        if (plan.status === 'APPROVED') {
          await tx.mealPlan.update({
            where: { id: plan.id },
            data: {
              status: 'PENDING_REVIEW',
              requiresSafetyRevalidation: true,
            },
          });
          await tx.groceryList.updateMany({ where: { userId }, data: { isStale: true } });
          await tx.auditEvent.create({
            data: {
              actorName: 'Kainara',
              action: 'MEAL_APPROVAL_REUSE_INVALIDATED',
              entityType: 'MealPlan',
              entityId: plan.id,
              metadata: { policyVersion: REVIEW_REFERENCE_POLICY },
            },
          });
        }
        continue;
      }
      if (plan.status === 'APPROVED') {
        if (!plan.requiresSafetyRevalidation) valid.add(plan.id);
        continue;
      }
      const reviewer = object(object(reference.decision.evidenceSnapshot).reviewedBy);
      const provenance = {
        policyVersion: REVIEW_REFERENCE_POLICY,
        referenceId: reference.id,
        contextKey: keys.contextKey,
        servingKey: keys.servingKey,
        reusedAt: new Date().toISOString(),
        reviewedAt: reference.decision.submittedAt.toISOString(),
        reviewer: {
          name: reviewer.name ?? null,
          prcLicenseNumber: reviewer.prcLicenseNumber ?? null,
          prcLicenseExpiry: reviewer.prcLicenseExpiry ?? null,
        },
      } as Prisma.InputJsonObject;
      const updated = await tx.mealPlan.updateMany({
        where: {
          id: plan.id,
          status: 'PENDING_REVIEW',
          reviewApprovalCount: 0,
          claimedByNutritionistId: null,
          reviewDecisions: { none: {} },
        },
        data: {
          status: 'APPROVED',
          requiresSafetyRevalidation: false,
          safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          selectionEvidence: {
            ...object(plan.selectionEvidence),
            exactApprovalReuse: provenance,
          } as Prisma.InputJsonObject,
        },
      });
      if (!updated.count) continue;
      valid.add(plan.id);
      await tx.groceryList.updateMany({ where: { userId }, data: { isStale: true } });
      await tx.auditEvent.create({
        data: {
          actorName: 'Kainara',
          action: 'MEAL_APPROVAL_REUSED',
          entityType: 'MealPlan',
          entityId: plan.id,
          // No source patient identity, clinical snapshot, note or clarification answers.
          metadata: {
            policyVersion: REVIEW_REFERENCE_POLICY,
            referenceId: reference.id,
            libraryMealId: object(opened?.snapshot.meal).libraryMealId ?? null,
            sourceRawRecipeCandidateId: object(opened?.snapshot.meal).sourceRawRecipeCandidateId ?? null,
          } as Prisma.InputJsonObject,
        },
      });
    }
    return valid;
  };
  if (client !== prisma) return reconcile(client);
  for (let attempt = 0; ; attempt++) {
    try {
      // Full saved clinical context and source eligibility require several remote reads.
      // Shared Neon revalidation exceeded 30 seconds and aborted the workspace read (P2028).
      // Keep a bounded transaction within the member read's 90-second request budget.
      return await prisma.$transaction(reconcile, { isolationLevel: 'Serializable', timeout: 60000 });
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') continue;
      throw error;
    }
  }
}
