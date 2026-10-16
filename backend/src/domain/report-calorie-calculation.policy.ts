import { ActivityLevel, Goal } from '@prisma/client';
import { calculateDailyTargetBreakdown } from '@/lib/calculations';
import { reportProfile } from './planning-report.policy';
import type { NutritionReportVersion } from '@prisma/client';
import { clinicalEvidenceSourceByCode } from './clinical-evidence-source.catalog';

/** Derive only from the selected version; never substitute today's profile into an archive. */
export function reportCalorieCalculation(version: Pick<NutritionReportVersion, 'profileSnapshot'> | null) {
  const profile = reportProfile(version);
  if (
    !profile ||
    ![profile.age, profile.weightKg, profile.heightCm].every(
      (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
    ) ||
    !Object.values(Goal).includes(profile.goal as Goal) ||
    !Object.values(ActivityLevel).includes(profile.activityLevel as ActivityLevel)
  )
    return null;
  const snapshot = version?.profileSnapshot as { conditions?: string[] } | null;
  const inputs = {
    age: profile.age!,
    weightKg: profile.weightKg!,
    heightCm: profile.heightCm!,
    biologicalSex: profile.biologicalSex === 'MALE' ? ('MALE' as const) : ('FEMALE' as const),
    activityLevel: profile.activityLevel as ActivityLevel,
    goal: profile.goal as Goal,
    hasPregnantCondition: snapshot?.conditions?.includes('PREGNANT') ?? false,
  };
  const calculated = calculateDailyTargetBreakdown(inputs);
  const source = clinicalEvidenceSourceByCode('MIFFLIN_ST_JEOR_1990')!;
  return {
    ...calculated,
    inputs,
    recordedTarget: profile.dailyCalorieTarget ?? null,
    sexTermBasis: inputs.hasPregnantCondition
      ? 'PREGNANCY_OVERRIDE'
      : profile.biologicalSex === 'MALE' || profile.biologicalSex === 'FEMALE'
        ? 'RECORDED_SEX'
        : 'FEMALE_DEFAULT',
    sourceTitle: source.title,
    sourceUrl: source.canonicalUrl,
  };
}
