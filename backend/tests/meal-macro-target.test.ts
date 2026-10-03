import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePlanningMacroTargets,
  reportPlanningMacroTargets,
  mealMacroBudget,
  nutritionFitScore,
  describeDayNutrition,
} from '../src/domain/meal-macro-target.policy';
import { rawRecipeServing } from '../src/services/raw-recipe-serving.service';
import { selectRawRecipeCandidates } from '../src/services/raw-recipe-candidate.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import { cycleMacroTargets, dailyTargetMap } from '../src/services/meal-macro-context.service';
import type { Prisma, MealPlanCycleSnapshot } from '@prisma/client';

const profile = { dailyCalorieTarget: 2400, weightKg: 75, age: 25, goal: 'BUILD_MUSCLE' };
const targets = calculatePlanningMacroTargets(profile)!;
test('muscle estimates use the report weight and conserve the calorie budget across all macros', () => {
  assert.equal(targets.proteinG, 120);
  assert.equal(targets.basis, 'MUSCLE_BUILDING_ESTIMATE');
  assert.equal(targets.proteinG * 4 + targets.carbsG * 4 + targets.fatG * 9, 2400);
  assert.equal(mealMacroBudget(targets, 'LUNCH')!.proteinG, 48);
});
test('medical, younger and infeasible profiles do not receive the generic high-protein prescription', () => {
  for (const input of [
    { ...profile, restricted: true },
    { ...profile, age: 18 },
    { ...profile, dailyCalorieTarget: 500 },
  ]) {
    assert.equal(calculatePlanningMacroTargets(input)!.basis, 'REVIEW_REFERENCE');
  }
  assert.equal(calculatePlanningMacroTargets({ ...profile, dailyCalorieTarget: NaN }), null);
});
test('legacy report estimates derive from its recorded profile, not subsequent live updates', () => {
  const saved = { profileSnapshot: { profile, conditions: ['NONE'], otherConditions: '' } };
  const result = reportPlanningMacroTargets(saved)!;
  assert.equal(result.proteinG, 120);
  assert.equal(
    reportPlanningMacroTargets({
      ...saved,
      profileSnapshot: { ...saved.profileSnapshot, conditions: ['KIDNEY_DISEASE'] },
    })!.basis,
    'REVIEW_REFERENCE'
  );
});
test('day budget compensates for other planned meals rather than copying the old slot macros', () => {
  const other = [{ mealType: 'BREAKFAST', calories: 720, proteinG: 12, carbsG: 110, fatG: 18 }];
  const budget = mealMacroBudget(targets, 'LUNCH', other)!;
  assert.ok(budget.proteinG > 48);
  assert.ok(budget.carbsG < targets.carbsG * 0.4);
});
test('a balanced plate can outrank an exact-calorie match with very low protein', () => {
  const budget = mealMacroBudget(targets, 'LUNCH')!;
  const lowProtein = { calories: 960, proteinG: 10, carbsG: 180, fatG: 20 };
  const balanced = { calories: 930, proteinG: 48, carbsG: 130, fatG: 26 };
  assert.ok(nutritionFitScore(balanced, budget) < nutritionFitScore(lowProtein, budget));
});
const rice = {
  id: 'rice',
  name: 'Rice, well-milled, boiled',
  source: 'FNRI',
  calories: 130,
  proteinG: 2.5,
  carbsG: 28,
  fatG: 0.3,
};
function candidate(
  id: string,
  nutrition: NonNullable<RecipeCandidateProjection['nutrition']>
): RecipeCandidateProjection & { _ranking: { score: number; reasonCodes: [] } } {
  return {
    id,
    providerRecordId: id,
    provenance: 'PANLASANG_PINOY',
    displayName: `Chicken ${id}`,
    normalizedName: id,
    category: 'Main dish',
    description: null,
    contentSignature: id,
    sourceUrl: 'https://example.invalid/recipe',
    applicableMealTypes: ['LUNCH'],
    dietaryTags: ['OMNIVORE'],
    ingredients: [{ name: 'Chicken', quantity: 100, unit: 'g' }],
    ingredientsComplete: true,
    reviewFreeBaseEligible: true,
    nutrition,
    servingDescription: null,
    riceRole: null,
    imageUrl: null,
    videoUrl: null,
    state: 'ACTIVE',
    _ranking: { score: 50, reasonCodes: [] },
  };
}
test('macro-aware rice selection can favor protein in the dish over filling all calories with rice', () => {
  const dish = candidate('protein', { calories: 400, proteinG: 40, carbsG: 10, fatG: 20 });
  const input = {
    candidate: dish,
    mealType: 'LUNCH' as const,
    dailyCalorieTarget: 1500,
    ricePreference: 'WITH_RICE' as const,
    riceFood: rice,
  };
  const legacy = rawRecipeServing(input)!;
  const macro = rawRecipeServing({
    ...input,
    macroTarget: { calories: 600, proteinG: 55, carbsG: 35, fatG: 27, goal: 'BUILD_MUSCLE' },
  })!;
  assert.ok(macro.nutrition!.proteinG > legacy.nutrition!.proteinG);
  assert.ok([75, 150, 225].includes(macro.pairedRiceG!));
  assert.ok(macro.plateCalories >= 510 && macro.plateCalories <= 690);
  assert.equal(macro.ingredients[0].quantity, 100 * macro.servingScale);
  assert.deepEqual(dish.ingredients, [{ name: 'Chicken', quantity: 100, unit: 'g' }]);
});
test('raw generation ranks all three macros even when an alphabetically first meal hits calories exactly', () => {
  const a = candidate('a', { calories: 960, proteinG: 10, carbsG: 180, fatG: 20 });
  const b = candidate('b', { calories: 930, proteinG: 48, carbsG: 130, fatG: 26 });
  const selected = selectRawRecipeCandidates({
    slots: [{ dayNumber: 1, mealType: 'LUNCH', scheduledDate: new Date() }],
    candidatesByType: new Map([['LUNCH', [a, b]]]),
    dietaryPreference: 'OMNIVORE',
    allergens: [],
    planningTargets: targets,
  });
  assert.equal(selected.meals[0].rawCandidateId, 'b');
});
test('equal calories still expose day macro gaps, while incomplete days do not falsely claim a full-day shortfall', () => {
  const day = { calories: 2400, proteinG: 40, carbsG: 250, fatG: 137 };
  assert.ok(describeDayNutrition(day, day, targets, true).warnings.some((w) => w.startsWith('Protein')));
  assert.deepEqual(describeDayNutrition(day, day, targets, false).warnings, []);
});
test('old selected-meal totals are ignored and AI/repair target maps preserve report estimates', async () => {
  const client = {
    nutritionReportVersion: {
      findFirst: async () => ({ profileSnapshot: { profile, conditions: ['NONE'] }, content: {} }),
    },
  } as unknown as Prisma.TransactionClient;
  const snapshot = {
    userId: 'fixture',
    nutritionReportVersion: 1,
    dailyMacroTargets: { '2026-10-03': { calories: 2400, proteinG: 40, carbsG: 250, fatG: 137 } },
  } as unknown as MealPlanCycleSnapshot;
  const resolved = await cycleMacroTargets(client, snapshot, null);
  assert.equal(resolved!.proteinG, 120);
  const map = dailyTargetMap([new Date('2026-10-03T00:00:00Z')], resolved);
  assert.equal(map['2026-10-03'].proteinG, 120);
  assert.equal(map['2026-10-03'].calories, 2400);
  const extended = dailyTargetMap([new Date('2026-10-04T00:00:00Z')], resolved, map);
  assert.equal(extended['2026-10-03'].proteinG, 120);
  assert.equal(extended['2026-10-04'].proteinG, 120);
});
