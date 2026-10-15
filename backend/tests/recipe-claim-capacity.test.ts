import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { assertRecipeClaimCapacity } from '../src/services/recipe-claim-capacity.service';

test('recipe claims serialize and block a second base or flagged review', async () => {
  const calls: string[] = [];
  let base: object | null = null, incident: object | null = null;
  const tx = {
    $queryRaw: async () => { calls.push('lock'); },
    mealBaseVerification: { findFirst: async (args: any) => {
      calls.push('base');
      assert.equal(args.where.claimedByNutritionistId, 'rnd');
      assert.ok(args.where.claimedAt.gte instanceof Date);
      assert.deepEqual(args.where.status.in, ['PENDING', 'REJECTED']);
      return base;
    } },
    mealReviewIncident: { findFirst: async (args: any) => {
      calls.push('incident');
      assert.equal(args.where.closedAt, null);
      assert.equal(args.where.state, 'PENDING_REREVIEW');
      assert.deepEqual(args.where.lineage, { meals: { none: { id: 'meal' } } });
      return incident;
    } },
  } as unknown as Prisma.TransactionClient;
  await assertRecipeClaimCapacity(tx, 'rnd', { kind: 'FLAGGED_RECIPE', id: 'meal' });
  assert.deepEqual(calls, ['lock', 'base', 'incident']);
  for (const occupied of ['base', 'incident']) {
    base = occupied === 'base' ? { id: 'other' } : null;
    incident = occupied === 'incident' ? { id: 'other' } : null;
    await assert.rejects(assertRecipeClaimCapacity(tx, 'rnd', { kind: 'FLAGGED_RECIPE', id: 'meal' }), { errorCode: 'REVIEW_CLAIM_LIMIT' });
  }
});
