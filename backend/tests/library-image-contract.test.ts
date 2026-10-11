import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import prisma from '../src/lib/prisma';
import { getNutritionistMealLibraryWithFilters } from '../src/services/nutritionist-library-query.service';
import { NutritionistLibraryService } from '../src/services/nutritionist-library.service';
import { libraryBaseRevisionKey } from '../src/services/meal-base-admission.service';

function replace(context: TestContext, delegate: unknown, method: string, value: unknown) {
  const target = delegate as Record<string, unknown>;
  const original = target[method];
  target[method] = value;
  context.after(() => {
    target[method] = original;
  });
}

for (const scenario of ['generated', 'retired-source', 'unsigned-source', 'held-certified'] as const) {
  test(`library list and detail agree on base verification: ${scenario}`, async (context) => {
    const current = {
      ...recipe,
      status: scenario === 'held-certified' ? 'FLAGGED' : 'APPROVED',
      recipeSignature: scenario === 'unsigned-source' ? null : 'recipe-v1',
      sourceRawRecipeCandidateId: scenario === 'generated' ? null : 'source',
      sourceRawRecipeCandidate:
        scenario === 'generated'
          ? null
          : {
              ...recipe.sourceRawRecipeCandidate,
              sourceName: 'PANLASANG_PINOY',
              status: scenario === 'retired-source' ? 'RETIRED' : 'AVAILABLE',
            },
      safetyEvidenceStatus: scenario === 'held-certified' ? 'COMPLETE' : 'INCOMPLETE',
      safetyEvidenceRevision: 1,
      certifiedEvidenceRevision: 1,
      safetyReviewedByNutritionistId: 'rnd',
    };
    const verification =
      scenario === 'generated'
        ? { targetKind: 'GENERATED_RECIPE', targetId: 'recipe-v1', revisionKey: 'recipe-v1' }
        : { targetKind: 'LIBRARY_MEAL', targetId: recipe.id, revisionKey: libraryBaseRevisionKey('recipe-v1', null) };
    replace(context, prisma.mealLibrary, 'findMany', async (args: { select?: unknown }) => [
      args.select
        ? { id: recipe.id, sourceRawRecipeCandidateId: current.sourceRawRecipeCandidateId, recipeFamilyId: null }
        : current,
    ]);
    replace(context, prisma.mealLibrary, 'findUnique', async () => current);
    replace(context, prisma.mealBaseVerification, 'findMany', async () => [verification]);
    replace(context, prisma.auditEvent, 'findMany', async () => []);
    replace(context, prisma.auditEvent, 'findFirst', async () => null);
    const listed = (await getNutritionistMealLibraryWithFilters('rnd', {})).meals[0];
    const detail = await NutritionistLibraryService.getLibraryMeal(recipe.id);
    assert.equal(listed.baseVerification, detail?.baseVerification);
    assert.equal(listed.baseVerification, scenario === 'generated' ? 'VERIFIED' : 'REVIEW_PENDING');
  });
}

const recipe = {
  id: 'photo-recipe',
  mealName: 'Recorded plate',
  description: null,
  recipeSignature: null,
  sourceRawRecipeCandidateId: 'source',
  recipeFamilyId: null,
  derivationKind: 'ORIGINAL',
  adaptedImageUrl: null,
  imagePublicId: null,
  imageVersion: null,
  imageFormat: null,
  imageKind: null,
  imageAltText: null,
  imageCreator: null,
  imageSourcePageUrl: null,
  imageLicenseCode: null,
  imageLicenseUrl: null,
  sourceRawRecipeCandidate: {
    recipeName: 'Recorded plate',
    sourceName: 'DEMO_STANDARD_PORTION',
    sourceUrl: 'https://panlasangpinoy.com/recorded-plate/',
    sourceImageUrl: 'https://panlasangpinoy.com/wp-content/uploads/2026/plate.jpg',
    sourceVideoUrl: 'https://youtu.be/uXi6QDOdhGg',
    contentSignature: 'source-v1',
    status: 'AVAILABLE',
  },
};

for (const endpoint of ['list', 'detail'] as const) {
  test(`${endpoint} library image retains representative provenance and video fallback`, async (context) => {
    replace(context, prisma.mealLibrary, 'findMany', async (args: { select?: unknown }) => [
      args.select ? { id: recipe.id, sourceRawRecipeCandidateId: 'source', recipeFamilyId: null } : recipe,
    ]);
    replace(context, prisma.mealLibrary, 'findUnique', async () => recipe);
    replace(context, prisma.mealBaseVerification, 'findMany', async () => []);
    replace(context, prisma.auditEvent, 'findMany', async () => []);
    replace(context, prisma.auditEvent, 'findFirst', async () => null);
    const result =
      endpoint === 'list'
        ? (await getNutritionistMealLibraryWithFilters('rnd', {})).meals[0]
        : await NutritionistLibraryService.getLibraryMeal(recipe.id);
    const image = (
      result as unknown as {
        image: { url: string; kind: string; attribution: { creator: string }; fallback: { url: string } };
      }
    ).image;
    assert.equal(image?.url, recipe.sourceRawRecipeCandidate.sourceImageUrl);
    assert.equal(image?.kind, 'REPRESENTATIVE');
    assert.equal(image?.attribution.creator, 'Panlasang Pinoy');
    assert.equal(image?.fallback.url, 'https://i.ytimg.com/vi/uXi6QDOdhGg/mqdefault.jpg');
  });
}
