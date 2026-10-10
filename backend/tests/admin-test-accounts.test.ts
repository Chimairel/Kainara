import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient, Prisma } from '@prisma/client';
import { createAccounts } from '../src/services/dev-test-accounts/writer';
import {
  accountSpecs,
  adminTestAccountTarget,
  parseCreationRequest,
  signAccountPreview,
  testAccountRequestSchema,
  verifyAccountPreview,
} from '../src/services/dev-test-accounts/admin-policy';

const request = testAccountRequestSchema.parse({
  set: 'walkthrough',
  role: 'USER',
  name: 'Member',
  count: 2,
  conditions: ['DIABETES'],
  allergens: ['NUTS'],
  rndStatus: 'ACTIVE',
});
test('admin provisioning fails closed outside an explicit development public runtime', () => {
  for (const patch of [
    {},
    { NODE_ENV: 'test' },
    { NODE_ENV: 'production' },
    { NODE_ENV: 'development', NUTRIMIND_DEPLOYMENT_MODE: 'capstone-demo' },
    { NODE_ENV: 'development', APP_ENV: 'production' },
  ])
    assert.throws(() => adminTestAccountTarget({ DATABASE_URL: 'postgresql://localhost/dev', ...patch }));
  assert.equal(
    adminTestAccountTarget({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://localhost/dev' }).local,
    true
  );
});
test('preview is short-lived and bound to the live admin, database and every account option', () => {
  const now = 100_000;
  const token = signAccountPreview('admin', 'db-a', request, 'secret', now);
  verifyAccountPreview(token, 'admin', 'db-a', request, 'secret', now);
  for (const check of [
    () => verifyAccountPreview(token, 'other', 'db-a', request, 'secret', now),
    () => verifyAccountPreview(token, 'admin', 'db-b', request, 'secret', now),
    () => verifyAccountPreview(token, 'admin', 'db-a', { ...request, count: 3 }, 'secret', now),
    () => verifyAccountPreview(token, 'admin', 'db-a', { ...request, emailName: 'changed-email' }, 'secret', now),
    () =>
      verifyAccountPreview(
        token,
        'admin',
        'db-a',
        testAccountRequestSchema.parse({ ...request, profile: { heightCm: 180 } }),
        'secret',
        now
      ),
    () => verifyAccountPreview(token, 'admin', 'db-a', request, 'wrong', now),
    () => verifyAccountPreview(token, 'admin', 'db-a', request, 'secret', now + 600_000),
    () => verifyAccountPreview('invalid', 'admin', 'db-a', request, 'secret', now),
  ])
    assert.throws(check);
});

test('admin email names use the exact name for one account and numbered names for a batch', () => {
  const single = accountSpecs(testAccountRequestSchema.parse({ ...request, emailName: ' Member ', count: 1 }));
  assert.equal(single[0].emailName, 'member');
  const batch = accountSpecs(testAccountRequestSchema.parse({ ...request, emailName: 'member', count: 10 }));
  assert.equal(batch[0].emailName, 'member-1');
  assert.equal(batch[9].emailName, 'member-10');
  assert.equal(accountSpecs(request)[0].emailName, undefined, 'Old callers retain automatic names.');
  assert.equal(testAccountRequestSchema.safeParse({ ...request, emailName: 'x'.repeat(46) }).success, false);
});
test('creation requires target confirmation and refuses account override fields', () => {
  assert.throws(() => parseCreationRequest({ ...request, previewToken: 'signed', confirmedTarget: false }));
  assert.throws(() =>
    parseCreationRequest({ ...request, previewToken: 'signed', confirmedTarget: true, email: 'real@gmail.com' })
  );
  assert.deepEqual(
    parseCreationRequest({ ...request, previewToken: 'signed', confirmedTarget: true }).request,
    request
  );
  for (const patch of [
    { count: 11 },
    { count: 0 },
    { conditions: ['NONE', 'DIABETES'] },
    { role: 'ADMIN' },
    { set: '../real' },
    { profile: { weightKg: 20 } },
    { profile: { goal: 'LOSE_WEIGHT', targetWeightKg: 75 } },
    { profile: { dailyCalorieTarget: 9999 } },
    { role: 'RND', conditions: ['NONE'], allergens: ['NONE'], profile: {} },
  ])
    assert.equal(testAccountRequestSchema.safeParse({ ...request, ...patch }).success, false);
});
test('single RND creation uses the real administering actor rather than an extra synthetic admin', () => {
  const specs = accountSpecs({
    ...request,
    role: 'RND',
    conditions: ['NONE'],
    allergens: ['NONE'],
    rndStatus: 'EXPIRED',
  });
  assert.equal(specs.length, 2);
  assert.equal(specs[0].role, 'RND');
  assert.equal(specs[0].rnd?.status, 'EXPIRED');
  assert.deepEqual(accountSpecs(request)[0].member, { conditions: ['DIABETES'], allergens: ['NUTS'] });
});

test('writer rechecks the administrator inside the transaction before creating any row', async () => {
  for (const actor of [
    null,
    { name: 'Actor', role: 'USER', isSuspended: false, emailVerified: true },
    { name: 'Actor', role: 'ADMIN', isSuspended: true, emailVerified: true },
    { name: 'Actor', role: 'ADMIN', isSuspended: false, emailVerified: false },
  ]) {
    let writes = 0;
    const transaction = {
      $executeRaw: async () => 0,
      user: {
        findMany: async () => [],
        findUnique: async () => actor,
        create: async () => {
          writes++;
        },
      },
    } as unknown as Prisma.TransactionClient;
    const db = {
      $transaction: async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => callback(transaction),
    } as unknown as PrismaClient;
    await assert.rejects(
      createAccounts(db, 'guard', accountSpecs(request), 'synthetic-password-123456', 'actor'),
      /administrator/
    );
    assert.equal(writes, 0);
  }
});
