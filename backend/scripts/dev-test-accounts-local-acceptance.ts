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
