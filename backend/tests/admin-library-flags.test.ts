import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import express from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { flagWholeMeal, flagWholeMealAsAdmin, releaseWholeMeal } from '../src/services/meal-wide-flag.service';
import { NutritionistService } from '../src/services/nutritionist.service';
import adminRouter from '../src/routes/admin-library.routes';
import authenticate from '../src/middleware/auth';
import requireRole from '../src/middleware/rbac';
import { signAccessToken } from '../src/lib/jwt';

function mockDelegate(
  context: TestContext,
  delegate: unknown,
  method: string,
  replacement: (...args: unknown[]) => Promise<unknown>
) {
  const target = delegate as Record<string, unknown>;
  const original = target[method];
  target[method] = replacement;
  context.after(() => {
    target[method] = original;
  });
}

test('admin and nutritionist flags share family blocking, plan revalidation, grocery and notification effects', async (context) => {
  let role = 'ADMIN';
  let suspended = false;
  let alreadyFlagged = false;
  const flags: Array<{ flaggedByNutritionistId: string | null; flaggedByAdminUserId: string | null }> = [];
  const effects: string[] = [];
  const tx = {
    user: { findUnique: async () => ({ role, isSuspended: suspended }) },
    mealLibrary: {
      findUnique: async () => ({ id: 'base', recipeFamilyId: null, sourceRawRecipeCandidateId: null }),
      findMany: async () => ['base', 'portion'].map((id) => ({ id, status: alreadyFlagged ? 'FLAGGED' : 'APPROVED' })),
      updateMany: async ({ data }: { data: { status: string } }) => {
        assert.equal(data.status, 'FLAGGED');
        effects.push('family-blocked');
        return { count: 2 };
      },
    },
    mealLibraryFlag: {
      createMany: async ({ data }: { data: typeof flags }) => {
        flags.push(...data);
      },
    },
    mealPlan: {
      findMany: async () => [{ userId: 'member' }],
      updateMany: async ({ data }: { data: { requiresSafetyRevalidation: boolean } }) => {
        assert.equal(data.requiresSafetyRevalidation, true);
        effects.push('plans-held');
      },
    },
    groceryList: {
      updateMany: async ({ data }: { data: { isStale: boolean } }) => {
        assert.equal(data.isStale, true);
        effects.push('groceries-stale');
      },
    },
    notification: {
      createMany: async () => {
        effects.push('members-notified');
      },
    },
    auditEvent: {
      create: async ({ data }: { data: { actorUserId: string } }) => {
        assert.ok(['admin', 'rnd-user'].includes(data.actorUserId));
        effects.push('audited');
      },
    },
  };
  context.mock.method(
    prisma,
    '$transaction',
    async (callback: (db: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, 'Serializable');
      return callback(tx as unknown as Prisma.TransactionClient);
    }
  );
  mockDelegate(context, prisma.nutritionistProfile, 'findUnique', async () => ({
    id: 'rnd',
    userId: 'rnd-user',
    isVerified: true,
    prcLicenseExpiry: new Date('2099-01-01'),
    user: { role: 'NUTRITIONIST', isSuspended: false },
  }));
  const reason = 'Incorrect ingredient evidence needs review.';
  const result = await flagWholeMealAsAdmin('admin', 'base', reason);
  assert.equal(result.affectedVariants, 2);
  assert.deepEqual(
    flags.map((flag) => [flag.flaggedByAdminUserId, flag.flaggedByNutritionistId]),
    [
      ['admin', null],
      ['admin', null],
    ]
  );
  assert.deepEqual(effects, ['family-blocked', 'plans-held', 'groceries-stale', 'members-notified', 'audited']);
  effects.length = 0;
  await flagWholeMeal('rnd', 'base', reason);
  assert.deepEqual(
    flags.slice(2).map((flag) => [flag.flaggedByAdminUserId, flag.flaggedByNutritionistId]),
    [
      [null, 'rnd'],
      [null, 'rnd'],
    ]
  );
  const mutations = flags.length;
  role = 'USER';
  await assert.rejects(flagWholeMealAsAdmin('admin', 'base', reason), /active administrator/);
  role = 'ADMIN';
  suspended = true;
  await assert.rejects(flagWholeMealAsAdmin('admin', 'base', reason), /active administrator/);
  suspended = false;
  alreadyFlagged = true;
  await assert.rejects(flagWholeMealAsAdmin('admin', 'base', reason), /already flagged/);
  await assert.rejects(flagWholeMealAsAdmin('admin', 'base', 'short'), /reason/);
  assert.equal(flags.length, mutations);
});

test('an uninvolved eligible nutritionist can release an admin flag; its actor cannot self-release after changing roles', async (context) => {
  let reviewerUserId = 'reviewer-user';
  let originalVerifier = 'other-rnd';
  let released = false;
  const tx = {
    mealLibrary: {
      findUnique: async () => ({ id: 'base', recipeFamilyId: null, sourceRawRecipeCandidateId: null }),
      findMany: async (args: { select: { status?: boolean } }) =>
        args.select.status
          ? [{ id: 'base', status: 'FLAGGED' }]
          : [{ verifiedByNutritionistId: originalVerifier, authoredByNutritionistId: null }],
      updateMany: async () => {
        released = true;
        return { count: 1 };
      },
    },
    mealLibraryFlag: {
      findMany: async () => [{ id: 'admin-flag', flaggedByNutritionistId: null, flaggedByAdminUserId: 'admin-user' }],
      updateMany: async () => undefined,
    },
    auditEvent: { create: async () => undefined },
  };
  context.mock.method(prisma, '$transaction', async (callback: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    callback(tx as unknown as Prisma.TransactionClient)
  );
  mockDelegate(context, prisma.nutritionistProfile, 'findUnique', async () => ({
    id: 'reviewer',
    userId: reviewerUserId,
    isVerified: true,
    prcLicenseExpiry: new Date('2099-01-01'),
    user: { role: 'NUTRITIONIST', isSuspended: false },
  }));
  await releaseWholeMeal('reviewer', 'base', 'Checked the corrected ingredient evidence.');
  assert.equal(released, true);
  released = false;
  reviewerUserId = 'admin-user';
  await assert.rejects(releaseWholeMeal('reviewer', 'base', 'Reviewed ingredient evidence.'), /different nutritionist/);
  reviewerUserId = 'reviewer-user';
  originalVerifier = 'reviewer';
  await assert.rejects(
    releaseWholeMeal('reviewer', 'base', 'Reviewed ingredient evidence.'),
    /uninvolved nutritionist/
  );
  assert.equal(released, false);
});

test('admin library HTTP access uses current role and exposes no clinical mutations or private case routes', async (context) => {
  process.env.JWT_SECRET ||= 'synthetic-admin-library-secret';
  let role = 'ADMIN';
  mockDelegate(context, prisma.user, 'findUnique', async () => ({
    email: 'admin@example.invalid',
    role,
    isSuspended: false,
  }));
  context.mock.method(
    NutritionistService,
    'getMealLibraryWithFilters',
    async (_user: string, filters: { verifiedByMe?: boolean }) => {
      assert.equal(filters.verifiedByMe, false);
      return { meals: [], total: 0, limit: 20 };
    }
  );
  context.mock.method(NutritionistService, 'getLibraryMeal', async () => ({ id: 'base', flags: [] }));
  const app = express();
  app.use(express.json());
  app.use('/api/admin/library', authenticate, requireRole('ADMIN'), adminRouter);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/admin/library`;
  const headers = {
    authorization: `Bearer ${signAccessToken({ userId: 'admin', email: 'admin@example.invalid', role: 'ADMIN' })}`,
    'Content-Type': 'application/json',
  };
  assert.equal((await fetch(base)).status, 401);
  for (const denied of ['USER', 'NUTRITIONIST']) {
    role = denied;
    assert.equal((await fetch(base, { headers })).status, 403);
    assert.equal(
      (
        await fetch(`${base}/base/flag`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason: 'Meal needs review.' }),
        })
      ).status,
      403
    );
  }
  role = 'ADMIN';
  assert.equal((await fetch(`${base}?verifiedByMe=true`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/base`, { headers })).status, 200);
  for (const route of ['release-flag', 'safety-evidence/certify', 'derive']) {
    assert.equal((await fetch(`${base}/base/${route}`, { method: 'POST', headers, body: '{}' })).status, 404);
  }
  assert.equal((await fetch(`${base}/base/approvals/PROFILE/private-member`, { headers })).status, 404);
  assert.equal((await fetch(`${base}/base/flag`, { method: 'POST', headers, body: '{"reason":"short"}' })).status, 400);
});
