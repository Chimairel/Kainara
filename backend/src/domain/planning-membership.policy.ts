import { RESTRICTION_ALLERGY_KEYS } from './restriction-evaluation.policy';
import {
  adaptUserSafetyRestrictions,
  type CanonicalUserSafetyRestrictions,
  type UserSafetyRestrictionSource,
} from './structured-restriction.adapter';
import {
  PLANNING_PROFILE_FIELDS,
  reportInputsMatch,
  reportProfile,
  reportDeclarationsMatch,
} from './planning-report.policy';
import type { NutritionReportVersion } from '@prisma/client';

const allergyKeys = new Set<string>(RESTRICTION_ALLERGY_KEYS.filter((key) => key !== 'NONE'));

/** Membership eligibility only; recipe evidence must still pass its own checks. */
export function requiresIndividualPlanningReview(restrictions: CanonicalUserSafetyRestrictions): boolean {
  return (
    restrictions.requiresReview ||
    restrictions.conditions.some((key) => key !== 'NONE') ||
    restrictions.customConditions.length > 0 ||
    restrictions.customFoodRestrictions.length > 0 ||
    restrictions.allergies.some((key) => key !== 'NONE' && !allergyKeys.has(key))
  );
}

export function requiresHealthPlanning(source: UserSafetyRestrictionSource): boolean {
  return requiresIndividualPlanningReview(adaptUserSafetyRestrictions(source));
}

type Report = Pick<NutritionReportVersion, 'profileSnapshot'> | null;
function snapshotRequiresHealth(report: Report): boolean {
  const value = report?.profileSnapshot;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  const snapshot = value as Record<string, unknown>;
  return requiresHealthPlanning({
    healthConditions: snapshot.conditions,
    allergies: snapshot.allergens,
    otherConditions: snapshot.otherConditions,
    otherAllergies: snapshot.otherAllergies,
  });
}

/** Compare the server's full snapshots, never a client-provided "weight only" flag. */
export function reportActivationTier(
  current: Report,
  previous: Report,
  currentRequiresHealth: boolean
): 'LIFESTYLE' | 'HEALTH' | null {
  if (!previous) return currentRequiresHealth ? 'HEALTH' : 'LIFESTYLE';
  if (reportInputsMatch(current, previous)) return null;
  if (currentRequiresHealth || snapshotRequiresHealth(current) || snapshotRequiresHealth(previous)) return 'HEALTH';
  const now = reportProfile(current),
    before = reportProfile(previous);
  if (!now || !before) return 'LIFESTYLE';
  // Calculated calorie targets may change along with weight; every other input
  // and all safety declarations must remain identical for Free activation.
  const ordinarySame = PLANNING_PROFILE_FIELDS.filter(
    (field) => field !== 'weightKg' && field !== 'dailyCalorieTarget'
  ).every((field) => (now[field] ?? null) === (before[field] ?? null));
  const declarationsSame = reportDeclarationsMatch(current, previous);
  return ordinarySame &&
    declarationsSame &&
    now.safetyRevision === before.safetyRevision &&
    now.weightKg !== before.weightKg
    ? null
    : 'LIFESTYLE';
}

export const HEALTH_PLANNING_REQUIRED_MESSAGE =
  'Your health details require nutritionist review. Choose Health to continue personalized meal planning.';
