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
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { NotificationService } from '../src/services/notification.service';
import { ReviewRoutingService } from '../src/services/review-routing.service';
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
    await prisma.safetyProfileEntry.createMany({
      data: ['CONDITION', 'ALLERGY'].map((domain) => ({
        userId: member.id,
        domain: domain as 'CONDITION' | 'ALLERGY',
        canonicalCode: 'NONE',
        normalizedText: 'none',
        displayName: 'None',
        originalText: 'None',
        policyReference: 'SYNTHETIC_NONE',
        provenance: 'PREDEFINED' as const,
        supportState: 'SUPPORTED' as const,
      })),
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
    assert.equal(replacement.status, 'PENDING_REVIEW');
    assert.equal(replacement.reviewApprovalCount, 0);
    assert.equal(replacement.requiresSafetyRevalidation, true);
    assert.equal(replacement.claimedByNutritionistId, reviewer.id);
    assert.equal(replacement.claimedAt?.getTime(), initial.claimedAt?.getTime());
    assert.equal(replacement.reviewedAt, null);
    assert.equal(replacement.profileApprovalId, null);
    assert.equal(replacement.libraryMealId, eligible.id);
    assert.equal(replacement.nutritionistId, null);
    assert.equal(replacement.ingredients[0].quantity, 400);
    assert.equal(await prisma.mealPlan.count({ where: { planGroupId: initial.planGroupId, status: 'APPROVED' } }), 0);
    assert.equal(
      await prisma.mealPlanReviewDecision.count({
        where: { mealPlanId: replacement.id, nutritionistProfileId: reviewer.id },
      }),
      0
    );
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: replacement.id, action: 'MEAL_PLAN_SLOT_REPLACED_PENDING_REVIEW' },
    });
    assert.equal(audit.actorUserId, rnd.id);
    assert.equal((audit.metadata as { rationale: string }).rationale, payload(preview).note);
    assert.equal(
      (await prisma.groceryList.findUniqueOrThrow({ where: { planGroupId: initial.planGroupId } })).isStale,
      true
    );
    assert.equal(await prisma.notification.count({ where: { userId: member.id, type: 'PLAN_APPROVED' } }), 0);
    assert(
      (await ok(request(rnd, '/nutritionist/audit-history'))).rows.some((row: { id: string }) => row.id === audit.id)
    );
    pass(
      'one atomic pending replacement under concurrent submissions, preserved claim, no approval or notification, audit and stale groceries'
    );
    assert.equal(
      (
        await CertifiedSlotFallbackService.replaceWithBestCertified({
          mealPlanId: replacement.id,
          tolerance: 0.15,
          reasonCode: 'SHOPPING_DEADLINE_WIDER_TOLERANCE',
          expectedStatus: 'PENDING_REVIEW',
        })
      ).replaced,
      false
    );
    const competing = await prisma.mealPlan.create({
      data: {
        userId: member.id,
        planGroupId: replacement.planGroupId,
        mealType: replacement.mealType,
        scheduledDate: replacement.scheduledDate,
        mealName: 'Synthetic competing candidate',
        calories: 800,
        proteinG: 40,
        carbsG: 80,
        fatG: 20,
        status: 'PENDING_REVIEW',
      },
    });
    assert.equal(
      (
        await CertifiedSlotFallbackService.replaceWithBestCertified({
          mealPlanId: competing.id,
          tolerance: 0.15,
          reasonCode: 'SHOPPING_DEADLINE_WIDER_TOLERANCE',
          expectedStatus: 'PENDING_REVIEW',
        })
      ).replaced,
      false
    );
    await prisma.mealPlanCycle.update({
      where: { id: replacement.planGroupId },
      data: { shoppingDeadlineAt: new Date(0) },
    });
    await UpcomingPlanPreparationService.reconcileDeadline(member.id, replacement.planGroupId);
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: replacement.id } })).status, 'PENDING_REVIEW');
    pass('deadline fallback cannot approve, replace or cancel a pending RND-selected meal');
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: competing.id } })).status, 'PENDING_REVIEW');
    await prisma.mealPlan.update({ where: { id: competing.id }, data: { status: 'CANCELLED' } });
    const replacementDetail = await ok(request(rnd, `/nutritionist/queue/${replacement.id}`));
    assert.equal(replacementDetail.mealPlan.status, 'PENDING_REVIEW');
    assert.equal(replacementDetail.claimStatus.claimedByMe, true);
    const pendingLog = await request(member, `/user/meals/${replacement.id}/status`, 'PATCH', { status: 'DONE' });
    assert.equal(pendingLog.status, 409);
    assert.equal(await prisma.mealLog.count({ where: { mealPlanId: replacement.id } }), 0);
    await ok(
      request(rnd, `/nutritionist/review/${replacement.id}`, 'PATCH', {
        action: 'approve',
        note: 'Separately inspected the replacement and approved.',
      })
    );
    const approvedReplacement = await prisma.mealPlan.findUniqueOrThrow({ where: { id: replacement.id } });
    assert.equal(approvedReplacement.status, 'APPROVED');
    assert.equal(approvedReplacement.nutritionistId, reviewer.id);
    assert.equal(approvedReplacement.reviewApprovalCount, 1);
    assert.equal(approvedReplacement.claimedByNutritionistId, null);
    assert.equal(
      await prisma.mealPlanReviewDecision.count({ where: { mealPlanId: replacement.id, decision: 'APPROVE' } }),
      1
    );
    pass('replacement remains inspectable and only a separate explicit decision approves it');
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
    const today = getStartOfManilaBusinessDay();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const current = await slot(),
      upcoming = await slot();
    await prisma.mealPlan.update({
      where: { id: current.id },
      data: { scheduledDate: today, candidateProvenance: 'RAW_RECIPE_CORPUS' },
    });
    await prisma.mealPlan.update({ where: { id: upcoming.id }, data: { candidateProvenance: 'RAW_RECIPE_CORPUS' } });
    await prisma.mealPlanCycle.update({
      where: { id: current.planGroupId },
      data: {
        startDate: today,
        endDate: new Date(today.getTime() + 7 * 86_400_000),
        preparationOpensAt: today,
        shoppingDeadlineAt: today,
      },
    });
    const expired = await slot(),
      ended = await slot(),
      completed = await slot(),
      superseded = await slot(),
      replaced = await slot();
    for (const meal of [expired, ended, completed, superseded, replaced])
      await prisma.mealPlan.update({ where: { id: meal.id }, data: { candidateProvenance: 'RAW_RECIPE_CORPUS' } });
    await prisma.mealPlan.update({ where: { id: expired.id }, data: { scheduledDate: yesterday } });
    await prisma.mealPlanCycle.update({
      where: { id: ended.planGroupId },
      data: { startDate: yesterday, endDate: yesterday, preparationOpensAt: yesterday, shoppingDeadlineAt: yesterday },
    });
    await prisma.mealPlanCycle.update({ where: { id: completed.planGroupId }, data: { status: 'COMPLETED' } });
    await prisma.mealPlanCycle.update({
      where: { id: superseded.planGroupId },
      data: { supersededById: current.planGroupId },
    });
    await prisma.mealPlan.update({ where: { id: replaced.id }, data: { supersededByMealPlanId: current.id } });
    const historical = await prisma.mealPlanReviewDecision.create({
      data: {
        mealPlanId: expired.id,
        nutritionistProfileId: reviewer.id,
        stage: 'PRIMARY',
        decision: 'APPROVE',
        rationale: 'Recorded earlier synthetic review.',
        evidenceSnapshot: { calories: 800, source: 'SYNTHETIC_HISTORY' },
      },
    });
    const historicalAudit = await prisma.auditEvent.create({
      data: {
        actorUserId: rnd.id,
        actorName: rnd.name,
        actorRole: 'NUTRITIONIST',
        action: 'MEAL_PLAN_APPROVED',
        entityType: 'MealPlan',
        entityId: expired.id,
        metadata: { rationale: historical.rationale },
      },
    });
    const oldDispute = await slot(),
      newDispute = await slot();
    await prisma.mealPlan.update({
      where: { id: oldDispute.id },
      data: { scheduledDate: yesterday, status: 'DISPUTED' },
    });
    await prisma.mealPlan.update({ where: { id: newDispute.id }, data: { status: 'DISPUTED' } });
    const inactive = [expired, ended, completed, superseded, replaced];
    const rowsBefore = await prisma.mealPlan.count();
    for (const routingEnabled of [false, true]) {
      await prisma.reviewRoutingConfig.upsert({
        where: { id: 'global' },
        create: { id: 'global', enabled: routingEnabled },
        update: { enabled: routingEnabled },
      });
      for (const actor of [rnd, other]) {
        const activeQueue = await ok(request(actor, '/nutritionist/queue'));
        assert(activeQueue.some((meal: { id: string }) => meal.id === current.id));
        assert(activeQueue.some((meal: { id: string }) => meal.id === upcoming.id));
        assert(!activeQueue.some((meal: { id: string }) => inactive.some((old) => old.id === meal.id)));
        const counts = await ok(request(actor, '/nutritionist/review-work-counts'));
        assert.equal(counts.case, activeQueue.length + 1);
        const governance = await ok(request(actor, '/nutritionist/governance/queue?view=disputed'));
        assert(governance.plans.some((meal: { id: string }) => meal.id === newDispute.id));
        assert(!governance.plans.some((meal: { id: string }) => meal.id === oldDispute.id));
      }
    }
    pass(
      'past, ended, completed and replaced requests leave active queues and counts with routing on/off; today/future cases remain'
    );
    for (const meal of inactive) {
      for (const [path, method, body] of [
        [`/nutritionist/queue/${meal.id}`, 'GET', undefined],
        [`/nutritionist/queue/${meal.id}/claim`, 'POST', {}],
        [`/nutritionist/queue/${meal.id}/swap-options`, 'GET', undefined],
        [`/nutritionist/review/${meal.id}`, 'PATCH', { action: 'approve', note: 'Stale browser attempt.' }],
        [`/nutritionist/review/${meal.id}`, 'PATCH', { action: 'reject', note: 'Stale browser attempt.' }],
      ] as const) {
        const outcome = await request(rnd, path, method, body);
        assert.equal(outcome.status, 409);
        assert.equal(
          (outcome.body as { code?: string; errorCode?: string }).code ??
            (outcome.body as { errorCode?: string }).errorCode,
          'MEAL_REVIEW_INACTIVE'
        );
      }
    }
    assert.equal(
      (
        await request(rnd, `/nutritionist/review/${oldDispute.id}/dispute-resolution`, 'POST', {
          decision: 'APPROVE',
          rationale: 'Stale dispute approval attempt.',
        })
      ).status,
      422
    );
    await ok(request(rnd, `/nutritionist/queue/${current.id}/claim`, 'POST', {}));
    pass(
      'stale previews, claims, approvals, rejections, swaps and dispute approvals are blocked; today remains claimable'
    );
    const admin = await account('ADMIN');
    const oversight = await ok(request(admin, `/admin/audit-history/${historicalAudit.id}/review-context`));
    assert(oversight.decisions.some((decision: { id: string }) => decision.id === historical.id));
    assert.deepEqual(oversight.reviewedSnapshot, historical.evidenceSnapshot);
    assert.equal((await request(member, `/admin/audit-history/${historicalAudit.id}/review-context`)).status, 403);
    assert.equal(await prisma.mealPlan.count(), rowsBefore);
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: expired.id } })).status, 'PENDING_REVIEW');
    assert.deepEqual(
      (await prisma.mealPlanReviewDecision.findUniqueOrThrow({ where: { id: historical.id } })).evidenceSnapshot,
      historical.evidenceSnapshot
    );
    pass(
      'history and snapshots are retained with admin related-case oversight; active-queue retirement deletes no data'
    );
    // An old enabled setting and an active specialist episode must not hide new or existing cases.
    await prisma.reviewRoutingConfig.update({
      where: { id: 'global' },
      data: { enabled: true, enabledAt: new Date(Date.now() - 30 * 86_400_000) },
    });
    await prisma.nutritionistProfile.update({
      where: { id: reviewer.id },
      data: { verifiedExpertise: ['HEART_CONDITION'], verifiedExperienceYears: 20, expertiseVerifiedAt: new Date() },
    });
    await prisma.nutritionistProfile.update({
      where: { userId: other.id },
      data: { verifiedExpertise: [], verifiedExperienceYears: 40, expertiseVerifiedAt: new Date() },
    });
    const junior = await account('NUTRITIONIST');
    await prisma.nutritionistProfile.create({
      data: {
        userId: junior.id,
        isVerified: true,
        prcLicenseNumber: marker + '-junior',
        prcLicenseExpiry: new Date('2099-01-01'),
        verifiedExpertise: [],
        verifiedExperienceYears: 0,
        acceptingReviews: false,
      },
    });
    await prisma.healthCondition.create({ data: { userId: member.id, condition: 'HEART_CONDITION' } });
    await prisma.safetyProfileEntry.updateMany({
      where: { userId: member.id, domain: 'CONDITION' },
      data: { canonicalCode: 'HEART_CONDITION', displayName: 'Heart condition', originalText: 'Heart condition' },
    });
    const currentProfile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    await ClinicalEvidenceService.saveHealthDetails(member.id, {
      area: 'HEART_CONDITION',
      expectedSafetyRevision: currentProfile.safetyRevision,
      conditionDetails: 'Synthetic heart condition for shared queue software testing.',
      medications: 'None',
      dietaryAdvice: 'Unknown',
      recentSymptoms: 'None',
      measurements: '',
    });
    const episode = await prisma.reviewRoutingEpisode.create({
      data: {
        episodeKey: `PROFILE:${member.id}:${currentProfile.safetyRevision}`,
        userId: member.id,
        safetyRevision: currentProfile.safetyRevision,
        scopeKey: '0'.repeat(64),
        conditions: ['HEART_CONDITION'],
        selectedReviewerIds: [reviewer.id],
        firstCycleId: current.planGroupId,
        stage: 'SPECIALIST',
        reason: 'MATCHING_EXPERTISE',
        beganAt: new Date(),
        opensAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
    await prisma.mealPlanCycle.update({
      where: { id: current.planGroupId },
      data: { reviewRoutingEpisodeId: episode.id },
    });
    const queues = [];
    for (const actor of [rnd, other, junior]) {
      const queue = await ok(request(actor, '/nutritionist/queue'));
      assert(queue.some((meal: { id: string }) => meal.id === current.id));
      assert(queue.some((meal: { id: string }) => meal.id === upcoming.id));
      assert(queue.every((meal: { routing: { reason: string } }) => meal.routing.reason === 'SHARED_POOL'));
      queues.push(queue.map((meal: { id: string }) => meal.id).sort());
      const profileId = (await prisma.nutritionistProfile.findUniqueOrThrow({ where: { userId: actor.id } })).id;
      assert((await ClinicalProfileReviewService.queue(profileId)).some((person) => person.userId === member.id));
      assert.deepEqual(await ReviewRoutingService.assertProfile(profileId, member.id), {
        stage: 'GENERAL',
        reason: 'SHARED_POOL',
        opensAt: null,
      });
    }
    assert.deepEqual(queues[0], queues[1]);
    assert.deepEqual(queues[1], queues[2]);
    const claimed = await prisma.mealPlan.findUniqueOrThrow({ where: { id: current.id } });
    assert.equal(claimed.claimedByNutritionistId, reviewer.id);
    // The revised clinical context must still be reviewed before any new claim/approval.
    assert.notEqual((await request(other, `/nutritionist/queue/${current.id}/claim`, 'POST', {})).status, 200);
    assert.equal(
      (await prisma.mealPlan.findUniqueOrThrow({ where: { id: current.id } })).claimedByNutritionistId,
      reviewer.id
    );
    assert.equal((await request(member, '/nutritionist/queue')).status, 403);
    const obsoleteEnable = await request(admin, '/admin/review-routing', 'PATCH', { enabled: true });
    assert.equal(obsoleteEnable.status, 410);
    assert.equal((obsoleteEnable.body as { errorCode?: string }).errorCode, 'REVIEW_ROUTING_RETIRED');
    const sharedOverview = await ok(request(admin, '/admin/review-routing'));
    assert.equal(sharedOverview.config.enabled, false);
    assert.equal(sharedOverview.config.retired, true);
    assert(sharedOverview.episodes.some((item: { id: string }) => item.id === episode.id));
    assert.equal(
      (await prisma.reviewRoutingEpisode.findUniqueOrThrow({ where: { id: episode.id } })).stage,
      'SPECIALIST'
    );
    await NotificationService.notifyReviewers('Synthetic shared queue alert', 'Shared queue software test.');
    for (const actor of [rnd, other, junior])
      assert.equal(
        await prisma.notification.count({ where: { userId: actor.id, title: 'Synthetic shared queue alert' } }),
        1
      );
    pass(
      'heart specialists, experienced generalists and new RNDs see the same cases and profiles despite legacy priority; claims, roles, notifications and historical audit remain protected'
    );
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
