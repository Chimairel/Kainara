import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeminiGenerationConfig,
  GEMINI_MODEL_SEQUENCE,
  getGeminiModelSequence,
} from '../src/domain/gemini-model.policy';

test('[TEST-150] Gemini fallback policy uses explicit current GA model IDs', () => {
  assert.deepEqual(GEMINI_MODEL_SEQUENCE, [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
  ]);
  assert.equal(new Set(GEMINI_MODEL_SEQUENCE).size, GEMINI_MODEL_SEQUENCE.length);
  assert.ok(GEMINI_MODEL_SEQUENCE.every((model) => !model.includes('preview')));
  assert.ok(GEMINI_MODEL_SEQUENCE.every((model) => !model.endsWith('-latest')));
});

test('Routine estimates/extraction use Lite; complex and unknown tasks never downgrade to Lite', () => {
  for (const usage of [
    { operation: 'OUTSIDE_MEAL_ESTIMATE' },
    { operation: 'MEAL_PLAN_CORPUS_LOOKUP' },
    { operation: 'OTHER', purpose: 'FNRI_LOOKUP_ESTIMATE' },
    { operation: 'OTHER', purpose: 'HEALTH_TERM_NORMALIZATION' },
  ])
    assert.equal(getGeminiModelSequence(usage)[0], 'gemini-3.5-flash-lite');
  for (const usage of [
    { operation: 'MEAL_PLAN_GENERATION' },
    { operation: 'MEAL_REPLACEMENT' },
    { operation: 'NUTRITION_REPORT' },
    { operation: 'OTHER', purpose: 'UNRECOGNIZED_TASK' },
    { operation: 'MEAL_REPLACEMENT', purpose: 'FNRI_LOOKUP_ESTIMATE' },
    {},
  ]) {
    const models = getGeminiModelSequence(usage);
    assert.equal(models[0], 'gemini-3.6-flash');
    assert.equal(models.includes('gemini-3.5-flash-lite'), false);
    assert.equal(new Set(models).size, models.length);
  }
});

test('[TEST-150] Gemini 3 generation config excludes deprecated sampling parameters', () => {
  const config = buildGeminiGenerationConfig();
  assert.deepEqual(config, { responseMimeType: 'application/json' });
  assert.equal('temperature' in config, false);
  assert.equal('topP' in config, false);
  assert.equal('topK' in config, false);
});
