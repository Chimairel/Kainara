import assert from 'node:assert/strict';
import test from 'node:test';
import { MealType, RicePreference } from '@prisma/client';
import type { CertifiedLibraryMeal } from '../src/services/meal-library-candidate-query.service';
import { selectLibraryMealSlots } from '../src/services/meal-library-slot-selection.service';

function recipe(id: string, overrides: Partial<CertifiedLibraryMeal> = {}): CertifiedLibraryMeal {
  return {
    id,
    mealName: 'Vegetable stew',
    mealType: MealType.LUNCH,
    applicableMealTypes: [{ mealType: MealType.LUNCH }],
    calories: 795,
    proteinG: 33,
    carbsG: 102,
    fatG: 15.15,
    dietaryTags: ['OMNIVORE'],
    usageCount: 0,
    riceRole: 'STANDALONE',
    riceRoleReviewStatus: 'REVIEWED',
    riceMinHalfCups: 1,
    riceMaxHalfCups: 3,
    includedRiceG: null,
    ingredients: [{ foodItemId: 'measured', ingredientName: 'Vegetable', quantity: 300, unit: 'g' }],
    ...overrides,
  } as CertifiedLibraryMeal;
}

function selection(
  libraryMeals: CertifiedLibraryMeal[],
  extra: Partial<Parameters<typeof selectLibraryMealSlots>[0]> = {}
) {
  return selectLibraryMealSlots({
    libraryMeals,
    caseReviewCandidateIds: new Set(),
    recentlyUsedLibraryIds: new Set(),
    cookedRiceFood: null,
    retainedSlots: new Set(),
    planningTargets: null,
    dailyCalorieTarget: 2000,
    individualReviewRequired: false,
    profile: { dietaryPreference: 'OMNIVORE', ricePreference: RicePreference.NO_RICE },
    startDate: new Date('2026-10-10T16:00:00Z'),
    numDays: 4,
    ...extra,
  });
}

test('selection preserves retained slots and the three-day recipe rotation', () => {
  const result = selection([recipe('only')], { retainedSlots: new Set(['2026-10-11:LUNCH']), numDays: 5 });
  assert.deepEqual(
    result.matchedSlots.map((slot) => slot.dayNumber),
    [2, 5]
  );
  assert.ok(!result.unmatchedSlots.some((slot) => slot.dayNumber === 1 && slot.mealType === MealType.LUNCH));
  assert.deepEqual(
    result.selectedNutrition.map((slot) => slot.dayNumber),
    [2, 5]
  );
});

test('eligible certified candidates precede pending cases, while pending choices retain their approval requirement', () => {
  const candidates = [recipe('pending'), recipe('certified')];
  const result = selection(candidates, { caseReviewCandidateIds: new Set(['pending']), numDays: 1 });
  assert.equal(result.matchedSlots[0].libraryMeal.id, 'certified');
  assert.equal(result.matchedSlots[0].requiresCaseApproval, false);
  assert.equal(result.matchedSlots[0].fallbackAvailable, true);
  const pending = selection([candidates[0]], { caseReviewCandidateIds: new Set(['pending']), numDays: 1 });
  assert.equal(pending.matchedSlots[0].requiresCaseApproval, true);
});

test('diet and whole-plate calorie mismatches remain gaps rather than selected meals', () => {
  const result = selection([recipe('wrong-diet', { dietaryTags: ['VEGAN'] }), recipe('too-small', { calories: 100 })], {
    numDays: 1,
  });
  assert.equal(result.matchedSlots.length, 0);
  assert.deepEqual(
    result.unmatchedSlots.map((slot) => slot.mealType),
    [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER]
  );
});
