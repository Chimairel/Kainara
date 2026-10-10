/** Actual SQL/auth checks only on the task-owned account provisioning database. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  accountSpecSchema,
  databaseTarget,
  defaultAccountSpecs,
  fixtureIdentity,
} from './helpers/dev-test-account-config';
import { createAccounts } from './helpers/dev-test-account-writer';
import { evaluateOnboardingStatus } from '../src/domain/onboarding.policy';
import prisma from '../src/lib/prisma';
import { loadPlanningNutritionContext } from '../src/domain/user-nutrition-context';
import { login } from '../src/services/auth/password-auth';
import { isNutritionistEligibleForReview } from '../src/domain/nutritionist-review.policy';
import express from 'express';
import router from '../src/routes/admin-test-accounts.routes';
import authenticate from '../src/middleware/auth';
import requireRole from '../src/middleware/rbac';
import { signAccessToken } from '../src/lib/jwt';
import type { AdminTestAccountsService } from '../src/services/admin-test-accounts.service';
import { testMemberProfileSchema } from '../src/services/dev-test-accounts/member-profile';
import { calculateDailyTarget } from '../src/lib/calculations';

async function responseData<T>(response: Response): Promise<T> {
  return ((await response.json()) as { data: T }).data;
}
type PreviewResult = Awaited<ReturnType<typeof AdminTestAccountsService.preview>>;
type CreateResult = Awaited<ReturnType<typeof AdminTestAccountsService.create>>;

async function main() {
  const target = databaseTarget(process.env.DATABASE_URL ?? '', process.env);
  assert.equal(target.label, '127.0.0.1:55485/kainara_dev_accounts_test');
  assert.equal(process.env.NODE_ENV, 'test');
  const db = new PrismaClient();
  try {
    assert.equal(await db.user.count(), 0, 'Use the fresh task-owned database.');
    const password = randomBytes(24).toString('base64url');
    const plan = await createAccounts(db, 'acceptance', defaultAccountSpecs, password);
    assert.equal(plan.filter((item) => !item.exists).length, 10);
    const userId = fixtureIdentity('acceptance', defaultAccountSpecs[1]).id;
    const healthy = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
        safetyProfileEntries: true,
        mealReminderSettings: true,
      },
    });
    assert.equal(
      evaluateOnboardingStatus({
        onboardingDone: healthy.onboardingDone,
        tosAccepted: healthy.tosAccepted,
        acceptedTermsVersion: healthy.acceptedTermsVersion,
        acceptedPrivacyVersion: healthy.acceptedPrivacyVersion,
        profile: healthy.userProfile,
        conditions: healthy.healthConditions.map((item) => item.condition),
        allergies: healthy.allergies.map((item) => item.allergen),
        safetyEntries: healthy.safetyProfileEntries,
        mealSchedule: healthy.mealReminderSettings,
      }).readyToComplete,
      true
    );
    for (const spec of defaultAccountSpecs) {
      const identity = fixtureIdentity('acceptance', spec);
      const result = await login(identity.email, password);
      assert.equal(result.user.role, identity.role);
      if (spec.role === 'USER') {
        const context = await loadPlanningNutritionContext(db, identity.id, 'Missing fixture');
        assert.ok(context.profile.dailyCalorieTarget);
        assert.deepEqual(
          context.conditions,
          spec.member!.conditions.filter((condition) => condition !== 'NONE')
        );
      }
      if (spec.role === 'RND') {
        const profile = await db.nutritionistProfile.findUniqueOrThrow({ where: { userId: identity.id } });
        assert.ok(isNutritionistEligibleForReview(profile));
        assert.deepEqual(profile.verifiedExpertise, spec.rnd!.expertise);
        assert.equal(profile.verifiedExperienceYears, spec.rnd!.experienceYears);
        assert.equal(await db.nutritionistApplication.count({ where: { invitedUserId: identity.id } }), 0);
      }
    }
    const originalHash = healthy.passwordHash;
    const rerun = await createAccounts(db, 'acceptance', defaultAccountSpecs, randomBytes(24).toString('base64url'));
    assert.equal(
      rerun.every((item) => item.exists),
      true
    );
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash, originalHash);
    assert.equal(await db.auditEvent.count({ where: { action: 'SYNTHETIC_DEV_ACCOUNT_CREATED' } }), 10);
    const negativeSpecs = accountSpecSchema.parse([
      defaultAccountSpecs[0],
      ...['EXPIRED', 'UNVERIFIED', 'SUSPENDED'].map((status) => ({
        alias: `rnd-${status.toLowerCase()}`,
        role: 'RND',
        name: `Test ${status}`,
        rnd: { status },
      })),
    ]);
    await createAccounts(db, 'negative', negativeSpecs, password);
    for (const spec of negativeSpecs.filter((item) => item.role === 'RND')) {
      const identity = fixtureIdentity('negative', spec);
      const profile = await db.nutritionistProfile.findUniqueOrThrow({
        where: { userId: identity.id },
        include: { user: true },
      });
      assert.equal(isNutritionistEligibleForReview(profile), false);
      if (spec.rnd?.status === 'SUSPENDED') await assert.rejects(login(identity.email, password), /suspended/);
    }
    const duplicateSpec = [defaultAccountSpecs[0], { ...defaultAccountSpecs[1], alias: 'new-member' }];
    await Promise.all([
      createAccounts(db, 'concurrent', duplicateSpec, password),
      createAccounts(db, 'concurrent', duplicateSpec, password),
    ]);
    assert.equal(await db.user.count({ where: { id: { startsWith: 'devfixture_concurrent_' } } }), 2);
    // A genuine email collision rejects the entire set; it cannot reset credentials or assign a role.
    const collision = fixtureIdentity('collision', defaultAccountSpecs[1]);
    await db.user.create({
      data: {
        id: 'unrelated-account',
        email: collision.email,
        name: 'Unrelated synthetic control',
        passwordHash: 'unchanged',
      },
    });
    await assert.rejects(
      createAccounts(
        db,
        'collision',
        duplicateSpec.map((item, i) => (i ? defaultAccountSpecs[1] : item)),
        password
      ),
      /collision/
    );
    assert.equal(await db.user.count({ where: { id: { startsWith: 'devfixture_collision_' } } }), 0);
    await db.nutritionistProfile.create({
      data: { userId: 'unrelated-account', prcLicenseNumber: 'TEST-rollback-rnd', prcLicenseExpiry: new Date() },
    });
    const rollbackSpecs = accountSpecSchema.parse([
      defaultAccountSpecs[0],
      { alias: 'rnd', role: 'RND', name: 'Rollback fixture' },
    ]);
    await assert.rejects(createAccounts(db, 'rollback', rollbackSpecs, password));
    assert.equal(await db.user.count({ where: { id: { startsWith: 'devfixture_rollback_' } } }), 0);
    assert.equal(await db.auditEvent.count({ where: { metadata: { path: ['fixtureSet'], equals: 'rollback' } } }), 0);
    assert.equal(await db.mealPlan.count(), 0);
    assert.equal(await db.mealLibrary.count(), 0);
    assert.equal(await db.reviewRoutingConfig.count(), 0);
    // Different custom reviewer names in one group must not collide on synthetic PRC numbers.
    for (const emailName of ['first-reviewer', 'second-reviewer']) {
      const specs = accountSpecSchema.parse([
        defaultAccountSpecs[0],
        { alias: 'rnd-1', name: 'Test reviewer', role: 'RND', emailName },
      ]);
      const result = await createAccounts(db, 'custom-reviewers', specs, password);
      const reviewer = result.find((item) => item.role === 'NUTRITIONIST')!;
      assert.equal(reviewer.email, `${emailName}@example.test`);
      assert.equal((await login(reviewer.email, password)).user.role, 'NUTRITIONIST');
    }
    // Actual HTTP creation on this same disposable database, with normal live auth.
    const adminId = fixtureIdentity('acceptance', defaultAccountSpecs[0]).id;
    const app = express();
    app.use(express.json());
    app.use('/accounts', authenticate, requireRole('ADMIN'), router);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/accounts`;
    const headers = {
      'Content-Type': 'application/json',
      authorization: `Bearer ${signAccessToken({ userId: adminId, email: 'fixture@example.test', role: 'ADMIN' })}`,
    };
    try {
      assert.equal((await fetch(url)).status, 401);
      for (const spec of defaultAccountSpecs.filter((item) => item.role !== 'ADMIN')) {
        const identity = fixtureIdentity('acceptance', spec);
        const denied = await fetch(url, {
          headers: {
            authorization: `Bearer ${signAccessToken({ userId: identity.id, email: identity.email, role: identity.role })}`,
          },
        });
        assert.equal(denied.status, 403);
      }
      const request = {
        emailName: 'case-member',
        set: 'ui',
        role: 'USER',
        name: 'UI Member',
        count: 2,
        conditions: ['DIABETES'],
        allergens: ['NUTS'],
        rndStatus: 'ACTIVE',
        profile: testMemberProfileSchema.parse({
          age: 45,
          biologicalSex: 'FEMALE',
          heightCm: 165,
          weightKg: 72,
          targetWeightKg: 65,
          goal: 'LOSE_WEIGHT',
          activityLevel: 'ACTIVE',
          dietaryPreference: 'PESCATARIAN',
          ricePreference: 'NO_RICE',
          shoppingDayOfWeek: 2,
        }),
      };
      const post = (path: string, body: object) =>
        fetch(`${url}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      assert.equal((await post('/preview', request)).status, 404, 'Test runtime cannot enable the UI writer.');
      process.env.NODE_ENV = 'production';
      assert.equal((await post('/preview', request)).status, 404);
      process.env.NODE_ENV = 'development';
      const capability = await responseData<{ available: boolean }>(await fetch(url, { headers }));
      assert.equal(capability.available, true);
      const preview = await responseData<PreviewResult>(await post('/preview', request));
      assert.equal(await db.user.count({ where: { id: { startsWith: 'devfixture_ui_' } } }), 0);
      assert.equal(
        (await post('', { ...request, previewToken: preview.previewToken, confirmedTarget: false })).status,
        400
      );
      assert.equal(
        (await post('', { ...request, count: 3, previewToken: preview.previewToken, confirmedTarget: true })).status,
        400
      );
      const response = await post('', { ...request, previewToken: preview.previewToken, confirmedTarget: true });
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const created = await responseData<CreateResult>(response);
      assert.ok(created.newAccountPassword);
      assert.equal(created.accounts.length, 2);
      assert.deepEqual(
        created.accounts.map((account) => account.email),
        ['case-member-1@example.test', 'case-member-2@example.test']
      );
      const memberLogin = await login(created.accounts[0].email, created.newAccountPassword);
      assert.equal(memberLogin.user.role, 'USER');
      const saved = await db.user.findUniqueOrThrow({ where: { id: created.accounts[0].id } });
      const selectedContext = await loadPlanningNutritionContext(db, saved.id, 'Missing test profile');
      for (const [key, value] of Object.entries(request.profile))
        assert.equal((selectedContext.profile as unknown as Record<string, unknown>)[key], value);
      assert.equal(
        selectedContext.profile.dailyCalorieTarget,
        calculateDailyTarget(request.profile).dailyCalorieTarget
      );
      assert.equal(selectedContext.profile.shoppingDayGroup, 'WEEKDAY');
      const selectedReport = await db.nutritionReportVersion.findFirstOrThrow({ where: { userId: saved.id } });
      const snapshot = selectedReport.profileSnapshot as {
        profile: Record<string, unknown>;
        planningTargets: { basis: string; calories: number };
      };
      assert.equal(snapshot.profile.weightKg, 72);
      assert.equal(snapshot.planningTargets.calories, selectedContext.profile.dailyCalorieTarget);
      assert.equal(
        snapshot.planningTargets.basis,
        'REVIEW_REFERENCE',
        'Conditions retain ordinary macro review policy.'
      );
      const kept = await responseData<CreateResult>(
        await post('', { ...request, previewToken: preview.previewToken, confirmedTarget: true })
      );
      assert.equal(kept.newAccountPassword, null);
      assert.ok(kept.accounts.every((item: { exists: boolean }) => item.exists));
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: saved.id } })).passwordHash, saved.passwordHash);
      const changedRequest = { ...request, profile: { ...request.profile, weightKg: 73 } };
      assert.equal(
        (await post('', { ...changedRequest, previewToken: preview.previewToken, confirmedTarget: true })).status,
        400
      );
      const changedPreview = await responseData<PreviewResult>(await post('/preview', changedRequest));
      const unchanged = await responseData<CreateResult>(
        await post('', { ...changedRequest, previewToken: changedPreview.previewToken, confirmedTarget: true })
      );
      assert.equal(unchanged.newAccountPassword, null);
      assert.equal((await db.userProfile.findUniqueOrThrow({ where: { userId: saved.id } })).weightKg, 72);
      for (const status of ['ACTIVE', 'EXPIRED', 'UNVERIFIED', 'SUSPENDED']) {
        const rndRequest = {
          ...request,
          emailName: `reviewer-${status.toLowerCase()}`,
          profile: undefined,
          set: `ui-${status.toLowerCase()}`,
          count: 1,
          role: 'RND',
          conditions: ['NONE'],
          allergens: ['NONE'],
          rndStatus: status,
        };
        const rndPreview = await responseData<PreviewResult>(await post('/preview', rndRequest));
        const rndResponse = await post('', {
          ...rndRequest,
          previewToken: rndPreview.previewToken,
          confirmedTarget: true,
        });
        assert.equal(rndResponse.status, 201);
        const result = await responseData<CreateResult>(rndResponse);
        assert.equal(result.accounts[0].email, `reviewer-${status.toLowerCase()}@example.test`);
        assert.ok(result.newAccountPassword);
        assert.equal(result.newAccountPassword, created.newAccountPassword, 'New groups/roles share a password.');
        const rndProfile = await db.nutritionistProfile.findUniqueOrThrow({
          where: { userId: result.accounts[0].id },
          include: { user: true },
        });
        assert.equal(rndProfile.verifiedByAdminId, adminId);
        assert.equal(isNutritionistEligibleForReview(rndProfile), status === 'ACTIVE');
        if (status === 'SUSPENDED')
          await assert.rejects(login(result.accounts[0].email, result.newAccountPassword), /suspended/);
        else assert.equal((await login(result.accounts[0].email, result.newAccountPassword)).user.role, 'NUTRITIONIST');
      }
      const adminRequest = {
        ...request,
        emailName: 'demo-admin',
        profile: undefined,
        set: 'ui-admin',
        count: 1,
        role: 'ADMIN',
        conditions: ['NONE'],
        allergens: ['NONE'],
      };
      const adminPreview = await responseData<PreviewResult>(await post('/preview', adminRequest));
      const adminResponse = await post('', {
        ...adminRequest,
        previewToken: adminPreview.previewToken,
        confirmedTarget: true,
      });
      assert.equal(adminResponse.status, 201);
      const newAdmin = await responseData<CreateResult>(adminResponse);
      assert.ok(newAdmin.newAccountPassword);
      assert.equal(newAdmin.newAccountPassword, created.newAccountPassword);
      assert.equal((await login(newAdmin.accounts[0].email, newAdmin.newAccountPassword)).user.role, 'ADMIN');
      const audits = await db.auditEvent.findMany({
        where: { actorUserId: adminId, action: 'SYNTHETIC_DEV_ACCOUNT_CREATED' },
      });
      assert.equal(audits.length, 7);
      assert.ok(audits.every((item) => item.actorRole === 'ADMIN' && item.actorName));
      assert.ok(!JSON.stringify(audits).includes(created.newAccountPassword));
      assert.equal(await db.mealPlan.count(), 0);
      console.log(
        'PASS: admin-only HTTP previews, runtime blocks, target confirmation, custom profiles and snapshots, tampering refusal, shared new-group/role passwords, unchanged existing credentials, four RND states and secret-free actor audit.'
      );
    } finally {
      process.env.NODE_ENV = 'test';
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    console.log(
      'PASS: ten real role logins, complete onboarding/report baselines, test expertise, denied expired/unverified/suspended RNDs, create-only reruns, concurrent creation, collisions/transaction rollback and no meals/routing configuration changed.'
    );
  } finally {
    await db.$disconnect();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error('Guarded account acceptance failed. No shared target is permitted.', {
    name: error?.name,
    code: error?.code,
    location: String(error?.stack)
      .split('\n')
      .find((line) => line.includes('dev-test-'))
      ?.trim(),
  });
  process.exitCode = 1;
});
