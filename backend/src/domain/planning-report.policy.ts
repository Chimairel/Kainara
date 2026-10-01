import type { NutritionReportVersion, UserProfile } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from './deterministic-nutrition-report.policy';

export const PLANNING_PROFILE_FIELDS = [
  'age',
  'biologicalSex',
  'heightCm',
  'weightKg',
  'targetWeightKg',
  'goal',
  'activityLevel',
  'dietaryPreference',
  'ricePreference',
  'foodCulture',
  'dailyCalorieTarget',
  'otherConditions',
  'otherAllergies',
  'shoppingDayGroup',
  'shoppingDayOfWeek',
] as const;

export function reportProfile(version: Pick<NutritionReportVersion, 'profileSnapshot'> | null) {
  const snapshot = version?.profileSnapshot as { profile?: Partial<UserProfile> } | null;
  return snapshot?.profile ?? null;
}

export function planningInputsMatch(
  profile: UserProfile,
  version: Pick<NutritionReportVersion, 'profileSnapshot'> | null
) {
  const saved = reportProfile(version);
  return Boolean(
    saved &&
    saved.safetyRevision === profile.safetyRevision &&
    PLANNING_PROFILE_FIELDS.every((field) => (saved[field] ?? null) === (profile[field] ?? null))
  );
}

export function resolvePlanningProfile(live: UserProfile, version: NutritionReportVersion | null): UserProfile {
  const saved = reportProfile(version);
  if (
    !version?.acknowledgedAt ||
    version.policyVersion !== NUTRITION_GUIDANCE_POLICY_VERSION ||
    !saved ||
    saved.safetyRevision !== live.safetyRevision ||
    !saved.dailyCalorieTarget ||
    !saved.age ||
    !saved.weightKg ||
    !saved.heightCm ||
    !saved.activityLevel ||
    !saved.goal
  ) {
    throw new AppError(
      'Your planning report needs updating. Review your current health context before meal planning.',
      409,
      'REPORT_ACKNOWLEDGEMENT_REQUIRED'
    );
  }
  return {
    ...live,
    ...Object.fromEntries(PLANNING_PROFILE_FIELDS.map((field) => [field, saved[field] ?? null])),
    revision: version.profileRevision,
    safetyRevision: live.safetyRevision,
  } as UserProfile;
}

/** Compare actual report inputs, including declarations, so correcting a mistake can restore a baseline. */
export function reportInputsMatch(
  current: Pick<NutritionReportVersion, 'profileSnapshot'> | null,
  previous: Pick<NutritionReportVersion, 'profileSnapshot'> | null
) {
  const a = reportProfile(current),
    b = reportProfile(previous);
  if (!a || !b || !PLANNING_PROFILE_FIELDS.every((field) => (a[field] ?? null) === (b[field] ?? null))) return false;
  const left = current!.profileSnapshot as Record<string, unknown>;
  const right = previous!.profileSnapshot as Record<string, unknown>;
  return ['conditions', 'allergens', 'otherConditions', 'otherAllergies'].every((key) => {
    const normalize = (value: unknown) =>
      Array.isArray(value)
        ? JSON.stringify(
            value
              .filter((item) => item !== 'NONE')
              .map(String)
              .sort()
          )
        : String(value ?? '').trim();
    return normalize(left[key]) === normalize(right[key]);
  });
}
