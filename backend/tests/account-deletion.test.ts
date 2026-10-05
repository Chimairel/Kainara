import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET ||= 'synthetic-deletion-access-key';
process.env.JWT_REFRESH_SECRET ||= 'synthetic-deletion-refresh-key';

test('account deletion uses one authenticated action, validates ownership and preserves its atomic audit', async (t) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  const password = 'Synthetic!123';
  let user: Record<string, unknown> | null = {
    id: 'synthetic-owner',
    email: 'fixture@example.invalid',
    role: 'USER',
    passwordLoginEnabled: false,
    passwordHash: await bcrypt.hash(password, 4),
    accounts: [{ providerAccountId: 'synthetic-subject' }],
  };
  let transactions = 0;
  let batch: Array<{ model: string; args: unknown }> = [];
  const operation = (model: string) => (args: unknown) => ({ model, args });
  globals.prisma = {
    user: { findUnique: async () => user, delete: operation('user') },
    mealPlan: { findMany: async () => [{ id: 'owned-plan' }] },
    mealConditionClearance: { findMany: async () => [{ id: 'owned-clearance' }], deleteMany: operation('clearance') },
    mealPlanClinicalEvidence: { deleteMany: operation('plan-evidence') },
    clearanceClinicalEvidence: { deleteMany: operation('clearance-evidence') },
    mealPlanClearanceUsage: { deleteMany: operation('usage') },
    mealConditionClearanceDecision: { deleteMany: operation('clearance-decision') },
    mealPlanReviewDecision: { deleteMany: operation('plan-decision') },
    auditEvent: { create: operation('audit') },
    $transaction: async (operations: typeof batch) => {
      transactions++;
      batch = operations;
    },
  };
  t.after(() => {
    globals.prisma = previous;
  });
  const { default: router } = await import('../src/routes/user.routes');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { UserController } = await import('../src/controllers/user.controller');
  const { UserService } = await import('../src/services/user.service');
  const app = express();
  app.use(express.json());
  app.use('/user', router);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const headers = {
    authorization: `Bearer ${signAccessToken({ userId: 'synthetic-owner', email: 'fixture@example.invalid', role: 'USER' })}`,
    'Content-Type': 'application/json',
  };
  const base = `http://127.0.0.1:${address.port}/user`;
  const confirmation = 'DELETE MY KAINARA ACCOUNT';
  const remove = (body: unknown, requestHeaders = headers) =>
    fetch(base + '/account', {
      method: 'DELETE',
      headers: requestHeaders,
      body: JSON.stringify(body),
    });
  assert.equal((await remove({ confirmation }, { authorization: '', 'Content-Type': 'application/json' })).status, 401);
  assert.equal((await remove({ confirmation: 'DELETE' })).status, 400);
  assert.equal((await remove({ confirmation, userId: 'another-account' })).status, 400);
  assert.equal((await remove({ confirmation, googleIdToken: 'synthetic-unsupported-credential' })).status, 400);
  assert.equal(transactions, 0);
  const deleted = await remove({ confirmation });
  assert.equal(deleted.status, 200);
  assert.match(deleted.headers.get('set-cookie') ?? '', /nutrimind_refresh=;/);
  assert.equal(transactions, 1);
  assert.deepEqual(
    batch.map(({ model }) => model),
    [
      'plan-evidence',
      'clearance-evidence',
      'usage',
      'clearance-decision',
      'clearance',
      'plan-decision',
      'audit',
      'user',
    ]
  );
  assert.deepEqual(batch.at(-1)?.args, { where: { id: 'synthetic-owner' } });
  assert.deepEqual(batch.at(-2)?.args, {
    data: {
      actorUserId: 'synthetic-owner',
      action: 'USER_SELF_DELETION',
      entityType: 'User',
      entityId: 'synthetic-owner',
      metadata: { initiatedBy: 'SELF_SERVICE', reauthenticationMethod: 'AUTHENTICATED_SESSION' },
    },
  });
  user!.passwordLoginEnabled = true;
  assert.equal((await remove({ confirmation })).status, 400);
  assert.equal((await remove({ confirmation, password: 'Incorrect!123' })).status, 400);
  assert.equal(transactions, 1);
  assert.equal((await remove({ confirmation, password })).status, 200);
  assert.equal(transactions, 2);
  assert.match(JSON.stringify(batch.at(-2)?.args), /PASSWORD/);
  user!.passwordLoginEnabled = false;
  user!.accounts = [];
  assert.equal((await remove({ confirmation })).status, 400);
  user!.accounts = [{ providerAccountId: 'synthetic-subject' }];
  for (const role of ['ADMIN', 'NUTRITIONIST']) {
    user!.role = role;
    assert.equal((await remove({ confirmation })).status, 403);
  }
  user!.role = 'USER';
  user!.isSuspended = true;
  assert.equal((await remove({ confirmation })).status, 401);
  user = null;
  assert.equal((await remove({ confirmation })).status, 401);
  assert.equal(transactions, 2);

  // An explicit initials selection persists without reading the Google account photo.
  const save = t.mock.method(UserService, 'updateUserImage', async (_userId: string, image: string | null) => ({
    image,
  }));
  let result: unknown;
  const response = {
    status: () => response,
    json: (data: unknown) => {
      result = data;
    },
  };
  await UserController.updateAvatar(
    { user: { userId: 'synthetic-owner' }, body: { image: 'Default' } } as never,
    response as never
  );
  assert.deepEqual(save.mock.calls[0].arguments, ['synthetic-owner', 'Default']);
  assert.deepEqual(result, { success: true, data: { image: 'Default' } });
});
