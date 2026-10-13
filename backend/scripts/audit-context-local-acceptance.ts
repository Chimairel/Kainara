/** Refuses normal local/shared databases; all records below are disposable. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Role } from '@prisma/client';
import app from '../src/app';
import db from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_auditfix_20261013');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY']) assert.equal(process.env[key] ?? '', '');
  assert.equal(await db.user.count(), 0, 'Use a fresh task-owned fixture.');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => { assert.equal(new URL(String(input)).hostname, '127.0.0.1'); return nativeFetch(input, init); };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  let sequence = 0;
  const account = (role: Role) => db.user.create({ data: { role, name: `Synthetic ${role}`,
    email: `auditfix-${++sequence}@example.invalid`, passwordHash: 'NON_LOGIN_FIXTURE', emailVerified: true,
    onboardingDone: true, tosAccepted: true, healthDataConsentedAt: new Date(),
    acceptedTermsVersion: CURRENT_TERMS_VERSION, acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION } });
  type Actor = Awaited<ReturnType<typeof account>>;
  const request = async (actor: Actor, path: string) => {
    const response = await fetch(base + path, { headers: { Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}` } });
    return { status: response.status, body: await response.json() as any };
  };
  const ok = async (promise: ReturnType<typeof request>) => { const result = await promise; assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.data; };
  const passed = (value: string) => console.log(`PASS ${value}`);
  try {
    const admin = await account('ADMIN'), member = await account('USER'), rnd = await account('NUTRITIONIST'), other = await account('NUTRITIONIST');
    const reviewers = [];
    for (const user of [rnd, other]) reviewers.push(await db.nutritionistProfile.create({ data: { userId: user.id, isVerified: true,
      prcLicenseNumber: randomUUID(), prcLicenseExpiry: new Date('2099-01-01') } }));
    await db.userProfile.create({ data: { userId: member.id, age: 28, heightCm: 170, weightKg: 99, goal: 'MAINTAIN', activityLevel: 'SEDENTARY', dailyCalorieTarget: 2000 } });
    const meal = await db.mealLibrary.create({ data: { mealName: 'Bam-I Recipe', mealType: 'LUNCH', calories: 912, proteinG: 30, carbsG: 139, fatG: 26, status: 'APPROVED' } });
    const sameName = await db.mealLibrary.create({ data: { mealName: meal.mealName, mealType: 'LUNCH', calories: 600, proteinG: 30, carbsG: 90, fatG: 15, status: 'APPROVED' } });
    const cycle = await db.mealPlanCycle.create({ data: { id: randomUUID(), userId: member.id, planType: 'WEEKLY', startDate: new Date('2090-01-01'), endDate: new Date('2090-01-07'), preparationOpensAt: new Date('2089-12-28'), shoppingDeadlineAt: new Date('2090-01-01'), expectedSlotCount: 3 } });
    const plan = await db.mealPlan.create({ data: { userId: member.id, planGroupId: cycle.id, libraryMealId: meal.id, mealName: meal.mealName, mealType: 'LUNCH', calories: 912, proteinG: 30, carbsG: 139, fatG: 26, scheduledDate: new Date('2090-01-01'), status: 'APPROVED' } });
    const planOther = await db.mealPlan.create({ data: { userId: member.id, planGroupId: cycle.id, libraryMealId: sameName.id, mealName: meal.mealName, mealType: 'DINNER', calories: 600, proteinG: 30, carbsG: 90, fatG: 15, scheduledDate: new Date('2090-01-01'), status: 'APPROVED' } });
    const decision = await db.mealPlanReviewDecision.create({ data: { mealPlanId: plan.id, nutritionistProfileId: reviewers[0].id, stage: 'PRIMARY', decision: 'APPROVE', rationale: 'PRIVATE_NOTE',
      evidenceSnapshot: { mealName: meal.mealName, original: { mealName: meal.mealName, calories: 912, ingredients: [{ ingredientName: 'Cabbage', quantity: 50, unit: 'g' }] },
        recordedProfile: { weightKg: 57 }, healthDetails: ['PRIVATE_ANSWER'],
        reviewContext: { profile: { weightKg: 57 }, meal: { libraryMealId: meal.id } } } } });
    const event = await db.auditEvent.create({ data: { actorUserId: rnd.id, actorRole: 'NUTRITIONIST', action: 'MEAL_PLAN_APPROVED', entityType: 'MealPlan', entityId: plan.id, metadata: { reviewDecisionId: decision.id, policyVersion: 'NUTRIMIND_PLAN_SAFETY_V2' } } });
    // Corrupt/foreign and unlinked old events cannot claim this recipe by name or current plan.
    await db.auditEvent.create({ data: { actorUserId: rnd.id, actorRole: 'NUTRITIONIST', action: 'MEAL_PLAN_APPROVED', entityType: 'MealPlan', entityId: planOther.id, metadata: { reviewDecisionId: decision.id } } });
    await db.auditEvent.create({ data: { actorUserId: rnd.id, actorRole: 'NUTRITIONIST', action: 'MEAL_PLAN_APPROVED', entityType: 'MealPlan', entityId: plan.id, metadata: { policyVersion: 'old' } } });
    const history = await ok(request(rnd, '/nutritionist/audit-history'));
    assert.equal(history.rows.find((row: any) => row.id === event.id).type, 'Meal approval');
    assert.equal(history.rows.find((row: any) => row.id === event.id).subject, meal.mealName);
    const detail = await ok(request(rnd, `/nutritionist/audit-history/${event.id}`));
    assert.equal(detail.contextAvailable, true);
    passed('Real SQL audit type and saved meal title');
    const own = await ok(request(rnd, `/nutritionist/audit-history/${event.id}/review-context`));
    assert.equal(own.selectedDecisionId, decision.id);
    assert.equal(own.reviewedSnapshot.recordedProfile.weightKg, 57);
    assert.equal(own.currentProfile, null);
    passed('Original RND exact historical context without live profile substitution');
    const redacted = await ok(request(other, `/nutritionist/audit-history/${event.id}/review-context`));
    assert.match(JSON.stringify(redacted), /912/);
    assert.doesNotMatch(JSON.stringify(redacted), /PRIVATE_|weightKg/);
    assert.equal(redacted.reviewedSnapshot, null);
    passed('Other eligible RND sees plate only; private context stays restricted');
    const oversight = await ok(request(admin, `/admin/audit-history/${event.id}/review-context`));
    assert.equal(oversight.reviewedSnapshot.recordedProfile.weightKg, 57);
    assert.equal(oversight.currentProfile.userProfile.weightKg, 99);
    passed('Admin separates saved review from changed live profile');
    const cases = await ok(request(rnd, `/nutritionist/library/${meal.id}/case-history`));
    assert.equal(cases.total, 1);
    assert.equal(cases.rows[0].id, event.id);
    assert.equal((await ok(request(rnd, `/nutritionist/library/${sameName.id}/case-history`))).total, 0);
    assert.equal((await ok(request(rnd, `/nutritionist/library/${meal.id}/approvals`))).flatMap((row: any) => row.approvals).length, 0);
    passed('Case approval appears without reusable approval; exact identities exclude same-name and foreign links');
    assert.equal((await request(member, `/nutritionist/audit-history/${event.id}/review-context`)).status, 403);
    assert.equal((await request(other, `/nutritionist/audit-history/${event.id}/review-context?userId=${member.id}`)).status, 400);
    await db.nutritionistProfile.update({ where: { id: reviewers[1].id }, data: { prcLicenseExpiry: new Date('2000-01-01') } });
    assert.equal((await request(other, `/nutritionist/audit-history/${event.id}/review-context`)).status, 403);
    assert.ok(await db.auditEvent.count({ where: { action: 'RND_REVIEW_SAVED_CONTEXT_ACCESSED' } }) >= 2);
    passed('Member/expired RND/foreign selectors rejected; context reads audited');
  } finally { globalThis.fetch = nativeFetch; await new Promise<void>((resolve) => server.close(() => resolve())); await db.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
