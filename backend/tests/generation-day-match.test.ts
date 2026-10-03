import assert from 'node:assert/strict';
import test from 'node:test';
import {
  refineRawRecipeDayMatches,
  selectRawRecipeCandidates,
  sourceRawRecipeCandidates,
  type SourcedRawRecipeMeal,
} from '../src/services/raw-recipe-candidate.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import {
  calculatePlanningMacroTargets,
  type NutritionVector,
  type PlanningMacroTargets,
} from '../src/domain/meal-macro-target.policy';
import { planningSlotNutritionScore } from '../src/domain/swap-nutrition-fit.policy';
import { databaseRecipeCandidateProvider } from '../src/services/panlasang-recipe-candidate.provider';

const target = {
  ...calculatePlanningMacroTargets({ dailyCalorieTarget: 2000, age: 25 })!,
  proteinG: 100,
  carbsG: 250,
  fatG: 66,
};
function candidate(id: string, nutrition: NutritionVector, ingredient = 'Chicken', signature = id) {
  return {
    id,
    providerRecordId: id,
    provenance: 'PANLASANG_PINOY',
    displayName: id,
    normalizedName: id,
    contentSignature: signature,
    sourceUrl: 'https://example.invalid/recipe',
    category: 'Main dish',
    description: null,
    applicableMealTypes: ['BREAKFAST'],
    dietaryTags: ['OMNIVORE'],
    ingredients: [{ name: ingredient, quantity: 100, unit: 'g' }],
    ingredientsComplete: true,
    nutrition,
    servingDescription: null,
    riceRole: 'STANDALONE',
    imageUrl: null,
    videoUrl: null,
    state: 'ACTIVE',
    reviewFreeBaseEligible: true,
    _ranking: { score: 50, reasonCodes: [] },
  } as RecipeCandidateProjection & { _ranking: { score: number; reasonCodes: [] } };
}
const current = candidate('old', { calories: 600, proteinG: 30, carbsG: 20, fatG: 44 });
const close = candidate('close', { calories: 600, proteinG: 30, carbsG: 75, fatG: 20 });
const slot = { dayNumber: 1, mealType: 'BREAKFAST' as const, scheduledDate: new Date('2100-10-03T00:00:00Z') };
const fixed = [
  { dayNumber: 1, mealType: 'LUNCH', calories: 800, proteinG: 40, carbsG: 100, fatG: 26 },
  { dayNumber: 1, mealType: 'DINNER', calories: 600, proteinG: 30, carbsG: 75, fatG: 20 },
];
const selected = selectRawRecipeCandidates({
  slots: [slot],
  candidatesByType: new Map([['BREAKFAST', [current]]]),
  dietaryPreference: 'OMNIVORE',
  allergens: [],
}).meals;
function input(pool = [current, close]) {
  return {
    slots: [slot],
    candidatesByType: new Map([['BREAKFAST' as const, pool]]),
    dietaryPreference: 'OMNIVORE' as const,
    allergens: [],
    reviewFreeBaseOnly: true,
    planningTargets: target,
    existingNutrition: fixed,
    ricePreference: 'NO_RICE' as const,
    selected,
  };
}

test('new-plan refinement repairs an earlier greedy choice against the completed day before persistence', () => {
  const result = refineRawRecipeDayMatches(input());
  assert.equal(result[0].rawCandidateId, 'close');
  assert.equal(planningSlotNutritionScore(target, 'BREAKFAST', fixed)!(result[0]), 0);
  assert.equal(selected[0].rawCandidateId, 'old');
  assert.equal(result[0].pairedRiceG, null);
  assert.deepEqual(refineRawRecipeDayMatches({ ...input(), selected: result }), result);
});

test('the actual source-generation entry point refines a completed day before returning it for saving', async () => {
  const original = databaseRecipeCandidateProvider.list;
  const breakfast = candidate('greedy-breakfast', { calories: 600, proteinG: 30, carbsG: 75, fatG: 20 });
  const alternative = candidate('better-day-breakfast', { calories: 600, proteinG: 30, carbsG: 105, fatG: 0 });
  const lunch = {
    ...candidate('forced-lunch', { calories: 800, proteinG: 40, carbsG: 100, fatG: 46 }),
    applicableMealTypes: ['LUNCH'] as RecipeCandidateProjection['applicableMealTypes'],
  };
  const dinner = {
    ...candidate('forced-dinner', { calories: 600, proteinG: 30, carbsG: 75, fatG: 20 }),
    applicableMealTypes: ['DINNER'] as RecipeCandidateProjection['applicableMealTypes'],
  };
  databaseRecipeCandidateProvider.list = async (request) => ({
    items:
      request.sourceKind === 'USER_OBSERVED'
        ? []
        : request.mealType === 'BREAKFAST'
          ? [breakfast, alternative]
          : request.mealType === 'LUNCH'
            ? [lunch as RecipeCandidateProjection]
            : [dinner as RecipeCandidateProjection],
    nextCursor: null,
  });
  try {
    const result = await sourceRawRecipeCandidates({
      slots: ['BREAKFAST', 'LUNCH', 'DINNER'].map((mealType) => ({
        ...slot,
        mealType: mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER',
      })),
      dailyCalorieTarget: 2000,
      planningTargets: target,
      ricePreference: 'NO_RICE',
      dietaryPreference: 'OMNIVORE',
      conditions: [],
      allergens: [],
      reviewFreeBaseOnly: true,
    });
    assert.equal(result.remainingSlots.length, 0);
    assert.equal(result.meals.find((m) => m.mealType === 'BREAKFAST')!.rawCandidateId, 'better-day-breakfast');
    assert.ok(result.meals.every((m) => !m.pairedRiceG));
  } finally {
    databaseRecipeCandidateProvider.list = original;
  }
});

test('initial macro ranking uses the same whole-day objective when the other two meals are known', () => {
  const result = selectRawRecipeCandidates(input());
  assert.equal(result.meals[0].rawCandidateId, 'close');
});

test('better numerical matches cannot bypass allergies, review-free evidence, diet or meal time', () => {
  for (const bad of [
    candidate('blocked', close.nutrition!, 'Shrimp'),
    { ...close, id: 'blocked', reviewFreeBaseEligible: false },
    { ...close, id: 'blocked', dietaryTags: ['VEGAN'] as const },
    { ...close, id: 'blocked', applicableMealTypes: ['DINNER'] as const },
  ]) {
    const result = refineRawRecipeDayMatches({ ...input([current, bad as typeof close]), allergens: ['SHELLFISH'] });
    assert.equal(result[0].rawCandidateId, 'old');
  }
});

test('refinement preserves freshness and does not add duplicate source identities or signatures', () => {
  assert.equal(refineRawRecipeDayMatches({ ...input(), recentCandidateIds: ['close'] })[0].rawCandidateId, 'old');
  const used = { ...selected[0], dayNumber: 2, rawCandidateId: 'other-day' };
  const duplicate = candidate('close', close.nutrition!, 'Chicken', 'same-recipe');
  const other = candidate('other-day', current.nutrition!, 'Chicken', 'same-recipe');
  assert.equal(
    refineRawRecipeDayMatches({ ...input([current, duplicate, other]), selected: [...selected, used] })[0]
      .rawCandidateId,
    'old'
  );
});

test('missing slots and unavailable report estimates do not manufacture a completed-day match', () => {
  assert.deepEqual(refineRawRecipeDayMatches({ ...input(), existingNutrition: [] }), selected);
  assert.deepEqual(refineRawRecipeDayMatches({ ...input(), planningTargets: null }), selected);
});

test('all proposed changes strictly improve the recorded report score', () => {
  const worse = candidate('worse', { calories: 600, proteinG: 4, carbsG: 4, fatG: 62 });
  assert.deepEqual(refineRawRecipeDayMatches(input([current, worse])), selected);
  const alteredTarget: PlanningMacroTargets = { ...target, goal: 'BUILD_MUSCLE', proteinG: 150 };
  const result = refineRawRecipeDayMatches({ ...input(), planningTargets: alteredTarget });
  const score = planningSlotNutritionScore(alteredTarget, 'BREAKFAST', fixed)!;
  assert.ok(score(result[0]) <= score(selected[0]));
  assert.equal(result[0].dayNumber, selected[0].dayNumber);
  assert.equal(result[0].mealType, selected[0].mealType);
  const typed: SourcedRawRecipeMeal = result[0];
  assert.equal(typed.ingredients[0].quantity, 100);
});
