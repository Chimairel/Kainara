import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.JWT_SECRET ||= 'session-test-only-access';
process.env.JWT_REFRESH_SECRET ||= 'session-test-only-refresh';

test('password session creation retains credential checks and never replays a failed write', async (t) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  let current: { isSuspended: boolean; passwordLoginEnabled: boolean; passwordHash: string } | null = {
    isSuspended: false,
    passwordLoginEnabled: true,
    passwordHash: 'verified-hash',
  };
  let writes = 0;
  let transactions = 0;
  let writeFailure = false;
  let locked = false;
  const persisted: string[] = [];
  globals.prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<void>, options: { timeout: number; maxWait: number }) => {
      transactions++;
      assert.equal(options.timeout, 15_000);
      assert.equal(options.maxWait, 5_000);
      locked = false;
      await callback({
        $queryRaw: async () => {
          locked = true;
        },
        user: {
          findUnique: async () => {
            assert.equal(locked, true);
            return current;
          },
        },
        session: {
          create: async ({ data }: { data: { sessionToken: string } }) => {
            writes++;
            if (writeFailure) throw Object.assign(new Error('Transaction expired'), { code: 'P2028' });
            persisted.push(data.sessionToken);
          },
        },
      });
    },
  };
  t.after(() => {
    globals.prisma = previous;
  });
  const { createRefreshSession, hashSessionToken } = await import('../src/services/auth/sessions');
  const payload = { userId: 'session-fixture', email: 'session@example.invalid', role: 'USER' as const };
  const token = await createRefreshSession(payload.userId, payload, 'verified-hash');
  assert.deepEqual(persisted, [hashSessionToken(token)]);
  assert.notEqual(persisted[0], token);
  for (const changed of [
    null,
    { isSuspended: true, passwordLoginEnabled: true, passwordHash: 'verified-hash' },
    { isSuspended: false, passwordLoginEnabled: false, passwordHash: 'verified-hash' },
    { isSuspended: false, passwordLoginEnabled: true, passwordHash: 'changed-hash' },
  ]) {
    current = changed;
    await assert.rejects(createRefreshSession(payload.userId, payload, 'verified-hash'), /credentials changed/);
  }
  assert.equal(writes, 1);
  current = { isSuspended: false, passwordLoginEnabled: true, passwordHash: 'verified-hash' };
  writeFailure = true;
  const before = transactions;
  await assert.rejects(createRefreshSession(payload.userId, payload, 'verified-hash'), { code: 'P2028' });
  assert.equal(transactions, before + 1);
  assert.equal(writes, 2);
  assert.equal(persisted.length, 1);
});
