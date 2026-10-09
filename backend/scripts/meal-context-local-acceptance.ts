/** Synthetic HTTP scenarios restricted to a fresh task-owned PostgreSQL database. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import app from '../src/app';
import db from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';
import { lockUserProfile, advanceProfileRevision } from '../src/services/profile-revision.service';
import { loadMealReviewContext, assertCurrentMealReviewContext } from '../src/services/meal-case-context.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, '55488');
  assert.equal(target.pathname, '/kainara_meal_context');
  assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.CLINICAL_CLARIFICATIONS_ENABLED, 'true');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY']) assert.equal(process.env[key] ?? '', '');
  assert.equal(await db.user.count(), 0, 'Only use a fresh disposable database.');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => { assert.equal(new URL(String(input)).hostname, '127.0.0.1'); return nativeFetch(input, init); };
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const account = (role: Role) => db.user.create({ data: { role, name: `Synthetic ${role}`, email: `${randomUUID()}@example.invalid`, passwordHash: 'NON_LOGIN_FIXTURE', emailVerified: true, onboardingDone: true, tosAccepted: true, acceptedTermsVersion: CURRENT_TERMS_VERSION, acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION, healthDataConsentedAt: new Date() } });
  type Actor = Awaited<ReturnType<typeof account>>;
  const request = async (actor: Actor, path: string, method = 'GET', body?: unknown) => {
    const result = await fetch(base + path, { method, headers: { Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: result.status, body: await result.json() as any };
  };
  const ok = async (promise: ReturnType<typeof request>) => { const result = await promise; assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.data; };
  const checks: string[] = []; const pass = (name: string) => { checks.push(name); console.log(`PASS ${name}`); };
  try {
    const member = await account('USER'), foreign = await account('USER'), admin = await account('ADMIN');
    const reviewers = await Promise.all(Array.from({ length: 21 }, () => account('NUTRITIONIST')));
    await Promise.all(reviewers.map(actor => db.nutritionistProfile.create({ data: { userId: actor.id, isVerified: true, prcLicenseNumber: actor.id, prcLicenseExpiry: new Date('2099-01-01') } })));
    const profile = await db.userProfile.create({ data: { userId: member.id, revision: 1, safetyRevision: 1, age: 28, biologicalSex: 'MALE', heightCm: 170, weightKg: 65, goal: 'MAINTAIN', activityLevel: 'SEDENTARY', dietaryPreference: 'OMNIVORE', dailyCalorieTarget: 2000, planningReportVersion: 1 } });
    for (const domain of ['CONDITION', 'ALLERGY'] as const) await db.safetyProfileEntry.create({ data: { userId: member.id, domain, canonicalCode: 'NONE', displayName: 'None', originalText: 'None', normalizedText: 'none', provenance: 'PREDEFINED', supportState: 'SUPPORTED', policyReference: 'STRUCTURED_RESTRICTIONS_V1' } });
    await db.healthCondition.create({ data: { userId: member.id, condition: 'NONE' } });
    await db.allergy.create({ data: { userId: member.id, allergen: 'NONE' } });
    const now = new Date();
    await db.nutritionReport.create({ data: { userId: member.id, version: 1, profileRevision: 1, acknowledgedAt: now, foodsToAvoid: [], foodsToLimit: [], foodsRecommended: [], drinksGuidance: [], generalSummary: 'Synthetic guidance', basedOnConditions: [], basedOnAllergies: [] } });
    await db.nutritionReportVersion.create({ data: { userId: member.id, version: 1, profileRevision: 1, acknowledgedAt: now, policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION, content: {}, profileSnapshot: { profile: JSON.parse(JSON.stringify(profile)) } } });
    const cycle = await db.mealPlanCycle.create({ data: { id: randomUUID(), userId: member.id, planType: 'WEEKLY', startDate: now, endDate: new Date(now.getTime() + 7 * 86400000), preparationOpensAt: now, shoppingDeadlineAt: now, expectedSlotCount: 21, snapshot: { create: { userId: member.id, profileRevision: 1, safetyRevision: 1, nutritionReportVersion: 1, weightKg: 65, activityLevel: 'SEDENTARY', goal: 'MAINTAIN', dailyCalorieTarget: 2000, dailyMacroTargets: {}, dietaryPreference: 'OMNIVORE', planningGeographyLevel: 'NATIONAL' } } } });
    const plans = await Promise.all(Array.from({ length: 21 }, (_, i) => db.mealPlan.create({ data: { userId: member.id, planGroupId: cycle.id, mealType: 'LUNCH', mealName: `Synthetic plate ${i}`, calories: 700, proteinG: 25, carbsG: 100, fatG: 22, scheduledDate: new Date(now.getTime() + Math.floor(i / 3) * 86400000), candidateProvenance: 'RAW_RECIPE_CORPUS' } })));
    const route = (i: number) => `/nutritionist/queue/${plans[i].id}`;
    assert.equal((await request(member, route(0))).status, 403); assert.equal((await request(foreign, route(0))).status, 403);
    const opened = await ok(request(reviewers[0], route(0)));
    const key = opened.reviewContext.contextKey; assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal((await request(reviewers[0], route(0) + '/claim', 'POST', {})).status, 409);
    assert.equal((await request(reviewers[0], route(0) + '/claim', 'POST', { expectedContextKey: 'bad' })).status, 400);
    await ok(request(reviewers[0], route(0) + '/claim', 'POST', { expectedContextKey: key }));
    assert.equal((await ok(request(reviewers[0], route(0)))).reviewContext.contextKey, key);
    pass('Role boundaries and version-bound explicit claiming; claim metadata does not change context');
    await db.user.update({ where: { id: member.id }, data: { name: 'Changed display name' } });
    await db.userProfile.update({ where: { userId: member.id }, data: { checkinStreak: 1, lastCheckinAt: now } });
    assert.equal((await loadMealReviewContext(plans[0].id))!.contextKey, key);
    pass('Cosmetic name and check-in counters leave clinical context unchanged');
    const ingredient = await db.mealIngredient.create({ data: { mealPlanId: plans[1].id, ingredientName: 'Synthetic measured ingredient', category: 'GRAINS', quantity: 1, unit: 'cup', dataSource: 'FNRI' } });
    const measured = (await loadMealReviewContext(plans[1].id))!.contextKey;
    await db.mealIngredient.update({ where: { id: ingredient.id }, data: { quantity: 2 } });
    assert.notEqual((await loadMealReviewContext(plans[1].id))!.contextKey, measured);
    await db.mealIngredient.update({ where: { id: ingredient.id }, data: { quantity: 1, unit: 'tbsp' } });
    assert.notEqual((await loadMealReviewContext(plans[1].id))!.contextKey, measured);
    pass('Measured ingredient quantities and units bind the review context');

    await db.mealPlan.update({ where: { id: plans[0].id }, data: { calories: 701 } });
    for (const [path, method, body] of [
      [`/nutritionist/review/${plans[0].id}`, 'PATCH', { action: 'approve', expectedContextKey: key }],
      [`/nutritionist/review/${plans[0].id}`, 'PATCH', { action: 'reject', note: 'Recorded rejection rationale', expectedContextKey: key }],
      [route(0) + '/swap', 'POST', { libraryMealId: 'missing-recipe', expectedContextKey: key, expectedVersion: key, expectedRecipeSignature: key, expectedEvidenceRevision: 1, note: 'Recorded replacement rationale' }],
    ] as const) {
      const result = await request(reviewers[0], path, method, body); assert.equal(result.status, 409, JSON.stringify(result.body));
    }
    assert.equal(await db.mealPlanReviewDecision.count(), 0);
    pass('Changed plate blocks stale approve, reject and swap without writing decisions');
    const refreshed = await ok(request(reviewers[0], route(0)));
    await ok(request(reviewers[0], `/nutritionist/review/${plans[0].id}`, 'PATCH', { action: 'approve', note: 'Reviewed the exact synthetic plate.', expectedContextKey: refreshed.reviewContext.contextKey }));
    const decision = await db.mealPlanReviewDecision.findFirstOrThrow({ where: { mealPlanId: plans[0].id } });
    const evidence = decision.evidenceSnapshot as any;
    assert.equal(evidence.contextKey, refreshed.reviewContext.contextKey); assert.equal(evidence.reviewContext.profile.revision, 1); assert.equal(evidence.reviewContext.meal.calories, 701);
    pass('Current approval retains the exact immutable reviewed context');
    const keys = await Promise.all(plans.slice(1).map(async (plan, index) => {
      const detail = await ok(request(reviewers[index + 1], route(index + 1)));
      await ok(request(reviewers[index + 1], route(index + 1) + '/claim', 'POST', { expectedContextKey: detail.reviewContext.contextKey }));
      return detail.reviewContext.contextKey as string;
    }));
    await db.$transaction(async tx => { await lockUserProfile(tx, member.id); await tx.userProfile.update({ where: { userId: member.id }, data: { weightKg: 64 } }); await advanceProfileRevision(tx, member.id); });
    assert.equal(await db.mealPlan.count({ where: { userId: member.id, claimedByNutritionistId: { not: null } } }), 0);
    const staleDecisions = await Promise.all(plans.slice(1).map((plan, index) => request(reviewers[index + 1], `/nutritionist/review/${plan.id}`, 'PATCH', { action: 'reject', note: 'Outdated-context rejection must not commit.', expectedContextKey: keys[index] })));
    assert(staleDecisions.every(r => r.status === 409), JSON.stringify(staleDecisions.map(r => r.body)));
    assert.equal(await db.mealPlanReviewDecision.count(), 1);
    const queue = await ok(request(reviewers[0], '/nutritionist/queue')); assert(!queue.some((item: any) => item.user.id === member.id));
    assert.deepEqual((await db.mealPlanReviewDecision.findUniqueOrThrow({ where: { id: decision.id } })).evidenceSnapshot, evidence);
    pass('Twenty simultaneous claimed reviews release on profile change, reject stale decisions, hide paused work and retain history');
    // Demonstrate serialization: a reviewer waits behind a changing member, then sees the new revision.
    let held!: () => void; const holding = new Promise<void>(resolve => { held = resolve; });
    let release!: () => void; const untilRelease = new Promise<void>(resolve => { release = resolve; });
    const before = (await loadMealReviewContext(plans[1].id))!.contextKey;
    const edit = db.$transaction(async tx => { await lockUserProfile(tx, member.id); held(); await untilRelease; await tx.userProfile.update({ where: { userId: member.id }, data: { weightKg: 63 } }); await advanceProfileRevision(tx, member.id); });
    await holding;
    const waitingDecision = db.$transaction(async tx => { await lockUserProfile(tx, member.id); await assertCurrentMealReviewContext(plans[1].id, before, tx); });
    release(); await edit;
    await assert.rejects(waitingDecision, { errorCode: 'MEAL_REVIEW_CONTEXT_CHANGED' });
    pass('A decision waiting behind the profile lock checks the committed revision');
    const event = await db.auditEvent.findFirstOrThrow({ where: { entityType: 'MealPlan', entityId: plans[0].id, action: 'MEAL_PLAN_APPROVED' } });
    const audit = await ok(request(admin, `/admin/audit-history/${event.id}/review-context`));
    assert.deepEqual(audit.decisions[0].evidenceSnapshot.reviewContext, evidence.reviewContext);
    assert.equal((await request(member, `/admin/audit-history/${event.id}/review-context`)).status, 403);
    assert.equal(await db.auditEvent.count({ where: { action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED', actorUserId: admin.id } }), 1); pass('Admin case access retains saved review context');
    console.log(JSON.stringify({ target: 'task-owned loopback PostgreSQL', checks, accounts: await db.user.count(), decisionCount: await db.mealPlanReviewDecision.count() }));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); globalThis.fetch = nativeFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
