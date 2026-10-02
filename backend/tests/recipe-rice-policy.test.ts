import assert from 'node:assert/strict';
import test from 'node:test';
import { recipeDerivationKind, assertIndependentRecipeReviewer } from '../src/domain/recipe-derivation.policy';
import { recipeDerivationSchema } from '../src/validation/recipe-derivation.schemas';
import { buildComposedServing } from '../src/domain/composed-serving.policy';
import { chooseCookedRicePortionG } from '../src/domain/upcoming-preparation.policy';

const draft = {
  expectedRevision: 1,
  mealName: 'Chicken dish',
  summary: 'Measured serving',
  instructions: 'Cook chicken thoroughly and serve warm.',
  mealType: 'LUNCH',
  ingredients: [{ foodItemId: 'chicken', grams: 150 }],
  riceRole: 'PAIR_WITH_RICE',
  imageUrl: 'https://example.com/chicken.jpg',
  imageMatchesRecipe: true,
  rationale: 'Replace fish with a measured chicken serving.',
};
test('quantity versions retain identity; substitutions, removals and unresolved identities require adapted meals', () => {
  assert.equal(
    recipeDerivationKind(
      [{ foodItemId: 'fish' }, { foodItemId: 'salt' }],
      [{ foodItemId: 'salt' }, { foodItemId: 'fish' }]
    ),
    'SERVING_VERSION'
  );
  assert.equal(recipeDerivationKind([{ foodItemId: 'fish' }], [{ foodItemId: 'chicken' }]), 'ADAPTED');
  assert.equal(
    recipeDerivationKind([{ foodItemId: 'fish' }, { foodItemId: 'salt' }], [{ foodItemId: 'fish' }]),
    'ADAPTED'
  );
  assert.equal(recipeDerivationKind([{ foodItemId: null }], [{ foodItemId: 'fish' }]), 'ADAPTED');
  assert.throws(() => assertIndependentRecipeReviewer('author', 'author'), /different nutritionist/);
  assert.doesNotThrow(() => assertIndependentRecipeReviewer('author', 'independent'));
});
test('draft requests reject quarter cups, unsupported ranges, forged totals and private image URLs', () => {
  assert.equal(recipeDerivationSchema.parse(draft).riceMinHalfCups, 1);
  for (const change of [
    { riceMinHalfCups: 0.5 },
    { riceMaxHalfCups: 7 },
    { riceMinHalfCups: 3, riceMaxHalfCups: 1 },
    { calories: 1 },
    { imageUrl: 'https://127.0.0.1/private.jpg' },
    { riceRole: 'INCLUDES_RICE', includedRiceG: null },
  ]) {
    assert.equal(recipeDerivationSchema.safeParse({ ...draft, ...change }).success, false);
  }
});
test('composed plate arithmetic and signature bind the rice evidence version', () => {
  const input = {
    baseRecipeSignature: 'a'.repeat(64),
    baseNutrition: { calories: 300, proteinG: 20, carbsG: 10, fatG: 10 },
    riceFood: {
      id: 'rice',
      name: 'Cooked rice',
      source: 'FNRI',
      compositionRevision: 1,
      calories: 130,
      proteinG: 2.5,
      carbsG: 28,
      fatG: 0.3,
    },
    cookedRiceG: 75,
  };
  const plate = buildComposedServing(input);
  assert.deepEqual(plate.total, { calories: 397.5, proteinG: 21.875, carbsG: 31, fatG: 10.225 });
  assert.notEqual(
    plate.composedServingSignature,
    buildComposedServing({ ...input, riceFood: { ...input.riceFood, compositionRevision: 2 } }).composedServingSignature
  );
  assert.notEqual(
    plate.composedServingSignature,
    buildComposedServing({ ...input, riceFood: { ...input.riceFood, calories: 140 } }).composedServingSignature
  );
});
test('rice fills the slot gap within reviewer bounds and never rounds to a quarter cup', () => {
  const input = {
    baseCalories: 300,
    riceCaloriesPer100G: 130,
    slotTargetCalories: 500,
    slotMinimumCalories: 450,
    slotMaximumCalories: 550,
  };
  assert.equal(chooseCookedRicePortionG(input), 150);
  assert.equal(chooseCookedRicePortionG({ ...input, minHalfCups: 1, maxHalfCups: 1 }), null);
  assert.equal(chooseCookedRicePortionG({ ...input, minHalfCups: 2, maxHalfCups: 2 }), 150);
});
