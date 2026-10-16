import assert from 'node:assert/strict';
import test from 'node:test';
import { REVIEW_REFERENCE_POLICY } from '../src/domain/reusable-review-reference.policy';
import {
  resolvePlanImage,
  resolveRecordedPlanImage,
  serializeActionableMeal,
} from '../src/services/meal-plan-presentation.service';

const meal = {
  id: 'fixture-meal',
  libraryMealId: null,
  selectionEvidence: null,
  status: 'APPROVED',
  aiConfidenceFlag: 'SAFE',
  calories: 400,
  ingredients: [],
};
test('reused approval shows only recorded RND credentials and does not expose reuse fingerprints or source identities', () => {
  const result = serializeActionableMeal({
    ...meal,
    selectionEvidence: {
      exactApprovalReuse: {
        policyVersion: REVIEW_REFERENCE_POLICY,
        referenceId: 'PRIVATE_REFERENCE_ID',
        contextKey: 'PRIVATE_CONTEXT',
        reviewer: { name: 'Original RND', prcLicenseNumber: 'Recorded-license', prcLicenseExpiry: '2030-01-01' },
      },
    },
  });
  assert.equal(result.approvalReused, true);
  assert.equal(result.verifier?.name, 'Original RND');
  assert.equal(result.verifier?.reviewScope, 'RECORDED');
  assert(!JSON.stringify(result).includes('PRIVATE_'));
});

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
test('review and member presentation share source photography without reusing a replaced recipe photo', () => {
  const raw = {
    recipeName: 'Synthetic Hotsilog',
    sourceName: 'PANLASANG_PINOY',
    sourceUrl: 'https://panlasangpinoy.com/hotsilog/',
    sourceImageUrl: 'https://panlasangpinoy.com/wp-content/uploads/2026/10/hotsilog.jpg',
    sourceVideoUrl: null,
  };
  const display = resolvePlanImage({ sourceRawRecipeCandidate: raw });
  assert.equal(display?.url, raw.sourceImageUrl);
  assert.equal(display?.attribution.sourcePageUrl, raw.sourceUrl);
  assert.equal(serializeActionableMeal({ ...meal, sourceRawRecipeCandidate: raw }).image?.url, display?.url);
  assert.equal(resolvePlanImage({ sourceRawRecipeCandidate: raw, selectionEvidence: { source: 'USER_SWAP' } }), null);
  assert.equal(
    resolvePlanImage({ sourceRawRecipeCandidate: { ...raw, sourceImageUrl: 'https://untrusted.invalid/photo.jpg' } }),
    null
  );
  const adapted = { ...recipe, derivationKind: 'ADAPTED', adaptedImageUrl: '/meals/fixture-adapted.jpg' };
  assert.equal(resolvePlanImage({ libraryMeal: adapted, sourceRawRecipeCandidate: raw })?.url, adapted.adaptedImageUrl);
});
test('history resolves the same linked recipe photo and rejects a different recorded meal', () => {
  const linked = {
    mealName: 'Bam-I Recipe',
    sourceRawRecipeCandidate: {
      recipeName: 'Bam-I Recipe',
      sourceName: 'PANLASANG_PINOY',
      sourceUrl: 'https://panlasangpinoy.com/bam-i/',
      sourceImageUrl: 'https://panlasangpinoy.com/wp-content/uploads/2026/10/bam-i.jpg',
      sourceVideoUrl: null,
    },
  };
  assert.deepEqual(resolveRecordedPlanImage({ mealName: linked.mealName, mealPlan: linked }), resolvePlanImage(linked));
  assert.equal(resolveRecordedPlanImage({ mealName: 'Old recipe', mealPlan: linked }), null);
  assert.equal(resolveRecordedPlanImage({ mealName: linked.mealName, mealPlan: null }), null);
  assert.equal(
    resolveRecordedPlanImage({
      mealName: linked.mealName,
      mealPlan: { ...linked, selectionEvidence: { source: 'USER_SWAP' } },
    }),
    null
  );
});

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

test('a recorded source reviewer is shown as recipe review, not member-specific approval', () => {
  const sourceMeal = {
    ...meal,
    sourceRawRecipeCandidate: {
      id: 'raw-1',
      contentSignature: 'current',
      sourceName: 'PANLASANG_PINOY',
      sourceUrl: 'https://panlasangpinoy.com/recipe',
      sourceImageUrl: null,
      sourceVideoUrl: null,
      sourceRecordId: 'recipe',
      recipeName: 'Fish',
    },
  };
  const result = serializeActionableMeal(
    sourceMeal,
    undefined,
    undefined,
    new Map([
      [
        'raw-1',
        {
          name: 'Recorded RND',
          image: null,
          officialHeadshot: null,
          prcLicenseNumber: '12345',
          prcLicenseExpiry: new Date('2099-01-01'),
          specialization: null,
          yearsOfExperience: null,
          university: null,
          bio: null,
        },
      ],
    ])
  );
  assert.equal(result.verifier?.name, 'Recorded RND');
  assert.equal(result.verifier?.reviewScope, 'RECIPE');
  assert.equal(serializeActionableMeal(sourceMeal).verifier, null);
});
