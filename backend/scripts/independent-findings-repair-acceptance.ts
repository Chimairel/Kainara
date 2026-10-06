/** Actual HTTP/PostgreSQL regressions in a fresh disposable DB. No providers or real accounts. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import AuthService from '../src/services/auth.service';
import { updateAccountSettings } from '../src/services/account-settings.service';
import { WaterService } from '../src/services/water.service';
import { AdminDataService } from '../src/services/admin-data.service';
import { updateScheduledMealStatus } from '../src/services/scheduled-meal-log.service';
import { ProgressService } from '../src/services/progress.service';
import { SafetyIntakeService } from '../src/services/safety-intake.service';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '../src/domain/meal-plan-production-safety.policy';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';
import { AppError } from '../src/errors/AppError';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55478');
  assert.equal(target.pathname, '/kainara_independent_repairs');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] || '', '');
  assert.ok(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH);
  const run = randomUUID().slice(0, 8);
  const password = 'SyntheticRepair123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const member = await prisma.user.create({
    data: {
      name: 'Synthetic repair member',
      email: `repair-${run}@example.invalid`,
      passwordHash,
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      acceptedTermsVersion: CURRENT_TERMS_VERSION,
      acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      userProfile: { create: { dailyCalorieTarget: 2000 } },
    },
  });
  const admin = await prisma.user.create({
    data: {
      name: 'Synthetic repair admin',
      email: `repair-admin-${run}@example.invalid`,
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const login = await AuthService.login(member.email, password);
  async function request(route: string, method: string, body: unknown, token = login.accessToken) {
    const response = await fetch(base + route, {
      method,
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      body: (await response.json()) as any,
      cookie: response.headers.get('set-cookie'),
    };
  }
  let probes = 0;
  async function check(name: string, work: () => Promise<void>) {
    await work();
    probes++;
    console.log('PASS', name);
  }
  try {
    await check('malformed email and credential types leave the account unchanged', async () => {
      for (const email of ['not-an-email', '', 'a@', 42, null]) {
        const result = await request('/api/user/profile/settings', 'PUT', { email });
        assert.equal(result.status, 400);
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).email, member.email);
      }
      assert.equal(
        (await request('/api/user/profile/settings', 'PUT', { currentPassword: {}, newPassword: password })).status,
        400
      );
    });
    await check('failed current password preserves the combined email/name/password change', async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      const result = await request('/api/user/profile/settings', 'PUT', {
        email: `wrong-${run}@example.invalid`,
        name: 'Wrong password',
        currentPassword: 'Wrong123!',
        newPassword: 'ChangedRepair123!',
      });
      assert.equal(result.status, 400);
      assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: member.id } }), before);
    });
    await check('new inbox gets a new OTP, loses verification and blocks protected writes', async () => {
      const result = await request('/api/user/profile/settings', 'PUT', { email: `new-${run}@example.invalid` });
      assert.equal(result.status, 200);
      assert.equal(result.body.data.emailVerified, false);
      assert.equal(result.body.data.verificationEmailSent, true);
      const changed = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      assert.ok(changed.emailVerificationToken);
      assert.equal((await request('/api/user/profile/settings', 'PUT', { name: 'Blocked' })).status, 403);
      const mails = (await readFile(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH!, 'utf8'))
        .trim()
        .split(/\r?\n/u)
        .map((line) => JSON.parse(line));
      const mail = mails.filter((row) => row.to === changed.email).at(-1);
      assert.ok(mail?.token);
      assert.equal((await request('/api/auth/verify-email', 'POST', { otp: mail.token })).status, 200);
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).emailVerified, true);
      assert.equal((await request('/api/user/profile/settings', 'PUT', { name: 'Verified again' })).status, 200);
    });
    await check('same normalized inbox retains verification and does not issue another OTP', async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      const result = await updateAccountSettings(member.id, { email: ` ${before.email.toUpperCase()} ` });
      assert.equal(result.emailChanged, false);
      assert.equal(result.user.emailVerified, true);
      assert.equal(result.verificationEmailSent, false);
    });
    await check(
      'duplicate inbox rejects the entire write and mail failure leaves the new inbox unverified',
      async () => {
        const before = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
        assert.equal(
          (await request('/api/user/profile/settings', 'PUT', { email: admin.email, name: 'Must not change' })).status,
          400
        );
        assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: member.id } }), before);
        const fixture = await prisma.user.create({
          data: {
            email: `mail-failure-${run}@example.invalid`,
            name: 'Synthetic delivery failure',
            passwordHash,
            emailVerified: true,
          },
        });
        const path = process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH!;
        try {
          process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = 'C:/Users/chima/Desktop/Nutrimind/.codex-runtime';
          const saved = await updateAccountSettings(fixture.id, { email: `undelivered-${run}@example.invalid` });
          assert.equal(saved.verificationEmailSent, false);
          assert.equal(saved.user.emailVerified, false);
          assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: fixture.id } })).emailVerificationToken);
        } finally {
          process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = path;
        }
      }
    );
    await check('linked Google subject cannot verify a different changed contact inbox', async () => {
      const google = await prisma.user.create({
        data: {
          name: 'Synthetic Google repair',
          email: `google-new-${run}@example.invalid`,
          passwordHash,
          passwordLoginEnabled: false,
          emailVerified: false,
          accounts: { create: { type: 'oauth', provider: 'google', providerAccountId: `repair-google-${run}` } },
        },
      });
      const result = await AuthService.completeGoogleAuth(
        { email: `google-old-${run}@gmail.com`, sub: `repair-google-${run}`, emailAuthoritative: true },
        'CONTINUE'
      );
      assert.equal(result.user.id, google.id);
      assert.equal(result.user.emailVerified, false);
    });
    await check('password change revokes both old refresh sessions and requires new credentials', async () => {
      const current = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      const one = await AuthService.login(current.email, password);
      const two = await AuthService.login(current.email, password);
      await AuthService.forgotPassword(current.email);
      const resetMails = (await readFile(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH!, 'utf8'))
        .trim()
        .split(/\r?\n/u)
        .map((line) => JSON.parse(line));
      const oldReset = resetMails.filter((row) => row.type === 'PASSWORD_RESET' && row.to === current.email).at(-1);
      assert.ok(oldReset?.token);
      const result = await request(
        '/api/user/profile/settings',
        'PUT',
        { currentPassword: password, newPassword: 'ChangedRepair123!' },
        one.accessToken
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.data.requiresSignIn, true);
      assert.match(result.cookie || '', /nutrimind_refresh=;/);
      assert.equal(await prisma.session.count({ where: { userId: member.id } }), 0);
      await assert.rejects(() => AuthService.refreshToken(one.refreshToken));
      await assert.rejects(() => AuthService.refreshToken(two.refreshToken));
      await assert.rejects(() => AuthService.login(current.email, password));
      await assert.rejects(() => AuthService.resetPassword(oldReset.token, 'ReplayReset123!'));
      await AuthService.login(current.email, 'ChangedRepair123!');
    });
    await check('five concurrent water subtraction trials preserve every accepted decrement', async () => {
      for (let trial = 0; trial < 5; trial++) {
        await WaterService.resetToday(member.id);
        await WaterService.add(member.id, 1000);
        const values = await Promise.all([WaterService.remove(member.id, 100), WaterService.remove(member.id, 100)]);
        assert.deepEqual(values.map((row) => row.totalMl).sort(), [800, 900]);
        assert.equal((await WaterService.getToday(member.id)).totalMl, 800);
      }
    });
    await check('water add/remove/reset share the lock and preserve adjacent Manila days', async () => {
      const now = new Date();
      const start = getStartOfManilaBusinessDay(now);
      await prisma.waterLog.create({
        data: { userId: member.id, amountMl: 300, loggedAt: new Date(start.getTime() - 1) },
      });
      await WaterService.resetToday(member.id, now);
      await WaterService.add(member.id, 1000);
      await Promise.all([WaterService.add(member.id, 200), WaterService.remove(member.id, 100)]);
      assert.equal((await WaterService.getToday(member.id, now)).totalMl, 1100);
      await Promise.all([WaterService.resetToday(member.id, now), WaterService.add(member.id, 200)]);
      assert.ok([0, 200].includes((await WaterService.getToday(member.id, now)).totalMl));
      assert.equal(
        await prisma.waterLog.count({ where: { userId: member.id, loggedAt: { lt: start }, amountMl: 300 } }),
        1
      );
    });
    await check('historical scheduled status changes atomically refresh daily totals and API history', async () => {
      await SafetyIntakeService.save(member.id, [
        { domain: 'CONDITION', value: 'NONE', provenance: 'PREDEFINED' },
        { domain: 'ALLERGY', value: 'NONE', provenance: 'PREDEFINED' },
      ]);
      const day = new Date(getStartOfManilaBusinessDay().getTime() - 3 * 86_400_000);
      const cycle = await prisma.mealPlanCycle.create({
        data: {
          id: randomUUID(),
          userId: member.id,
          planType: 'STARTER',
          startDate: day,
          endDate: day,
          preparationOpensAt: day,
          shoppingDeadlineAt: day,
          expectedSlotCount: 3,
        },
      });
      const raw = await prisma.rawRecipeCandidate.create({
        data: {
          sourceRecordId: `repair-${run}`,
          sourceUrl: 'https://example.invalid/synthetic-source',
          recipeName: 'Synthetic software plate',
          normalizedName: 'synthetic software plate',
          contentSignature: randomUUID(),
          cuisines: [],
          dietaryTags: ['OMNIVORE'],
          ingredients: [],
          publishedNutrition: { synthetic: true },
          mealType: 'LUNCH',
        },
      });
      const meal = await prisma.mealPlan.create({
        data: {
          userId: member.id,
          planGroupId: cycle.id,
          mealType: 'LUNCH',
          mealName: 'Synthetic software plate',
          calories: 400,
          proteinG: 20,
          carbsG: 50,
          fatG: 10,
          scheduledDate: day,
          status: 'APPROVED',
          requiresSafetyRevalidation: false,
          baseRecipeSignature: raw.contentSignature,
          composedServingSignature: randomUUID(),
          safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          candidateProvenance: 'RAW_RECIPE_CORPUS',
          sourceRawRecipeCandidateId: raw.id,
        },
      });
      await prisma.dailyNutritionLog.create({
        data: {
          userId: member.id,
          logDate: day,
          totalCalories: 0,
          totalProteinG: 0,
          totalCarbsG: 0,
          totalFatG: 0,
          targetCalories: 2000,
          adherencePct: 0,
        },
      });
      for (const [status, expected] of [
        ['DONE', 400],
        ['PENDING', 0],
        ['DONE', 400],
        ['SKIPPED', 0],
      ] as const) {
        await updateScheduledMealStatus(member.id, meal.id, status);
        const daily = await prisma.dailyNutritionLog.findUniqueOrThrow({
          where: { userId_logDate: { userId: member.id, logDate: day } },
        });
        assert.equal(daily.totalCalories, expected);
        assert.equal(daily.totalProteinG, expected ? 20 : 0);
        assert.equal(daily.adherencePct, expected ? 20 : 0);
        assert.equal(
          (await ProgressService.getProgressHistory(member.id)).dailyNutritionLogs.find((row) => row.id === daily.id)
            ?.totalCalories,
          expected
        );
      }
      await prisma.mealPlan.update({ where: { id: meal.id }, data: { status: 'PENDING_REVIEW' } });
      await assert.rejects(() => updateScheduledMealStatus(member.id, meal.id, 'DONE'));
      assert.equal((await prisma.mealLog.findUniqueOrThrow({ where: { mealPlanId: meal.id } })).status, 'SKIPPED');
    });
    await check('concurrent reference publish and rollback create exactly one transition record each', async () => {
      const source = await prisma.referenceDataSource.create({
        data: {
          code: `repair-${run}`,
          name: 'Synthetic source',
          agencyName: 'Synthetic fixture',
          domain: 'FOOD_CONSUMPTION',
          homepageUrl: 'https://example.invalid',
          attributionText: 'Software verification only',
        },
      });
      const create = (versionLabel: string) =>
        prisma.referenceDataRelease.create({
          data: {
            sourceId: source.id,
            versionLabel,
            sourceUrl: 'https://example.invalid/release',
            retrievedAt: new Date(),
            createdByAdminId: admin.id,
            status: 'STAGED',
          },
        });
      const first = await create('one');
      const second = await create('two');
      async function race(id: string, action: 'PUBLISH' | 'ROLLBACK') {
        const results = await Promise.allSettled(
          Array.from({ length: 3 }, () => AdminDataService.activateRelease(admin.id, id, action))
        );
        assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
        for (const row of results)
          if (row.status === 'rejected') assert.ok(row.reason instanceof AppError && row.reason.statusCode === 409);
        assert.equal(await prisma.referenceDataRelease.count({ where: { sourceId: source.id, status: 'ACTIVE' } }), 1);
      }
      await race(first.id, 'PUBLISH');
      await race(second.id, 'PUBLISH');
      await race(first.id, 'ROLLBACK');
      assert.equal(await prisma.referenceDataReleaseActivation.count({ where: { releaseId: first.id } }), 2);
      assert.equal(await prisma.referenceDataReleaseActivation.count({ where: { releaseId: second.id } }), 1);
      assert.equal(
        await prisma.auditEvent.count({ where: { entityId: first.id, action: 'REFERENCE_DATA_RELEASE_PUBLISHED' } }),
        1
      );
      assert.equal(
        await prisma.auditEvent.count({ where: { entityId: first.id, action: 'REFERENCE_DATA_RELEASE_ROLLED_BACK' } }),
        1
      );
      const adminLogin = await AuthService.login(admin.email, password);
      assert.equal(
        (await request(`/api/admin/data/releases/${first.id}/publish`, 'POST', {}, adminLogin.accessToken)).status,
        409
      );
      assert.equal((await request(`/api/admin/data/releases/${first.id}/publish`, 'POST', {})).status, 403);
      const reviewer = await prisma.user.create({
        data: {
          name: 'Synthetic role denial',
          email: `reviewer-${run}@example.invalid`,
          role: 'NUTRITIONIST',
          emailVerified: true,
          passwordHash,
        },
      });
      const reviewerLogin = await AuthService.login(reviewer.email, password);
      assert.equal(
        (await request(`/api/admin/data/releases/${first.id}/publish`, 'POST', {}, reviewerLogin.accessToken)).status,
        403
      );
      for (const token of [adminLogin.accessToken, reviewerLogin.accessToken])
        assert.equal(
          (await request('/api/user/profile/settings', 'PUT', { email: 'staff-injection@example.invalid' }, token))
            .status,
          403
        );
    });
    console.log(
      JSON.stringify({
        probes,
        passed: probes,
        database: 'isolated localhost 55478/kainara_independent_repairs',
        synthetic: true,
      })
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
