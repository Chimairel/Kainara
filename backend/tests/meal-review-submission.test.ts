import assert from 'node:assert/strict';
import test from 'node:test';
import { mealFlagSubmissionSchema, mealReviewSubmissionSchema } from '../src/validation/meal-review.schemas';

const notes = {
  category: 'NUTRITION',
  affectedFields: ['sodiumMg'],
  explanation: 'The sodium evidence requires an independent source review.',
  reference: 'Recorded source composition and measured ingredient amounts.',
  proposedCorrection: 'Reconcile the measured grams with the cited source evidence.',
};
test('HTTP flags require a bounded structured concern and exact version, excluding injected review identities', () => {
  assert.equal(mealFlagSubmissionSchema.safeParse({ expectedVersion: 'a'.repeat(64), notes }).success, true);
  for (const missing of Object.keys(notes)) {
    const incomplete = { ...notes } as Record<string, unknown>;
    delete incomplete[missing];
    assert.equal(
      mealFlagSubmissionSchema.safeParse({ expectedVersion: 'a'.repeat(64), notes: incomplete }).success,
      false
    );
  }
  assert.equal(mealFlagSubmissionSchema.safeParse({ reason: notes.explanation }).success, false);
  assert.equal(
    mealFlagSubmissionSchema.safeParse({ expectedVersion: 'a'.repeat(64), notes, flaggedByAdminUserId: 'spoofed' })
      .success,
    false
  );
  assert.equal(
    mealFlagSubmissionSchema.safeParse({ expectedVersion: 'a'.repeat(64), notes: { ...notes, affectedFields: [] } })
      .success,
    false
  );
});
test('review confirmation cannot omit evidence acknowledgement or concern resolutions', () => {
  const input = {
    expectedVersion: 'a'.repeat(64),
    rationale: 'Independent review of the exact serving and concerns.',
    evidenceReviewed: true,
    riceRoleReviewed: true,
    resolutions: [{ reportId: 'report', rationale: 'Checked the source nutrition against the measured serving.' }],
  };
  assert.equal(mealReviewSubmissionSchema.safeParse(input).success, true);
  assert.equal(mealReviewSubmissionSchema.safeParse({ ...input, evidenceReviewed: false }).success, false);
  assert.equal(mealReviewSubmissionSchema.safeParse({ ...input, riceRoleReviewed: undefined }).success, false);
  assert.equal(mealReviewSubmissionSchema.safeParse({ ...input, resolutions: [] }).success, false);
  assert.equal(mealReviewSubmissionSchema.safeParse({ ...input, nutritionistId: 'spoofed-reviewer' }).success, false);
});
