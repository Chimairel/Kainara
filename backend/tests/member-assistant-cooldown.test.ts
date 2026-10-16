import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { MemberAssistantUsageService as Usage } from '../src/services/member-assistant-usage.service';
import { assistantInputSchema } from '../src/domain/member-assistant.policy';

function delegate(t: TestContext, target: object, name: string, value: unknown) {
  const record = target as Record<string, unknown>; const old = record[name]; record[name] = value;
  t.after(() => { record[name] = old; });
}
const input = () => assistantInputSchema.parse({ requestKey: randomUUID(), message: 'What is protein?', allowAi: true });

test('cooldown reads the latest attempt per owner, regardless of success, without a table scan', async t => {
  const now = new Date('2026-10-15T14:00:30Z');
  delegate(t, prisma.assistantRequest, 'findFirst', async (query: unknown) => {
    assert.deepEqual(query, { where: { userId: 'owner', createdAt: { gt: new Date('2026-10-15T13:59:30Z') } },
      orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    return { createdAt: new Date('2026-10-15T14:00:00Z') };
  });
  assert.equal((await Usage.nextRequestAt('owner', now))?.toISOString(), '2026-10-15T14:01:00.000Z');
  delegate(t, prisma.assistantRequest, 'findFirst', async () => null);
  assert.equal(await Usage.nextRequestAt('owner', now), null);
});

test('one recent admission rejects a second attempt with its exact deadline and no new receipt', async t => {
  const createdAt = new Date(Date.now() - 20_000); let inserts = 0; let locks = 0;
  t.mock.method(prisma, '$transaction', async (callback: unknown) => (callback as (tx: unknown) => unknown)({
    $executeRaw: async () => { locks++; }, assistantRequest: {
      deleteMany: async () => ({}), findUnique: async () => null,
      findFirst: async (query: { where: { state?: string } }) => query.where.state ? null : { createdAt },
      create: async () => { inserts++; throw new Error('must not admit another request'); },
    },
  }));
  await assert.rejects(Usage.reserve('owner', input()), (error: unknown) => {
    const failure = error as { errorCode: string; statusCode: number; retryAt: Date };
    assert.equal(failure.errorCode, 'ASSISTANT_TOO_FAST'); assert.equal(failure.statusCode, 429);
    assert.equal(+failure.retryAt, +createdAt + 60_000); return true;
  });
  assert.equal(inserts, 0); assert.equal(locks, 1);
});

test('completed response replay bypasses cooldown without reserving another credit', async t => {
  const message = input(); const response = { text: 'Stored reply', source: 'AI', creditsUsed: 1 };
  const payloadHash = createHash('sha256').update(JSON.stringify({ message: message.message, context: message.context, action: null })).digest('hex');
  t.mock.method(prisma, '$transaction', async (callback: unknown) => (callback as (tx: unknown) => unknown)({
    $executeRaw: async () => {}, assistantRequest: { deleteMany: async () => ({}),
      findUnique: async () => ({ id: 'old', payloadHash, state: 'SUCCEEDED', response }),
      findFirst: async () => { throw new Error('replay must not be rate limited'); } },
  }));
  assert.deepEqual(await Usage.reserve('owner', message), { replay: response, id: 'old' });
});

test('status supplies cooldown while failed attempts do not spend weekly credits', async t => {
  const old = process.env.MEMBERSHIP_ENABLED; process.env.MEMBERSHIP_ENABLED = 'false';
  t.after(() => { if (old === undefined) delete process.env.MEMBERSHIP_ENABLED; else process.env.MEMBERSHIP_ENABLED = old; });
  const now = new Date('2026-10-15T14:00:30Z');
  delegate(t, prisma.assistantRequest, 'count', async () => 0);
  delegate(t, prisma.assistantRequest, 'findFirst', async () => ({ createdAt: new Date('2026-10-15T14:00:00Z') }));
  const value = await Usage.allowance('owner', now);
  assert.equal(value.remaining, 5); assert.equal(value.nextAiRequestAt, '2026-10-15T14:01:00.000Z');
});
