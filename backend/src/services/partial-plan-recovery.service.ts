import prisma from '@/lib/prisma';
import { canResumePartialCycle, remainingGenerationSlots } from '@/domain/meal-generation-continuation.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { retainedMealsForCycle } from './plan-repair-history.service';

let cursor: string | undefined;

const recoverableJob = {
  OR: [
    { status: 'COMPLETED' as const },
    { status: 'FAILED' as const, lastErrorCode: { in: ['NO_REVIEW_FREE_SOURCE', 'Error: NO_REVIEW_FREE_SOURCE'] } },
  ],
};

/** Reconcile old completed jobs after candidate cancellation, without restoring cancelled meals. */
export async function recoverPartialPlanJobs(now: Date = new Date()): Promise<number> {
  const cycles = await prisma.mealPlanCycle.findMany({
    where: {
      ...(cursor ? { id: { gt: cursor } } : {}),
      endDate: { gte: MealPlanCycleService.getBusinessDay(now) },
      status: { notIn: ['SUPERSEDED', 'COMPLETED', 'REVALIDATION_REQUIRED'] },
      profileAdaptationState: 'CURRENT',
      shoppingStartedAt: null,
      incompleteAcknowledgedAt: null,
      generationJob: recoverableJob,
      user: { emailVerified: true, onboardingDone: true, tosAccepted: true, isSuspended: false },
    },
    include: {
      snapshot: true,
      user: { select: { userProfile: { select: { revision: true, safetyRevision: true } } } },
      generationJob: { select: { id: true } },
      mealPlans: { where: { status: { not: 'CANCELLED' } }, select: { scheduledDate: true, mealType: true } },
    },
    orderBy: { id: 'asc' },
    take: 100,
  });
  cursor = cycles.length === 100 ? cycles.at(-1)?.id : undefined;
  let recovered = 0;
  for (const cycle of cycles) {
    const retained = await retainedMealsForCycle(cycle.userId, cycle.id);
    if (
      !canResumePartialCycle(cycle, cycle.user.userProfile, now) ||
      !remainingGenerationSlots(cycle.startDate, cycle.expectedSlotCount, [...cycle.mealPlans, ...retained], now).length
    )
      continue;
    try {
      await ClinicalEvidenceService.assertReadyForMealPlanning(cycle.userId);
      await ClinicalProfileReviewService.assertReadyForMealPlanning(cycle.userId);
      const context = await loadPlanningNutritionContext(prisma, cycle.userId, 'PROFILE_MISSING');
      if (!canResumePartialCycle(cycle, context.profile, now)) continue;
    } catch {
      // Pending evidence or approval must never be converted into automatic preparation.
      continue;
    }
    const result = await prisma.mealPlanGenerationJob.updateMany({
      where: {
        id: cycle.generationJob!.id,
        planGroupId: cycle.id,
        ...recoverableJob,
        cycle: {
          status: { notIn: ['SUPERSEDED', 'COMPLETED', 'REVALIDATION_REQUIRED'] },
          profileAdaptationState: 'CURRENT',
          shoppingStartedAt: null,
          incompleteAcknowledgedAt: null,
          user: {
            userProfile: { revision: cycle.snapshot!.profileRevision, safetyRevision: cycle.snapshot!.safetyRevision },
          },
        },
      },
      data: {
        status: 'WAITING_FOR_AI',
        nextAttemptAt: now,
        processingToken: null,
        completedAt: null,
        lastErrorCode: null,
        progressPct: 90,
        stageCode: 'WAITING_FOR_AI',
        stageMessage: 'Preparing fresh replacements for remaining empty slots.',
      },
    });
    recovered += result.count;
  }
  return recovered;
}
