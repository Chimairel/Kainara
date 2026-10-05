import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptUserSafetyRestrictions } from '../src/domain/structured-restriction.adapter';
import { evaluateMealGenerationLibraryCompatibility } from '../src/domain/meal-generation-library-compatibility.adapter';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { isCertifiedLibraryMealCompatible } from '../src/services/meal-library-candidate-query.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';

const completeCandidate = (
  conditions: string[] = [],
  allergenFree: string[] = [],
  detectedAllergens: string[] = []
) => ({
  status: 'APPROVED',
  suitableConditions: conditions,
  allergenFree,
  safetyEvidence: {
    complete: true,
    baseComplete: true,
    detectedAllergens,
    reviewedAbsentAllergens: allergenFree,
    allergenDomainReviewed: true,
    crossContactCleared: true,
    conditionRuleMatches: conditions,
    conditionDomainReviewed: true,
  },
  ingredients: [{ ingredientName: 'Rice', dataSource: 'FNRI', foodItemId: 'food-1', quantity: 100, unit: 'g' }],
  nutritionEvidenceSource: 'FNRI_RECONCILED',
});

const entry = (
  domain: string,
  canonicalCode: string | null,
  supportState = 'SUPPORTED',
  displayName = canonicalCode || 'Custom'
) => ({
  domain,
  canonicalCode,
  supportState,
  displayName,
  originalText: displayName,
});

const certifiedMeal = (dietaryTags: string[], conditions: string[], allergenFree: string[]) => ({
  recipeSignature: 'a'.repeat(64),
  status: 'APPROVED',
  dietaryTags: [...dietaryTags, 'MAINTAIN'],
  safetyEvidenceStatus: 'COMPLETE',
  safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
  conditionDeclarationState: 'NOT_REVIEWED',
  allergenDeclarationState: allergenFree.length > 0 ? 'REVIEWED_WITH_DECLARATIONS' : 'REVIEWED_NONE_DECLARED',
  crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
  safetyEvidenceRevision: 1,
  certifiedEvidenceRevision: 1,
  safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
  safetyInvalidatedAt: null,
  nutritionEvidenceSource: 'FNRI_RECONCILED',
  safetyReviewedByNutritionist: {
    isVerified: true,
    prcLicenseExpiry: new Date('2999-12-31T00:00:00.000Z'),
  },
  ingredients: [{ ingredientName: 'Rice', dataSource: 'FNRI', foodItemId: 'food-1', quantity: 100, unit: 'g' }],
  safetyDeclarations: [
    ...allergenFree.map((canonicalKey) => ({
      declarationType: 'ALLERGEN_REVIEWED_ABSENT',
      canonicalKey,
      customKey: null,
    })),
  ],
  conditionClearances: conditions.map((condition, index) => ({
    id: `fixture-clearance-${index}`,
    condition,
    state: 'ACTIVE',
    recipeSignature: 'a'.repeat(64),
    evidenceRevision: 1,
    policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
    assuranceTier: 'STANDARD',
    provenance: 'MANUAL_REVIEW',
    userScopeId: null,
    expiresAt: null,
    auditDueAt: new Date('2999-12-31T00:00:00.000Z'),
    rulePolicyVersion: null,
    decisions: [
      {
        decision: 'APPROVE',
        nutritionistProfile: {
          isVerified: true,
          prcLicenseExpiry: new Date('2999-12-31T00:00:00.000Z'),
          canLeadReview: false,
        },
      },
    ],
  })),
});

test('supported allergy-only profiles reuse complete reviewed absence evidence without case approval', () => {
  const meal = certifiedMeal(['OMNIVORE'], [], ['SHELLFISH']);
  const profile = { dietaryPreference: 'OMNIVORE', otherConditions: null, otherAllergies: null };
  assert.equal(isCertifiedLibraryMealCompatible(meal, [], ['SHELLFISH'], profile), true);
  for (const changed of [
    ...['Shrimp', 'Alamang', 'Mystery sauce'].map((ingredientName) => ({
      ...meal,
      ingredients: [{ ...meal.ingredients[0], ingredientName }],
    })),
    { ...meal, ingredients: [{ ...meal.ingredients[0], foodItem: { name: 'Shrimp' } }] },
    { ...meal, safetyEvidenceStatus: 'INCOMPLETE' },
    { ...meal, crossContactAssessment: 'NOT_ASSESSED' },
    { ...meal, safetyDeclarations: [] },
    { ...meal, safetyInvalidatedAt: new Date() },
    { ...meal, ingredients: [{ ingredientName: 'Shrimp paste', dataSource: 'GEMINI_ESTIMATED', foodItemId: null }] },
  ])
    assert.equal(isCertifiedLibraryMealCompatible(changed, [], ['SHELLFISH'], profile), false);
  assert.equal(isCertifiedLibraryMealCompatible(meal, [], ['SOY'], profile), false);
  assert.equal(
    isCertifiedLibraryMealCompatible(meal, [], ['SHELLFISH'], { ...profile, otherAllergies: 'unknown allergen' }),
    false
  );
});

test('cycle actionability rechecks allergy-only recipe evidence and rejects changed or incomplete evidence', async (t) => {
  const library = {
    ...certifiedMeal(['OMNIVORE'], [], ['SHELLFISH']),
    id: 'reviewed-rice',
    description: null,
    sourceRawRecipeCandidateId: 'source-rice',
    sourceRawRecipeCandidate: { sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE', contentSignature: 'b'.repeat(64) },
  };
  const cycle = {
    user: {
      healthConditions: [] as Array<{ condition: string }>,
      allergies: [{ allergen: 'SHELLFISH' }],
      userProfile: { otherConditions: null, otherAllergies: null },
      safetyProfileEntries: [entry('CONDITION', 'NONE'), entry('ALLERGY', 'SHELLFISH')],
    },
    mealPlans: [
      {
        id: 'meal-rice',
        status: 'APPROVED',
        requiresSafetyRevalidation: false,
        candidateProvenance: 'CERTIFIED_LIBRARY',
        libraryMealId: library.id,
        libraryMeal: library,
        baseRecipeSignature: library.recipeSignature,
        composedServingSignature: 'c'.repeat(64),
        safetyPolicyVersion: 'fixture',
        profileApproval: null,
        reviewDecisions: [],
        clearanceUsages: [],
        servingComponents: [],
      },
    ],
  };
  const client = { mealPlanCycle: { findFirst: async () => cycle } } as unknown as Parameters<
    typeof MealPlanCycleService.getClearedMealPlanIds
  >[3];
  t.mock.method(ClinicalProfileReviewService, 'hasCurrentApproval', async () => true);
  const cleared = () => MealPlanCycleService.getClearedMealPlanIds('fixture', 'cycle', new Date(), client);
  assert.deepEqual(await cleared(), ['meal-rice']);
  library.ingredients[0].ingredientName = 'Shrimp';
  assert.deepEqual(await cleared(), []);
  library.ingredients[0].ingredientName = 'Rice';
  library.safetyEvidenceStatus = 'INCOMPLETE';
  assert.deepEqual(await cleared(), []);
  library.safetyEvidenceStatus = 'COMPLETE';
  cycle.mealPlans[0].requiresSafetyRevalidation = true;
  assert.deepEqual(await cleared(), []);
  cycle.mealPlans[0].requiresSafetyRevalidation = false;
  cycle.user.healthConditions = [{ condition: 'DIABETES' }];
  cycle.user.safetyProfileEntries[0] = entry('CONDITION', 'DIABETES');
  assert.deepEqual(await cleared(), [], 'Allergy-only automation cannot waive condition clearance.');
});

test('user-scoped condition clearance admits only its intended patient', () => {
  const base = certifiedMeal(['OMNIVORE'], ['HYPERTENSION'], []);
  const meal = {
    ...base,
    conditionClearances: base.conditionClearances.map((clearance) => ({
      ...clearance,
      userScopeId: 'patient-one',
    })),
  };
  const profile = {
    dietaryPreference: 'OMNIVORE',
    otherConditions: null,
    otherAllergies: null,
    safetyEntries: [entry('CONDITION', 'HYPERTENSION')],
  };
  assert.equal(
    isCertifiedLibraryMealCompatible(meal, ['HYPERTENSION'], [], { ...profile, userId: 'patient-one' }),
    true
  );
  assert.equal(
    isCertifiedLibraryMealCompatible(meal, ['HYPERTENSION'], [], { ...profile, userId: 'patient-two' }),
    false
  );
  assert.equal(isCertifiedLibraryMealCompatible(meal, ['HYPERTENSION'], [], profile), false);
});

test('certified USDA fallback can be reused, while an ordinary USDA name match still waits for review', () => {
  const meal = {
    ...certifiedMeal(['OMNIVORE'], [], []),
    ingredients: [{ dataSource: 'USDA_FDC', foodItemId: 'usda-1', quantity: 100, unit: 'g' }],
    nutritionEvidenceSource: 'NUTRITIONIST_EDITED',
  };
  assert.equal(
    isCertifiedLibraryMealCompatible(meal, [], [], {
      dietaryPreference: 'OMNIVORE',
      goal: 'MAINTAIN',
      otherConditions: null,
      otherAllergies: null,
    }),
    true
  );
  const pending = completeCandidate();
  const unreviewed = evaluateMealGenerationLibraryCompatibility({
    candidate: {
      ...pending,
      ingredients: [{ dataSource: 'USDA_FDC', foodItemId: 'usda-1' }],
      safetyEvidence: { ...pending.safetyEvidence, complete: false, baseComplete: false },
    },
    userRestrictions: { conditions: [], allergies: [] },
  });
  assert.equal(unreviewed.eligible, false);
  assert.ok(unreviewed.reasonCodes.includes('USDA_COMPOSITION_REQUIRES_REVIEW'));
});

test('[TEST-074] structured entries are authoritative and aliases dedupe across entry paths', () => {
  const adapted = adaptUserSafetyRestrictions({
    safetyEntries: [entry('CONDITION', 'DIABETES'), entry('ALLERGY', 'EGGS'), entry('AVOIDED_INGREDIENT', 'EGGS')],
    healthConditions: ['HYPERTENSION'],
    allergies: ['DAIRY'],
  });
  assert.equal(adapted.source, 'STRUCTURED');
  assert.deepEqual(adapted.conditions, ['DIABETES']);
  assert.deepEqual(adapted.allergies, ['EGGS']);
});

test('[TEST-074] legacy fallback remains deterministic when structured rows do not exist', () => {
  const adapted = adaptUserSafetyRestrictions({
    safetyEntries: [],
    healthConditions: ['DIABETES', 'NONE'],
    allergies: ['EGGS'],
    otherConditions: 'Gout',
    otherAllergies: 'Soy, pork',
  });
  assert.equal(adapted.source, 'LEGACY');
  assert.deepEqual(adapted.conditions, ['DIABETES']);
  assert.deepEqual(adapted.customFoodRestrictions, ['Soy', 'pork']);
  assert.equal(adapted.requiresReview, true);
});

test('[TEST-074] known high-risk structured conditions retain their canonical escalation signal and review gate', () => {
  const adapted = adaptUserSafetyRestrictions({
    safetyEntries: [entry('CONDITION', 'KIDNEY_DISEASE', 'RECOGNIZED_UNSUPPORTED', 'Kidney disease')],
  });
  assert.deepEqual(adapted.conditions, ['KIDNEY_DISEASE']);
  assert.deepEqual(adapted.customConditions, ['KIDNEY_DISEASE']);
  assert.equal(adapted.requiresReview, true);
});

test('[TEST-075] required realistic structured combinations use conservative intersection semantics', () => {
  const cases = [
    {
      label: 'diabetes + vegetarian + egg allergy',
      entries: [entry('CONDITION', 'DIABETES'), entry('ALLERGY', 'EGGS')],
      candidate: completeCandidate(['DIABETES'], ['EGGS']),
      expected: 'ALLOW',
    },
    {
      label: 'hypertension + pescatarian + dairy allergy',
      entries: [entry('CONDITION', 'HYPERTENSION'), entry('ALLERGY', 'DAIRY')],
      candidate: completeCandidate(['HYPERTENSION'], ['DAIRY']),
      expected: 'ALLOW',
    },
    {
      label: 'diabetes + hypertension + gluten allergy',
      entries: [entry('CONDITION', 'DIABETES'), entry('CONDITION', 'HYPERTENSION'), entry('ALLERGY', 'GLUTEN')],
      candidate: completeCandidate(['DIABETES', 'HYPERTENSION'], ['GLUTEN']),
      expected: 'ALLOW',
    },
    {
      label: 'unsupported condition with supported restrictions',
      entries: [entry('CONDITION', 'DIABETES'), entry('CONDITION', 'GOUT', 'RECOGNIZED_UNSUPPORTED', 'Gout')],
      candidate: completeCandidate(['DIABETES']),
      expected: 'REVIEW',
    },
    {
      label: 'pending condition plus avoided ingredient',
      entries: [entry('CONDITION', null, 'PENDING_REVIEW', 'Pending syndrome'), entry('AVOIDED_INGREDIENT', 'EGGS')],
      candidate: completeCandidate([], ['EGGS']),
      expected: 'REVIEW',
    },
    {
      label: 'multiple allergy intolerance avoidance with one conflict',
      entries: [
        entry('ALLERGY', 'EGGS'),
        entry('INTOLERANCE', 'LACTOSE', 'RECOGNIZED_UNSUPPORTED', 'Lactose'),
        entry('AVOIDED_INGREDIENT', 'DAIRY'),
      ],
      candidate: completeCandidate([], ['EGGS', 'DAIRY'], ['DAIRY']),
      expected: 'BLOCK',
    },
  ] as const;

  for (const profile of cases) {
    const adapted = adaptUserSafetyRestrictions({ safetyEntries: profile.entries });
    const result = evaluateMealGenerationLibraryCompatibility({
      userRestrictions: adapted.evaluationRestrictions,
      candidate: profile.candidate,
    });
    assert.equal(result.evaluation.decision, profile.expected, profile.label);
    assert.equal(result.eligible, profile.expected === 'ALLOW', profile.label);
  }
});

test('[TEST-075] certified recipe evidence does not grant allergy-case approval', () => {
  const profiles = [
    {
      label: 'diabetes + vegetarian + egg allergy',
      diet: 'VEGETARIAN',
      conditions: ['DIABETES'],
      allergens: ['EGGS'],
      entries: [entry('CONDITION', 'DIABETES'), entry('ALLERGY', 'EGGS')],
    },
    {
      label: 'hypertension + pescatarian + dairy allergy',
      diet: 'PESCATARIAN',
      conditions: ['HYPERTENSION'],
      allergens: ['DAIRY'],
      entries: [entry('CONDITION', 'HYPERTENSION'), entry('ALLERGY', 'DAIRY')],
    },
    {
      label: 'diabetes + hypertension + gluten allergy',
      diet: 'OMNIVORE',
      conditions: ['DIABETES', 'HYPERTENSION'],
      allergens: ['GLUTEN'],
      entries: [entry('CONDITION', 'DIABETES'), entry('CONDITION', 'HYPERTENSION'), entry('ALLERGY', 'GLUTEN')],
    },
  ] as const;

  for (const profile of profiles) {
    const meal = certifiedMeal([profile.diet], [...profile.conditions], [...profile.allergens]);
    assert.equal(
      isCertifiedLibraryMealCompatible(meal, [], [], {
        dietaryPreference: profile.diet,
        goal: 'MAINTAIN',
        otherConditions: null,
        otherAllergies: null,
        safetyEntries: profile.entries,
      }),
      false,
      `${profile.label} requires a separate case decision`
    );
  }

  const vegetarianProfile = profiles[0];
  const restrictionCompatiblePescatarianMeal = certifiedMeal(
    ['PESCATARIAN'],
    [...vegetarianProfile.conditions],
    [...vegetarianProfile.allergens]
  );
  assert.equal(
    isCertifiedLibraryMealCompatible(restrictionCompatiblePescatarianMeal, [], [], {
      dietaryPreference: vegetarianProfile.diet,
      goal: 'MAINTAIN',
      otherConditions: null,
      otherAllergies: null,
      safetyEntries: vegetarianProfile.entries,
    }),
    false,
    'a restriction-compatible meal with a mismatched diet tag must be denied'
  );
  const browseProfile = {
    dietaryPreference: vegetarianProfile.diet,
    otherConditions: null,
    otherAllergies: null,
    safetyEntries: vegetarianProfile.entries,
  };
  assert.equal(
    isCertifiedLibraryMealCompatible(restrictionCompatiblePescatarianMeal, [], [], browseProfile, { safetyOnly: true }),
    false,
    'browse mode must not bypass a missing allergy-case approval'
  );
  assert.equal(
    isCertifiedLibraryMealCompatible(certifiedMeal(['PESCATARIAN'], [], []), [], [], browseProfile, {
      safetyOnly: true,
    }),
    false,
    'browse mode must not bypass missing allergen and condition clearance'
  );
});

test('[TEST-075] precedence is BLOCK over REVIEW over ALLOW', () => {
  const adapted = adaptUserSafetyRestrictions({
    safetyEntries: [
      entry('ALLERGY', 'EGGS'),
      entry('INTOLERANCE', 'LACTOSE', 'RECOGNIZED_UNSUPPORTED', 'Lactose intolerance'),
    ],
  });
  const result = evaluateMealGenerationLibraryCompatibility({
    userRestrictions: adapted.evaluationRestrictions,
    candidate: completeCandidate([], ['EGGS'], ['EGGS']),
  });
  assert.equal(result.evaluation.decision, 'BLOCK');
  assert.ok(result.reasonCodes.includes('EXACT_ALLERGEN_CONFLICT'));
  assert.ok(result.reasonCodes.includes('CUSTOM_RESTRICTION_UNMAPPED'));
});
