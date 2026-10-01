import { getManilaDateKey, getManilaMidnight, getScheduledMealDate } from './meal-plan-cycle.policy';

export const MEMBERSHIP_TRIAL_DAYS = 14;
export const MEMBERSHIP_POLICY_VERSION = 'KAINARA_MEMBERSHIP_V1';
export type MembershipLevel = 'FREE' | 'TRIAL_PENDING' | 'TRIAL' | 'MEMBER';
export type MembershipFeatureName = 'AI_ESTIMATE' | 'REPLAN' | 'PLAN_REVIEW' | 'OUTSIDE_REVIEW';

export function membershipEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MEMBERSHIP_ENABLED === 'true';
}

export function membershipLimits(env: NodeJS.ProcessEnv = process.env) {
  const integer = (name: string, fallback: number, maximum: number) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > maximum)
      throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
    return Number(raw);
  };
  const limits = {
    freeSwaps: 3,
    freeEstimates: 2,
    memberSwaps: integer('MEMBERSHIP_WEEKLY_SWAPS', 6, 21),
    memberEstimates: integer('MEMBERSHIP_WEEKLY_ESTIMATES', 10, 100),
    memberReplans: integer('MEMBERSHIP_WEEKLY_REPLANS', 2, 7),
    memberPlanReviews: integer('MEMBERSHIP_WEEKLY_PLAN_REVIEWS', 1, 7),
    memberOutsideReviews: integer('MEMBERSHIP_WEEKLY_OUTSIDE_REVIEWS', 1, 20),
  };
  if (limits.memberSwaps < limits.freeSwaps || limits.memberEstimates < limits.freeEstimates)
    throw new Error('Membership swap and estimate allowances must be at least the free allowances.');
  return limits;
}

/** Usage weeks are Monday 00:00 through the next Monday in Asia/Manila. */
export function membershipWeek(at: Date) {
  const day = getManilaMidnight(getManilaDateKey(at));
  const weekday = new Date(day.getTime() + 8 * 60 * 60 * 1000).getUTCDay();
  const start = getScheduledMealDate(day, -(weekday + 6) % 7);
  return { start, end: getScheduledMealDate(start, 7) };
}

export function resolveMembershipLevel(input: { at: Date; trialStartedAt: Date | null; paidUntil: Date | null }) {
  if (!Number.isFinite(input.at.getTime())) throw new Error('A valid membership instant is required.');
  if (input.trialStartedAt && (!Number.isFinite(input.trialStartedAt.getTime()) || input.trialStartedAt > input.at))
    throw new Error('The trial start must be a valid past or current instant.');
  const trialEndsAt = input.trialStartedAt
    ? new Date(input.trialStartedAt.getTime() + MEMBERSHIP_TRIAL_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const level: MembershipLevel =
    input.paidUntil && input.paidUntil > input.at
      ? 'MEMBER'
      : input.trialStartedAt === null
        ? 'TRIAL_PENDING'
        : trialEndsAt! > input.at
          ? 'TRIAL'
          : 'FREE';
  return { level, trialEndsAt, enhanced: level !== 'FREE' };
}

export function membershipFeatureCap(feature: MembershipFeatureName, enhanced: boolean, limits = membershipLimits()) {
  if (feature === 'AI_ESTIMATE') return enhanced ? limits.memberEstimates : limits.freeEstimates;
  if (!enhanced) return 0;
  if (feature === 'REPLAN') return limits.memberReplans;
  if (feature === 'PLAN_REVIEW') return limits.memberPlanReviews;
  return limits.memberOutsideReviews;
}
