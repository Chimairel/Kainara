import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import type { Request, Response } from 'express';

process.env.JWT_SECRET ||= 'test-only-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret';

test('account switch revokes its refresh session without an access token', async (t) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  const deleted: Array<{ userId: string; sessionToken: string }> = [];
  globals.prisma = {
    session: {
      deleteMany: async ({ where }: { where: { userId: string; sessionToken: string } }) => {
        deleted.push(where);
        return { count: 1 };
      },
    },
  };
  t.after(() => { globals.prisma = previous; });

  const { signRefreshToken } = await import('../src/lib/jwt');
  const { AuthController } = await import('../src/controllers/auth.controller');
  const refreshToken = signRefreshToken({ userId: 'switching-user', email: 'user@example.test', role: 'USER' });
  const cleared: string[] = [];
  let status = 0;
  let response: { success?: boolean } = {};
  const res = {
    clearCookie(name: string) { cleared.push(name); return this; },
    status(value: number) { status = value; return this; },
    json(value: typeof response) { response = value; return this; },
  } as unknown as Response;

  await AuthController.logout({ cookies: { nutrimind_refresh: refreshToken } } as Request, res);
  assert.equal(status, 200);
  assert.equal(response.success, true);
  assert.deepEqual(cleared, ['nutrimind_refresh']);
  assert.deepEqual(deleted, [{
    userId: 'switching-user',
    sessionToken: crypto.createHash('sha256').update(refreshToken).digest('hex'),
  }]);

  await AuthController.logout({ cookies: { nutrimind_refresh: 'expired-or-invalid' } } as Request, res);
  assert.equal(status, 200);
  assert.equal(deleted.length, 1);
});
