import assert from 'node:assert/strict';
import test from 'node:test';
import type prisma from '../src/lib/prisma';
import { AdminReviewContextService } from '../src/services/admin-review-context.service';

function fixture(metadata: unknown, visible = true, role = 'ADMIN') {
  const writes: unknown[] = [];
  const old = { id: 'old', evidenceSnapshot: { recordedProfile: { age: 21 }, calories: 0 } };
  const latest = { id: 'latest', evidenceSnapshot: { recordedProfile: { age: 22 }, calories: 900 } };
  const event = { entityType: 'MealPlan', entityId: 'plan', action: 'MEAL_PLAN_APPROVED', metadata };
  const tx = {
    auditEvent: {
      findUnique: async () => event,
      create: async (value: unknown) => {
        writes.push(value);
      },
    },
    user: {
      findUnique: async (query: { where: { id: string } }) =>
        query.where.id === 'admin'
          ? { id: 'admin', role, isSuspended: false, name: 'Admin' }
          : { name: 'Current member', userProfile: { age: 25 } },
    },
    mealPlan: {
      findUnique: async () => ({
        userId: 'member',
        reviewDecisions: [old, latest],
        clinicalEvidence: [{ clinicalDocumentId: 'doc' }],
      }),
    },
    clinicalDocument: {
      findMany: async (query: unknown) => {
        assert.deepEqual((query as { where: unknown }).where, { id: { in: ['doc'] }, userId: 'member' });
        return [{ id: 'doc', revision: 2, documentType: 'LAB_REPORT' }];
      },
    },
  };
  const db = {
    ...tx,
    $queryRaw: async () => [
      {
        total: visible ? 1n : 0n,
        rows: visible ? [{ id: 'audit', actionCode: event.action, actor: 'RND', role: 'NUTRITIONIST' }] : [],
      },
    ],
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  } as unknown as typeof prisma;
  return { db, writes, old, latest };
}

test('admin audit selects the exact linked old decision rather than the latest or live profile', async () => {
  const f = fixture({ reviewDecisionId: 'old' });
  const result = await AdminReviewContextService.detail('admin', 'audit', f.db);
  assert.deepEqual(result.reviewedSnapshot, f.old.evidenceSnapshot);
  assert.equal('selectedDecisionId' in result && result.selectedDecisionId, 'old');
  assert.equal(result.historicalInformation, null);
  assert.deepEqual(result.currentProfile, { name: 'Current member', userProfile: { age: 25 } });
  assert.equal(result.decisions.length, 2);
  assert.equal(f.writes.length, 1);
  assert.match(JSON.stringify(f.writes), /ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED/);
});

test('legacy or unrelated decision links do not guess a snapshot from another decision', async () => {
  for (const metadata of [null, {}, { reviewDecisionId: 'other-case' }]) {
    const f = fixture(metadata);
    const result = await AdminReviewContextService.detail('admin', 'audit', f.db);
    assert.equal(result.reviewedSnapshot, null);
    assert.equal('selectedDecisionId' in result && result.selectedDecisionId, null);
    assert.match(result.historicalInformation!, /decision link.*not recorded/);
    assert.equal(result.decisions.length, 2);
  }
});

test('invisible audit or a non-admin cannot obtain case context or generate an access record', async () => {
  for (const [visible, role, statusCode] of [
    [false, 'ADMIN', 404],
    [true, 'USER', 403],
  ] as const) {
    const f = fixture({}, visible, role);
    await assert.rejects(AdminReviewContextService.detail('admin', 'audit', f.db), { statusCode });
    assert.equal(f.writes.length, 0);
  }
});
