import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFoodGuidance } from '../src/domain/food-guidance.policy';
import { adaptUserSafetyRestrictions } from '../src/domain/structured-restriction.adapter';

function guidance(
  conditions: string[] = [],
  allergies: string[] = [],
  otherConditions?: string,
  otherAllergies?: string
) {
  return buildFoodGuidance({
    dietaryPreference: 'OMNIVORE',
    restrictions: adaptUserSafetyRestrictions({
      healthConditions: conditions,
      allergies,
      otherConditions,
      otherAllergies,
    }),
  });
}
test('all supported condition combinations have saved source references and no unsupported personal ceilings', () => {
  for (const conditions of [
    [],
    ['DIABETES'],
    ['HYPERTENSION'],
    ['KIDNEY_DISEASE'],
    ['HEART_CONDITION'],
    ['PREGNANT'],
    ['KIDNEY_DISEASE', 'DIABETES', 'HYPERTENSION'],
  ]) {
    const result = guidance(conditions);
    assert.equal(result.formatVersion, 1);
    const entries = [...result.avoid, ...result.limit, ...result.choose, ...result.discuss];
    assert.ok(entries.length > 0);
    assert.ok(entries.every((item) => result.sources.some((source) => source.code === item.sourceCode)));
    if (conditions.includes('KIDNEY_DISEASE')) {
      assert.deepEqual(result.choose, []);
      assert.ok(result.discuss.some((item) => /potassium/.test(item.name)));
    }
    if (conditions.includes('DIABETES')) {
      assert.ok(result.discuss.some((item) => /carbohydrate/i.test(item.name)));
      assert.ok(!result.avoid.some((item) => /rice|carbohydrate/i.test(item.name)));
    }
  }
});
test('all predefined allergens get containing-food examples and label checks', () => {
  for (const allergen of ['DAIRY', 'NUTS', 'SHELLFISH', 'GLUTEN', 'EGGS']) {
    const result = guidance([], [allergen]);
    assert.equal(result.avoid.length, 1);
    assert.match(result.avoid[0].tip, /label/);
    assert.ok(!result.choose.some((item) => item.name === result.avoid[0].name));
  }
});
test('custom restrictions preserve original labels and suppress uncertain recommendations', () => {
  const result = guidance([], [], 'Unclassified condition', 'sesame');
  assert.equal(result.choose.length, 0);
  assert.ok(result.avoid.some((item) => item.name === 'sesame'));
  assert.ok(result.discuss.some((item) => item.name === 'Unclassified condition'));
});
test('intolerance and avoided ingredients are not described as allergies', () => {
  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: [
      { domain: 'INTOLERANCE', canonicalCode: 'DAIRY', displayName: 'DAIRY', supportState: 'SUPPORTED' },
      { domain: 'AVOIDED_INGREDIENT', canonicalCode: 'EGGS', displayName: 'EGGS', supportState: 'SUPPORTED' },
    ],
  });
  const result = buildFoodGuidance({ restrictions, dietaryPreference: 'VEGAN' });
  assert.match(result.avoid[0].reason, /intolerance/);
  assert.match(result.avoid[1].reason, /chose to exclude/);
  assert.ok(!result.choose.some((item) => /chicken|fish/.test(item.name)));
});
