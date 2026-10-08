import { MealPlanCycleStatus } from '@prisma/client';
import { getManilaDateKey, getManilaMidnight } from './meal-plan-cycle.policy';
import { missingMealSlots } from './meal-generation-gap.policy';

export function remainingGenerationSlots(
  startDate: Date,
  expectedSlotCount: number,
  occupied: Parameters<typeof missingMealSlots>[2],
  now: Date
) {
  const today = getManilaMidnight(getManilaDateKey(now));
  return missingMealSlots(startDate, expectedSlotCount, occupied).filter((slot) => slot.scheduledDate >= today);
}

export function canResumePartialCycle(
  cycle: {
    status: MealPlanCycleStatus;
    startDate: Date;
    endDate: Date;
    shoppingDeadlineAt: Date;
    shoppingStartedAt: Date | null;
    incompleteAcknowledgedAt: Date | null;
    profileAdaptationState: string;
    snapshot: { profileRevision: number; safetyRevision: number } | null;
  },
  profile: { revision: number; safetyRevision: number } | null,
  now: Date
) {
  const today = getManilaMidnight(getManilaDateKey(now));
  return Boolean(
    cycle.snapshot &&
    profile &&
    cycle.endDate >= today &&
    ![MealPlanCycleStatus.SUPERSEDED, MealPlanCycleStatus.COMPLETED, MealPlanCycleStatus.REVALIDATION_REQUIRED].some(
      (status) => cycle.status === status
    ) &&
    !cycle.shoppingStartedAt &&
    !cycle.incompleteAcknowledgedAt &&
    !(cycle.startDate > today && now >= cycle.shoppingDeadlineAt) &&
    cycle.profileAdaptationState === 'CURRENT' &&
    cycle.snapshot.profileRevision === profile.revision &&
    cycle.snapshot.safetyRevision === profile.safetyRevision
  );
}

/** Provider outages may resume; deterministic safety, evidence and configuration failures require resolution. */
export function continuationRetryAt(error: unknown, attempts: number, now: Date): Date | null {
  const code = (error as { errorCode?: string } | null)?.errorCode;
  if (!code || !['AI_HIGH_DEMAND', 'AI_TIMEOUT', 'AI_CONNECTION_ERROR', 'AI_UNAVAILABLE'].includes(code)) return null;
  return new Date(now.getTime() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(6, Math.max(0, attempts - 1))));
}
