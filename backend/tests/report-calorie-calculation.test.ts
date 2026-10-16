import assert from 'node:assert/strict';
import test from 'node:test';
import { reportCalorieCalculation } from '../src/domain/report-calorie-calculation.policy';
import { calculateDailyTarget } from '../src/lib/calculations';

const profile = {
  age: 30,
  biologicalSex: 'MALE',
  heightCm: 170,
  weightKg: 65,
  activityLevel: 'LIGHTLY_ACTIVE',
  goal: 'MAINTAIN',
  dailyCalorieTarget: 2142,
};
test('report calories reproduce planning using unrounded intermediate values and saved inputs', () => {
  const result = reportCalorieCalculation({ profileSnapshot: { profile } })!;
  assert.equal(result.rawBmr, 1567.5);
  assert.equal(result.rawTdee, 2155.3125);
  assert.equal(result.dailyCalorieTarget, 2155);
  assert.equal(result.recordedTarget, 2142, 'A stored target is never silently overwritten by a display calculation.');
  const expected = calculateDailyTarget({
    ...profile,
    goal: 'MAINTAIN',
    activityLevel: 'LIGHTLY_ACTIVE',
    biologicalSex: 'MALE',
  });
  assert.deepEqual({ bmr: result.bmr, tdee: result.tdee, dailyCalorieTarget: result.dailyCalorieTarget }, expected);
});
test('archives use their own sex, activity and goal; missing snapshots do not borrow the live profile', () => {
  assert.equal(reportCalorieCalculation(null), null);
  assert.equal(reportCalorieCalculation({ profileSnapshot: {} }), null);
  assert.equal(
    reportCalorieCalculation({ profileSnapshot: { profile: { ...profile, activityLevel: 'UNKNOWN' } } }),
    null
  );
  const old = reportCalorieCalculation({
    profileSnapshot: {
      profile: { ...profile, biologicalSex: 'FEMALE', goal: 'LOSE_WEIGHT', activityLevel: 'SEDENTARY' },
    },
  })!;
  assert.equal(old.sexTerm, -161);
  assert.equal(old.activityMultiplier, 1.2);
  assert.equal(old.goalAdjustment, -500);
  const pregnant = reportCalorieCalculation({ profileSnapshot: { profile, conditions: ['PREGNANT'] } })!;
  assert.equal(pregnant.sexTerm, -161, 'Match the actual calculator pregnancy override.');
});
