import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../src/types';

process.env.JWT_SECRET ||= 'test-only-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret';

test('user and nutritionist gates reuse the live account check without weakening decisions', async (t) => {
  const previousMembershipFlag = process.env.MEMBERSHIP_ENABLED;
  // This fixture exercises the legacy report gate, independently of local .env settings.
  process.env.MEMBERSHIP_ENABLED = 'false';
  t.after(() => {
    if (previousMembershipFlag === undefined) delete process.env.MEMBERSHIP_ENABLED;
    else process.env.MEMBERSHIP_ENABLED = previousMembershipFlag;
  });
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  let userReads = 0;
  let stale = false;
  let suspended = false;
  let verified = true;
  globals.prisma = {
    user: {
      findUnique: async ({ where, select }: { where: { id: string }; select: Record<string, unknown> }) => {
        userReads += 1;
        assert.equal(select.isSuspended, true);
        if (where.id === 'patient')
          return {
            email: 'patient@example.test',
            role: 'USER',
            isSuspended: suspended,
            emailVerified: true,
            onboardingDone: true,
            tosAccepted: true,
            acceptedTermsVersion: '2026-09-27',
            acceptedPrivacyVersion: '2026-09-27',
            nutritionReport: { acknowledgedAt: new Date(), isStale: stale, profileRevision: 4 },
            userProfile: { revision: 4 },
          };
        return {
          email: 'rnd@example.test',
          role: 'NUTRITIONIST',
          isSuspended: false,
          emailVerified: verified,
          onboardingDone: false,
          tosAccepted: false,
          acceptedTermsVersion: null,
          acceptedPrivacyVersion: null,
        };
      },
    },
    nutritionistProfile: {
      findUnique: async () => ({ id: 'rnd-profile', isVerified: true, prcLicenseExpiry: new Date('2030-01-01') }),
    },
    nutritionistApplication: {
      findUnique: async () => ({ status: 'ACTIVATED' }),
    },
  };
  t.after(() => {
    globals.prisma = previous;
  });

  const { authenticate } = await import('../src/middleware/auth');
  const { requireReadyUser } = await import('../src/middleware/userPrerequisites');
  const { requireEligibleNutritionist } = await import('../src/middleware/nutritionistEligibility');
  const { signAccessToken } = await import('../src/lib/jwt');
  const attempt = async (userId: string, role: 'USER' | 'NUTRITIONIST') => {
    const req = {
      headers: { authorization: `Bearer ${signAccessToken({ userId, email: `${userId}@example.test`, role })}` },
    } as AuthenticatedRequest;
    let status = 200;
    let errorCode: string | undefined;
    let authorized = false;
    const res = {
      locals: {},
      status(value: number) {
        status = value;
        return this;
      },
      json(value: { errorCode?: string }) {
        errorCode = value.errorCode;
        return this;
      },
    } as unknown as Response;
    await authenticate(req, res, () => {
      authorized = true;
    });
    if (authorized) {
      authorized = false;
      if (role === 'USER')
        await requireReadyUser(req, res, () => {
          authorized = true;
        });
      else
        await requireEligibleNutritionist(req, res, () => {
          authorized = true;
        });
    }
    return { status, errorCode, authorized, req };
  };

  assert.equal((await attempt('patient', 'USER')).authorized, true);
  assert.equal(userReads, 1);
  stale = true;
  assert.deepEqual(
    await (async () => {
      const { status, errorCode, authorized } = await attempt('patient', 'USER');
      return { status, errorCode, authorized };
    })(),
    { status: 409, errorCode: 'REPORT_ACKNOWLEDGEMENT_REQUIRED', authorized: false }
  );
  assert.equal(userReads, 2);
  suspended = true;
  assert.equal((await attempt('patient', 'USER')).status, 401);
  assert.equal(userReads, 3);
  assert.equal((await attempt('rnd', 'NUTRITIONIST')).authorized, true);
  assert.equal(userReads, 4);
  verified = false;
  assert.equal((await attempt('rnd', 'NUTRITIONIST')).status, 403);
  assert.equal(userReads, 5);

  // Exercise Express mounting as well: /api/user/meals must not pass through
  // the broad /api/user middleware before reaching its own router.
  stale = false;
  suspended = false;
  userReads = 0;
  const { PlanningReadinessService } = await import('../src/services/planning-readiness.service');
  const originalReadiness = PlanningReadinessService.getForUser;
  PlanningReadinessService.getForUser = async () =>
    ({ ready: true }) as unknown as Awaited<ReturnType<typeof originalReadiness>>;
  t.after(() => {
    PlanningReadinessService.getForUser = originalReadiness;
  });
  // Dynamic test-only import avoids pulling app-level Express augmentations
  // into otherwise unrelated compile-only middleware tests.
  const appModule: string = '../src/app';
  const app = (await import(appModule)).default as import('express').Express;
  const server = app.listen(0);
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/user/meals/readiness`, {
    headers: {
      authorization: `Bearer ${signAccessToken({
        userId: 'patient',
        email: 'patient@example.test',
        role: 'USER',
      })}`,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(userReads, 1);
});
