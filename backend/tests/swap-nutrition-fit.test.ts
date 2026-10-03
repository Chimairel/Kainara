import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { swapNutritionFitScore, describeSwapNutritionMatch } from '../src/domain/swap-nutrition-fit.policy';
import { swapMacroContext } from '../src/services/meal-macro-context.service';
import { rawRecipeServing } from '../src/services/raw-recipe-serving.service';
import { resolveReplacementServing } from '../src/services/meal-swap-serving.service';
import type { CertifiedLibraryMeal } from '../src/services/meal-library-candidate-query.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import { MEAL_MACRO_POLICY_VERSION, type PlanningMacroTargets } from '../src/domain/meal-macro-target.policy';

const target: PlanningMacroTargets = {
  calories: 2000,
  proteinG: 100,
  carbsG: 250,
  fatG: 66,
  goal: 'MAINTAIN',
  basis: 'GENERAL_ADULT_ESTIMATE',
  explanation: 'Fixture',
  policyVersion: MEAL_MACRO_POLICY_VERSION,
};
const scheduledDate = new Date('2100-10-03T04:00:00Z');
const slot = { id: 'lunch', planGroupId: 'cycle', scheduledDate, mealType: 'LUNCH' };
const other = { calories: 1200, proteinG: 60, carbsG: 150, fatG: 40 };
const current = { calories: 758, proteinG: 51, carbsG: 44, fatG: 42 };
const mami = { calories: 758, proteinG: 37, carbsG: 135, fatG: 7 };
const balanced = { calories: 740, proteinG: 40, carbsG: 100, fatG: 25 };

function client(complete = true, savedTarget: PlanningMacroTargets | null = target) {
  return {
    mealPlanCycleSnapshot: {
      findUnique: async () =>
        savedTarget
          ? {
              dailyMacroTargets: { '2100-10-03': savedTarget },
            }
          : null,
    },
    mealPlan: {
      findMany: async () => [
        { ...slot, ...current, status: 'APPROVED', requiresSafetyRevalidation: false },
        ...['BREAKFAST', ...(complete ? ['DINNER'] : [])].map((mealType) => ({
          ...slot,
          id: mealType,
          mealType,
          status: 'APPROVED',
          requiresSafetyRevalidation: false,
          calories: other.calories / 2,
          proteinG: other.proteinG / 2,
          carbsG: other.carbsG / 2,
          fatG: other.fatG / 2,
        })),
      ],
    },
  } as unknown as Prisma.TransactionClient;
}

test('a close daily macro fit outranks an exact-calorie plate with macro gaps', async () => {
  const context = await swapMacroContext(client(), 'owner', slot, null);
  assert.ok(context.scoreReplacement(balanced) < context.scoreReplacement(mami));
  assert.equal(context.analyze(balanced).nutritionMatch, 'CLOSE');
  assert.equal(context.analyze(mami).nutritionMatch, 'GAPS_REMAIN');
  assert.equal(context.analyze(mami).after.carbsG, 285);
  assert.deepEqual(
    context.analyze(mami).macroChanges.find((c) => c.nutrient === 'fatG'),
    {
      nutrient: 'fatG',
      direction: 'FURTHER',
      status: 'BELOW',
    }
  );
});

test('the report target wins over the current plate and a newer fallback profile', async () => {
  const context = await swapMacroContext(client(), 'owner', slot, { ...target, proteinG: 300 });
  assert.equal(context.target!.proteinG, 100);
  const desired = { calories: 800, proteinG: 40, carbsG: 100, fatG: 26 };
  assert.equal(context.scoreReplacement(desired), 0);
  assert.ok(context.scoreReplacement(current) > context.scoreReplacement(desired));
});

test('large excesses and shortfalls receive increasing penalties and muscle protein has extra weight', () => {
  const high = { ...target, carbsG: target.carbsG * 2 };
  const low = { ...target, carbsG: 0 };
  assert.equal(swapNutritionFitScore(high, target), swapNutritionFitScore(low, target));
  assert.ok(swapNutritionFitScore(high, target) > swapNutritionFitScore({ ...target, carbsG: 320 }, target));
  const proteinGap = { ...target, proteinG: 70 };
  assert.ok(
    swapNutritionFitScore(proteinGap, { ...target, goal: 'BUILD_MUSCLE' }) > swapNutritionFitScore(proteinGap, target)
  );
});

test('incomplete days are scored by an allocated slot budget without claiming daily balance', async () => {
  const context = await swapMacroContext(client(false), 'owner', slot, null);
  assert.equal(context.analyze(balanced).nutritionMatch, 'PARTIAL_DAY');
  assert.deepEqual(context.analyze(balanced).macroChanges, []);
  assert.deepEqual(context.analyze(balanced).warnings, []);
  assert.equal(context.scoreReplacement(balanced), swapNutritionFitScore(balanced, context.budget!));
});

test('missing report estimates are explicitly unavailable, never a close match', async () => {
  const context = await swapMacroContext(client(true, null), 'owner', slot, null);
  assert.equal(context.analyze(balanced).nutritionMatch, 'UNAVAILABLE');
  assert.deepEqual(context.analyze(balanced).macroChanges, []);
  assert.equal(
    describeSwapNutritionMatch({ before: target, after: target, target, completeDay: true }).nutritionMatch,
    'CLOSE'
  );
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
const dishNutrition = { calories: 400, proteinG: 40, carbsG: 10, fatG: 20 };
const dish = {
  displayName: 'Chicken dish',
  provenance: 'PANLASANG_PINOY',
  state: 'ACTIVE',
  applicableMealTypes: ['LUNCH'],
  riceRole: 'PAIR_WITH_RICE',
  nutrition: dishNutrition,
  ingredients: [{ name: 'Chicken', quantity: 100, unit: 'g' }],
} as RecipeCandidateProjection;

test('source swapping jointly selects dish scale and half-cup rice using the whole-day objective', () => {
  const daily = { calories: 1500, proteinG: 120, carbsG: 180, fatG: 66, goal: 'BUILD_MUSCLE' };
  const remaining = { calories: 900, proteinG: 60, carbsG: 165, fatG: 36 };
  const scoreNutrition = (n: typeof dishNutrition) =>
    swapNutritionFitScore(
      {
        calories: remaining.calories + n.calories,
        proteinG: remaining.proteinG + n.proteinG,
        carbsG: remaining.carbsG + n.carbsG,
        fatG: remaining.fatG + n.fatG,
      },
      daily
    );
  const serving = rawRecipeServing({
    candidate: dish,
    mealType: 'LUNCH',
    dailyCalorieTarget: 1500,
    ricePreference: 'FLEXIBLE',
    riceFood: rice,
    macroTarget: { calories: 600, proteinG: 60, carbsG: 15, fatG: 30 },
    scoreNutrition,
  })!;
  assert.equal(serving.pairedRiceG, null);
  assert.equal(serving.servingScale, 1.5);
  assert.equal(serving.ingredients[0].quantity, 150);
  const required = rawRecipeServing({
    candidate: dish,
    mealType: 'LUNCH',
    dailyCalorieTarget: 1500,
    ricePreference: 'WITH_RICE',
    riceFood: rice,
    macroTarget: { calories: 600, proteinG: 60, carbsG: 15, fatG: 30 },
    scoreNutrition,
  })!;
  assert.equal(required.pairedRiceG, 75);
  assert.ok(required.plateCalories >= 510 && required.plateCalories <= 690);
});

test('certified-library swaps preserve the certified dish serving while optimizing only permitted rice', () => {
  const meal = {
    mealName: 'Chicken dish',
    ...dishNutrition,
    applicableMealTypes: [{ mealType: 'LUNCH' }],
    riceRole: 'PAIR_WITH_RICE',
    riceRoleReviewStatus: 'REVIEWED',
    includedRiceG: null,
    riceMinHalfCups: 1,
    riceMaxHalfCups: 3,
    recipeSignature: 'a'.repeat(64),
    ingredients: [],
  } as unknown as CertifiedLibraryMeal;
  const input = {
    meal,
    mealType: 'LUNCH' as const,
    dailyTarget: 1250,
    ricePreference: 'FLEXIBLE' as const,
    hasConditions: false,
    riceFood: rice,
    macroTarget: { calories: 500, proteinG: 40, carbsG: 30, fatG: 20 },
    scoreNutrition: (n: typeof dishNutrition) =>
      swapNutritionFitScore(n, { calories: 500, proteinG: 40, carbsG: 30, fatG: 20 }),
  };
  const serving = resolveReplacementServing(input)!;
  assert.equal(serving.pairedRiceG, 75);
  assert.equal(serving.proteinG, dishNutrition.proteinG + rice.proteinG * 0.75);
  assert.equal(resolveReplacementServing({ ...input, hasConditions: true }), null);
  assert.equal(resolveReplacementServing({ ...input, mealType: 'DINNER' }), null);
});
