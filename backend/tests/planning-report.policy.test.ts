import assert from 'node:assert/strict';
import test from 'node:test';
import type { UserProfile, NutritionReportVersion } from '@prisma/client';
import { resolvePlanningProfile, reportInputsMatch, planningInputsMatch } from '../src/domain/planning-report.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';
import { membershipFeatureCap } from '../src/domain/membership.policy';
const profile = {
  age: 26,
  biologicalSex: 'MALE',
  heightCm: 170,
  weightKg: 65,
  targetWeightKg: 65,
  goal: 'MAINTAIN',
  activityLevel: 'SEDENTARY',
  dietaryPreference: 'OMNIVORE',
  ricePreference: 'FLEXIBLE',
  dailyCalorieTarget: 2000,
  revision: 1,
  safetyRevision: 1,
  shoppingDayOfWeek: 0,
} as UserProfile;
const version = {
  profileRevision: 1,
  version: 1,
  acknowledgedAt: new Date(),
  policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
  profileSnapshot: { profile, conditions: [], allergens: [], otherConditions: '', otherAllergies: '' },
} as unknown as NutritionReportVersion;

test('unapplied ordinary edits retain the actual accepted targets and shopping day', () => {
  const live = { ...profile, revision: 2, weightKg: 80, dailyCalorieTarget: 2400, shoppingDayOfWeek: 4 };
  const planned = resolvePlanningProfile(live, version);
  assert.equal(planned.weightKg, 65);
  assert.equal(planned.dailyCalorieTarget, 2000);
  assert.equal(planned.shoppingDayOfWeek, 0);
  assert.equal(planned.revision, 1);
  assert.equal(planningInputsMatch(live, version), false);
});
test('an old report cannot hide a safety change or bypass its policy version', () => {
  assert.throws(() => resolvePlanningProfile({ ...profile, safetyRevision: 2 }, version), {
    errorCode: 'REPORT_ACKNOWLEDGEMENT_REQUIRED',
  });
  assert.throws(() => resolvePlanningProfile(profile, { ...version, policyVersion: 'old' }), {
    errorCode: 'REPORT_ACKNOWLEDGEMENT_REQUIRED',
  });
  assert.throws(() => resolvePlanningProfile(profile, { ...version, acknowledgedAt: null }), {
    errorCode: 'REPORT_ACKNOWLEDGEMENT_REQUIRED',
  });
});
test('unchanged dated reports compare actual context, not client flags or dates', () => {
  const same = {
    ...version,
    version: 2,
    generatedAt: new Date(),
    profileSnapshot: {
      profile: { ...profile, revision: 9, safetyRevision: 8 },
      conditions: [],
      allergens: [],
      otherConditions: '',
      otherAllergies: '',
    },
  } as unknown as NutritionReportVersion;
  assert.equal(reportInputsMatch(same, version), true);
  assert.equal(
    reportInputsMatch(
      { ...same, profileSnapshot: { ...(same.profileSnapshot as object), allergens: ['EGGS'] } },
      version
    ),
    false
  );
  assert.equal(
    reportInputsMatch(
      {
        ...same,
        profileSnapshot: JSON.parse(
          JSON.stringify({ ...(same.profileSnapshot as object), profile: { ...profile, goal: 'LOSE_WEIGHT' } })
        ),
      },
      version
    ),
    false
  );
});
test('Lifestyle has planning allowances and zero new review allowance', () => {
  assert.equal(membershipFeatureCap('AI_ESTIMATE', true, undefined, false), 10);
  assert.equal(membershipFeatureCap('REPLAN', true, undefined, false), 2);
  assert.equal(membershipFeatureCap('PLAN_REVIEW', true, undefined, false), 0);
  assert.equal(membershipFeatureCap('OUTSIDE_REVIEW', true, undefined, false), 0);
  assert.equal(membershipFeatureCap('PLAN_REVIEW', true, undefined, true), 1);
});
