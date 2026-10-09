import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeConditionPlanningAssessment,
  CONDITION_PLANNING_ASSESSMENT_POLICY,
} from '../src/domain/condition-planning-assessment.policy';
import {
  adaptUserSafetyRestrictions,
  hasDeclaredSafetyRestrictions,
} from '../src/domain/structured-restriction.adapter';
import { requiresHealthPlanning } from '../src/domain/planning-membership.policy';
import { mealApprovalSafetyScope } from '../src/domain/meal-approval-scope.policy';
import { invalidateConditionPlanningAssessments } from '../src/services/profile-revision.service';

const entry = {
  id: 'condition',
  userId: 'member',
  domain: 'CONDITION',
  canonicalCode: null,
  displayName: 'Reviewed unrelated condition',
  originalText: 'Reviewed unrelated condition',
  normalizedText: 'reviewed unrelated condition',
  supportState: 'PENDING_REVIEW',
};
const assessment = {
  policyVersion: CONDITION_PLANNING_ASSESSMENT_POLICY,
  result: 'NO_ADDITIONAL_RESTRICTIONS',
  entryId: entry.id,
  userId: entry.userId,
  normalizedText: entry.normalizedText,
  profileRevision: 3,
  safetyRevision: 2,
  reviewId: 'signed-review',
  reviewerId: 'rnd',
  reviewerName: 'Recorded RND',
  assessedAt: '2026-10-09T00:00:00.000Z',
  rationale: 'Reviewed the condition, treatment and handling needs.',
  reviewedDietaryAndTreatmentEffects: true,
  reviewedFoodborneIllnessRisk: true,
};
const assessed = { ...entry, mealPlanningAssessment: assessment };

test('an active RND assessment removes only its condition from effective restrictions and preserves the declaration', () => {
  const source = { safetyEntries: [assessed], otherConditions: entry.originalText };
  assert.equal(requiresHealthPlanning(source), false);
  assert.equal(hasDeclaredSafetyRestrictions(source), false);
  const effective = adaptUserSafetyRestrictions(source);
  assert.deepEqual(effective.customConditions, []);
  assert.equal(effective.displayEntries[0].label, entry.displayName);
  assert.equal(effective.displayEntries[0].mealPlanningAssessment?.reviewerName, 'Recorded RND');
  assert.deepEqual(adaptUserSafetyRestrictions({ ...source, useConditionAssessments: false }).customConditions, [
    entry.displayName,
  ]);
  assert.equal(entry.supportState, 'PENDING_REVIEW');
});

test('heart conditions and allergies remain enforced alongside an assessed unrelated condition', () => {
  const source = {
    safetyEntries: [
      assessed,
      {
        domain: 'CONDITION',
        canonicalCode: 'HEART_CONDITION',
        displayName: 'Heart condition',
        supportState: 'RECOGNIZED_UNSUPPORTED',
      },
      { domain: 'ALLERGY', canonicalCode: 'NUTS', displayName: 'Nuts', supportState: 'SUPPORTED' },
    ],
  };
  const restrictions = adaptUserSafetyRestrictions(source);
  assert.deepEqual(restrictions.conditions, ['HEART_CONDITION']);
  assert.deepEqual(restrictions.allergies, ['NUTS']);
  assert.equal(requiresHealthPlanning(source), true);
});

test('known dietary conditions, NONE, vague conditions and food restrictions cannot use the exception', () => {
  for (const patch of [
    { canonicalCode: 'DIABETES' },
    { canonicalCode: 'HEART_CONDITION' },
    { canonicalCode: 'KIDNEY_DISEASE' },
    { displayName: 'Gout' },
    { originalText: 'acid reflux' },
    { canonicalCode: 'NONE' },
    { domain: 'ALLERGY' },
    { domain: 'INTOLERANCE' },
    { supportState: 'NEEDS_CLARIFICATION' },
    { supportState: 'INVALID' },
  ])
    assert.equal(activeConditionPlanningAssessment({ ...assessed, ...patch }), null);
});

test('copied, malformed, incomplete and invalidated assessments fail closed', () => {
  for (const patch of [
    null,
    {},
    { ...assessment, entryId: 'other' },
    { ...assessment, userId: 'other' },
    { ...assessment, normalizedText: 'changed' },
    { ...assessment, reviewedFoodborneIllnessRisk: false },
    { ...assessment, rationale: 'short' },
    { ...assessment, profileRevision: -1 },
    { ...assessment, assessedAt: 'invalid' },
  ])
    assert.equal(hasDeclaredSafetyRestrictions({ safetyEntries: [{ ...entry, mealPlanningAssessment: patch }] }), true);
});

test('approval scopes distinguish active assessments from the original and invalidated restrictions', () => {
  const profile = { conditions: [], allergens: [], safetyEntries: [entry] };
  const original = mealApprovalSafetyScope(profile);
  const current = mealApprovalSafetyScope({ ...profile, safetyEntries: [assessed] });
  assert.equal(original.supported, false);
  assert.equal(current.supported, true);
  assert.notEqual(current.key, original.key);
  assert.equal(
    mealApprovalSafetyScope({ ...profile, safetyEntries: [{ ...assessed, mealPlanningAssessment: null }] }).key,
    original.key
  );
});

test('evidence changes clear active assessments, invalidate the reviewed profile version and retain history', async () => {
  const calls: string[] = [];
  const tx = {
    safetyProfileEntry: {
      updateMany: async () => {
        calls.push('clear');
        return { count: 1 };
      },
    },
    userProfile: {
      update: async () => {
        calls.push('profile-revision');
      },
    },
    nutritionReport: {
      updateMany: async () => {
        calls.push('report-stale');
      },
    },
    auditEvent: {
      create: async ({ data }: any) => {
        assert.equal(data.metadata.reason, 'TREATMENT_CHANGED');
        calls.push('audit');
      },
    },
  };
  await invalidateConditionPlanningAssessments(tx as any, 'member', 'TREATMENT_CHANGED', true);
  assert.deepEqual(calls, ['clear', 'profile-revision', 'report-stale', 'audit']);
});

test('unassessed members retain their existing revisions and clinical behavior on evidence changes', async () => {
  const tx = { safetyProfileEntry: { updateMany: async () => ({ count: 0 }) } };
  await invalidateConditionPlanningAssessments(tx as any, 'member', 'UNCHANGED', true);
});
