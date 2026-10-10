import assert from 'node:assert/strict';
import test from 'node:test';
import { testMemberProfileSchema, buildTestMemberProfile } from '../src/services/dev-test-accounts/member-profile';
import { accountSchema } from '../src/services/dev-test-accounts/config';
import { calculateDailyTarget } from '../src/lib/calculations';

test('legacy test members retain defaults, with a female pregnancy baseline', () => {
  const defaults = buildTestMemberProfile();
  assert.equal(defaults.age, 26);
  assert.equal(defaults.weightKg, 65);
  assert.equal(defaults.goal, 'MAINTAIN');
  assert.equal(buildTestMemberProfile(undefined, true).biologicalSex, 'FEMALE');
});
test('custom test profiles calculate targets and exact shopping schedules from selected factors', () => {
  const selected = testMemberProfileSchema.parse({
    age: 45,
    biologicalSex: 'FEMALE',
    heightCm: 165,
    weightKg: 72,
    targetWeightKg: 65,
    goal: 'LOSE_WEIGHT',
    activityLevel: 'ACTIVE',
    dietaryPreference: 'PESCATARIAN',
    ricePreference: 'NO_RICE',
    shoppingDayOfWeek: 2,
    foodCulture: 'Filipino',
  });
  const profile = buildTestMemberProfile(selected);
  assert.equal(profile.dailyCalorieTarget, calculateDailyTarget(selected).dailyCalorieTarget);
  assert.equal(profile.shoppingDayGroup, 'WEEKDAY');
  assert.equal(profile.shoppingDayOfWeek, 2);
  assert.equal(profile.dietaryPreference, 'PESCATARIAN');
  assert.notEqual(profile.dailyCalorieTarget, buildTestMemberProfile().dailyCalorieTarget);
});
test('test profiles enforce ordinary onboarding bounds and coherent goal/target weight', () => {
  for (const patch of [
    { age: 17 },
    { age: 101 },
    { heightCm: 99 },
    { weightKg: 301 },
    { weightKg: NaN },
    { activityLevel: 'UNKNOWN' },
    { shoppingDayOfWeek: 7 },
    { goal: 'MAINTAIN', targetWeightKg: 64 },
    { goal: 'LOSE_WEIGHT', targetWeightKg: 66 },
    { goal: 'GAIN_WEIGHT', targetWeightKg: 64 },
    { goal: 'BUILD_MUSCLE', targetWeightKg: 64 },
    { dailyCalorieTarget: 1 },
    { planningReportVersion: 999 },
  ])
    assert.equal(testMemberProfileSchema.safeParse(patch).success, false, JSON.stringify(patch));
  assert.equal(testMemberProfileSchema.safeParse({ weightKg: 54.5, targetWeightKg: 54.5 }).success, true);
});
test('pregnancy cannot create contradictory male profile settings', () => {
  assert.equal(
    accountSchema.safeParse({
      alias: 'pregnant',
      name: 'Test',
      role: 'USER',
      member: { conditions: ['PREGNANT'], profile: {} },
    }).success,
    false
  );
  assert.equal(
    accountSchema.safeParse({
      alias: 'pregnant',
      name: 'Test',
      role: 'USER',
      member: { conditions: ['PREGNANT'], profile: { biologicalSex: 'FEMALE' } },
    }).success,
    true
  );
});
