import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import prisma from '../src/lib/prisma';
import { NutritionistLibraryService } from '../src/services/nutritionist-library.service';

function mockDelegate(context: TestContext, delegate: unknown, method: string, replacement: unknown) {
  const target = delegate as Record<string, unknown>;
  const original = target[method];
  target[method] = replacement;
  context.after(() => {
    target[method] = original;
  });
}

test('library details refresh the current held lineage without granting base verification', async (context) => {
  let lineage = { state: 'PENDING_REREVIEW', incidentCount: 1 };
  mockDelegate(context, prisma.mealLibrary, 'findUnique', async (args: { include: Record<string, unknown> }) => {
    assert.deepEqual(args.include.reviewLineage, { select: { state: true, incidentCount: true } });
    return {
      id: 'held-recipe',
      status: 'FLAGGED',
      recipeSignature: null,
      description: null,
      sourceRawRecipeCandidateId: null,
      sourceRawRecipeCandidate: null,
      reviewLineage: { ...lineage },
    };
  });
  mockDelegate(context, prisma.mealBaseVerification, 'findMany', async () => []);
  mockDelegate(context, prisma.auditEvent, 'findFirst', async () => null);

  const first = await NutritionistLibraryService.getLibraryMeal('held-recipe');
  assert.deepEqual(first?.reviewLineage, { state: 'PENDING_REREVIEW', incidentCount: 1 });
  assert.equal(first?.baseVerification, 'REVIEW_PENDING');
  lineage = { state: 'QUARANTINED', incidentCount: 2 };
  const second = await NutritionistLibraryService.getLibraryMeal('held-recipe');
  assert.deepEqual(second?.reviewLineage, { state: 'QUARANTINED', incidentCount: 2 });
  assert.equal(second?.baseVerification, 'REVIEW_PENDING');
  assert.equal(second?.status, 'FLAGGED');
});
