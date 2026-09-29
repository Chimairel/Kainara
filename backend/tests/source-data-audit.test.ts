import assert from 'node:assert/strict';
import test from 'node:test';
import { recoverSourceIngredientMeasurement } from '../src/domain/source-ingredient-recovery.policy';
import { sourceDataAuditLabel } from '../src/domain/source-data-audit.policy';

test('only explicit source text repairs an ingredient amount or unit', () => {
  assert.deepEqual(recoverSourceIngredientMeasurement({ name: 'lb. Spaghetti', quantity: 0.25, unit: null }, 4), {
    ingredient: { name: 'lb. Spaghetti', quantity: 0.25, unit: 'lb',
      sourceDataAdjustment: 'CODEX_SOURCE_TEXT_MEASUREMENT_V1',
      sourceQuantityBeforeAdjustment: 0.25, sourceUnitBeforeAdjustment: null },
    method: 'UNIT_FROM_SOURCE_TEXT',
  });
  const half = recoverSourceIngredientMeasurement({ name: '½ lb. ground pork', quantity: 0, unit: null }, 4);
  assert.equal(half.ingredient.quantity, 0.125);
  assert.equal(half.ingredient.unit, 'lb');
  assert.equal(recoverSourceIngredientMeasurement({ name: 'salt to taste', quantity: 0, unit: null }, 4).method, null);
  assert.equal(recoverSourceIngredientMeasurement(half.ingredient, 4).method, null);
});

test('Codex corrections have an explicit backend audit label', () => {
  assert.equal(sourceDataAuditLabel({ dataCompletionAudit: { version: 'CODEX_PANLASANG_DATA_AUDIT_V1',
    operations: ['MISSING_SOURCE_NUTRITION_RECORDED_AS_NULL'] } }),
  'Codex data audit · source nutrition unavailable');
  assert.equal(sourceDataAuditLabel({ dataCompletionAudit: { version: 'CODEX_PANLASANG_DATA_AUDIT_V1',
    operations: ['CODEX_SOURCE_TEXT_MEASUREMENT_V1'] } }),
  'Codex data audit · source quantities recovered');
  assert.equal(sourceDataAuditLabel({ dataCompletionAudit: { version: 'CODEX_PANLASANG_DATA_AUDIT_V1',
    operations: ['CODEX_SIMILAR_RECIPE_ESTIMATE_V1'] } }),
  'Codex nutrition estimate · comparable recipes');
  assert.equal(sourceDataAuditLabel({ calories: 500 }), null);
});
