import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import express from 'express';
import prisma from '../src/lib/prisma';
import { releaseWholeMeal } from '../src/services/meal-wide-flag.service';
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

// Full family blocking, independent review and concurrency acceptance now uses
// actual PostgreSQL in scripts/meal-governance-local-acceptance.ts.
test('legacy release calls cannot bypass version-bound evidence and concern resolution', async () => {
  await assert.rejects(releaseWholeMeal('reviewer', 'base', 'Legacy reason-only release'), /version-bound/);
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
