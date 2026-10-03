import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMealExplanation, type MealSelectionEvidence } from '../src/domain/meal-explanation.policy';

const evidence: MealSelectionEvidence = {
  schemaVersion: 1,
  source: 'AI_GENERATED',
  dailyCalorieTarget: 2400,
  slotCalorieTarget: 720,
  slotCalorieLower: 612,
  slotCalorieUpper: 828,
  planningLocationLabel: 'Central Visayas',
  consumptionEvidenceScope: 'Central Visayas',
  consumptionEvidenceRelease: 'FNRI ENNS 2023',
  rankingReasonCodes: ['CALORIE_FIT', 'LOCALITY_EVIDENCE_MATCH'],
  capturedAt: '2026-09-09T00:00:00.000Z',
};

test('[TEST-203] meal explanation reports persisted calorie, provenance, and review facts', () => {
  const result = buildMealExplanation({
    status: 'PENDING_REVIEW',
    aiConfidenceFlag: 'CAUTION',
    calories: 700,
    ingredients: [
      { dataSource: 'FNRI', foodItemId: 'rice' },
      { dataSource: 'GEMINI_ESTIMATED', foodItemId: null },
    ],
    selectionEvidence: evidence,
  });

  assert.equal(result.source, 'AI_GENERATED');
  assert.equal(result.calorieFit, 'WITHIN_TARGET');
  assert.equal(result.nutritionEvidence, 'MIXED');
  assert.equal(result.reviewState, 'PENDING_REVIEW');
  assert.equal(result.limitation, undefined);
  assert.ok(result.bullets.some((line) => line.includes('612–828 kcal')));
  assert.ok(result.bullets.every((line) => !/Central Visayas|ENNS|consumption|locality/i.test(line)));
  assert.ok(result.bullets.some((line) => line.includes('1 FNRI out of 2 ingredients')));
});

test('[TEST-204] legacy meal explanation refuses to invent missing selection evidence', () => {
  const result = buildMealExplanation({
    libraryMealId: null,
    status: 'APPROVED',
    aiConfidenceFlag: 'SAFE',
    calories: 500,
    ingredients: [],
    selectionEvidence: null,
  });

  assert.equal(result.source, 'LEGACY_UNKNOWN');
  assert.equal(result.calorieFit, 'UNAVAILABLE');
  assert.equal(result.nutritionEvidence, 'UNAVAILABLE');
  assert.match(result.limitation || '', /unavailable/i);
  assert.ok(result.bullets.every((line) => !line.includes('within')));
});

test('[TEST-205] verified-library meals expose certification and all-FNRI evidence', () => {
  const result = buildMealExplanation({
    libraryMealId: 'meal-library-1',
    status: 'APPROVED',
    aiConfidenceFlag: 'SAFE',
    calories: 700,
    verifierName: 'Andrea Reyes, RND',
    ingredients: [
      { dataSource: 'FNRI', foodItemId: 'rice' },
      { dataSource: 'FNRI', foodItemId: 'chicken' },
    ],
    selectionEvidence: { ...evidence, source: 'VERIFIED_LIBRARY' },
  });

  assert.equal(result.source, 'VERIFIED_LIBRARY');
  assert.equal(result.reviewState, 'NUTRITIONIST_VERIFIED');
  assert.equal(result.nutritionEvidence, 'ALL_FNRI');
  assert.ok(result.bullets.some((line) => line.includes('Andrea Reyes')));
});

test('[TEST-206] catalogue fallback omits removed geography and consumption claims', () => {
  const result = buildMealExplanation({
    status: 'APPROVED',
    aiConfidenceFlag: 'SAFE',
    calories: 700,
    ingredients: [],
    selectionEvidence: {
      ...evidence,
      consumptionEvidenceScope: null,
      planningLocationLabel: 'Cebu City',
    },
  });
  assert.ok(result.bullets.every((line) => !/cebu|consumption|locality/i.test(line)));
});

test('source recipe links are counted by the linked food source without claiming recomputed totals or review', () => {
  const result = buildMealExplanation({
    status: 'APPROVED',
    aiConfidenceFlag: 'CAUTION',
    calories: 568,
    candidateProvenance: 'RAW_RECIPE_CORPUS',
    ingredients: [
      ...Array.from({ length: 3 }, (_, index) => ({
        dataSource: 'SOURCE_RECIPE',
        foodItemId: `food-${index}`,
        foodItem: { source: 'FNRI' },
      })),
      ...Array.from({ length: 3 }, () => ({ dataSource: 'SOURCE_RECIPE', foodItemId: null })),
    ],
    selectionEvidence: {
      ...evidence,
      source: 'RAW_RECIPE_CORPUS',
      rankingReasonCodes: ['INGREDIENTS_RESOLVED', 'NUTRIENTS_COMPLETE', 'SINGLE_REVIEW_REMAINING', 'DIET_MATCH'],
    },
  });
  assert.equal(result.nutritionEvidence, 'SOURCE_RECIPE');
  assert.equal(result.reviewState, 'APPROVED');
  assert.ok(result.bullets.some((line) => /3 FNRI out of 6/.test(line)));
  assert.ok(result.bullets.some((line) => /3 of 6.*no saved/.test(line)));
  assert.ok(result.bullets.some((line) => /recorded recipe values/.test(line)));
  assert.ok(result.bullets.some((line) => /No nutritionist review is recorded/.test(line)));
  assert.ok(
    result.bullets.every(
      (line) => !/pending|ingredients resolved|nutrients complete|include estimates|0 of 6/i.test(line)
    )
  );
});

test('USDA fallback is represented as composition data and never inferred to be an estimate', () => {
  const result = buildMealExplanation({
    status: 'APPROVED',
    aiConfidenceFlag: 'CAUTION',
    calories: 500,
    ingredients: [{ dataSource: 'USDA_FDC', foodItemId: 'usda', foodItem: { source: 'USDA_FDC' } }],
  });
  assert.equal(result.nutritionEvidence, 'ALL_USDA');
  assert.ok(result.bullets.some((line) => /USDA FoodData Central/.test(line)));
  assert.ok(result.bullets.every((line) => !/estimate|FNRI-linked/.test(line)));
});

test('mixed composition, source and estimated evidence reports only the saved facts', () => {
  const result = buildMealExplanation({
    status: 'PENDING_REVIEW',
    aiConfidenceFlag: 'NEEDS_REVIEW',
    calories: 500,
    ingredients: [
      { dataSource: 'SOURCE_RECIPE', foodItemId: 'usda', foodItem: { source: 'USDA_FDC' } },
      { dataSource: 'FNRI', foodItemId: 'fnri', foodItem: { source: 'FNRI' } },
      { dataSource: 'GEMINI_ESTIMATED', foodItemId: null },
    ],
  });
  assert.equal(result.nutritionEvidence, 'MIXED');
  assert.ok(result.bullets.some((line) => /1 FNRI and 1 USDA out of 3/.test(line)));
  assert.ok(result.bullets.some((line) => /1 of 3 ingredients use estimated/.test(line)));
  assert.ok(result.bullets.some((line) => /Professional review is still pending/.test(line)));
});

test('missing ingredient provenance is unavailable and a past reviewer does not imply current approval', () => {
  const result = buildMealExplanation({
    status: 'PENDING_REVIEW',
    aiConfidenceFlag: 'NEEDS_REVIEW',
    calories: 500,
    verifierName: 'Past reviewer',
    ingredients: [{ dataSource: null, foodItemId: null }],
    candidateProvenance: 'RAW_RECIPE_CORPUS',
    selectionEvidence: { source: 'USER_SWAP', replacementKind: 'PANLASANG_SOURCE' },
  });
  assert.equal(result.source, 'RAW_RECIPE_CORPUS');
  assert.equal(result.reviewState, 'PENDING_REVIEW');
  assert.equal(result.nutritionEvidence, 'UNAVAILABLE');
  assert.ok(result.bullets.every((line) => !/Reviewed by|estimated nutrition|verified meal library/.test(line)));
});
