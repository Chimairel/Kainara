/** Real HTTP/Postgres checks. Provider output is stubbed; no external AI traffic. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../src/lib/prisma';
import app from '../src/app';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { MemberAssistantUsageService as Usage } from '../src/services/member-assistant-usage.service';
import { assistantInputSchema } from '../src/domain/member-assistant.policy';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { libraryBaseRevisionKey } from '../src/services/meal-base-admission.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_assistant_20261015');
  assert.equal(process.env.MEMBER_ASSISTANT_ENABLED, 'true');
  assert.equal(process.env.GEMINI_API_KEY, 'isolated-provider-stub');
  assert.equal(await prisma.user.count(), 0, 'This script needs a fresh task-owned database.');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(String(url)).hostname), 'External traffic forbidden');
    return nativeFetch(url, init);
  };
  const actors = [];
  const passwordHash = await bcrypt.hash('AssistantDemo123!', 10);
  for (const [name, role] of [['member', 'USER'], ['other', 'USER'], ['lifestyle', 'USER'], ['health', 'USER'], ['rnd', 'NUTRITIONIST'], ['admin', 'ADMIN']] as const) {
    const actor = await prisma.user.create({ data: {
      email: `assistant-${name}@example.invalid`, name: `Assistant test ${name}`, role, passwordHash,
      emailVerified: true, onboardingDone: true, tosAccepted: true,
      acceptedTermsVersion: CURRENT_TERMS_VERSION, acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      healthDataConsentedAt: new Date(),
    } });
    actors.push(actor);
    if (role === 'USER') {
      await prisma.userProfile.create({ data: {
        userId: actor.id, age: 28, biologicalSex: 'MALE', heightCm: 170, weightKg: 65, targetWeightKg: 65, foodCulture: 'BALANCED',
        goal: 'MAINTAIN', activityLevel: 'SEDENTARY', dietaryPreference: 'OMNIVORE', dailyCalorieTarget: 2000,
        shoppingDayGroup: 'WEEKEND', shoppingDayOfWeek: 6,
      } });
      await prisma.healthCondition.create({ data: { userId: actor.id, condition: 'NONE' } });
      await prisma.allergy.create({ data: { userId: actor.id, allergen: 'NONE' } });
      await prisma.safetyProfileEntry.createMany({ data: (['CONDITION', 'ALLERGY'] as const).map(domain => ({
        userId: actor.id, domain, canonicalCode: 'NONE', normalizedText: 'none', displayName: 'None', originalText: 'None',
        policyReference: 'SYNTHETIC_NONE', provenance: 'PREDEFINED', supportState: 'SUPPORTED',
      })) });
      await prisma.membershipAccount.create({ data: { userId: actor.id, createdAt: new Date(Date.now() - 90 * 86400000), trialStartedAt: new Date(Date.now() - 60 * 86400000) } });
      const report = await NutritionReportService.generateReport(actor.id);
      await prisma.nutritionReport.update({ where: { userId: actor.id }, data: { acknowledgedAt: new Date() } });
      await prisma.nutritionReportVersion.update({ where: { userId_version: { userId: actor.id, version: report.version } }, data: { acknowledgedAt: new Date() } });
      await prisma.userProfile.update({ where: { userId: actor.id }, data: { planningReportVersion: report.version, firstReportAcknowledgedAt: new Date() } });
      if (name === 'lifestyle' || name === 'health') await prisma.membershipGrant.create({ data: {
        userId: actor.id, tier: name === 'health' ? 'HEALTH' : 'LIFESTYLE', source: 'ADMIN_ADJUSTMENT',
        evidenceReference: `isolated-assistant-${name}`, verifiedAt: new Date(), effectiveFrom: new Date(Date.now() - 10000), effectiveUntil: new Date(Date.now() + 86400000),
      } });
    }
  }
  const [member, other, lifestyle, health, rnd, admin] = actors;
  const reviewer = await prisma.nutritionistProfile.create({ data: { userId: rnd.id, isVerified: true,
    prcLicenseNumber: 'ISOLATED-ASSISTANT', prcLicenseExpiry: new Date('2099-01-01') } });
  const food = await prisma.foodItem.create({ data: { name: 'Synthetic chicken breast', source: 'FNRI', category: 'Poultry', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 } });
  const ingredients = [{ ingredientName: 'chicken breast', foodItemId: food.id, quantity: 100, unit: 'g', category: 'PROTEIN', dataSource: 'FNRI' as const, position: 0 }];
  const nutrition = { calories: 400, proteinG: 30, carbsG: 35, fatG: 12 };
  const signature = buildMealLibraryRecipeSignature({ mealName: 'Synthetic chicken lunch', mealType: 'LUNCH', ...nutrition, ingredients });
  const meal = await prisma.mealLibrary.create({ data: {
    mealName: 'Synthetic chicken lunch', mealType: 'LUNCH', ...nutrition,
    description: 'Measured synthetic software fixture', status: 'APPROVED', dietaryTags: ['OMNIVORE'],
    recipeSignature: signature, verifiedByNutritionistId: reviewer.id, safetyReviewedByNutritionistId: reviewer.id,
    safetyReviewedAt: new Date(), safetyEvidenceStatus: 'COMPLETE', safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
    safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION, safetyEvidenceRevision: 1, certifiedEvidenceRevision: 1,
    conditionDeclarationState: 'REVIEWED_NONE_DECLARED', allergenDeclarationState: 'REVIEWED_NONE_DECLARED', crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
    nutritionEvidenceSource: 'FNRI_RECONCILED', nutritionServingDescription: 'One synthetic serving',
    riceRole: 'STANDALONE', riceRoleReviewStatus: 'REVIEWED', applicableMealTypes: { create: { mealType: 'LUNCH' } }, ingredients: { create: ingredients },
  } });
  await prisma.mealBaseVerification.create({ data: { targetKind: 'LIBRARY_MEAL', targetId: meal.id,
    revisionKey: libraryBaseRevisionKey(signature, meal.description), status: 'VERIFIED', reviewedByNutritionistId: reviewer.id, reviewedAt: new Date(), rationale: 'Isolated test fixture.' } });
  await prisma.mealLog.createMany({ data: [
    { userId: member.id, source: 'USER_LOGGED', mealName: 'Synthetic recorded lunch', ...nutrition, dataSource: 'USER_REPORTED', status: 'DONE' },
    { userId: other.id, source: 'USER_LOGGED', mealName: 'Other member private log', ...nutrition, calories: 999, dataSource: 'USER_REPORTED', status: 'DONE' },
    { userId: member.id, source: 'USER_LOGGED', mealName: 'Voided log', ...nutrition, dataSource: 'USER_REPORTED', status: 'DONE', voidedAt: new Date() },
  ] });
  let providerCalls = 0;
  const originalModel = GoogleGenerativeAI.prototype.getGenerativeModel;
  GoogleGenerativeAI.prototype.getGenerativeModel = (() => ({ generateContent: async () => {
    providerCalls++;
    return { response: { text: () => JSON.stringify({ intent: 'FIND_MEAL', clarification: '', search: '', mealType: 'LUNCH', include: ['chicken'], exclude: [], minProteinG: 25, maxCalories: 500, maxFatG: null }) } };
  } })) as typeof originalModel;
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/user/assistant`;
  const request = async (actor: typeof member | null, path = '', body?: unknown) => {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: {
      'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}` } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  let checks = 0;
  const pass = (name: string) => { checks++; console.log('PASS', name); };
  try {
    assert.equal((await request(null)).status, 401);
    for (const actor of [rnd, admin]) assert.equal((await request(actor)).status, 403);
    pass('authenticated member role boundary');
    for (const [actor, cap] of [[member, 5], [lifestyle, 20], [health, 40]] as const) assert.equal((await request(actor)).body.data.allowance.cap, cap);
    pass('real Free/Lifestyle/Health entitlement grants');
    const raw = { requestKey: randomUUID(), message: 'Chicken lunch under 500 kcal with at least 25 g protein' };
    const preflight = await request(member, '/messages', raw);
    assert.equal(preflight.body.data.confirmationRequired, true);
    assert.equal(providerCalls, 0); assert.equal(await prisma.assistantRequest.count(), 0);
    pass('preflight and cancellation leave provider and credit ledger untouched');
    const free = await request(member, '/messages', { requestKey: randomUUID(), message: 'Today’s nutrition', action: 'TODAY' });
    assert.equal(free.body.data.reply.facts[0].value, '400.0 kcal');
    assert.equal(free.body.data.confirmationRequired, false); assert.equal(providerCalls, 0);
    pass('free nutrition action excludes voided and other-member data');
    const consent = await request(member, '/messages', { ...raw, allowAi: true });
    assert.equal(consent.status, 200, JSON.stringify(consent.body));
    assert.equal(consent.body.data.reply.meals.length, 1);
    assert.equal(consent.body.data.reply.meals[0].id, meal.id);
    assert.equal(consent.body.data.allowance.remaining, 4); assert.equal(providerCalls, 1);
    pass('confirmed request retrieves a real admitted fixture and spends one credit');
    const replay = await request(member, '/messages', raw);
    assert.equal(replay.body.data.replayed, true); assert.equal(providerCalls, 1);
    assert.equal(replay.body.data.allowance.remaining, 4);
    pass('lost-response recovery is idempotent before asking to spend again');
    const otherReplay = await request(other, '/messages', raw);
    assert.equal(otherReplay.body.data.confirmationRequired, true);
    assert.equal(otherReplay.body.data.allowance.remaining, 5);
    pass('request keys are scoped to their authenticated owner');
    const parallel = await Promise.allSettled([Usage.reserve(other.id, assistantInputSchema.parse({ ...raw, requestKey: randomUUID() })), Usage.reserve(other.id, assistantInputSchema.parse({ ...raw, requestKey: randomUUID() }))]);
    assert.equal(parallel.filter(item => item.status === 'fulfilled').length, 1);
    const reserved = parallel.find(item => item.status === 'fulfilled');
    assert.ok(reserved && reserved.status === 'fulfilled'); await Usage.fail(reserved.value.id);
    assert.equal((await Usage.allowance(other.id)).remaining, 5);
    pass('database lock permits one active request and failed work refunds the reservation');
    await prisma.assistantRequest.createMany({ data: Array.from({ length: 4 }, (_, n) => ({
      userId: member.id, requestKey: randomUUID(), payloadHash: '0'.repeat(64), state: 'SUCCEEDED',
      createdAt: new Date(Date.now() - (n + 2) * 60000), leaseUntil: new Date(), completedAt: new Date(), response: {},
    })) });
    const exhausted = await request(member, '/messages', { ...raw, requestKey: randomUUID(), allowAi: true });
    assert.equal(exhausted.status, 429); assert.equal(exhausted.body.errorCode, 'ASSISTANT_CREDITS_EXHAUSTED');
    assert.equal(providerCalls, 1);
    assert.equal((await request(member, '/messages', { requestKey: randomUUID(), message: 'hello' })).status, 200);
    pass('exhausted AI credits block provider work while free actions remain available');
    await prisma.mealLibrary.update({ where: { id: meal.id }, data: { status: 'FLAGGED' } });
    // Verify through the existing admission query independently of the provider/global RPM.
    const { queryEligibleLibraryPage } = await import('../src/services/meal-library-candidate-query.service');
    const { loadPlanningNutritionContext } = await import('../src/domain/user-nutrition-context');
    const context = await loadPlanningNutritionContext(prisma, member.id, 'missing');
    const hidden = await queryEligibleLibraryPage({ userId: member.id, userConditions: context.conditions, userAllergens: context.allergens,
      profile: { ...context.profile, userId: member.id, safetyEntries: context.user.safetyProfileEntries }, limit: 5, includeProfileApproved: true });
    assert.equal(hidden.total, 0);
    await prisma.mealLibrary.update({ where: { id: meal.id }, data: { status: 'APPROVED' } });
    pass('flagged recipes remain excluded by the authoritative admission query');
    await prisma.assistantRequest.deleteMany({ where: { userId: { in: actors.map(actor => actor.id) } } });
    console.log(`PASS ${checks} isolated HTTP/SQL checks. No live provider calls. Browser fixtures retained only in disposable loopback database.`);
  } finally {
    GoogleGenerativeAI.prototype.getGenerativeModel = originalModel; globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
