import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import prisma from '../src/lib/prisma';
import progressRouter from '../src/routes/progress.routes';
import userRouter from '../src/routes/user.routes';
import { ProgressService } from '../src/services/progress.service';
import { WeightLogService } from '../src/services/weight-log.service';
import { MembershipService } from '../src/services/membership.service';
import { signAccessToken } from '../src/lib/jwt';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';

test('Free members can read weight history and log weight through both routes without buying access', async (t) => {
  const settings = { MEMBERSHIP_ENABLED: process.env.MEMBERSHIP_ENABLED, JWT_SECRET: process.env.JWT_SECRET };
  process.env.MEMBERSHIP_ENABLED = 'true';
  process.env.JWT_SECRET = 'synthetic-free-weight-route-test';
  t.after(() => {
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const profile = {
    revision: 1,
    safetyRevision: 1,
    planningReportVersion: 1,
    age: 26,
    weightKg: 65,
    heightCm: 170,
    activityLevel: 'SEDENTARY',
    goal: 'MAINTAIN',
    dailyCalorieTarget: 2000,
  };
  let verified = true,
    role = 'USER';
  let writes = 0;
  const originalUser = prisma.user.findUnique;
  const originalVersion = prisma.nutritionReportVersion.findFirst;
  t.after(() => {
    prisma.user.findUnique = originalUser;
    prisma.nutritionReportVersion.findFirst = originalVersion;
  });
  prisma.user.findUnique = (async () => ({
    email: 'qa@example.invalid',
    role,
    isSuspended: false,
    emailVerified: verified,
    onboardingDone: true,
    tosAccepted: true,
    acceptedTermsVersion: '2026-09-27',
    acceptedPrivacyVersion: '2026-09-27',
    userProfile: profile,
    healthConditions: [{ condition: 'NONE' }],
    allergies: [{ allergen: 'SHELLFISH' }],
    safetyProfileEntries: [],
  })) as unknown as typeof originalUser;
  prisma.nutritionReportVersion.findFirst = (async () => ({
    profileRevision: 1,
    acknowledgedAt: new Date(),
    policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
    profileSnapshot: { profile },
    content: {},
  })) as unknown as typeof originalVersion;
  t.mock.method(MembershipService, 'assertEnhanced', async () => {
    throw Error('Free weight must not call a paid gate');
  });
  const save = async (userId: string, weightKg: number) => {
    assert.equal(userId, 'qa-weight');
    assert.equal(weightKg, 66);
    writes++;
    return { weightKg };
  };
  t.mock.method(ProgressService, 'logWeight', save);
  t.mock.method(WeightLogService, 'logWeight', save);
  t.mock.method(ProgressService, 'getProgressHistory', async () => ({
    weightLogs: [{ weightKg: 65 }],
    dailyNutritionLogs: [],
  }));
  const app = express();
  app.use(express.json());
  app.use('/progress', progressRouter);
  app.use('/user', userRouter);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const headers = {
    authorization: `Bearer ${signAccessToken({ userId: 'qa-weight', email: 'qa@example.invalid', role: 'USER' })}`,
    'Content-Type': 'application/json',
  };
  assert.equal((await fetch(base + '/progress/history', { headers })).status, 200);
  for (const path of ['/progress/weight', '/user/weight-log']) {
    const input = { method: 'POST', headers, body: JSON.stringify({ weightKg: 66 }) };
    assert.ok([200, 201].includes((await fetch(base + path, input)).status));
    assert.equal((await fetch(base + path, { ...input, body: JSON.stringify({ weightKg: 20 }) })).status, 400);
    assert.equal((await fetch(base + path, { ...input, headers: { 'Content-Type': 'application/json' } })).status, 401);
    for (const staffRole of ['ADMIN', 'NUTRITIONIST']) {
      role = staffRole;
      assert.equal((await fetch(base + path, input)).status, 403);
    }
    role = 'USER';
  }
  verified = false;
  assert.equal(
    (await fetch(base + '/progress/weight', { method: 'POST', headers, body: JSON.stringify({ weightKg: 66 }) }))
      .status,
    403
  );
  assert.equal(writes, 2);
});
