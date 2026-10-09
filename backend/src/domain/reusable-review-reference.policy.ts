import { createHash, createHmac } from 'node:crypto';
import { PLANNING_PROFILE_FIELDS } from './planning-report.policy';

export const REVIEW_REFERENCE_POLICY = 'EXACT_REVIEW_REFERENCE_V1';
export const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const pick = (value: unknown, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, object(value)[key] ?? null]));
export function canonicalReferenceJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalReferenceJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(object(value))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalReferenceJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value ?? null);
}
const sorted = (value: unknown[]) =>
  value.sort((a, b) => canonicalReferenceJson(a).localeCompare(canonicalReferenceJson(b)));
export const referenceServingDigest = (value: unknown) =>
  createHash('sha256').update(canonicalReferenceJson(value)).digest('hex');

/** Exact recorded inputs only. Private clinical strings are hashed; none become reference presentation. */
export function reusableClinicalContextKey(snapshot: unknown, resolvedForms: unknown[], secret: string): string | null {
  const saved = object(snapshot),
    profile = object(saved.profile),
    clinical = object(saved.clinical);
  if (
    saved.policyVersion !== 'MEAL_REVIEW_CONTEXT_V1' ||
    !profile.age ||
    !profile.weightKg ||
    !profile.heightCm ||
    !profile.biologicalSex ||
    !profile.dailyCalorieTarget ||
    !Array.isArray(clinical.conditions) ||
    !Array.isArray(clinical.allergies) ||
    !Array.isArray(clinical.healthDetails) ||
    !Array.isArray(saved.safetyEntries) ||
    !Array.isArray(saved.clinicalDocuments)
  )
    return null;
  const meaning = {
    policy: REVIEW_REFERENCE_POLICY,
    profile: pick(profile, [
      ...PLANNING_PROFILE_FIELDS,
      'planningGeographyLevel',
      'planningRegionName',
      'planningProvinceHucName',
    ]),
    guidancePolicy: object(object(saved.guidance).selected).policyVersion ?? null,
    clinical: pick(clinical, ['conditions', 'allergies', 'customConditions', 'customFoodRestrictions']),
    healthDetails: sorted(array(clinical.healthDetails).map((value) => pick(value, ['area', 'responses']))),
    declarations: sorted(
      array(saved.safetyEntries).map((value) => ({
        ...pick(value, ['domain', 'canonicalCode', 'normalizedText', 'originalText', 'supportState']),
        assessment: pick(object(value).mealPlanningAssessment, [
          'policyVersion',
          'result',
          'normalizedText',
          'reviewedDietaryAndTreatmentEffects',
          'reviewedFoodborneIllnessRisk',
        ]),
      }))
    ),
    documents: sorted(
      array(saved.clinicalDocuments).map((value) => ({
        ...pick(value, ['area', 'documentType', 'status', 'issuedAt', 'issuerName', 'validUntil', 'withdrawnAt']),
        facts: sorted(
          array(object(value).facts).map((fact) =>
            pick(fact, ['code', 'valueText', 'valueNumber', 'unit', 'observedAt', 'reviewStatus'])
          )
        ),
      }))
    ),
    resolvedForms: sorted(resolvedForms),
  };
  return createHmac('sha256', secret).update(canonicalReferenceJson(meaning)).digest('hex');
}

/** Clinical notes, identities, documents and answers are intentionally absent from the reusable payload. */
export function referencePlateFacts(snapshot: unknown) {
  const meal = object(object(snapshot).meal);
  const facts = pick(meal, ['calories', 'proteinG', 'carbsG', 'fatG']);
  if (Object.values(facts).some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0))
    return null;
  return facts as { calories: number; proteinG: number; carbsG: number; fatG: number };
}
