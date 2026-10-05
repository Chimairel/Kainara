import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../src/types';

process.env.JWT_SECRET ||= 'test-only-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret';

test('profile bootstrap checks current account status and returns the profile with one user read', async (t) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  let reads = 0;
  let suspended = false;
  globals.prisma = {
    user: {
      findUnique: async ({ select }: { select: Record<string, unknown> }) => {
        reads += 1;
        assert.equal(select.isSuspended, true);
        return {
          id: 'bootstrap-user',
          name: 'Test Admin',
          email: 'admin@example.test',
          role: 'ADMIN',
          isSuspended: suspended,
          emailVerified: true,
          passwordLoginEnabled: true,
          tosAccepted: true,
          tosAcceptedAt: new Date(),
          acceptedTermsVersion: null,
          acceptedPrivacyVersion: null,
          healthDataConsentedAt: null,
          onboardingDone: true,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userProfile: null,
          healthConditions: [],
          allergies: [],
          safetyProfileEntries: [],
          nutritionReport: null,
          accounts: [],
        };
      },
    },
  };
  t.after(() => {
    globals.prisma = previous;
  });

  const { authenticateProfile } = await import('../src/middleware/auth');
  const { UserController } = await import('../src/controllers/user.controller');
  const { signAccessToken } = await import('../src/lib/jwt');
  const token = signAccessToken({ userId: 'bootstrap-user', email: 'admin@example.test', role: 'ADMIN' });
  const makeRequest = () => ({ headers: { authorization: `Bearer ${token}` } }) as AuthenticatedRequest;
  let status = 200;
  let body: { success?: boolean; data?: Record<string, unknown> } = {};
  const res = {
    locals: {},
    set() {
      return this;
    },
    status(value: number) {
      status = value;
      return this;
    },
    json(value: typeof body) {
      body = value;
      return this;
    },
  } as unknown as Response;

  const req = makeRequest();
  let authorized = false;
  await authenticateProfile(req, res, () => {
    authorized = true;
  });
  assert.equal(authorized, true);
  await UserController.getProfile(req, res);
  assert.equal(status, 200);
  assert.equal(reads, 1);
  assert.equal(body.data?.email, 'admin@example.test');
  assert.equal(body.data?.isSuspended, undefined);

  suspended = true;
  authorized = false;
  await authenticateProfile(makeRequest(), { ...res, locals: {} } as Response, () => {
    authorized = true;
  });
  assert.equal(authorized, false);
  assert.equal(status, 401);
  assert.equal(reads, 2);
});
