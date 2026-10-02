import assert from 'node:assert/strict';
import test from 'node:test';
import { baseMealAdmissionMatches, libraryBaseRevisionKey } from '../src/services/meal-base-admission.service';

const recipe = {
  id: 'meal-1',
  status: 'APPROVED',
  recipeSignature: 'revision-2',
  description: 'Cook the meal',
  sourceRawRecipeCandidateId: null,
};
test('old library verification cannot revive an unavailable linked source', () => {
  const key = `LIBRARY_MEAL:meal-1:${libraryBaseRevisionKey(recipe.recipeSignature, recipe.description)}`;
  assert.equal(
    baseMealAdmissionMatches(
      {
        ...recipe,
        sourceRawRecipeCandidateId: 'source',
        sourceRawRecipeCandidate: { sourceName: 'PANLASANG_PINOY', status: 'RETIRED', contentSignature: 'old' },
      },
      new Set([key])
    ),
    false
  );
});

test('retired fixture recipes cannot be readmitted by their old verification', () => {
  const key = `LIBRARY_MEAL:meal-1:${libraryBaseRevisionKey('revision-2', 'Cook the meal')}`;
  assert.equal(baseMealAdmissionMatches({ ...recipe, status: 'ARCHIVED' }, new Set([key])), false);
});

test('admin and generated meals require verification for the current revision', () => {
  assert.equal(
    baseMealAdmissionMatches(
      recipe,
      new Set([`LIBRARY_MEAL:meal-1:${libraryBaseRevisionKey('revision-2', 'Old preparation')}`])
    ),
    false
  );
  assert.equal(
    baseMealAdmissionMatches(
      recipe,
      new Set([`LIBRARY_MEAL:meal-1:${libraryBaseRevisionKey('revision-2', 'Cook the meal')}`])
    ),
    true
  );
  assert.equal(baseMealAdmissionMatches(recipe, new Set(['GENERATED_RECIPE:revision-2:revision-2'])), true);
});

test('published Panlasang provenance admits an available base but does not revive a retired source', () => {
  const source = { sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE', contentSignature: 'source-revision' };
  assert.equal(
    baseMealAdmissionMatches(
      { ...recipe, sourceRawRecipeCandidateId: 'source-1', sourceRawRecipeCandidate: source },
      new Set()
    ),
    true
  );
  assert.equal(
    baseMealAdmissionMatches(
      { ...recipe, sourceRawRecipeCandidateId: 'source-1', sourceRawRecipeCandidate: { ...source, status: 'RETIRED' } },
      new Set()
    ),
    false
  );
});

test('outside recipe verification follows the source revision and availability', () => {
  const source = { sourceName: 'USER_OBSERVED', status: 'AVAILABLE', contentSignature: 'source-revision-2' };
  const meal = { ...recipe, sourceRawRecipeCandidateId: 'source-1', sourceRawRecipeCandidate: source };
  assert.equal(baseMealAdmissionMatches(meal, new Set(['RAW_RECIPE:source-1:source-revision-1'])), false);
  assert.equal(baseMealAdmissionMatches(meal, new Set(['RAW_RECIPE:source-1:source-revision-2'])), true);
  assert.equal(
    baseMealAdmissionMatches(
      { ...meal, sourceRawRecipeCandidate: { ...source, status: 'RETIRED' } },
      new Set(['RAW_RECIPE:source-1:source-revision-2'])
    ),
    false
  );
});
