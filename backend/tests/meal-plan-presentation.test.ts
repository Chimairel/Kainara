import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeActionableMeal } from '../src/services/meal-plan-presentation.service';

const meal = {
  id: 'fixture-meal',
  libraryMealId: null,
  selectionEvidence: null,
  status: 'APPROVED',
  aiConfidenceFlag: 'SAFE',
  calories: 400,
  ingredients: [],
};

test('approved meals without a stored reviewer do not acquire fabricated credentials or explanation attribution', () => {
  const result = serializeActionableMeal(meal);
  assert.equal(result.verifier, null);
  assert.ok(!JSON.stringify(result.explanation).includes('Andrea Reyes'));
  assert.ok(!('selectionEvidence' in result));
});

test('meal presentation preserves the stored reviewer and strips its internal relation', () => {
  const result = serializeActionableMeal({
    ...meal,
    nutritionist: {
      prcLicenseNumber: 'fixture-license',
      prcLicenseExpiry: new Date('2030-01-01'),
      specialization: null,
      yearsOfExperience: null,
      university: null,
      bio: null,
      user: { name: 'Stored reviewer', image: null },
    },
  });
  assert.equal(result.verifier?.name, 'Stored reviewer');
  assert.equal(result.verifier?.reviewScope, 'RECORDED');
  assert.ok(!('nutritionist' in result));
});

test('the public serializer uses linked composition metadata without exposing the internal food relation', () => {
  const result = serializeActionableMeal({
    ...meal,
    candidateProvenance: 'RAW_RECIPE_CORPUS',
    ingredients: [
      {
        dataSource: 'SOURCE_RECIPE',
        foodItemId: 'fixture-food',
        foodItem: { source: 'FNRI' },
        ingredientName: 'Egg',
        quantity: 50,
        unit: 'g',
      },
    ],
  });
  assert.ok(result.explanation.bullets.some((line) => /FNRI\/USDA nutrition database/.test(line)));
  assert.equal(result.explanation.nutritionEvidence, 'SOURCE_RECIPE');
  assert.deepEqual(result.ingredients, [
    { dataSource: 'SOURCE_RECIPE', foodItemId: 'fixture-food', ingredientName: 'Egg', quantity: 50, unit: 'g' },
  ]);
});

const reviewer = {
  prcLicenseNumber: 'synthetic-license',
  prcLicenseExpiry: new Date('2030-01-01'),
  specialization: null,
  yearsOfExperience: null,
  university: null,
  bio: null,
  user: { name: 'Synthetic reviewer', image: null },
};
const recipe = {
  id: 'synthetic-recipe',
  verifiedByNutritionist: reviewer,
  imagePublicId: null,
  imageVersion: null,
  imageFormat: null,
  imageKind: null,
  imageAltText: null,
  imageCreator: null,
  imageSourcePageUrl: null,
  imageLicenseCode: null,
  imageLicenseUrl: null,
};
const reviewedMeal = {
  ...meal,
  nutritionistId: 'synthetic-rnd',
  nutritionist: reviewer,
  mealName: 'Synthetic plate',
  proteinG: 20,
  carbsG: 40,
  fatG: 15,
  composedServingSignature: 'synthetic-serving',
};
const recordedDecision = {
  decision: 'APPROVE',
  nutritionistProfileId: 'synthetic-rnd',
  nutritionistProfile: reviewer,
  evidenceSnapshot: {
    effective: { mealName: reviewedMeal.mealName, calories: 400, proteinG: 20, carbsG: 40, fatG: 15 },
    composedServingSignature: 'synthetic-serving',
    recordedProfile: { privateSyntheticContext: true },
  },
};

test('automatic certified-library selection shows recipe verification despite a stored nutritionist relation', () => {
  const result = serializeActionableMeal({
    ...reviewedMeal,
    candidateProvenance: 'CERTIFIED_LIBRARY',
    libraryMealId: recipe.id,
    libraryMeal: recipe,
    reviewDecisions: [],
  });
  assert.equal(result.verifier?.reviewScope, 'RECIPE');
  assert.equal(result.verifier?.name, reviewer.user.name);
});

test('an exact recorded member approval takes precedence over linked recipe certification and stays private', () => {
  const result = serializeActionableMeal({
    ...reviewedMeal,
    candidateProvenance: 'CERTIFIED_LIBRARY',
    libraryMealId: recipe.id,
    libraryMeal: { ...recipe, verifiedByNutritionist: { ...reviewer, user: { name: 'Recipe reviewer' } } },
    reviewDecisions: [recordedDecision],
  });
  assert.equal(result.verifier?.reviewScope, 'MEMBER');
  assert.equal(result.verifier?.name, reviewer.user.name);
  assert.ok(!('reviewDecisions' in result));
  assert.ok(!JSON.stringify(result).includes('privateSyntheticContext'));
});

test('a swapped replacement does not inherit member approval from the former meal decision', () => {
  const result = serializeActionableMeal({
    ...reviewedMeal,
    mealName: 'Replacement plate',
    candidateProvenance: 'CERTIFIED_LIBRARY',
    libraryMealId: recipe.id,
    libraryMeal: recipe,
    selectionEvidence: { source: 'USER_SWAP' },
    reviewDecisions: [recordedDecision],
  });
  assert.equal(result.verifier?.reviewScope, 'RECIPE');
});

test('a swap to the same plate needs a subsequent recorded member approval', () => {
  const swappedMeal = {
    ...reviewedMeal,
    reviewedAt: new Date('2026-10-10T10:00:00Z'),
    selectionEvidence: { source: 'USER_SWAP' },
  };
  assert.equal(
    serializeActionableMeal({
      ...swappedMeal,
      reviewDecisions: [{ ...recordedDecision, submittedAt: new Date('2026-10-10T09:00:00Z') }],
    }).verifier?.reviewScope,
    'RECORDED'
  );
  assert.equal(
    serializeActionableMeal({
      ...swappedMeal,
      reviewDecisions: [{ ...recordedDecision, submittedAt: new Date('2026-10-10T10:00:01Z') }],
    }).verifier?.reviewScope,
    'MEMBER'
  );
});

test('changed serving signatures and unrelated or rejected decisions cannot establish member approval', () => {
  for (const change of [
    { composedServingSignature: 'changed-serving' },
    { reviewDecisions: [{ ...recordedDecision, nutritionistProfileId: 'another-rnd' }] },
    { reviewDecisions: [{ ...recordedDecision, decision: 'REJECT' }] },
  ]) {
    const result = serializeActionableMeal({ ...reviewedMeal, reviewDecisions: [recordedDecision], ...change });
    assert.equal(result.verifier?.reviewScope, 'RECORDED');
  }
});

test('recorded coalesced approvals belong only to the matching unswapped review work', () => {
  const coalescedMeal = {
    ...reviewedMeal,
    reviewWorkKey: 'synthetic-work',
    reviewDecisions: [
      {
        ...recordedDecision,
        evidenceSnapshot: { coalescedFromMealPlanId: 'source-meal', reviewWorkKey: 'synthetic-work' },
      },
    ],
  };
  assert.equal(serializeActionableMeal(coalescedMeal).verifier?.reviewScope, 'MEMBER');
  assert.equal(
    serializeActionableMeal({ ...coalescedMeal, reviewWorkKey: 'changed-work' }).verifier?.reviewScope,
    'RECORDED'
  );
  assert.equal(
    serializeActionableMeal({ ...coalescedMeal, selectionEvidence: { source: 'USER_SWAP' } }).verifier?.reviewScope,
    'RECORDED'
  );
});

test('reused profile approval and ambiguous historical attribution do not claim a fresh member review', () => {
  const result = serializeActionableMeal({
    ...reviewedMeal,
    candidateProvenance: 'CERTIFIED_LIBRARY',
    libraryMealId: recipe.id,
    libraryMeal: recipe,
    profileApprovalId: 'synthetic-reused-approval',
    reviewDecisions: [],
  });
  assert.equal(result.verifier?.reviewScope, 'RECORDED');
  assert.equal(
    serializeActionableMeal({ ...meal, firstApprovedByNutritionist: reviewer }).verifier?.reviewScope,
    'RECORDED'
  );
  assert.equal(serializeActionableMeal({ ...meal, libraryMeal: recipe }).verifier?.reviewScope, 'RECIPE');
});

test('missing decision reviewer credentials are never fabricated', () => {
  const result = serializeActionableMeal({
    ...reviewedMeal,
    nutritionist: null,
    reviewDecisions: [{ ...recordedDecision, nutritionistProfile: null }],
  });
  assert.equal(result.verifier, null);
});
