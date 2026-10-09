import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/errors/AppError';
import { planningInputsMatch } from '@/domain/planning-report.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '@/domain/deterministic-nutrition-report.policy';
import { remainingCycleWindow } from '@/domain/acknowledged-cycle-rebuild.policy';
import { loadRepairHistory } from './plan-repair-history.service';
import { getScheduledMealDate } from '@/domain/meal-plan-cycle.policy';

export async function assertAcknowledgedGenerationProfile(userId: string, client: Prisma.TransactionClient = prisma) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return;
  const user = await client.user.findUniqueOrThrow({
    where: { id: userId },
    include: { userProfile: true, nutritionReport: true },
  });
  const profile = user.userProfile;
  const selected = profile?.planningReportVersion
    ? await client.nutritionReportVersion.findUnique({
        where: { userId_version: { userId, version: profile.planningReportVersion } },
      })
    : null;
  if (
    !profile ||
    !user.nutritionReport?.acknowledgedAt ||
    user.nutritionReport.isStale ||
    user.nutritionReport.profileRevision !== profile.revision ||
    !selected?.acknowledgedAt ||
    selected.profileRevision !== profile.revision ||
    selected.policyVersion !== NUTRITION_GUIDANCE_POLICY_VERSION ||
    !planningInputsMatch(profile, selected)
  )
    throw new AppError(
      'Acknowledge the current nutrition guidance before generating meals.',
      409,
      'REPORT_ACKNOWLEDGEMENT_REQUIRED'
    );
}

export async function acknowledgedRebuild(userId: string, cycleId: string, now = new Date()) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return null;
  const [cycle, profile] = await Promise.all([
    prisma.mealPlanCycle.findFirst({ where: { id: cycleId, userId } }),
    prisma.userProfile.findUnique({ where: { userId } }),
  ]);
  if (
    !cycle ||
    !profile ||
    cycle.supersededById ||
    ['SUPERSEDED', 'COMPLETED'].includes(cycle.status) ||
    cycle.profileAdaptationState !== 'REBUILD_REQUIRED' ||
    cycle.requestedProfileRevision !== profile.revision ||
    cycle.acknowledgedProfileRevision !== profile.revision
  )
    return null;
  await assertAcknowledgedGenerationProfile(userId);
  const window = remainingCycleWindow(cycle, now);
  return window ? { window, cycleId, profileRevision: profile.revision } : null;
}

/** Internal repair authorization cannot be supplied through a member HTTP payload. */
export async function repairBillingStart(
  userId: string,
  repair: { cycleId: string; profileRevision: number },
  client: Prisma.TransactionClient = prisma
) {
  const profile = await client.userProfile.findUnique({ where: { userId }, select: { revision: true } });
  const cycle = await client.mealPlanCycle.findFirst({ where: { id: repair.cycleId, userId } });
  if (
    !profile ||
    profile.revision !== repair.profileRevision ||
    !cycle ||
    cycle.profileAdaptationState !== 'REBUILD_REQUIRED' ||
    cycle.supersededById ||
    ['SUPERSEDED', 'COMPLETED'].includes(cycle.status) ||
    cycle.requestedProfileRevision !== repair.profileRevision ||
    cycle.acknowledgedProfileRevision !== repair.profileRevision
  )
    throw new AppError('The repair context changed. Refresh the plan.', 409, 'MEAL_REVIEW_CONTEXT_CHANGED');
  const window = remainingCycleWindow(cycle);
  if (!window)
    throw new AppError('This plan no longer has remaining dates to repair.', 409, 'MEAL_REVIEW_CONTEXT_CHANGED');
  // Logged slots and purchases are reconciled by an immutable repair receipt at publication.
  // They grant no new approval and purchases are not silently credited as available pantry stock.
  await loadRepairHistory(
    userId,
    cycle.id,
    { startDate: window.startDate, endDate: getScheduledMealDate(window.startDate, window.numDays - 1) },
    client
  );
  return cycle.startDate;
}
