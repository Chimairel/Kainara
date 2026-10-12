import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasCurrentRiceEvidence } from '../src/domain/serving-evidence.policy';

test('approval and member availability reject obsolete or missing rice evidence', () => {
  const rice = { componentType: 'COOKED_RICE', evidenceSource: 'FNRI:1', foodItem: { compositionRevision: 1 } };
  assert.equal(hasCurrentRiceEvidence([rice]), true);
  assert.equal(hasCurrentRiceEvidence([{ ...rice, foodItem: { compositionRevision: 2 } }]), false);
  assert.equal(hasCurrentRiceEvidence([{ ...rice, foodItem: null }]), false);
  assert.equal(hasCurrentRiceEvidence([{ ...rice, evidenceSource: 'FNRI:01' }]), false);
});

test('meals without paired rice do not require rice evidence', () => {
  assert.equal(hasCurrentRiceEvidence(), true);
  assert.equal(
    hasCurrentRiceEvidence([{ componentType: 'BASE_RECIPE', evidenceSource: 'RECIPE', foodItem: null }]),
    true
  );
});
