import { z } from 'zod';
import { onboardingProfileSchema } from '../../validation/onboarding.schemas';
import { calculateDailyTarget } from '../../lib/calculations';

const fields = onboardingProfileSchema.shape;
/** Share onboarding field bounds and cross-field rules; never accept derived targets. */
export const testMemberProfileSchema = z
  .object({
    age: fields.age.unwrap().default(26),
    biologicalSex: fields.biologicalSex.unwrap().default('MALE'),
    heightCm: fields.heightCm.unwrap().default(170),
    weightKg: fields.weightKg.unwrap().default(65),
    targetWeightKg: fields.targetWeightKg.unwrap().default(65),
    goal: fields.goal.unwrap().default('MAINTAIN'),
    activityLevel: fields.activityLevel.unwrap().default('SEDENTARY'),
    dietaryPreference: fields.dietaryPreference.unwrap().default('OMNIVORE'),
    ricePreference: fields.ricePreference.unwrap().default('FLEXIBLE'),
    foodCulture: fields.foodCulture.unwrap().default('Filipino'),
    shoppingDayOfWeek: fields.shoppingDayOfWeek.unwrap().default(6),
  })
  .strict()
  .superRefine((profile, context) => {
    const validation = onboardingProfileSchema.safeParse(profile);
    if (!validation.success)
      for (const issue of validation.error.issues)
        context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  });
export type TestMemberProfile = z.infer<typeof testMemberProfileSchema>;

export function buildTestMemberProfile(settings?: TestMemberProfile, pregnant = false) {
  const selected = testMemberProfileSchema.parse(settings ?? { biologicalSex: pregnant ? 'FEMALE' : 'MALE' });
  if (pregnant && selected.biologicalSex !== 'FEMALE') throw new Error('Pregnancy requires a female profile.');
  return {
    ...selected,
    ricePreferenceProvenance: 'USER_SELECTED' as const,
    shoppingDayGroup:
      selected.shoppingDayOfWeek === 0 || selected.shoppingDayOfWeek === 6
        ? ('WEEKEND' as const)
        : ('WEEKDAY' as const),
    dailyCalorieTarget: calculateDailyTarget({ ...selected, hasPregnantCondition: pregnant }).dailyCalorieTarget,
    revision: 0,
    safetyRevision: 0,
  };
}
