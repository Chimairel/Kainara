import { AppError } from '@/errors/AppError';
import { getManilaDateKey, getManilaMidnight, getScheduledMealDate } from './meal-plan-cycle.policy';

export const MEMBERSHIP_TRIAL_DAYS = 30;
export const MEMBERSHIP_POLICY_VERSION = 'KAINARA_MEMBERSHIP_V4';
export type MembershipTierName = 'FREE' | 'LIFESTYLE' | 'HEALTH';
export type MembershipLevel = 'FREE' | 'TRIAL_PENDING' | 'TRIAL' | 'MEMBER';
// REPLAN remains a historical database value, but no longer grants access.
export type MembershipFeatureName = 'AI_ESTIMATE' | 'REPLAN' | 'PLAN_REVIEW' | 'OUTSIDE_REVIEW';
export const ACTIVE_MEMBERSHIP_FEATURES = ['AI_ESTIMATE', 'PLAN_REVIEW', 'OUTSIDE_REVIEW'] as const;

export function assertMemberPlanPreparation(replaceExisting?: boolean) {
  if (replaceExisting)
    throw new AppError('To change your plan, swap individual meals instead.', 403, 'PLAN_REPLACEMENT_UNAVAILABLE');
}

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
    lifestyleSwaps: integer('MEMBERSHIP_LIFESTYLE_CYCLE_SWAPS', 10, 21),
    healthSwaps: integer('MEMBERSHIP_HEALTH_CYCLE_SWAPS', 21, 21),
    memberEstimates: integer('MEMBERSHIP_WEEKLY_ESTIMATES', 10, 100),
    memberPlanReviews: integer('MEMBERSHIP_WEEKLY_PLAN_REVIEWS', 1, 7),
    memberOutsideReviews: integer('MEMBERSHIP_WEEKLY_OUTSIDE_REVIEWS', 1, 20),
  };
  if (
    limits.lifestyleSwaps < limits.freeSwaps ||
    limits.healthSwaps < limits.lifestyleSwaps ||
    limits.memberEstimates < limits.freeEstimates
  )
    throw new Error('Paid allowances must cover Free access, and Health swaps must be at least Lifestyle swaps.');
  return limits;
}

export function membershipSwapCap(access: { enhanced: boolean; healthAccess: boolean }, limits = membershipLimits()) {
  if (!access.enhanced) return limits.freeSwaps;
  return access.healthAccess ? limits.healthSwaps : limits.lifestyleSwaps;
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

export function membershipFeatureCap(
  feature: MembershipFeatureName,
  enhanced: boolean,
  limits = membershipLimits(),
  healthAccess = enhanced
) {
  if (feature === 'REPLAN') return 0;
  if (feature === 'AI_ESTIMATE') return enhanced ? limits.memberEstimates : limits.freeEstimates;
  if (!enhanced) return 0;

  if (!healthAccess) return 0;
  return feature === 'PLAN_REVIEW' ? limits.memberPlanReviews : limits.memberOutsideReviews;
}
