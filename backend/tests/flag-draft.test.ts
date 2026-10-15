import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type ReviewFlagDraft } from '@prisma/client';
import { flagDraftForSubmission, finishFlagDraft, retryFlagTransaction } from '../src/services/flag-draft-store.service';
import { leasedMealFlagSubmissionSchema } from '../src/validation/meal-review.schemas';

const id = '00000000-0000-4000-8000-000000000015', version = 'a'.repeat(64);
const row = (patch = {}) => ({ id, targetKey: 'meal:recipe:owned', ownerUserId: 'rnd', ownerName: 'Test RND',
  expectedVersion: version, entityType: 'MealLibrary', entityId: 'owned', notes: {}, state: 'ACTIVE', expiresAt: new Date(Date.now()+60000), ...patch }) as ReviewFlagDraft;
const db = (draft: ReviewFlagDraft, writes: unknown[] = []) => ({
  $executeRaw: async () => 1,
  reviewFlagDraft: { findUnique: async () => draft, update: async (input: unknown) => { writes.push(input); return draft; } },
  user: { findUnique: async () => ({ id: 'rnd' }) },
  auditEvent: { create: async (input: unknown) => { writes.push(input); return {}; } },
}) as unknown as Prisma.TransactionClient;

test('only the current owner, target and evidence version may consume an active unexpired draft', async () => {
  const input = { flagDraftId: id, expectedVersion: version };
  assert.equal((await flagDraftForSubmission(db(row()), 'meal:recipe:owned', 'rnd', input))?.id, id);
  for (const patch of [{ ownerUserId: 'other' }, { targetKey: 'meal:recipe:other' }, { expectedVersion: 'b'.repeat(64) }, { state: 'CANCELLED' }, { state: 'EXPIRED' }, { expiresAt: new Date(0) }])
    await assert.rejects(() => flagDraftForSubmission(db(row(patch)), 'meal:recipe:owned', 'rnd', input));
});
test('submitted leases replay their receipt, and final completion records only a lifecycle audit', async () => {
  const draft = row({ state: 'SUBMITTED', result: { incidentId: 'once' } });
  assert.deepEqual((await flagDraftForSubmission(db(draft), draft.targetKey, 'rnd', { flagDraftId: id, expectedVersion: version }))?.result, { incidentId: 'once' });
  const writes: unknown[] = [];
  await finishFlagDraft(db(row(),writes),row(),{ incidentId: 'once' });
  assert.equal(writes.length,2);
  assert.match(JSON.stringify(writes[1]),/FLAG_DRAFT_SUBMITTED/);
  assert.doesNotMatch(JSON.stringify(writes[1]),/explanation|reference|proposedCorrection/);
});
test('HTTP flag submissions require a valid draft token', () => {
  const input = { expectedVersion: version, notes: { category: 'NUTRITION', affectedFields: ['sodium'], explanation: 'A detailed synthetic concern.', reference: 'A reference for the fixture.', proposedCorrection: 'Recheck the measured amounts.' } };
  assert.equal(leasedMealFlagSubmissionSchema.safeParse(input).success,false);
  assert.equal(leasedMealFlagSubmissionSchema.safeParse({ ...input,flagDraftId:id }).success,true);
});

test('serialization conflicts retry within a bound; other failures are not retried', async () => {
  const conflict = new Prisma.PrismaClientKnownRequestError('Fixture conflict', { code: 'P2034', clientVersion: 'test' });
  let attempts = 0;
  assert.equal(await retryFlagTransaction(async () => { if (++attempts < 3) throw conflict; return 'saved receipt'; }), 'saved receipt');
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(() => retryFlagTransaction(async () => { attempts++; throw conflict; }), error => error === conflict);
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(() => retryFlagTransaction(async () => { attempts++; throw new Error('Evidence changed'); }), /Evidence changed/);
  assert.equal(attempts, 1);
});
