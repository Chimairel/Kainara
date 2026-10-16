import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';

process.env.CLINICAL_CLARIFICATIONS_ENABLED = 'true';
process.env.JWT_SECRET = 'unit-only-approval-read-cost-secret';
const service = import('../src/services/exact-meal-approval-reuse.service');
const policy = import('../src/domain/reusable-review-reference.policy');

test('an empty reuse candidate set never locks the member or loads reference evidence', async () => {
  const { reconcileExactMealApprovals } = await service;
  const { REVIEW_REFERENCE_POLICY } = await policy;
  let where: Prisma.MealPlanWhereInput | undefined;
  const client = {
    mealPlan: {
      findFirst: async (args: Prisma.MealPlanFindFirstArgs) => {
        where = args.where;
        return null;
      },
    },
    mealReviewReference: {
      findFirst: async () => {
        throw new Error('Unnecessary reference read');
      },
    },
    $executeRaw: async () => {
      throw new Error('Unnecessary profile lock');
    },
  } as unknown as Prisma.TransactionClient;
  assert.equal((await reconcileExactMealApprovals('member', 'cycle', client)).size, 0);
  assert.equal(where?.userId, 'member');
  assert.equal(where?.planGroupId, 'cycle');
  assert.equal(where?.supersededByMealPlanId, null);
  assert.deepEqual(where?.OR, [
    { status: 'PENDING_REVIEW', reviewApprovalCount: 0, claimedByNutritionistId: null, reviewDecisions: { none: {} } },
    {
      status: 'APPROVED',
      selectionEvidence: { path: ['exactApprovalReuse', 'policyVersion'], equals: REVIEW_REFERENCE_POLICY },
    },
  ]);
});

for (const referenceExists of [true, false]) {
  test(`existing reused approvals still enter locked revalidation (reference exists: ${referenceExists})`, async () => {
    const { reconcileExactMealApprovals } = await service;
    const locked = new Error('Reached unchanged locked revalidation');
    let reads = 0;
    const client = {
      mealPlan: {
        findFirst: async () => {
          reads += 1;
          return { id: 'existing-reuse' };
        },
      },
      mealReviewReference: { findFirst: async () => (referenceExists ? { id: 'reference' } : null) },
      $executeRaw: async () => {
        throw locked;
      },
    } as unknown as Prisma.TransactionClient;
    await assert.rejects(reconcileExactMealApprovals('member', 'cycle', client), (error) => error === locked);
    assert.equal(reads, referenceExists ? 1 : 2);
  });
}
