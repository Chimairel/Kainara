import assert from 'node:assert/strict';
import test from 'node:test';
import { assertMealReviewContext, reviewContextKey } from '../src/domain/meal-review-context.policy';
import { nutritionistReviewActionSchema, claimMealReviewSchema } from '../src/validation/nutritionist.schemas';
import { reviewSwapBodySchema } from '../src/validation/review-swap.schemas';

test('review context ignores object insertion order but binds nested clinical and plate values', () => {
  const original = { profile: { revision: 4, weightKg: 65 }, meal: { grams: 100 }, documents: [{ revision: 2 }] };
  const key = reviewContextKey(original);
  assert.equal(key, reviewContextKey({ documents: original.documents, meal: original.meal, profile: { weightKg: 65, revision: 4 } }));
  for (const changed of [
    { ...original, profile: { revision: 5, weightKg: 65 } },
    { ...original, profile: { revision: 4, weightKg: 64 } },
    { ...original, meal: { grams: 101 } },
    { ...original, documents: [{ revision: 3 }] },
  ]) assert.notEqual(reviewContextKey(changed), key);
  assert.doesNotThrow(() => assertMealReviewContext(key, key));
  for (const stale of [undefined, '', 'a'.repeat(64)]) assert.throws(() => assertMealReviewContext(stale, key), { errorCode: 'MEAL_REVIEW_CONTEXT_CHANGED' });
});

test('HTTP review contracts accept a bounded context key and reject injected snapshots', () => {
  for (const action of ['approve', 'reject']) {
    const body = { action, note: 'Recorded clinical rationale', expectedContextKey: 'b'.repeat(64) };
    assert.equal(nutritionistReviewActionSchema.safeParse(body).success, true);
    assert.equal(nutritionistReviewActionSchema.safeParse({ ...body, expectedContextKey: 'invalid' }).success, false);
    assert.equal(nutritionistReviewActionSchema.safeParse({ ...body, profileSnapshot: {} }).success, false);
  }
  assert.equal(claimMealReviewSchema.safeParse(undefined).success, true); // Legacy off-mode clients.
  assert.equal(claimMealReviewSchema.safeParse({ expectedContextKey: 'c'.repeat(64) }).success, true);
  assert.equal(reviewSwapBodySchema.safeParse({ libraryMealId: 'recipe', expectedVersion: 'a'.repeat(64), expectedRecipeSignature: 'a'.repeat(64), expectedEvidenceRevision: 1, expectedContextKey: 'c'.repeat(64), note: 'Suitable replacement rationale' }).success, true);
});
