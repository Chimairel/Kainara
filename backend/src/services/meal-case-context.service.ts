import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/errors/AppError';
import { assertMealReviewContext, reviewContextKey } from '@/domain/meal-review-context.policy';
import { planningInputsMatch } from '@/domain/planning-report.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { context, userInclude } from './clinical-profile-review.context';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';

type Client = Prisma.TransactionClient;
const ordered = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

/** A version guard, not an authorization token. Claims, eligibility and evidence gates still apply. */
export async function loadMealReviewContext(mealPlanId: string, client: Client = prisma) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return null;
  const plan = await client.mealPlan.findUnique({
    where: { id: mealPlanId },
    include: {
      ingredients: { include: { foodItem: true } },
      servingComponents: { include: { foodItem: true } },
      cycle: { include: { snapshot: true } },
      user: { include: { ...userInclude, nutritionReport: true,
        clinicalDocuments: { select: { id: true, revision: true, status: true, sha256: true, area: true,
          documentType: true, issuedAt: true, issuerName: true, validUntil: true, withdrawnAt: true, facts: true } },
      } },
    },
  });
  if (!plan) throw new AppError('Review case not found.', 404, 'REVIEW_NOT_FOUND');
  const current = context(plan.user);
  const profile = current.profile;
  // Check-in timestamps and counters do not change the clinical/planning context.
  const planningProfile = Object.fromEntries(Object.entries(profile).filter(([key]) => !['id', 'userId', 'updatedAt', 'lastCheckinAt', 'checkinStreak'].includes(key)));
  const reportVersion = plan.cycle.snapshot?.nutritionReportVersion ?? profile.planningReportVersion;
  const report = reportVersion ? await client.nutritionReportVersion.findUnique({
    where: { userId_version: { userId: plan.userId, version: reportVersion } },
  }) : null;
  const snapshot = {
    policyVersion: 'MEAL_REVIEW_CONTEXT_V1',
    userId: plan.userId,
    profile: planningProfile,
    clinical: current.snapshot,
    clinicalDocuments: ordered(plan.user.clinicalDocuments).map(document => ({ ...document, facts: ordered(document.facts) })),
    safetyEntries: ordered(plan.user.safetyProfileEntries),
    guidance: { selected: report, current: plan.user.nutritionReport },
    meal: {
      id: plan.id, planGroupId: plan.planGroupId, status: plan.status,
      mealType: plan.mealType, scheduledDate: plan.scheduledDate,
      mealName: plan.mealName, description: plan.description,
      calories: plan.calories, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG,
      baseRecipeSignature: plan.baseRecipeSignature, composedServingSignature: plan.composedServingSignature,
      libraryMealId: plan.libraryMealId, sourceRawRecipeCandidateId: plan.sourceRawRecipeCandidateId,
      requiresSafetyRevalidation: plan.requiresSafetyRevalidation, reviewApprovalCount: plan.reviewApprovalCount,
      ingredients: ordered(plan.ingredients), servingComponents: ordered(plan.servingComponents),
    },
    cycle: { snapshot: plan.cycle.snapshot, status: plan.cycle.status, supersededById: plan.cycle.supersededById,
      shoppingStartedAt: plan.cycle.shoppingStartedAt, endDate: plan.cycle.endDate },
  };
  return {
    guidanceReady: !!plan.user.nutritionReport?.acknowledgedAt && !plan.user.nutritionReport.isStale &&
      plan.user.nutritionReport.profileRevision === profile.revision && !!report?.acknowledgedAt &&
      report.profileRevision === profile.revision && reportVersion === profile.planningReportVersion && planningInputsMatch(profile, report),
    contextKey: reviewContextKey(snapshot),
    profileRevision: profile.revision,
    scopeKey: current.scopeKey,
    // JSON-safe immutable snapshot for decisions, never sent to unrelated cases.
    snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonObject,
  };
}

/** Call after lockUserProfile in every transaction that decides or replaces a case. */
export async function assertCurrentMealReviewContext(mealId: string, expected: string | undefined, client: Client = prisma, reviewerId?: string) {
  const current = await loadMealReviewContext(mealId, client);
  if (current) {
    assertMealReviewContext(expected, current.contextKey);
    if (reviewerId) {
      const reviewer = await client.nutritionistProfile.findUnique({ where: { id: reviewerId }, include: { user: true } });
      if (!reviewer || !isNutritionistEligibleForReview(reviewer))
        throw new AppError('A currently eligible RND is required.', 403, 'NUTRITIONIST_INELIGIBLE');
    }
    if (!current.guidanceReady)
      throw new AppError('The profile needs current acknowledged guidance before this case can be reviewed.', 409, 'MEAL_REVIEW_CONTEXT_CHANGED');
    const userId = current.snapshot.userId as string;
    if (!(await ClinicalProfileReviewService.hasCurrentApproval(userId, client)))
      throw new AppError('The profile is awaiting confirmation before this meal can be reviewed.', 409, 'PROFILE_REVIEW_REQUIRED');
  }
  return current;
}
