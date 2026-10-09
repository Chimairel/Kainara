/** Real HTTP/SQL acceptance. Only a fresh task-owned loopback database is allowed. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Role } from '@prisma/client';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { libraryBaseRevisionKey } from '../src/services/meal-base-admission.service';
import { CertifiedSlotFallbackService } from '../src/services/certified-slot-fallback.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55488');
  assert.equal(target.pathname, '/kainara_rnd_canvas');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.MEMBERSHIP_ENABLED, 'false');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  assert.equal(await prisma.user.count(), 0, 'Use a fresh disposable database');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1', 'External providers are disabled');
    return nativeFetch(input, init);
  };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const marker = randomUUID();
  let sequence = 0;
  const account = (role: Role) =>
    prisma.user.create({
      data: {
        role,
        name: `Synthetic ${role}`,
        email: `${marker}-${++sequence}@example.invalid`,
        passwordHash: 'NON_LOGIN_FIXTURE',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      },
    });
  type Actor = Awaited<ReturnType<typeof account>>;
  const request = async (actor: Actor, path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: (await response.json()) as { success?: boolean; data?: any; error?: string },
    };
  };
  const ok = async (promise: ReturnType<typeof request>) => {
    const result = await promise;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.data;
  };
  const passed: string[] = [],
    pass = (name: string) => {
      passed.push(name);
      console.log(`PASS ${name}`);
    };
  try {
    const member = await account('USER'),
      rnd = await account('NUTRITIONIST'),
      other = await account('NUTRITIONIST');
    const reviewer = await prisma.nutritionistProfile.create({
      data: { userId: rnd.id, isVerified: true, prcLicenseNumber: marker, prcLicenseExpiry: new Date('2099-01-01') },
    });
    await prisma.nutritionistProfile.create({
      data: {
        userId: other.id,
        isVerified: true,
        prcLicenseNumber: marker + '-other',
        prcLicenseExpiry: new Date('2099-01-01'),
      },
    });
    await prisma.userProfile.create({
      data: {
        userId: member.id,
        age: 28,
        biologicalSex: 'MALE',
        heightCm: 170,
        weightKg: 65,
        goal: 'MAINTAIN',
        activityLevel: 'SEDENTARY',
        dietaryPreference: 'OMNIVORE',
        dailyCalorieTarget: 2000,
      },
    });
    const food = await prisma.foodItem.create({
      data: {
        name: 'Synthetic squash',
        source: 'FNRI',
        category: 'Vegetables',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
      },
    });
    const library = async (name: string, calories = 800, verified = true) => {
      const ingredients = [
        {
          ingredientName: food.name,
          foodItemId: food.id,
          quantity: calories / 2,
          unit: 'g',
          category: 'PRODUCE',
          dataSource: 'FNRI' as const,
          position: 0,
        },
      ];
      const nutrition = { calories, proteinG: calories / 20, carbsG: calories / 10, fatG: calories / 40 };
      const signature = buildMealLibraryRecipeSignature({
        mealName: name,
        mealType: 'LUNCH',
        ...nutrition,
        ingredients,
      });
      const meal = await prisma.mealLibrary.create({
        data: {
          mealName: name,
          mealType: 'LUNCH',
          ...nutrition,
          description: 'Measured synthetic software fixture',
          status: 'APPROVED',
          dietaryTags: ['OMNIVORE'],
          recipeSignature: signature,
          verifiedByNutritionistId: reviewer.id,
          safetyReviewedByNutritionistId: reviewer.id,
          safetyReviewedAt: new Date(),
          safetyEvidenceStatus: 'COMPLETE',
          safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
          safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
          safetyEvidenceRevision: 1,
          certifiedEvidenceRevision: 1,
          conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
          allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
          crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
          nutritionEvidenceSource: 'FNRI_RECONCILED',
          nutritionServingDescription: `${calories / 2} g`,
          riceRole: 'STANDALONE',
          riceRoleReviewStatus: 'REVIEWED',
          applicableMealTypes: { create: { mealType: 'LUNCH' } },
          ingredients: { create: ingredients },
        },
      });
      if (verified)
        await prisma.mealBaseVerification.create({
          data: {
            targetKind: 'LIBRARY_MEAL',
            targetId: meal.id,
            revisionKey: libraryBaseRevisionKey(signature, meal.description),
            status: 'VERIFIED',
            reviewedByNutritionistId: reviewer.id,
            reviewedAt: new Date(),
            rationale: 'Synthetic base evidence reviewed.',
          },
        });
      return meal;
    };
    const eligible = await library('Synthetic eligible soup');
    const incompatible = await library('Synthetic over-target soup', 1500);
    const unverified = await library('Synthetic unverified soup', 800, false);
    let cycleNumber = 0;
    const slot = async () => {
      const start = new Date('2090-01-01');
      start.setUTCDate(start.getUTCDate() + ++cycleNumber);
      const cycle = await prisma.mealPlanCycle.create({
        data: {
          id: randomUUID(),
          userId: member.id,
          planType: 'WEEKLY',
          startDate: start,
          endDate: start,
          preparationOpensAt: start,
          shoppingDeadlineAt: start,
          expectedSlotCount: 1,
          snapshot: {
            create: {
              userId: member.id,
              profileRevision: 0,
              safetyRevision: 0,
              weightKg: 65,
              activityLevel: 'SEDENTARY',
              goal: 'MAINTAIN',
              dailyCalorieTarget: 2000,
              dailyMacroTargets: {},
              dietaryPreference: 'OMNIVORE',
              planningGeographyLevel: 'NATIONAL',
            },
          },
        },
      });
      await prisma.groceryList.create({
        data: { userId: member.id, planGroupId: cycle.id, weekLabel: 'Synthetic fixture' },
      });
      return prisma.mealPlan.create({
        data: {
          userId: member.id,
          planGroupId: cycle.id,
          mealType: 'LUNCH',
          mealName: 'Synthetic original',
          calories: 800,
          proteinG: 40,
          carbsG: 80,
          fatG: 20,
          scheduledDate: start,
          status: 'PENDING_REVIEW',
          claimedByNutritionistId: reviewer.id,
          claimedAt: new Date(),
        },
      });
    };
    const options = (id: string, actor = rnd) => request(actor, `/nutritionist/queue/${id}/swap-options`);
    const payload = (preview: { expectedVersion: string }, meal = eligible) => ({
      libraryMealId: meal.id,
      expectedVersion: preview.expectedVersion,
      expectedRecipeSignature: meal.recipeSignature!,
      expectedEvidenceRevision: meal.safetyEvidenceRevision,
      note: 'Selected the measured replacement after reviewing this member.',
    });
    const swap = (id: string, body: unknown, actor = rnd) =>
      request(actor, `/nutritionist/queue/${id}/swap`, 'POST', body);
    const initial = await slot(),
      preview = await ok(options(initial.id));
    assert(preview.options.some((meal: { id: string }) => meal.id === eligible.id));
    assert(!preview.options.some((meal: { id: string }) => [incompatible.id, unverified.id].includes(meal.id)));
    assert.equal((await options(initial.id, member)).status, 403);
    assert.equal((await options(initial.id, other)).status, 409);
    pass('role, claim and eligible preview filters');
    assert.equal((await swap(initial.id, { ...payload(preview), ingredients: [] })).status, 400);
    assert.equal((await swap(initial.id, payload(preview, incompatible))).status, 409);
    assert.equal((await swap(initial.id, payload(preview, unverified))).status, 409);
    pass('tampered and ineligible replacements are rejected');
    const outcomes = await Promise.all([swap(initial.id, payload(preview)), swap(initial.id, payload(preview))]);
    assert.equal(outcomes.filter((result) => result.status === 200).length, 1);
    const original = await prisma.mealPlan.findUniqueOrThrow({ where: { id: initial.id } });
    assert.equal(original.mealName, initial.mealName);
    assert.equal(original.status, 'CANCELLED');
    const replacement = await prisma.mealPlan.findUniqueOrThrow({
      where: { id: original.supersededByMealPlanId! },
      include: { ingredients: true },
    });
    assert.equal(replacement.status, 'APPROVED');
    assert.equal(replacement.libraryMealId, eligible.id);
    assert.equal(replacement.nutritionistId, reviewer.id);
    assert.equal(replacement.ingredients[0].quantity, 400);
    assert.equal(await prisma.mealPlan.count({ where: { planGroupId: initial.planGroupId, status: 'APPROVED' } }), 1);
    assert.equal(
      await prisma.mealPlanReviewDecision.count({
        where: { mealPlanId: replacement.id, nutritionistProfileId: reviewer.id },
      }),
      1
    );
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: replacement.id, action: 'MEAL_PLAN_SLOT_CERTIFIED_FALLBACK_SELECTED' },
    });
    assert.equal(audit.actorUserId, rnd.id);
    assert.equal((audit.metadata as { rationale: string }).rationale, payload(preview).note);
    assert.equal(
      (await prisma.groceryList.findUniqueOrThrow({ where: { planGroupId: initial.planGroupId } })).isStale,
      true
    );
    assert.equal(await prisma.notification.count({ where: { userId: member.id, type: 'PLAN_APPROVED' } }), 1);
    assert(
      (await ok(request(rnd, '/nutritionist/audit-history'))).rows.some((row: { id: string }) => row.id === audit.id)
    );
    pass(
      'one atomic replacement under concurrent submissions with attribution, immutable decision, audit, groceries and notification'
    );
    const checks = [
      [
        'changed source',
        async (id: string) => {
          await prisma.mealPlan.update({ where: { id }, data: { calories: 801 } });
        },
      ],
      [
        'expired claim',
        async (id: string) => {
          await prisma.mealPlan.update({ where: { id }, data: { claimedAt: new Date(0) } });
        },
      ],
      [
        'changed member safety',
        async () => {
          await prisma.userProfile.update({ where: { userId: member.id }, data: { safetyRevision: { increment: 1 } } });
        },
      ],
      [
        'changed replacement evidence',
        async () => {
          await prisma.mealLibrary.update({ where: { id: eligible.id }, data: { safetyEvidenceRevision: 2 } });
        },
      ],
    ] as const;
    for (const [name, change] of checks) {
      const source = await slot(),
        before = await ok(options(source.id));
      await change(source.id);
      assert.equal((await swap(source.id, payload(before))).status, 409, name);
      assert.equal(await prisma.mealPlan.count({ where: { planGroupId: source.planGroupId } }), 1);
      await prisma.mealLibrary.update({ where: { id: eligible.id }, data: { safetyEvidenceRevision: 1 } });
      pass(name + ' cannot publish a replacement');
    }
    const held = await slot(),
      beforeHold = await ok(options(held.id));
    const lineage = await prisma.mealReviewLineage.create({
      data: { key: `recipe:${eligible.id}`, state: 'QUARANTINED' },
    });
    assert.equal((await swap(held.id, payload(beforeHold))).status, 409);
    await prisma.mealReviewLineage.delete({ where: { id: lineage.id } });
    pass('quarantine hold is rechecked inside transaction');
    for (const kind of ['frozen', 'past', 'expired-rnd'] as const) {
      const source = await slot(),
        before = await ok(options(source.id));
      if (kind === 'frozen')
        await prisma.mealPlanCycle.update({
          where: { id: source.planGroupId },
          data: { shoppingStartedAt: new Date() },
        });
      if (kind === 'past')
        await prisma.mealPlan.update({ where: { id: source.id }, data: { scheduledDate: new Date('2000-01-01') } });
      if (kind === 'expired-rnd')
        await prisma.nutritionistProfile.update({
          where: { id: reviewer.id },
          data: { prcLicenseExpiry: new Date('2000-01-01') },
        });
      assert.notEqual((await swap(source.id, payload(before))).status, 200);
      await prisma.nutritionistProfile.update({
        where: { id: reviewer.id },
        data: { prcLicenseExpiry: new Date('2099-01-01') },
      });
      assert.equal(await prisma.mealPlan.count({ where: { planGroupId: source.planGroupId } }), 1);
      pass(kind + ' is blocked');
    }
    const automatic = await slot();
    assert.equal(
      (
        await CertifiedSlotFallbackService.replaceWithBestCertified({
          mealPlanId: automatic.id,
          tolerance: 0.15,
          reasonCode: 'EXISTING_REJECTION_FALLBACK',
          expectedStatus: 'PENDING_REVIEW',
        })
      ).replaced,
      true
    );
    pass('existing automatic certified fallback still works');
    console.log(JSON.stringify({ passed: passed.length, cases: passed }));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
