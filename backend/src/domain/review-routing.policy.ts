import { isNutritionistEligibleForReview } from './nutritionist-review.policy';

export const SPECIALIST_WINDOW_MS = 24 * 60 * 60_000;
export const REVIEW_DEADLINE_BUFFER_MS = 2 * 60 * 60_000;

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
  /** Legacy persisted field; automatic routing deliberately ignores it. */
  acceptingReviews?: boolean;
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
  return experiencedReviewers(reviewers, now).filter((reviewer) =>
    conditions.every((condition) => reviewer.verifiedExpertise.includes(condition))
  );
}

/** Verified experience is priority evidence, not a declaration of condition expertise. */
export function eligibleExperiencedReviewer(reviewer: RoutingReviewer, now: Date): boolean {
  return (
    eligibleRoutingReviewer(reviewer, now) &&
    reviewer.expertiseVerifiedAt !== null &&
    reviewer.verifiedExperienceYears !== null
  );
}

export function experiencedReviewers(reviewers: readonly RoutingReviewer[], now: Date) {
  return reviewers
    .filter((reviewer) => eligibleExperiencedReviewer(reviewer, now))
    .sort(
      (a, b) =>
        b.verifiedExperienceYears! - a.verifiedExperienceYears! ||
        a.activeClaims - b.activeClaims ||
        (a.lastRoutingAssignedAt?.getTime() ?? 0) - (b.lastRoutingAssignedAt?.getTime() ?? 0) ||
        a.id.localeCompare(b.id)
    );
}

/** The highest verified experience tier includes everyone tied at that level. */
export function highestExperienceReviewers(reviewers: readonly RoutingReviewer[], now: Date) {
  const candidates = experiencedReviewers(reviewers, now);
  const highest = candidates[0]?.verifiedExperienceYears;
  return candidates.filter((candidate) => candidate.verifiedExperienceYears === highest);
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
  priorityReason?: 'MATCHING_EXPERTISE' | 'EXPERIENCE_PRIORITY';
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
  return { stage: 'SPECIALIST', reason: input.priorityReason ?? 'MATCHING_EXPERTISE' };
}
