import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recipeBatchReviewIssues,
  recipeBatchReviewSchema,
  recipeReviewEvidenceHash,
} from '../src/domain/recipe-batch-review.policy';
import { recordedRawRecipeReviewWhere } from '../src/services/recorded-recipe-review.service';
import { baseMealAdmissionMatches } from '../src/services/meal-base-admission.service';

const evidence = {
  description: 'Steam the fish until cooked.',
  ingredients: [{ name: 'Fish', quantity: 100, unit: 'g' }],
  calories: 100,
  proteinG: 20,
  carbsG: 0,
  fatG: 2,
};
const item = {
  id: 'source',
  revisionKey: 'revision',
  evidenceHash: recipeReviewEvidenceHash(evidence),
  rationale: 'Reviewed ingredients and published serving.',
};

test('batch approval requires explicit review, bounded items and unique identities', () => {
  assert.equal(recipeBatchReviewSchema.safeParse({ confirmedReview: false, items: [item] }).success, false);
  assert.equal(recipeBatchReviewSchema.safeParse({ confirmedReview: true, items: [item, item] }).success, false);
  assert.equal(
    recipeBatchReviewSchema.safeParse({
      confirmedReview: true,
      items: Array.from({ length: 26 }, (_, i) => ({ ...item, id: String(i) })),
    }).success,
    false
  );
  assert.equal(
    recipeBatchReviewSchema.safeParse({ confirmedReview: true, items: [item], reviewedByNutritionistId: 'spoofed' })
      .success,
    false
  );
  assert.equal(recipeBatchReviewSchema.safeParse({ confirmedReview: true, items: [item] }).success, true);
});
test('automated completeness checks retain valid zero macros but reject missing amounts, negative nutrients and missing preparation', () => {
  assert.deepEqual(recipeBatchReviewIssues(evidence), []);
  assert.ok(
    recipeBatchReviewIssues({ ...evidence, ingredients: [{ name: 'Fish', quantity: null, unit: 'g' }] }).length
  );
  assert.ok(recipeBatchReviewIssues({ ...evidence, fatG: -1 }).length);
  assert.ok(recipeBatchReviewIssues({ ...evidence, description: '' }).length);
});
test('review evidence fingerprint changes when ingredients or nutrition change', () => {
  assert.notEqual(recipeReviewEvidenceHash(evidence), recipeReviewEvidenceHash({ ...evidence, calories: 101 }));
  assert.notEqual(recipeReviewEvidenceHash(evidence), recipeReviewEvidenceHash({ ...evidence, ingredients: [] }));
});
test('member source catalogue fails closed without recorded reviews and binds identities to exact revisions', async () => {
  let query: unknown;
  const db = {
    mealBaseVerification: {
      findMany: async (input: unknown) => {
        query = input;
        return [];
      },
    },
  };
  assert.deepEqual(await recordedRawRecipeReviewWhere(db as never), { id: { in: [] } });
  const where = (query as { where: Record<string, unknown> }).where;
  assert.equal(where.status, 'VERIFIED');
  assert.deepEqual(where.reviewedByNutritionistId, { not: null });
  assert.deepEqual(where.reviewedAt, { not: null });
  const reviewed = {
    mealBaseVerification: { findMany: async () => [{ targetId: 'source', revisionKey: 'exact-revision' }] },
  };
  assert.deepEqual(await recordedRawRecipeReviewWhere(reviewed as never), {
    OR: [{ id: 'source', contentSignature: 'exact-revision' }],
  });
});
test('strict member library admission rejects source availability alone and accepts an exact recorded review', () => {
  const meal = {
    id: 'meal',
    status: 'APPROVED',
    recipeSignature: 'serving',
    description: 'Preparation',
    sourceRawRecipeCandidateId: 'source',
    sourceRawRecipeCandidate: { sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE', contentSignature: 'current' },
  };
  assert.equal(baseMealAdmissionMatches(meal, new Set(), true), false);
  assert.equal(baseMealAdmissionMatches(meal, new Set(['RAW_RECIPE:source:stale']), true), false);
  assert.equal(baseMealAdmissionMatches(meal, new Set(['RAW_RECIPE:source:current']), true), true);
});
