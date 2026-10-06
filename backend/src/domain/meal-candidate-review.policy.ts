import { requiresIndividualPlanningReview } from './planning-membership.policy';
import type { CanonicalUserSafetyRestrictions } from './structured-restriction.adapter';

/** Recipe review is separate from membership/profile review. Known allergies
 * may receive proposals, but source recipes never clear those allergies. */
export function requiresMealCandidateReview(restrictions: CanonicalUserSafetyRestrictions): boolean {
  return requiresIndividualPlanningReview(restrictions) || restrictions.allergies.some((key) => key !== 'NONE');
}
