import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
/** Synthetic HTTP scenarios restricted to a fresh task-owned PostgreSQL database. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import app from '../src/app';
import db from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';
import { lockUserProfile, advanceProfileRevision } from '../src/services/profile-revision.service';
import { loadMealReviewContext } from '../src/services/meal-case-context.service';

import { getManilaDateKey, getManilaMidnight, getScheduledMealDate } from '../src/domain/meal-plan-cycle.policy';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { CurrentPlanPreparationService } from '../src/services/current-plan-preparation.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { MembershipService } from '../src/services/membership.service';
import { ProfileCycleAdaptationService } from '../src/services/profile-cycle-adaptation.service';
import { acknowledgedRebuild, repairBillingStart } from '../src/services/acknowledged-cycle-rebuild.service';
import { UserPrivacyService } from '../src/services/user-privacy.service';
import bcrypt from 'bcryptjs';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55488');
  assert.equal(target.pathname, '/kainara_meal_clarification');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.CLINICAL_CLARIFICATIONS_ENABLED, 'true');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert(!(process.env[key] ?? '').trim(), `External provider ${key} must be disabled.`);
  assert.equal(await db.user.count(), 0, 'Only use a fresh disposable database.');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1');
    return nativeFetch(input, init);
  };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const account = (role: Role) =>
    db.user.create({
      data: {
        role,
        name: `Synthetic ${role}`,
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'NON_LOGIN_FIXTURE',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        healthDataConsentedAt: new Date(),
      },
    });
  type Actor = Awaited<ReturnType<typeof account>>;
  const request = async (actor: Actor, path: string, method = 'GET', body?: unknown) => {
    const result = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: result.status, body: (await result.json()) as any };
  };
  const ok = async (promise: ReturnType<typeof request>) => {
    const result = await promise;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.data;
  };
  const checks: string[] = [];
  const pass = (name: string) => {
    checks.push(name);
    console.log(`PASS ${name}`);
  };
  try {
    const member = await account('USER'),
      foreign = await account('USER'),
      admin = await account('ADMIN');
    const reviewers = await Promise.all(Array.from({ length: 21 }, () => account('NUTRITIONIST')));
    await Promise.all(
      reviewers.map((actor) =>
        db.nutritionistProfile.create({
          data: {
            userId: actor.id,
            isVerified: true,
            prcLicenseNumber: actor.id,
            prcLicenseExpiry: new Date('2099-01-01'),
          },
        })
      )
    );
    const profile = await db.userProfile.create({
      data: {
        userId: member.id,
        revision: 1,
        safetyRevision: 1,
        age: 28,
        biologicalSex: 'MALE',
        heightCm: 170,
        weightKg: 65,
        targetWeightKg: 65,
        foodCulture: 'Filipino',
        shoppingDayOfWeek: 6,
        goal: 'MAINTAIN',
        activityLevel: 'SEDENTARY',
        dietaryPreference: 'OMNIVORE',
        dailyCalorieTarget: 2000,
        ricePreference: 'NO_RICE',
        planningReportVersion: 1,
      },
    });
    for (const domain of ['CONDITION', 'ALLERGY'] as const)
      await db.safetyProfileEntry.create({
        data: {
          userId: member.id,
          domain,
          canonicalCode: 'NONE',
          displayName: 'None',
          originalText: 'None',
          normalizedText: 'none',
          provenance: 'PREDEFINED',
          supportState: 'SUPPORTED',
          policyReference: 'STRUCTURED_RESTRICTIONS_V1',
        },
      });
    await db.healthCondition.create({ data: { userId: member.id, condition: 'NONE' } });
    await db.allergy.create({ data: { userId: member.id, allergen: 'NONE' } });
    const now = new Date();
    const today = getManilaMidnight(getManilaDateKey(now));
    await db.nutritionReport.create({
      data: {
        userId: member.id,
        version: 1,
        profileRevision: 1,
        acknowledgedAt: now,
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        generalSummary: 'Synthetic guidance',
        basedOnConditions: [],
        basedOnAllergies: [],
      },
    });
    await db.nutritionReportVersion.create({
      data: {
        userId: member.id,
        version: 1,
        profileRevision: 1,
        acknowledgedAt: now,
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
        content: {},
        profileSnapshot: { profile: JSON.parse(JSON.stringify(profile)) },
      },
    });
    const cycle = await db.mealPlanCycle.create({
      data: {
        id: randomUUID(),
        userId: member.id,
        planType: 'WEEKLY',
        status: 'ACTIVE',
        startDate: today,
        endDate: getScheduledMealDate(today, 6),
        preparationOpensAt: now,
        shoppingDeadlineAt: now,
        expectedSlotCount: 21,
        snapshot: {
          create: {
            userId: member.id,
            profileRevision: 1,
            safetyRevision: 1,
            nutritionReportVersion: 1,
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
    const plans = await Promise.all(
      Array.from({ length: 21 }, (_, i) =>
        db.mealPlan.create({
          data: {
            userId: member.id,
            planGroupId: cycle.id,
            mealType: (['BREAKFAST', 'LUNCH', 'DINNER'] as const)[i % 3],
            mealName: `Synthetic plate ${i}`,
            calories: i % 3 == 0 ? 600 : 700,
            proteinG: 25,
            carbsG: 100,
            fatG: 22,
            scheduledDate: getScheduledMealDate(today, Math.floor(i / 3)),
            candidateProvenance: 'RAW_RECIPE_CORPUS',
          },
        })
      )
    );
    const route = (i: number) => `/nutritionist/queue/${plans[i].id}`;
    const profileRoute = `/nutritionist/profile-reviews/${member.id}`;
    const opened = await ok(request(reviewers[0], route(0)));
    assert.equal(opened.clarifications.enabled, true);
    const input = {
      ...opened.reviewContext,
      expectedContextKey: opened.reviewContext.contextKey,
      title: 'Clarify the reported context',
      questions: [{ id: 'detail', type: 'TEXT', label: 'What has changed in your health context?', required: true }],
      requestKey: randomUUID(),
    };
    delete input.contextKey;
    assert.equal((await request(reviewers[0], route(0) + '/clarifications', 'POST', input)).status, 409);
    assert.equal((await request(member, route(0) + '/clarifications', 'POST', input)).status, 403);
    assert.equal(
      (await request(reviewers[0], route(0) + '/clarifications', 'POST', { ...input, conditions: ['NONE'] })).status,
      400
    );
    await ok(request(reviewers[0], route(0) + '/claim', 'POST', { expectedContextKey: input.expectedContextKey }));
    await db.mealPlan.update({ where: { id: plans[0].id }, data: { calories: plans[0].calories + 1 } });
    assert.equal((await request(reviewers[0], route(0) + '/clarifications', 'POST', input)).status, 409);
    await db.mealPlan.update({ where: { id: plans[0].id }, data: { calories: plans[0].calories } });
    const beforeProfile = await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    const beforeReport = await db.nutritionReport.findUniqueOrThrow({ where: { userId: member.id } });
    const pendingClaims = await Promise.all(
      plans.slice(1).map(async (plan, index) => {
        const key = (await loadMealReviewContext(plan.id))!.contextKey;
        await ok(request(reviewers[index + 1], route(index + 1) + '/claim', 'POST', { expectedContextKey: key }));
        return key;
      })
    );
    const duplicates = await Promise.all([
      request(reviewers[0], route(0) + '/clarifications', 'POST', input),
      request(reviewers[0], route(0) + '/clarifications', 'POST', input),
    ]);
    assert(
      duplicates.every((result) => result.status === 200),
      JSON.stringify(duplicates)
    );
    const formId = duplicates[0].body.data.id;
    assert.equal(duplicates[1].body.data.id, formId);
    assert.equal(await db.clinicalClarificationForm.count(), 1);
    await db.nutritionistProfile.update({
      where: { userId: reviewers[0].id },
      data: { prcLicenseExpiry: new Date('2020-01-01') },
    });
    assert.equal((await request(reviewers[0], route(0) + '/clarifications', 'POST', input)).status, 403);
    await db.nutritionistProfile.update({
      where: { userId: reviewers[0].id },
      data: { prcLicenseExpiry: new Date('2099-01-01') },
    });
    assert.equal(
      await db.notification.count({ where: { userId: member.id, title: 'An RND requested clarification' } }),
      1
    );
    assert.deepEqual(await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } }), beforeProfile);
    assert.deepEqual(await db.nutritionReport.findUniqueOrThrow({ where: { userId: member.id } }), beforeReport);
    assert.equal(await db.mealPlan.count({ where: { userId: member.id, status: 'PENDING_REVIEW' } }), 21);
    assert.equal(await db.mealPlan.count({ where: { userId: member.id, claimedByNutritionistId: { not: null } } }), 0);
    const stored = await db.clinicalClarificationForm.findUniqueOrThrow({ where: { id: formId } });
    assert.equal(stored.sourceMealPlanId, plans[0].id);
    assert.equal(stored.sourceContextKey, input.expectedContextKey);
    assert.equal((stored.profileSnapshot as any).sourceReview.snapshot.profile.revision, 1);
    pass(
      'Claim/role/strict boundaries and concurrent retry create one source-bound form; all 21 claims pause without profile or acknowledgment changes'
    );
    assert.equal(
      (await request(reviewers[0], route(0) + '/clarifications', 'POST', { ...input, title: 'Different payload' }))
        .status,
      409
    );
    const stale = await Promise.all(
      plans.slice(1).map((plan, i) =>
        request(reviewers[i + 1], `/nutritionist/review/${plan.id}`, 'PATCH', {
          action: 'approve',
          expectedContextKey: pendingClaims[i],
        })
      )
    );
    assert(
      stale.every((result) => result.status === 409),
      JSON.stringify(stale)
    );
    assert.equal(await db.mealPlanReviewDecision.count(), 0);
    assert.equal(await ClinicalProfileReviewService.hasCurrentApproval(member.id), false);
    assert.equal((await ok(request(reviewers[0], '/nutritionist/queue'))).length, 0);
    const work = await ok(request(reviewers[0], '/nutritionist/profile-work'));
    assert(work.some((item: any) => item.userId === member.id && item.profileStatus === 'AWAITING_MEMBER'));
    await assert.rejects(() => MealGenerationService.generatePlanForUser(member.id), {
      errorCode: 'PROFILE_REVIEW_REQUIRED',
    });
    pass(
      'Healthy NONE declarations can reopen as a persistent Profile case; stale decisions and generation are blocked'
    );

    // The form is attached to the profile case, not to its source week deadline.
    // Disable automatic preparation only for the expired synthetic fixture, then restore its acknowledgment.
    await db.nutritionReport.update({ where: { userId: member.id }, data: { acknowledgedAt: null } });
    await db.mealPlanCycle.update({
      where: { id: cycle.id },
      data: {
        startDate: getScheduledMealDate(today, -7),
        endDate: getScheduledMealDate(today, -1),
        preparationOpensAt: getScheduledMealDate(today, -7),
        shoppingDeadlineAt: getScheduledMealDate(today, -7),
      },
    });
    const savedForm = (await ok(request(member, '/user/clinical-evidence'))).clarifications.forms[0];
    assert.equal(savedForm.sourceMeal.id, plans[0].id);
    const context = { profileRevision: savedForm.profileRevision, scopeKey: savedForm.scopeKey };
    const answer = {
      ...context,
      answers: { detail: 'Synthetic member clarification; no profile edit.' },
      expectedResponseId: null,
      requestKey: randomUUID(),
    };
    assert.equal(
      (await request(foreign, `/user/clinical-clarifications/${formId}/answers`, 'POST', answer)).status,
      404
    );
    const response = await ok(request(member, `/user/clinical-clarifications/${formId}/answers`, 'POST', answer));
    let detail = await ok(request(reviewers[1], profileRoute + '/claim', 'POST', {}));
    assert.equal(detail.clarifications.forms[0].responses[0].id, response.id);
    assert.equal(
      (
        await request(reviewers[1], profileRoute + '/decision', 'POST', {
          ...context,
          decision: 'APPROVED',
          notes: 'Premature confirmation must not pass.',
        })
      ).status,
      422
    );
    await ok(
      request(reviewers[1], profileRoute + `/clarifications/${formId}/resolve`, 'POST', {
        ...context,
        responseId: response.id,
        rationale: 'Reviewed the submitted clarification; current profile remains accurate.',
      })
    );
    await ok(
      request(reviewers[1], profileRoute + '/decision', 'POST', {
        ...context,
        decision: 'APPROVED',
        notes: 'Confirmed current context after resolution without changing the profile.',
      })
    );
    const oldConfirmation = await db.clinicalProfileReview.findFirstOrThrow({
      where: { userId: member.id, status: 'APPROVED' },
    });
    assert.deepEqual(await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } }), beforeProfile);
    assert.equal(await ClinicalProfileReviewService.hasCurrentApproval(member.id), true);
    assert.equal((await ok(request(reviewers[0], route(0) + '/clarifications', 'POST', input))).id, formId);
    pass(
      'Late answers survive an expired source week, ownership is enforced, and a successor resolves/confirms without altering the profile'
    );
    await db.mealPlanCycle.update({
      where: { id: cycle.id },
      data: {
        status: 'ACTIVE',
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        preparationOpensAt: cycle.preparationOpensAt,
        shoppingDeadlineAt: cycle.shoppingDeadlineAt,
      },
    });
    // Restore the synthetic current-window fixture for the independent edit/rebuild scenario.
    await db.nutritionReport.update({ where: { userId: member.id }, data: { acknowledgedAt: now } });
    await db.mealPlan.updateMany({ where: { planGroupId: cycle.id }, data: { status: 'PENDING_REVIEW' } });
    assert.equal(
      (await ok(request(reviewers[0], route(0)))).clarifications.forms[0].resolution.responseId,
      response.id
    );
    const publication = await db.auditEvent.findFirstOrThrow({
      where: { entityId: formId, action: 'CLINICAL_CLARIFICATION_PUBLISHED' },
    });
    const audit = await ok(request(admin, `/admin/audit-history/${publication.id}/review-context`));
    assert.equal(audit.reviewedSnapshot.profile.sourceReview.contextKey, input.expectedContextKey);
    assert.equal((await request(member, `/admin/audit-history/${publication.id}/review-context`)).status, 403);
    assert.equal(
      await db.auditEvent.count({
        where: { actorUserId: admin.id, action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED' },
      }),
      1
    );
    pass('Meal previews reuse saved forms read-only; related admin access retains source context and is audited');

    // An actual member edit permanently retires current/future unconsumed requests.
    const fresh = await ok(request(reviewers[0], route(0)));
    await ok(
      request(reviewers[0], route(0) + '/claim', 'POST', { expectedContextKey: fresh.reviewContext.contextKey })
    );
    await ok(
      request(reviewers[0], `/nutritionist/review/${plans[0].id}`, 'PATCH', {
        action: 'approve',
        expectedContextKey: fresh.reviewContext.contextKey,
      })
    );
    const decision = await db.mealPlanReviewDecision.findFirstOrThrow({ where: { mealPlanId: plans[0].id } });
    // A consumed row on an earlier date is kept, including its original cycle/snapshot.
    await db.mealPlan.update({ where: { id: plans[0].id }, data: { scheduledDate: getScheduledMealDate(today, -1) } });
    const log = await db.mealLog.create({
      data: {
        userId: member.id,
        mealPlanId: plans[0].id,
        source: 'SYSTEM_GENERATED',
        dataSource: 'FNRI',
        status: 'DONE',
        mealName: plans[0].mealName,
        calories: 700,
        proteinG: 25,
        carbsG: 100,
        fatG: 22,
      },
    });
    const temporaryLog = await db.mealLog.create({
      data: {
        userId: member.id,
        mealPlanId: plans[1].id,
        source: 'SYSTEM_GENERATED',
        dataSource: 'FNRI',
        status: 'SKIPPED',
        mealName: plans[1].mealName,
        calories: 700,
        proteinG: 25,
        carbsG: 100,
        fatG: 22,
      },
    });
    const todayDone = await db.mealLog.create({
      data: {
        userId: member.id,
        mealPlanId: plans[2].id,
        source: 'SYSTEM_GENERATED',
        dataSource: 'FNRI',
        status: 'DONE',
        mealName: plans[2].mealName,
        calories: 650,
        proteinG: 24,
        carbsG: 99,
        fatG: 21,
      },
    });
    await db.$transaction(async (tx) => {
      await lockUserProfile(tx, member.id);
      await tx.userProfile.update({ where: { userId: member.id }, data: { weightKg: 64 } });
      await advanceProfileRevision(tx, member.id);
    });
    const revised = await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    assert.equal(revised.revision, 2);
    assert.equal(await db.mealPlan.count({ where: { userId: member.id, status: 'CANCELLED' } }), 18);
    assert.equal(
      await db.auditEvent.count({ where: { action: 'MEAL_REVIEW_REQUEST_WITHDRAWN', actorUserId: member.id } }),
      18
    );
    assert.deepEqual(await db.mealLog.findUniqueOrThrow({ where: { id: log.id } }), log);
    assert.deepEqual(await db.mealPlanReviewDecision.findUniqueOrThrow({ where: { id: decision.id } }), decision);
    assert.deepEqual(
      await db.clinicalProfileReview.findUniqueOrThrow({ where: { id: oldConfirmation.id } }),
      oldConfirmation
    );
    assert.equal((await db.nutritionReport.findUniqueOrThrow({ where: { userId: member.id } })).acknowledgedAt, null);
    assert.equal(await ClinicalProfileReviewService.hasCurrentApproval(member.id), false);
    assert.equal((await CurrentPlanPreparationService.ensureForUser(member.id)).state, 'NOT_READY');
    assert.equal(
      (
        await request(reviewers[0], `/nutritionist/review/${plans[1].id}`, 'PATCH', {
          action: 'approve',
          expectedContextKey: pendingClaims[0],
        })
      ).status,
      409
    );
    pass(
      'Actual profile edits retire old requests, preserve consumed logs/decisions/confirmations, and block stale decisions and unacknowledged rebuilds'
    );

    // Finalize the two independent gates with provider-free guidance fixtures.
    // Simulate a source week already three days in progress; only four dates remain.
    const repairSource = await db.mealPlanCycle.update({
      where: { id: cycle.id },
      data: {
        startDate: getScheduledMealDate(today, -3),
        endDate: getScheduledMealDate(today, 3),
        preparationOpensAt: getScheduledMealDate(today, -3),
        shoppingDeadlineAt: getScheduledMealDate(today, -3),
      },
    });
    detail = await ok(request(reviewers[1], profileRoute + '/claim', 'POST', {}));
    await ok(
      request(reviewers[1], profileRoute + '/decision', 'POST', {
        profileRevision: detail.profileRevision,
        scopeKey: detail.scopeKey,
        decision: 'APPROVED',
        notes: 'Reviewed the changed member profile before fresh planning.',
      })
    );
    await db.userProfile.update({ where: { userId: member.id }, data: { planningReportVersion: 2 } });
    const acknowledged = await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    await db.nutritionReport.update({
      where: { userId: member.id },
      data: { version: 2, profileRevision: 2, isStale: false, acknowledgedAt: now },
    });
    await db.nutritionReportVersion.create({
      data: {
        userId: member.id,
        version: 2,
        profileRevision: 2,
        acknowledgedAt: now,
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
        content: {},
        profileSnapshot: { profile: JSON.parse(JSON.stringify(acknowledged)) },
      },
    });
    await db.$transaction(async (tx) => {
      await lockUserProfile(tx, member.id);
      await ProfileCycleAdaptationService.acknowledgeProfileRevision(tx, member.id, 2);
    });
    const repair = await acknowledgedRebuild(member.id, cycle.id);
    assert.equal((await request(reviewers[0], route(3))).body.code, 'MEAL_REVIEW_INACTIVE');
    assert(repair);
    assert.equal(repair.window.startDate.getTime(), today.getTime());
    assert.equal(repair.window.numDays, 4);
    const membership = await db.membershipUsage.create({
      data: {
        userId: member.id,
        feature: 'PLAN_REVIEW',
        requestKey: 'synthetic-original-admission',
        payloadHash: 'a'.repeat(64),
        windowStart: today,
        windowEnd: cycle.endDate,
        reservedUntil: cycle.endDate,
        completedAt: now,
        resultEntityId: cycle.id,
      },
    });
    assert.equal(await MembershipService.isSafetyRepair(member.id, repairSource.startDate, db), true);
    assert.equal((await repairBillingStart(member.id, repair)).getTime(), repairSource.startDate.getTime());
    await assert.rejects(() => repairBillingStart(foreign.id, repair), { errorCode: 'MEAL_REVIEW_CONTEXT_CHANGED' });
    await assert.rejects(() => repairBillingStart(member.id, { ...repair, profileRevision: 1 }), {
      errorCode: 'MEAL_REVIEW_CONTEXT_CHANGED',
    });
    pass(
      'Repair authorization requires the owning member, acknowledged current revision and original admitted allowance'
    );
    assert.equal((await repairBillingStart(member.id, repair)).getTime(), repairSource.startDate.getTime());
    const grocery = await db.groceryList.upsert({
      where: { planGroupId: cycle.id },
      create: { planGroupId: cycle.id, userId: member.id, weekLabel: 'Synthetic source week' },
      update: {},
    });
    const purchased = await db.groceryItem.create({
      data: {
        groceryListId: grocery.id,
        ingredientName: 'Synthetic purchased ingredient',
        quantity: 1,
        unit: 'g',
        purchasedQuantity: 1,
      },
    });
    assert.equal((await repairBillingStart(member.id, repair)).getTime(), repairSource.startDate.getTime());
    assert.equal(await db.mealPlanGenerationJob.count({ where: { userId: member.id } }), 0);
    assert.deepEqual(await db.mealLog.findUniqueOrThrow({ where: { id: temporaryLog.id } }), temporaryLog);
    assert.deepEqual(await db.groceryItem.findUniqueOrThrow({ where: { id: purchased.id } }), purchased);
    pass('Repair preflight preserves remaining-date logs and original purchases before reconciliation');
    const states = await Promise.all(Array.from({ length: 6 }, () => MembershipService.state(foreign.id)));
    assert.equal(new Set(states.map((state) => state.account.userId)).size, 1);
    assert(states.every((state) => state.account.trialStartedAt === null));
    assert.equal(await db.membershipAccount.count({ where: { userId: foreign.id } }), 1);
    pass('Concurrent membership first access creates one receipt without starting or resetting a trial');

    const food = await db.foodItem.create({
      data: {
        name: 'Synthetic cooked grains',
        source: 'FNRI',
        category: 'Cereals & Grains',
        calories: 200,
        proteinG: 10,
        carbsG: 25,
        fatG: 6,
      },
    });
    for (const type of ['BREAKFAST', 'LUNCH', 'DINNER'] as const)
      for (let i = 0; i < 4; i++) {
        const marker = randomUUID();
        const calories = type === 'BREAKFAST' ? 500 : type === 'LUNCH' ? 800 : 700;
        await db.rawRecipeCandidate.create({
          data: {
            sourceRecordId: marker,
            sourceUrl: 'https://panlasangpinoy.com/software-fixture/',
            recipeName: `Synthetic ${type} ${i}`,
            normalizedName: `synthetic ${type} ${i}`,
            contentSignature: createHash('sha256').update(marker).digest('hex'),
            cuisines: ['Filipino'],
            dietaryTags: ['OMNIVORE'],
            mealType: type,
            riceRole: 'STANDALONE',
            riceRoleReviewStatus: 'REVIEWED',
            calories,
            proteinG: calories / 20,
            carbsG: calories / 8,
            fatG: calories * 0.03,
            publishedNutrition: { calories, proteinG: calories / 20, carbsG: calories / 8, fatG: calories * 0.03 },
            ingredients: [{ name: food.name, quantity: calories / 2, unit: 'g', foodItemId: food.id }],
            applicableMealTypes: { create: { mealType: type, reviewStatus: 'REVIEWED' } },
          },
        });
      }
    const outcomes = await Promise.all([
      CurrentPlanPreparationService.ensureForUser(member.id),
      CurrentPlanPreparationService.ensureForUser(member.id),
    ]);
    assert(
      outcomes.some((result) => result.state === 'PREPARED'),
      JSON.stringify(outcomes)
    );
    const rebuilt = await db.mealPlanCycle.findFirstOrThrow({
      where: { userId: member.id, id: { not: cycle.id }, status: { not: 'SUPERSEDED' } },
      include: { mealPlans: true, snapshot: true },
    });
    assert.equal(rebuilt.startDate.getTime(), today.getTime());
    assert.equal(rebuilt.endDate.getTime(), repairSource.endDate.getTime());
    assert.equal(rebuilt.snapshot!.profileRevision, 2);
    assert.equal(rebuilt.snapshot!.nutritionReportVersion, 2);
    assert(rebuilt.mealPlans.length > 0);
    assert(rebuilt.mealPlans.every((plan) => plan.scheduledDate >= today));
    assert.equal(await db.mealPlanCycle.count({ where: { userId: member.id, status: { not: 'SUPERSEDED' } } }), 1);
    assert.equal((await db.mealPlanCycle.findUniqueOrThrow({ where: { id: cycle.id } })).supersededById, rebuilt.id);
    assert.equal(await db.membershipUsage.count({ where: { userId: member.id, feature: 'PLAN_REVIEW' } }), 1);
    assert.deepEqual(await db.membershipUsage.findUniqueOrThrow({ where: { id: membership.id } }), membership);
    assert.deepEqual(await db.mealLog.findUniqueOrThrow({ where: { id: log.id } }), log);
    assert.equal((await CurrentPlanPreparationService.ensureForUser(member.id)).state, 'EXISTING');
    pass(
      'Concurrent current-plan recovery produces one remaining-four-day cycle, preserves logs and admission, and cannot resurrect retired requests'
    );
    const receipt = await db.mealPlanRepairReceipt.findUniqueOrThrow({ where: { replacementCycleId: rebuilt.id } });
    assert.deepEqual(new Set(receipt.retainedMealIds as string[]), new Set([plans[1].id, plans[2].id]));
    assert.equal(rebuilt.mealPlans.length, 10);
    assert(
      !rebuilt.mealPlans.some((meal) => meal.mealType === 'LUNCH' && meal.scheduledDate.getTime() === today.getTime())
    );
    assert.deepEqual(await db.mealLog.findUniqueOrThrow({ where: { id: temporaryLog.id } }), temporaryLog);
    assert.deepEqual(await db.groceryItem.findUniqueOrThrow({ where: { id: purchased.id } }), purchased);
    const current = await request(member, '/user/meals/current');
    assert.equal(current.status, 200);
    assert.equal(current.body.meta.retainedMealLogs.length, 2);
    assert.equal(current.body.meta.retainedMealLogs.find((item: any) => item.id === plans[1].id).status, 'SKIPPED');
    assert.equal(
      current.body.meta.retainedMealLogs.find((item: any) => item.id === plans[2].id).calories,
      todayDone.calories
    );
    assert.equal(current.body.meta.awaitingGenerationCount, 0);
    const workspace = await request(member, '/user/meals/workspace');
    assert.equal(workspace.status, 200);
    assert.equal(workspace.body.meta.retainedMealLogs.length, 2);
    assert.equal(workspace.body.meta.awaitingGeneration.current, 0);
    const groceries = await ok(request(member, '/user/grocery/workspace'));
    assert.deepEqual(groceries.current.previousPurchases, [
      { ingredientName: purchased.ingredientName, quantity: 1, unit: 'g' },
    ]);
    assert.equal(groceries.current.coverage.retainedSlotCount, 2);
    assert.equal((await request(foreign, '/user/meals/current')).body.meta?.retainedMealLogs?.length ?? 0, 0);
    pass(
      'Replacement coverage includes retained slots, exposes read-only owned history and preserves purchases without stock credit'
    );
    const { loadRepairHistory, retainedMealsForCycle, assertUnchangedRepairHistory } =
      await import('../src/services/plan-repair-history.service');
    const inherited = await loadRepairHistory(member.id, rebuilt.id, { startDate: today, endDate: rebuilt.endDate });
    assert.deepEqual(new Set(inherited.meals.map((meal) => meal.id)), new Set([plans[1].id, plans[2].id]));
    assert.equal(inherited.purchasedItems.length, 1);
    await db.groceryItem.update({ where: { id: purchased.id }, data: { purchasedQuantity: 2 } });
    const changed = await loadRepairHistory(member.id, cycle.id, { startDate: today, endDate: rebuilt.endDate });
    assert.notEqual(changed.version, inherited.version);
    await assert.rejects(
      db.$transaction((tx) =>
        assertUnchangedRepairHistory(tx, member.id, cycle.id, { startDate: today, endDate: rebuilt.endDate }, inherited)
      ),
      { errorCode: 'MEAL_REVIEW_CONTEXT_CHANGED' }
    );
    await db.groceryItem.update({ where: { id: purchased.id }, data: { purchasedQuantity: 1 } });
    const { recoverPartialPlanJobs } = await import('../src/services/partial-plan-recovery.service');
    await recoverPartialPlanJobs();
    assert.equal(
      (await db.mealPlanGenerationJob.findUniqueOrThrow({ where: { planGroupId: rebuilt.id } })).status,
      'COMPLETED'
    );
    assert.equal((await retainedMealsForCycle(member.id, rebuilt.id)).length, 2);
    pass(
      'Repeated repair capture retains original histories once, detects purchase changes and recovery does not regenerate logged slots'
    );

    if (process.env.RND_BATCH5_BROWSER === 'true') {
      const fixture = {
        apiOrigin: base.replace(/\/api$/, ''),
        memberId: member.id,
        cycleId: rebuilt.id,
        actors: { member, rnd: reviewers[0], successor: reviewers[1], admin },
      };
      const actors = Object.fromEntries(
        Object.entries(fixture.actors).map(([role, actor]) => [
          role,
          { userId: actor.id, token: signAccessToken({ userId: actor.id, email: actor.email, role: actor.role }) },
        ])
      );
      writeFileSync(resolve('.local/batch5-repair-browser.json'), JSON.stringify({ ...fixture, actors }));
      console.log('BROWSER_READY repair');
      await once(process, 'SIGINT');
      return;
    }
    assert.equal((await MealGenerationService.ensureUpcomingPlanForUser(member.id)).state, 'NOT_OPEN');
    assert.equal((await MealPlanCycleService.getCurrentCycle(member.id))?.id, rebuilt.id);
    pass('Upcoming preparation cannot replace a repaired cycle before its recorded end date');
    const accountsCreated = await db.user.count();
    await db.user.update({
      where: { id: member.id },
      data: { passwordHash: await bcrypt.hash('DisposableFixtureDeletion!', 4) },
    });
    await UserPrivacyService.deleteAccount(member.id, { password: 'DisposableFixtureDeletion!' });
    assert.equal(await db.user.count({ where: { id: member.id } }), 0);
    assert.equal(await db.clinicalClarificationForm.count({ where: { userId: member.id } }), 0);
    assert.equal(await db.clinicalProfileReviewEpoch.count({ where: { userId: member.id } }), 0);
    assert.equal(await db.mealPlanRepairReceipt.count({ where: { userId: member.id } }), 0);
    pass('Reauthenticated member deletion removes the clarification graph without orphaning source references');
    console.log(
      JSON.stringify({
        target: 'task-owned loopback PostgreSQL',
        checks,
        accountsCreated,
        newMealCount: rebuilt.mealPlans.length,
        membershipEnabled: process.env.MEMBERSHIP_ENABLED,
      })
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
    globalThis.fetch = nativeFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
