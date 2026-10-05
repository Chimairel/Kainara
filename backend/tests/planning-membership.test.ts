import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresHealthPlanning, reportActivationTier } from '../src/domain/planning-membership.policy';
import type { Prisma } from '@prisma/client';

const report = (profile: Record<string, unknown> = {}, declarations: Record<string, unknown> = {}) => ({
  profileSnapshot: {
    profile: {
      weightKg: 60,
      dailyCalorieTarget: 2000,
      goal: 'MAINTAIN',
      activityLevel: 'SEDENTARY',
      safetyRevision: 1,
      ...profile,
    },
    conditions: [],
    allergens: [],
    otherConditions: '',
    otherAllergies: '',
    ...declarations,
  } as Prisma.JsonValue,
});

test('only supported allergy-only profiles qualify for deterministic Lifestyle exclusions', () => {
  for (const allergy of ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN', 'EGGS']) {
    assert.equal(requiresHealthPlanning({ allergies: [allergy], healthConditions: ['NONE'] }), false);
    assert.equal(
      requiresHealthPlanning({
        safetyEntries: [{ domain: 'ALLERGY', canonicalCode: allergy, supportState: 'SUPPORTED' }],
      }),
      false
    );
    assert.equal(requiresHealthPlanning({ allergies: [allergy], healthConditions: ['DIABETES'] }), true);
  }
  for (const source of [
    { allergies: ['SOY'] },
    { otherAllergies: 'shrimp paste' },
    { otherConditions: 'gout' },
    { healthConditions: ['HEART_CONDITION'] },
    { safetyEntries: [{ domain: 'ALLERGY', canonicalCode: 'SHELLFISH', supportState: 'PENDING_REVIEW' }] },
    { safetyEntries: [{ domain: 'INTOLERANCE', canonicalCode: 'LACTOSE', supportState: 'RECOGNIZED_UNSUPPORTED' }] },
  ])
    assert.equal(requiresHealthPlanning(source), true);
});

test('Free applies weight-only changes; mixed changes and standalone calorie edits require Lifestyle', () => {
  const before = report();
  assert.equal(reportActivationTier(report({ weightKg: 62, dailyCalorieTarget: 2025 }), before, false), null);
  assert.equal(reportActivationTier(report(), before, false), null);
  assert.equal(reportActivationTier(report({ dailyCalorieTarget: 2200 }), before, false), 'LIFESTYLE');
  for (const update of [
    { activityLevel: 'ACTIVE' },
    { goal: 'BUILD_MUSCLE' },
    { heightCm: 172 },
    { shoppingDayOfWeek: 4 },
  ]) {
    assert.equal(reportActivationTier(report({ weightKg: 62, ...update }), before, false), 'LIFESTYLE');
  }
  assert.equal(
    reportActivationTier(report({ weightKg: 62, safetyRevision: 2 }, { allergens: ['SHELLFISH'] }), before, false),
    'LIFESTYLE'
  );
  assert.equal(
    reportActivationTier(
      report({ weightKg: 62 }, { allergens: ['SHELLFISH'] }),
      report({}, { allergens: ['SHELLFISH'] }),
      false
    ),
    null
  );
  assert.equal(reportActivationTier(report({ weightKg: 62 }), before, true), 'HEALTH');
  assert.equal(
    reportActivationTier(report({ weightKg: 62 }), report({}, { conditions: ['DIABETES'] }), false),
    'HEALTH'
  );
  assert.equal(reportActivationTier(report({ weightKg: 62 }, { otherAllergies: 'soy' }), before, false), 'HEALTH');
  assert.equal(
    reportActivationTier(report(), null, false),
    'LIFESTYLE',
    'Missing prior snapshot is not proof of a weight-only update.'
  );
});
