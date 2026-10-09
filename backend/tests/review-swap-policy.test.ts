import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertReviewSwapClaim,
  reviewSwapVersion,
  requiresExplicitReplacementReview,
} from '../src/domain/review-swap.policy';
import { reviewSwapBodySchema } from '../src/validation/review-swap.schemas';

const now = new Date('2026-10-09T10:00:00Z');
const claim = {
  status: 'PENDING_REVIEW',
  supersededByMealPlanId: null,
  claimedByNutritionistId: 'rnd',
  claimedAt: now,
};

test('RND-selected pending replacements retain manual review holds; ordinary fallbacks and final decisions do not', () => {
  const selectionEvidence = { fallbackReasonCode: 'RND_SELECTED_REPLACEMENT' };
  assert.equal(requiresExplicitReplacementReview({ status: 'PENDING_REVIEW', selectionEvidence }), true);
  for (const status of ['APPROVED', 'REJECTED', 'CANCELLED'])
    assert.equal(requiresExplicitReplacementReview({ status, selectionEvidence }), false);
  for (const evidence of [
    null,
    [],
    'RND_SELECTED_REPLACEMENT',
    {},
    { fallbackReasonCode: 'SHOPPING_DEADLINE_WIDER_TOLERANCE' },
  ])
    assert.equal(requiresExplicitReplacementReview({ status: 'PENDING_REVIEW', selectionEvidence: evidence }), false);
});
test('selected replacement requires an active claim on an unsuperseded pending slot', () => {
  assert.doesNotThrow(() => assertReviewSwapClaim(claim, 'rnd', now));
  for (const changed of [
    { status: 'APPROVED' },
    { supersededByMealPlanId: 'replacement' },
    { claimedByNutritionistId: 'other' },
    { claimedAt: null },
    { claimedAt: new Date(now.getTime() - 31 * 60_000) },
  ])
    assert.throws(() => assertReviewSwapClaim({ ...claim, ...changed }, 'rnd', now));
});
test('preview version changes with recipe nutrition, serving or member safety revision', () => {
  const meal = {
    id: 'meal',
    status: 'PENDING_REVIEW',
    mealName: 'Soup',
    calories: 600,
    proteinG: 30,
    carbsG: 80,
    fatG: 15,
    libraryMealId: 'library',
    baseRecipeSignature: 'base',
    composedServingSignature: 'serving',
    supersededByMealPlanId: null,
  };
  const profile = { revision: 1, safetyRevision: 2 };
  const version = reviewSwapVersion(meal, profile);
  assert.equal(version, reviewSwapVersion({ ...meal }, { ...profile }));
  for (const changed of [
    { calories: 601 },
    { composedServingSignature: 'changed' },
    { status: 'CANCELLED' },
    { supersededByMealPlanId: 'new' },
  ])
    assert.notEqual(version, reviewSwapVersion({ ...meal, ...changed }, profile));
  assert.notEqual(version, reviewSwapVersion(meal, { ...profile, safetyRevision: 3 }));
  assert.notEqual(version, reviewSwapVersion(meal, { ...profile, revision: 2 }));
});
test('swap input accepts a version-bound choice and rationale, never recipe edits or actor identities', () => {
  const input = {
    libraryMealId: 'library',
    expectedVersion: 'a'.repeat(64),
    expectedRecipeSignature: 'b'.repeat(64),
    expectedEvidenceRevision: 2,
    note: 'Reviewed eligible replacement.',
  };
  assert.equal(reviewSwapBodySchema.safeParse(input).success, true);
  for (const changed of [
    { note: ' ' },
    { note: 'short' },
    { expectedVersion: 'old' },
    { expectedEvidenceRevision: -1 },
    { nutritionistId: 'spoofed' },
    { ingredients: [] },
    { calories: 700 },
  ])
    assert.equal(reviewSwapBodySchema.safeParse({ ...input, ...changed }).success, false);
});
