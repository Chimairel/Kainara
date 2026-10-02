import assert from 'node:assert/strict';
import test from 'node:test';
import { MealType, RicePreference } from '@prisma/client';
import { rawRecipeServing } from '../src/services/raw-recipe-serving.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import { hasDeclaredSafetyRestrictions } from '../src/domain/structured-restriction.adapter';
import { unavailablePlanMeals } from '../src/domain/unavailable-plan-meals.policy';
import { resolveRecipeRiceRole } from '../src/domain/recipe-rice-role.policy';

const dish: RecipeCandidateProjection = {
  id: 'source',
  providerRecordId: 'source',
  provenance: 'PANLASANG_PINOY',
  displayName: 'Chicken adobo',
  normalizedName: 'chicken adobo',
  category: 'Main dish',
  description: null,
  contentSignature: 'revision',
  sourceUrl: 'https://example.invalid/recipe',
  applicableMealTypes: ['LUNCH'],
  dietaryTags: ['OMNIVORE'],
  ingredients: [{ name: 'Chicken', quantity: 100, unit: 'g' }],
  ingredientsComplete: true,
  reviewFreeBaseEligible: true,
  nutrition: { calories: 400, proteinG: 30, carbsG: 10, fatG: 20 },
  servingDescription: null,
  riceRole: null,
  imageUrl: null,
  videoUrl: null,
  state: 'ACTIVE',
};
const rice = {
  id: 'rice',
  name: 'Rice, well-milled, boiled',
  source: 'FNRI',
  calories: 130,
  proteinG: 2.5,
  carbsG: 28,
  fatG: 0.3,
};
const input = { candidate: dish, mealType: MealType.LUNCH, dailyCalorieTarget: 1500, riceFood: rice };

test('source fallback preserves the dish and fills the lunch gap with one cup of rice', () => {
  const plate = rawRecipeServing({ ...input, ricePreference: RicePreference.WITH_RICE });
  assert.ok(plate);
  assert.equal(plate.servingScale, 1);
  assert.equal(plate.pairedRiceG, 150);
  assert.equal(plate.nutrition?.calories, 400);
  assert.equal(plate.plateCalories, 595);
  assert.deepEqual(plate.ingredients, dish.ingredients);
});
test('source fallback respects no-rice, included-rice and standalone choices', () => {
  const noRice = rawRecipeServing({ ...input, ricePreference: RicePreference.NO_RICE });
  assert.ok(noRice);
  assert.equal(noRice.pairedRiceG, null);
  assert.equal(noRice.plateCalories, 600);
  const included = {
    ...dish,
    nutrition: { ...dish.nutrition!, calories: 600 },
    ingredients: [{ name: 'Cooked rice', quantity: 150, unit: 'g' }],
  };
  assert.equal(rawRecipeServing({ ...input, candidate: included, ricePreference: RicePreference.NO_RICE }), null);
  assert.equal(
    rawRecipeServing({ ...input, candidate: included, ricePreference: RicePreference.WITH_RICE })?.pairedRiceG,
    null
  );
  assert.equal(
    rawRecipeServing({
      ...input,
      candidate: { ...dish, displayName: 'Apple salad' },
      ricePreference: RicePreference.WITH_RICE,
    }),
    null
  );
});
test('rice selection uses only half-cup steps and does not compose unreviewed outside observations', () => {
  for (const calories of [100, 200, 300, 400, 500]) {
    const plate = rawRecipeServing({
      ...input,
      candidate: { ...dish, nutrition: { ...dish.nutrition!, calories } },
      ricePreference: RicePreference.FLEXIBLE,
    });
    if (plate?.pairedRiceG) assert.ok([75, 150, 225].includes(plate.pairedRiceG));
  }
  assert.equal(
    rawRecipeServing({
      ...input,
      candidate: { ...dish, provenance: 'USER_OBSERVED' },
      ricePreference: RicePreference.WITH_RICE,
    }),
    null
  );
  assert.equal(rawRecipeServing({ ...input, candidate: { ...dish, state: 'RETIRED' } }), null);
});
test('allergies and supported conditions require review of a newly composed serving', () => {
  assert.equal(hasDeclaredSafetyRestrictions({ healthConditions: ['NONE'], allergies: [] }), false);
  assert.equal(hasDeclaredSafetyRestrictions({ healthConditions: ['HYPERTENSION'] }), true);
  assert.equal(hasDeclaredSafetyRestrictions({ allergies: ['PEANUTS'] }), true);
  assert.equal(hasDeclaredSafetyRestrictions({ otherConditions: 'Custom condition' }), true);
});
test('rice ingredients take precedence over a contradictory reviewed standalone classification', () => {
  assert.equal(
    resolveRecipeRiceRole({
      mealName: 'Fried rice',
      riceRole: 'STANDALONE',
      riceRoleReviewStatus: 'REVIEWED',
      includedRiceG: null,
      riceMinHalfCups: 1,
      riceMaxHalfCups: 3,
      ingredients: [{ ingredientName: 'Rice', quantity: 150, unit: 'g' }],
    }).riceRole,
    'INCLUDES_RICE'
  );
});
test('unavailable notices exclude past, cancelled, pending and logged meals', () => {
  const today = new Date('2031-01-01');
  const saved = {
    id: 'retired',
    status: 'APPROVED',
    scheduledDate: today,
    libraryMeal: { status: 'ARCHIVED', safetyInvalidationReason: 'SEEDED_FIXTURE_RETIRED' },
  };
  const result = unavailablePlanMeals(
    [
      saved,
      { ...saved, id: 'flagged', libraryMeal: { status: 'FLAGGED' } },
      { ...saved, id: 'cleared' },
      { ...saved, id: 'cancelled', status: 'CANCELLED' },
      { ...saved, id: 'pending', status: 'PENDING_REVIEW' },
      { ...saved, id: 'done', mealLogs: [{ status: 'DONE' }] },
      { ...saved, id: 'past', scheduledDate: new Date('2030-12-31') },
    ],
    new Set(['cleared']),
    today
  );
  assert.deepEqual(result, { unavailableMealCount: 2, retiredMealCount: 1 });
});
