import { CONDITION_SAFETY_CATALOGUE, FOOD_SAFETY_CATALOGUE } from './safety-intake.policy';
import { activeConditionPlanningAssessment } from './condition-planning-assessment.policy';
import { isDeterministicAvoidedFood } from './food-exclusion.policy';
import { adaptUserSafetyRestrictions, type UserSafetyRestrictionSource } from './structured-restriction.adapter';

/** Recognition removes the intake-review prerequisite, never meal-specific restrictions. */
export function needsProfileDeclarationReview(source: UserSafetyRestrictionSource): boolean {
  if (!source.safetyEntries?.length) return adaptUserSafetyRestrictions(source).requiresReview;
  const catalogue = [...CONDITION_SAFETY_CATALOGUE, ...FOOD_SAFETY_CATALOGUE];
  return source.safetyEntries.some((entry) => {
    if (entry.canonicalCode === 'NONE') return false;
    if (activeConditionPlanningAssessment(entry) || isDeterministicAvoidedFood(entry)) return false;
    return (
      !['SUPPORTED', 'RECOGNIZED_UNSUPPORTED'].includes(String(entry.supportState)) ||
      !catalogue.some((item) => item.code === entry.canonicalCode && item.domains.some((domain) => domain === entry.domain))
    );
  });
}

/** An RND may retain a named declaration without claiming it has automated rules. */
export function canReviewDeclarationAsRecorded(entry: {
  domain?: unknown;
  supportState?: unknown;
  displayName?: unknown;
}) {
  return (
    ['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'].includes(String(entry.domain)) &&
    entry.supportState === 'PENDING_REVIEW' &&
    typeof entry.displayName === 'string' &&
    entry.displayName.trim().length >= 2
  );
}
