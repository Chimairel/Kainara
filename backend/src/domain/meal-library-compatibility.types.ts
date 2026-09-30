import type { MealLibrarySafetyCandidate } from './meal-library-safety-evidence.policy';
import type { isNutritionistEligibleForReview } from './nutritionist-review.policy';

type Reviewer = Parameters<typeof isNutritionistEligibleForReview>[0] & { canLeadReview?: boolean };

/** Only the evidence read by the compatibility predicate; no unrelated Prisma relations required. */
export interface LibraryClearanceCandidate {
  condition: string;
  state: string;
  recipeSignature: string | null;
  evidenceRevision: number;
  policyVersion: string | null;
  assuranceTier: string;
  provenance: string;
  userScopeId: string | null;
  expiresAt: Date | null;
  auditDueAt: Date | null;
  rulePolicyVersion: { state: string; automationAllowed: boolean; policyVersion: string } | null;
  decisions: Array<{ decision: string; nutritionistProfile: Reviewer }>;
}

export interface LibraryCompatibilityCandidate extends MealLibrarySafetyCandidate {
  recipeSignature?: string | null;
  safetyReviewedByNutritionist?: Reviewer | null;
  conditionClearances?: LibraryClearanceCandidate[];
  dietaryTags?: unknown;
}
