import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rankLibraryMeals } from '../src/domain/library-ranking.policy';
import { scorePreparationCandidate } from '../src/domain/upcoming-preparation.policy';

test('legacy locality scores cannot alter meal preparation or swap ranking', () => {
  const base = {
    activeClearanceCoverage: true,
    allergenDeclarationsComplete: true,
    ingredientsResolved: true,
    nutrientsComplete: true,
    dietCompatible: true,
    remainingReviews: 0 as const,
    calorieDeviationRatio: 0,
    mealTypeMatch: true,
  };
  const legacy = { ...base, localityScore: 5 };
  assert.deepEqual(scorePreparationCandidate(legacy), scorePreparationCandidate(base));
  const meals = [
    { id: 'b', calories: 600, mealType: 'BREAKFAST', localityRank: 0 },
    { id: 'a', calories: 600, mealType: 'BREAKFAST', localityRank: 99 },
  ];
  assert.equal(rankLibraryMeals(meals, 2000, 600, 'BREAKFAST')[0].id, 'a');
});

test('generation, recipe selection and swaps no longer retrieve ENNS consumption evidence', () => {
  for (const name of ['meal-plan-composition', 'meal-ai-queue', 'meal-swap', 'raw-recipe-candidate']) {
    const source = readFileSync(resolve(process.cwd(), `src/services/${name}.service.ts`), 'utf8');
    assert.doesNotMatch(
      source,
      /getLocalizedFoodConsumptionContext|rankMealsByLocalizedFoodEvidence|enns-food-group|localityFoodGroupScores|localityScore:/
    );
  }
  for (const name of ['data/evidence-sources.ts', 'components/landing/landing-content.ts']) {
    const source = readFileSync(resolve(process.cwd(), `../frontend/src/${name}`), 'utf8');
    assert.doesNotMatch(source, /fnri-enns|DOST-FNRI ENNS|Locality.*consumption/);
    assert.match(source, /usda-fdc/);
  }
});
