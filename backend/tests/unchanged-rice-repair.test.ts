import assert from 'node:assert/strict';
import test from 'node:test';
import { unchangedRiceRepairCandidate } from '../src/services/unchanged-rice-repair.service';
import { buildBaseServingPersistence } from '../src/services/meal-plan-serving.service';
import { buildComposedServing } from '../src/domain/composed-serving.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '../src/domain/meal-plan-production-safety.policy';

type Plan = Parameters<typeof unchangedRiceRepairCandidate>[0];
type Context = Parameters<typeof unchangedRiceRepairCandidate>[1];
const context = {
  conditions: [],
  allergens: [],
  otherConditions: '',
  otherAllergies: '',
  user: { safetyProfileEntries: [] },
  declaredSafetyRestrictions: {
    requiresReview: false,
    conditions: [],
    allergies: [],
    customConditions: [],
    customFoodRestrictions: [],
  },
} as unknown as Context;
const food = {
  id: 'rice',
  name: 'Rice, well-milled, boiled',
  source: 'FNRI',
  compositionRevision: 1,
  calories: 129,
  proteinG: 2.1,
  carbsG: 29.7,
  fatG: 0.2,
};
const ingredients = [{ ingredientName: 'Chicken', foodItemId: null, quantity: 100, unit: 'g' }];
const base = {
  componentType: 'BASE_RECIPE',
  calories: 400,
  proteinG: 30,
  carbsG: 20,
  fatG: 15,
  evidenceSource: 'PANLASANG_PINOY_GENERAL_BASE',
};
const persistence = buildBaseServingPersistence({ ...base, mealName: 'Chicken dish', mealType: 'LUNCH', ingredients });
const serving = buildComposedServing({
  baseRecipeSignature: persistence.baseRecipeSignature,
  baseNutrition: base,
  riceFood: { ...food, compositionRevision: 0 },
  cookedRiceG: 225,
});
const plan = {
  id: 'plan',
  status: 'APPROVED',
  requiresSafetyRevalidation: false,
  candidateProvenance: 'RAW_RECIPE_CORPUS',
  reviewApprovalCount: 0,
  highRiskReviewRequired: false,
  mealName: 'Chicken dish',
  mealType: 'LUNCH',
  ...serving.total,
  baseRecipeSignature: persistence.baseRecipeSignature,
  composedServingSignature: serving.composedServingSignature,
  safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
  ingredients,
  _count: { mealLogs: 0, reviewDecisions: 0, clearanceUsages: 0, clarificationForms: 0 },
  sourceRawRecipeCandidate: {
    id: 'source',
    sourceName: 'PANLASANG_PINOY',
    status: 'AVAILABLE',
    sourceUrl: 'https://panlasangpinoy.com/chicken/',
    publishedNutrition: { calories: 400 },
    contentSignature: 'source-current',
    calories: 400,
    proteinG: 30,
    carbsG: 20,
    fatG: 15,
    ingredients: [{ name: 'Chicken', quantity: 100, unit: 'g' }],
    riceRole: 'PAIR_WITH_RICE',
    riceRoleReviewStatus: 'REVIEWED',
    libraryVariants: [],
  },
  servingComponents: [
    base,
    {
      id: 'side',
      componentType: 'COOKED_RICE',
      quantityG: 225,
      ...serving.riceNutrition,
      evidenceSource: 'FNRI:0',
      foodItem: food,
    },
  ],
} as unknown as Plan;

test('an unchanged unrestricted serving receives a freshly computed revision signature only', () => {
  const repair = unchangedRiceRepairCandidate(plan, context)!;
  assert.equal(repair.from, 'FNRI:0');
  assert.equal(repair.to, 'FNRI:1');
  assert.equal(repair.beforeSignature, plan.composedServingSignature);
  assert.equal(
    repair.afterSignature,
    buildComposedServing({
      baseRecipeSignature: plan.baseRecipeSignature!,
      baseNutrition: base,
      riceFood: food,
      cookedRiceG: 225,
    }).composedServingSignature
  );
  assert.notEqual(repair.afterSignature, repair.beforeSignature);
});

for (const patch of [
  { status: 'PENDING_REVIEW' },
  { requiresSafetyRevalidation: true },
  { reviewApprovalCount: 1 },
  { highRiskReviewRequired: true },
  { libraryMealId: 'library' },
  { profileApprovalId: 'profile-approval' },
  { nutritionistId: 'rnd' },
  { supersededByMealPlanId: 'new-plan' },
  { calories: plan.calories + 1 },
]) {
  test(`rice refresh refuses changed or reviewed state ${JSON.stringify(patch)}`, () => {
    assert.equal(unchangedRiceRepairCandidate({ ...plan, ...patch } as Plan, context), null);
  });
}
for (const key of ['mealLogs', 'reviewDecisions', 'clearanceUsages', 'clarificationForms'] as const) {
  test(`rice refresh preserves existing ${key}`, () =>
    assert.equal(unchangedRiceRepairCandidate({ ...plan, _count: { ...plan._count, [key]: 1 } }, context), null));
}
test('changed rice composition, current evidence, tampered signatures and changed ingredients are excluded', () => {
  const side = plan.servingComponents[1];
  for (const replacement of [
    { ...side, foodItem: { ...side.foodItem!, calories: 130 } },
    { ...side, evidenceSource: 'FNRI:1' },
  ])
    assert.equal(
      unchangedRiceRepairCandidate({ ...plan, servingComponents: [plan.servingComponents[0], replacement] }, context),
      null
    );
  assert.equal(unchangedRiceRepairCandidate({ ...plan, composedServingSignature: 'a'.repeat(64) }, context), null);
  assert.equal(
    unchangedRiceRepairCandidate({ ...plan, ingredients: [{ ...plan.ingredients[0], quantity: 101 }] }, context),
    null
  );
});
test('restricted, custom and assessed profiles cannot use this maintenance shortcut', () => {
  for (const restrictions of [
    { conditions: ['DIABETES'] },
    { allergies: ['DAIRY'] },
    { customConditions: ['unclear'] },
    { customFoodRestrictions: ['peanut'] },
    { requiresReview: true },
  ])
    assert.equal(
      unchangedRiceRepairCandidate(plan, {
        ...context,
        declaredSafetyRestrictions: { ...context.declaredSafetyRestrictions, ...restrictions },
      }),
      null
    );
});
test('flagged or retired sources cannot be refreshed', () => {
  assert.equal(
    unchangedRiceRepairCandidate(
      { ...plan, sourceRawRecipeCandidate: { ...plan.sourceRawRecipeCandidate!, status: 'RETIRED' } },
      context
    ),
    null
  );
  assert.equal(
    unchangedRiceRepairCandidate(
      {
        ...plan,
        sourceRawRecipeCandidate: { ...plan.sourceRawRecipeCandidate!, libraryVariants: [{ id: 'flagged' }] },
      },
      context
    ),
    null
  );
});
