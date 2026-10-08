import { isNutritionistEligibleForReview } from './nutritionist-review.policy';

export const SPECIALIST_WINDOW_MS = 24 * 60 * 60_000;
export const REVIEW_DEADLINE_BUFFER_MS = 2 * 60 * 60_000;
export const SPECIALIST_POOL_SIZE = 3;

export interface RoutingReviewer {
  id: string;
  isVerified: boolean;
  prcLicenseExpiry: Date;
  user: {
    role: string;
    isSuspended: boolean;
    emailVerified: boolean;
    nutritionistApplication?: { status: string } | null;
  };
  acceptingReviews: boolean;
  verifiedExpertise: readonly string[];
  verifiedExperienceYears: number | null;
  expertiseVerifiedAt: Date | null;
  lastRoutingAssignedAt: Date | null;
  activeClaims: number;
}

export function eligibleRoutingReviewer(reviewer: RoutingReviewer, now: Date): boolean {
  return (
    isNutritionistEligibleForReview(reviewer, now) &&
    reviewer.user.emailVerified &&
    (!reviewer.user.nutritionistApplication || reviewer.user.nutritionistApplication.status === 'ACTIVATED')
  );
}

export function matchingReviewers(conditions: readonly string[], reviewers: readonly RoutingReviewer[], now: Date) {
  if (!conditions.length) return [];
  return reviewers
    .filter(
      (reviewer) =>
        eligibleRoutingReviewer(reviewer, now) &&
        reviewer.acceptingReviews &&
        reviewer.expertiseVerifiedAt !== null &&
        reviewer.verifiedExperienceYears !== null &&
        conditions.every((condition) => reviewer.verifiedExpertise.includes(condition))
    )
    .sort(
      (a, b) =>
        b.verifiedExperienceYears! - a.verifiedExperienceYears! ||
        a.activeClaims - b.activeClaims ||
        (a.lastRoutingAssignedAt?.getTime() ?? 0) - (b.lastRoutingAssignedAt?.getTime() ?? 0) ||
        a.id.localeCompare(b.id)
    );
}

/** Keep a stable pool, replacing unavailable members without restarting its clock. */
export function specialistPool(previous: readonly string[], matches: readonly RoutingReviewer[]): string[] {
  const ids = new Set(matches.map((reviewer) => reviewer.id));
  const retained = [...new Set(previous)].filter((id) => ids.has(id)).slice(0, SPECIALIST_POOL_SIZE);
  return [...retained, ...matches.map((reviewer) => reviewer.id).filter((id) => !retained.includes(id))].slice(
    0,
    SPECIALIST_POOL_SIZE
  );
}

export function routingOpensAt(beganAt: Date, deadlines: readonly Date[], previous?: Date): Date {
  return new Date(
    Math.min(
      beganAt.getTime() + SPECIALIST_WINDOW_MS,
      previous?.getTime() ?? Infinity,
      ...deadlines
        .filter((date) => Number.isFinite(date.getTime()))
        .map((date) => date.getTime() - REVIEW_DEADLINE_BUFFER_MS)
    )
  );
}

export function routingStage(input: {
  previousStage?: string;
  legacy: boolean;
  unknownConditions: boolean;
  conditions: readonly string[];
  selectedReviewerIds: readonly string[];
  opensAt: Date;
  beganAt: Date;
  now: Date;
}): { stage: 'GENERAL' | 'SPECIALIST'; reason: string } {
  if (input.previousStage === 'GENERAL') return { stage: 'GENERAL', reason: 'ALREADY_OPEN' };
  if (input.legacy) return { stage: 'GENERAL', reason: 'EXISTING_WORK' };
  if (input.unknownConditions) return { stage: 'GENERAL', reason: 'UNMAPPED_CONDITION' };
  if (!input.conditions.length) return { stage: 'GENERAL', reason: 'NO_CONDITIONS' };
  if (input.opensAt <= input.now)
    return {
      stage: 'GENERAL',
      reason:
        input.opensAt.getTime() < input.beganAt.getTime() + SPECIALIST_WINDOW_MS ? 'DEADLINE_BUFFER' : 'WINDOW_EXPIRED',
    };
  if (!input.selectedReviewerIds.length) return { stage: 'GENERAL', reason: 'NO_AVAILABLE_MATCH' };
  return { stage: 'SPECIALIST', reason: 'MATCHING_EXPERTISE' };
}
