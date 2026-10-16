import { reviewContextKey } from './meal-review-context.policy';
import { effectivePatientLimits, type PatientLimitLike } from './planning-rule-screening.policy';
import { FOOD_CHOICE_POLICY_VERSION } from './food-choice-rules.policy';

export function clinicalRuleSnapshot(userId: string, limits: readonly PatientLimitLike[],
  policies: readonly { id: string; condition: string; policyVersion: string; updatedAt: Date; state?: string }[], now = new Date()) {
  return { choicePolicy: FOOD_CHOICE_POLICY_VERSION,
    patient: effectivePatientLimits(limits, userId, now).map(row => ({ id: row.id, version: row.version, condition: row.condition,
      nutrient: row.nutrient, threshold: row.threshold, operator: row.operator, basis: row.basis, active: row.active })).sort((a,b) => a.id.localeCompare(b.id)),
    policies: [...policies].sort((a,b) => a.id.localeCompare(b.id)),
  };
}
export function clinicalRuleKey(snapshot: unknown) { return reviewContextKey(snapshot); }
