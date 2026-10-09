import { CONDITION_SAFETY_CATALOGUE, normalizeSafetyText } from './safety-intake.policy';

export const CONDITION_PLANNING_ASSESSMENT_POLICY = 'RND_CONDITION_RELEVANCE_V1';
export type AssessedConditionEntry = {
  id?: unknown;
  userId?: unknown;
  domain?: unknown;
  canonicalCode?: unknown;
  displayName?: unknown;
  originalText?: unknown;
  normalizedText?: unknown;
  supportState?: unknown;
  mealPlanningAssessment?: unknown;
};

export type ConditionPlanningAssessment = {
  policyVersion: typeof CONDITION_PLANNING_ASSESSMENT_POLICY;
  result: 'NO_ADDITIONAL_RESTRICTIONS';
  entryId: string;
  userId: string;
  normalizedText: string;
  profileRevision: number;
  safetyRevision: number;
  reviewId: string;
  reviewerId: string;
  reviewerName: string;
  assessedAt: string;
  rationale: string;
  reviewedDietaryAndTreatmentEffects: true;
  reviewedFoodborneIllnessRisk: true;
};

/** Recognized dietary conditions retain their governed checks. No diagnosis whitelist is inferred. */
export function canAssessNoAdditionalRestrictions(entry: AssessedConditionEntry): boolean {
  if (
    entry.domain !== 'CONDITION' ||
    !['SUPPORTED', 'PENDING_REVIEW', 'RECOGNIZED_UNSUPPORTED'].includes(String(entry.supportState))
  )
    return false;
  const terms = [entry.canonicalCode, entry.displayName, entry.originalText, entry.normalizedText]
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeSafetyText);
  if (!terms.length || terms.some((term) => !term || term === 'none')) return false;
  return !CONDITION_SAFETY_CATALOGUE.some((item) =>
    [item.code, item.displayName, ...item.aliases].some((value) => terms.includes(normalizeSafetyText(value)))
  );
}

/** This active cache is written only by claimed RND review and cleared on profile/evidence changes. */
export function activeConditionPlanningAssessment(entry: AssessedConditionEntry): ConditionPlanningAssessment | null {
  const value = entry.mealPlanningAssessment;
  if (!canAssessNoAdditionalRestrictions(entry) || !value || typeof value !== 'object' || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (
    record.policyVersion !== CONDITION_PLANNING_ASSESSMENT_POLICY ||
    record.result !== 'NO_ADDITIONAL_RESTRICTIONS' ||
    typeof entry.id !== 'string' ||
    record.entryId !== entry.id ||
    typeof entry.userId !== 'string' ||
    record.userId !== entry.userId ||
    typeof entry.normalizedText !== 'string' ||
    record.normalizedText !== entry.normalizedText ||
    !Number.isInteger(record.profileRevision) ||
    Number(record.profileRevision) < 0 ||
    !Number.isInteger(record.safetyRevision) ||
    Number(record.safetyRevision) < 0 ||
    !['reviewId', 'reviewerId', 'reviewerName', 'assessedAt', 'rationale'].every(
      (key) => typeof record[key] === 'string' && String(record[key]).trim()
    ) ||
    String(record.rationale).trim().length < 10 ||
    !Number.isFinite(Date.parse(String(record.assessedAt))) ||
    record.reviewedDietaryAndTreatmentEffects !== true ||
    record.reviewedFoodborneIllnessRisk !== true
  )
    return null;
  return record as ConditionPlanningAssessment;
}
