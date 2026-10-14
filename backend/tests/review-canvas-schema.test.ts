import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewCanvasLayoutSchema } from '../src/validation/review-canvas.schema';
import { mealFlagSubmissionSchema } from '../src/validation/meal-review.schemas';

const layout = { version: 1, sheets: [{ title: 'Meal evidence', x: 120, y: -50 }],
  view: { x: -120, y: 44, scale: 0.8 }, selected: 0, mode: 'select' };
test('canvas accepts presentation only and rejects clinical payloads, unbounded or nonfinite coordinates', () => {
  assert.deepEqual(reviewCanvasLayoutSchema.parse(layout), layout);
  for (const value of [
    { ...layout, detail: { clinical: 'untrusted' } },
    { ...layout, view: { ...layout.view, scale: 0 } },
    { ...layout, view: { ...layout.view, x: Infinity } },
    { ...layout, sheets: [{ title: 'X', x: 100001, y: 0 }] },
    { ...layout, selected: 50 }, { ...layout, mode: 'write' },
    { ...layout, sheets: Array(51).fill(layout.sheets[0]) },
  ]) assert.equal(reviewCanvasLayoutSchema.safeParse(value).success, false);
});
test('approval flags require a current version and complete structured reasons', () => {
  const valid = { expectedVersion: 'a'.repeat(64), notes: { category: 'NUTRITION', affectedFields: ['sodium'],
    explanation: 'The measured sodium evidence needs independent review.', reference: 'Saved ingredient record.',
    proposedCorrection: 'Verify measured sodium amounts.' } };
  assert.equal(mealFlagSubmissionSchema.safeParse(valid).success, true);
  assert.equal(mealFlagSubmissionSchema.safeParse({ ...valid, expectedVersion: 'stale' }).success, false);
  assert.equal(mealFlagSubmissionSchema.safeParse({ ...valid, notes: { ...valid.notes, explanation: '' } }).success, false);
  assert.equal(mealFlagSubmissionSchema.safeParse({ ...valid, notes: { ...valid.notes, affectedFields: [] } }).success, false);
});
