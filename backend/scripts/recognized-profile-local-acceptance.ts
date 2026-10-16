/** Provider-free HTTP/SQL acceptance, restricted to its own disposable loopback database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { resolveSafetyEntries } from '../src/domain/safety-intake.policy';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_recognized_profile_acceptance');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.CLINICAL_CLARIFICATIONS_ENABLED, 'true');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY']) assert.equal(process.env[key] ?? '', '');
  const { default: db } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { ClinicalProfileReviewService: Reviews } = await import('../src/services/clinical-profile-review.service');
  const { MealGenerationService } = await import('../src/services/meal-generation.service');
  const { context, userInclude } = await import('../src/services/clinical-profile-review.context');
  const { getManilaDateKey, getManilaMidnight } = await import('../src/domain/meal-plan-cycle.policy');
  assert.equal(await db.user.count(), 0, 'Use a fresh fixture database.');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => { assert.equal(new URL(String(input)).hostname, '127.0.0.1'); return originalFetch(input, init); };
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const run = randomUUID();
  const passed: string[] = [];
  const account = async (label: string, condition: string, provenance: 'PREDEFINED' | 'CUSTOM' = 'PREDEFINED', allergy = 'NONE') => {
    const entries = resolveSafetyEntries([{ domain: 'CONDITION', value: condition, provenance }, { domain: 'ALLERGY', value: allergy, provenance: 'PREDEFINED' }]);
    const user = await db.user.create({ data: {
      email: `${run}-${label}@example.invalid`, name: `Synthetic ${label}`, passwordHash: 'NOT_A_LOGIN', role: 'USER',
      emailVerified: true, onboardingDone: true, tosAccepted: true, acceptedTermsVersion: CURRENT_TERMS_VERSION,
      acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION, healthDataConsentedAt: new Date(),
      userProfile: { create: { age: 30, biologicalSex: 'MALE', heightCm: 170, weightKg: 65, dailyCalorieTarget: 2000,
        goal: 'MAINTAIN', activityLevel: 'LIGHTLY_ACTIVE', dietaryPreference: 'OMNIVORE',
        ricePreference: 'NO_RICE', shoppingDayOfWeek: 0, planningReportVersion: 1 } },
      safetyProfileEntries: { create: entries },
      healthConditions: { create: { condition: condition === 'DIABETES' ? 'DIABETES' : condition === 'KIDNEY_DISEASE' ? 'KIDNEY_DISEASE' : 'NONE' } },
      allergies: { create: { allergen: allergy === 'SHELLFISH' ? 'SHELLFISH' : 'NONE' } },
    }, include: userInclude });
    await db.nutritionReport.create({ data: { userId: user.id, profileRevision: user.userProfile!.revision,
      acknowledgedAt: new Date(), isStale: false, generalSummary: 'Synthetic acceptance guidance.', foodsToAvoid: [], foodsToLimit: [],
      foodsRecommended: [], drinksGuidance: [], basedOnConditions: condition === 'DIABETES' ? ['DIABETES'] : [], basedOnAllergies: [] } });
    await db.nutritionReportVersion.create({ data: { userId: user.id, version: 1, profileRevision: user.userProfile!.revision,
      policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION, acknowledgedAt: new Date(), content: {},
      profileSnapshot: { profile: JSON.parse(JSON.stringify(user.userProfile)) } } });
    return user;
  };
  const request = async (user: Awaited<ReturnType<typeof account>>, route: string) => {
    const response = await fetch(base + route, { headers: { Authorization: `Bearer ${signAccessToken({ userId: user.id, email: user.email, role: user.role })}` } });
    return { status: response.status, body: await response.json() as any };
  };
  try {
    const known = await account('diabetes', 'DIABETES');
    const kidney = await account('kidney', 'KIDNEY_DISEASE');
    const allergy = await account('allergy', 'NONE', 'PREDEFINED', 'SHELLFISH');
    const alias = await account('alias', 'high blood pressure', 'CUSTOM');
    const unknown = await account('unknown', 'an unrecognized condition', 'CUSTOM');
    for (const user of [known, kidney, allergy, alias]) {
      const status = await request(user, '/user/clinical-profile-review/status');
      assert.equal(status.status, 200); assert.equal(status.body.data.required, false); assert.equal(status.body.data.approved, true);
      await Reviews.assertReadyForMealPlanning(user.id);
      assert.equal((await Reviews.currentApprovalsByUser([user.id])).get(user.id), true);
    }
    assert.equal(await db.clinicalProfileReview.count(), 0);
    const queue = await Reviews.queue(); assert.deepEqual(queue.map(row => row.userId), [unknown.id]);
    const blocked = await request(unknown, '/user/meals/readiness');
    assert.equal(blocked.status, 200); assert.equal(blocked.body.data.status, 'BLOCKED_PROFILE_REVIEW');
    passed.push('Known conditions/allergy/alias skip routine profile review, unknown declaration alone enters queue, no approval rows invented');

    for (const [mealType, calories] of [['BREAKFAST', 600], ['LUNCH', 800], ['DINNER', 600]] as const) {
      await db.rawRecipeCandidate.create({ data: { sourceRecordId: `${run}-${mealType}`, sourceUrl: `https://example.invalid/${run}/${mealType}`,
        recipeName: `Synthetic plain chicken ${mealType}`, normalizedName: `synthetic plain chicken ${mealType}`, contentSignature: `${run}-${mealType}`,
        mealType, description: 'Cook plain chicken thoroughly and divide into the stated serving.', status: 'AVAILABLE', sourceName: 'PANLASANG_PINOY',
        ingredients: [{ name: 'Chicken', quantity: 300, unit: 'g' }], publishedNutrition: { basis: 'synthetic serving' },
        calories, proteinG: 40, carbsG: 70, fatG: 20, cuisines: [], dietaryTags: ['OMNIVORE'], applicableMealTypes: { create: { mealType } } } });
    }
    const group = await MealGenerationService.generateWindowOnce(known.id, { planType: 'STARTER', numDays: 1, startDate: getManilaMidnight(getManilaDateKey(new Date())) });
    const meals = await db.mealPlan.findMany({ where: { planGroupId: group } });
    assert.equal(meals.length, 3);
    assert(meals.every(meal => meal.status === 'PENDING_REVIEW' && !meal.nutritionistId && !meal.firstApprovedByNutritionistId));
    assert.equal(await db.clinicalProfileReview.count(), 0);
    assert.equal(await db.aiUsageEvent.count(), 0);
    passed.push('Real generation prepares three diabetes meal candidates pending individual review without Gemini or fabricated profile approval');

    const savedContext = context(known);
    // Use a real Nutritionist foreign key for the scoped question.
    const rnd = await db.user.create({ data: { email: `${run}-rnd@example.invalid`, name: 'Synthetic RND', passwordHash: 'NOT_A_LOGIN', role: 'NUTRITIONIST',
      nutritionistProfile: { create: { isVerified: true, prcLicenseNumber: 'SYNTHETIC', prcLicenseExpiry: new Date('2099-01-01') } } }, include: { nutritionistProfile: true } });
    const form = await db.clinicalClarificationForm.create({ data: { userId: known.id, profileRevision: savedContext.profile.revision, scopeKey: savedContext.scopeKey,
      purpose: 'PROFILE', authorUserId: rnd.id, profileSnapshot: savedContext.snapshot, title: 'Synthetic profile question', requestKey: run,
      questions: [{ id: 'q', label: 'Clarify your current treatment', type: 'TEXT', required: true }] } });
    assert.equal(await Reviews.hasCurrentApproval(known.id), false);
    assert.equal((await Reviews.status(known.id)).required, true);
    assert((await Reviews.queue()).some(row => row.userId === known.id));
    await db.clinicalClarificationForm.update({ where: { id: form.id }, data: { purpose: 'MEAL', sourceMealPlanId: meals[0].id, sourceContextKey: '0'.repeat(64) } });
    assert.equal(await Reviews.hasCurrentApproval(known.id), true, 'Meal questions do not reopen the profile gate.');
    assert(!(await Reviews.queue()).some(row => row.userId === known.id));
    await db.clinicalClarificationForm.delete({ where: { id: form.id } });
    await db.clinicalProfileReview.create({ data: { id: randomUUID(), reasonCodes: ['DETAILS_REQUESTED'], userId: known.id, profileRevision: savedContext.profile.revision,
      policyVersion: `PROFILE_DETAILS_V1:fixture`, status: 'DECLINED', profileSnapshot: savedContext.snapshot,
      reviewerId: rnd.nutritionistProfile!.id, reviewedAt: new Date(), reviewNotes: 'Synthetic existing hold.' } });
    assert.equal(await Reviews.hasCurrentApproval(known.id), false);
    assert((await Reviews.queue()).some(row => row.userId === known.id));
    passed.push('Profile questions and current explicit RND declines remain blocking and visible; meal questions do not reopen profile review');
    console.log(JSON.stringify({ passed, count: passed.length, geminiCalls: 0, target: 'disposable loopback only' }));
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>(resolve => server.close(() => resolve()));
    // Keep all evidence inside this disposable fixture; never delete shared member records.
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
