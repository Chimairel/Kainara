import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import prisma from '../src/lib/prisma';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { SafetyIntakeService } from '../src/services/safety-intake.service';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { UserProfileService } from '../src/services/user-profile.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { loadMealReviewContext } from '../src/services/meal-case-context.service';
import { approveMealPlan } from '../src/services/nutritionist-approval.service';
import { loadPlanningRules } from '../src/services/planning-rule-screening.service';
import { screenPlanningRules } from '../src/domain/planning-rule-screening.policy';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import app from '../src/app';
import { signAccessToken } from '../src/lib/jwt';
import { renderToBuffer } from '@react-pdf/renderer';
import { NutritionReportPDF } from '../src/lib/pdf';

async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, '127.0.0.1'); assert.match(target.pathname, /^\/kainara_guidance_[a-f0-9]{8}$/);
  assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.MEMBERSHIP_ENABLED, 'true');
  assert.equal(process.env.CLINICAL_CLARIFICATIONS_ENABLED, 'true'); assert(!process.env.GEMINI_API_KEY);
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1', 'No external provider requests');
    return nativeFetch(input, init);
  };
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function call(actor: {id:string;email:string;role: 'USER'|'ADMIN'|'NUTRITIONIST'} | null, path: string, body?: unknown) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${signAccessToken({userId:actor.id,email:actor.email,role:actor.role})}` } : {}) },
      ...(body ? { body:JSON.stringify(body) } : {}) });
    return {status:response.status, body:await response.json() as any};
  }
  const trigger = UpcomingPlanPreparationService.triggerNonBlocking;
  UpcomingPlanPreparationService.triggerNonBlocking = () => undefined;
  const results: Record<string, unknown> = {};
  try {
    assert.equal(await prisma.user.count(), 0, 'Use a fresh task-owned database.');
    const reviewerUser = await prisma.user.create({ data: { name: 'Synthetic guidance reviewer', email: `${randomUUID()}@example.invalid`,
      passwordHash: 'NOT_A_LOGIN', role: 'NUTRITIONIST', emailVerified: true } });
    const reviewer = await prisma.nutritionistProfile.create({ data: { userId: reviewerUser.id, isVerified: true,
      prcLicenseNumber: `SYNTHETIC-${randomUUID()}`, prcLicenseExpiry: new Date('2099-01-01'), acceptingReviews: true, verifiedExpertise: ['DIABETES'] } });
    for (const [name, type] of [['Vegetable Omelet', 'BREAKFAST'], ['Chicken Adobo', 'LUNCH'], ['Ginisang Gulay', 'DINNER'], ['Homemade Taho', 'BREAKFAST'], ['Pandesal', 'BREAKFAST']] as const) {
      const key = randomUUID();
      await prisma.rawRecipeCandidate.create({ data: { sourceRecordId: key, sourceName: 'PANLASANG_PINOY', sourceUrl: `https://example.invalid/synthetic/${key}`,
        recipeName: name, normalizedName: name.toLowerCase(), contentSignature: createHash('sha256').update(key).digest('hex'),
        cuisines: ['Filipino'], description: 'Synthetic arithmetic fixture; not clinical evidence.', mealType: type,
        riceRole: 'STANDALONE', riceRoleReviewStatus: 'NOT_REVIEWED', dietaryTags: ['OMNIVORE'],
        ingredients: [{ name: 'egg', quantity: 100, unit: 'g' }], publishedNutrition: {},
        calories: 600, proteinG: 30, carbsG: 90, fatG: 13.333333,
        applicableMealTypes: { create: [{ mealType: type }] } } });
    }
    async function account() {
      const user = await prisma.user.create({ data: { name: 'Synthetic planning member', email: `${randomUUID()}@example.invalid`, passwordHash: 'NOT_A_LOGIN',
        role: 'USER', emailVerified: true, onboardingDone: true, tosAccepted: true, acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION, healthDataConsentedAt: new Date(),
        userProfile: { create: { age: 25, biologicalSex: 'MALE', heightCm: 170, weightKg: 65, targetWeightKg: 65, goal: 'MAINTAIN',
          activityLevel: 'LIGHTLY_ACTIVE', dietaryPreference: 'OMNIVORE', ricePreference: 'NO_RICE', foodCulture: 'Filipino',
          shoppingDayOfWeek: 0, shoppingDayGroup: 'WEEKEND', dailyCalorieTarget: 2190 } } } });
      await SafetyIntakeService.replaceDomains(user.id, ['CONDITION', 'ALLERGY'], [
        { domain: 'CONDITION', value: 'DIABETES', provenance: 'PREDEFINED' }, { domain: 'ALLERGY', value: 'SHELLFISH', provenance: 'PREDEFINED' }]);
      assert(await ClinicalProfileReviewService.hasCurrentApproval(user.id), 'Recognized choices retain the profile-classification bypass.');
      const report = await NutritionReportService.generateReport(user.id);
      await NutritionReportService.acknowledgeReport(user.id, report.version);
      return user;
    }
    const one = await account(), two = await account();
    const saturday = new Date('2026-10-17T03:00:00Z');
    const starter = await MealGenerationService.generateWindowOnce(one.id, { planType: 'STARTER', numDays: 2, startDate: new Date('2026-10-16T16:00:00Z') });
    const first = await prisma.mealPlan.findFirstOrThrow({ where: { planGroupId: starter, mealType: 'BREAKFAST' }, orderBy: { scheduledDate: 'asc' } });
    assert.equal(first.mealName, 'Vegetable Omelet');
    await prisma.mealPlan.update({ where: { id: first.id }, data: { claimedByNutritionistId: reviewer.id, claimedAt: new Date() } });
    const context = await loadMealReviewContext(first.id);
    await approveMealPlan(reviewer.id, first.id, 'Synthetic exact-context review for an isolated software test.', undefined, context!.contextKey);
    const secondStarter = await MealGenerationService.generateWindowOnce(two.id, { planType: 'STARTER', numDays: 2, startDate: new Date('2026-10-16T16:00:00Z') });
    const { MealPlanCycleService } = await import('../src/services/meal-plan-cycle.service');
    const reused = await MealPlanCycleService.getClearedMealPlanIds(two.id, secondStarter, saturday);
    assert(reused.length > 0, 'Identical saved profile/serving should reuse the recorded approval.');
    results.identicalProfileReuse = true;
    await MealGenerationService.ensureUpcomingPlanForUser(two.id, saturday);
    const admittedBefore = await prisma.membershipUsage.count({ where: { userId: two.id, feature: 'PLAN_REVIEW', completedAt: { not: null } } });
    await UserProfileService.updateUserProfile(two.id, { age: 24 });
    const updatedReport = await NutritionReportService.generateReport(two.id);
    await NutritionReportService.acknowledgeReport(two.id, updatedReport.version);
    const repairs = await Promise.allSettled(Array.from({ length: 3 }, () => UpcomingPlanPreparationService.ensureForUser(two.id, saturday)));
    assert(repairs.some(result => result.status === 'fulfilled'), 'Recovery must complete at least one coalesced pass.');
    const cycles = await prisma.mealPlanCycle.findMany({ where: { userId: two.id, status: { not: 'SUPERSEDED' } }, include: { mealPlans: { where: { status: { not: 'CANCELLED' } } }, snapshot: true } });
    const weekly = cycles.filter(cycle => cycle.planType === 'WEEKLY');
    assert.equal(weekly.length, 1, 'Exactly one upcoming weekly cycle must remain.');
    assert.equal(weekly[0].expectedSlotCount, 21); assert.equal(weekly[0].mealPlans.length, 21);
    assert.equal(weekly[0].snapshot!.profileRevision, updatedReport.profileRevision);
    assert.equal(cycles.find(c => c.planType === 'STARTER')?.mealPlans.length, 6);
    assert(!cycles.flatMap(c => c.mealPlans).some(meal => ['Homemade Taho', 'Pandesal'].includes(meal.mealName)));
    assert.equal(new Set(cycles.flatMap(c => c.mealPlans).map(meal => `${meal.scheduledDate.toISOString()}:${meal.mealType}`)).size, cycles.flatMap(c => c.mealPlans).length);
    results.profileChangeWeeklyRecovery = { starterSlots: cycles.find(c => c.planType === 'STARTER')?.mealPlans.length, weeklySlots: weekly[0].mealPlans.length };
    assert.equal(await prisma.membershipUsage.count({ where: { userId: two.id, feature: 'PLAN_REVIEW', completedAt: { not: null } } }), admittedBefore,
      'Acknowledged current/upcoming repairs must replay their original admissions, not charge again.');
    results.membershipAdmissionsUnchanged = admittedBefore;
    const after = await MealPlanCycleService.getClearedMealPlanIds(two.id, weekly[0].id, saturday);
    assert.equal(after.length, 0, 'Age/target change must not inherit the older exact approval.');
    results.changedProfileApprovalRejected = true;
    const pending = weekly[0].mealPlans[0];
    await prisma.mealPlan.update({ where: { id: pending.id }, data: { claimedByNutritionistId: reviewer.id, claimedAt: new Date() } });
    const admin = await prisma.user.create({ data: { name:'Synthetic rule admin',email:`${randomUUID()}@example.invalid`,passwordHash:'NOT_A_LOGIN',role:'ADMIN',emailVerified:true } });
    const other = await prisma.user.create({ data: { name:'Synthetic second reviewer',email:`${randomUUID()}@example.invalid`,passwordHash:'NOT_A_LOGIN',role:'NUTRITIONIST',emailVerified:true } });
    await prisma.nutritionistProfile.create({ data: { userId:other.id,isVerified:true,prcLicenseNumber:`SYNTHETIC-${randomUUID()}`,prcLicenseExpiry:new Date('2099-01-01') } });
    const limitPath = `/nutritionist/patient-nutrition/${pending.id}/limits`;
    assert.equal((await call(null,limitPath)).status,401);
    assert.equal((await call(two,limitPath)).status,403);
    assert.equal((await call(admin,limitPath)).status,403);
    assert.equal((await call(other,limitPath)).status,409);
    assert.equal((await call(reviewerUser,limitPath)).status,200);
    assert.equal((await call(reviewerUser,limitPath,{active:true})).status,400);
    const limitSaved = await call(reviewerUser,limitPath, { condition: 'DIABETES', nutrient: 'CARBOHYDRATE_G', operator: 'LESS_THAN_OR_EQUAL',
      threshold: 1, unit: 'g', basis: 'PER_SERVING', severity: 'HARD_BLOCK', rationale: 'Synthetic test-only restriction to force a software conflict.',
      sourceTitle: 'Synthetic fixture, not clinical evidence', sourceCitation: 'https://example.invalid/software-test', replacesRuleId: null,
      validFrom: new Date('2026-10-16T00:00:00Z').toISOString(), validUntil: null, expectedProfileRevision: updatedReport.profileRevision });
    assert.equal(limitSaved.status,201,JSON.stringify(limitSaved.body));
    results.patientLimitRoleAndClaimGuards = true;
    const savedRules = await loadPlanningRules(two.id, ['DIABETES']);
    const screening = screenPlanningRules({ ...savedRules, userId: two.id, now: saturday, conditions: ['DIABETES'],
      ingredientNames: ['egg'], nutrients: { calories: pending.calories, carbsG: pending.carbsG, proteinG: pending.proteinG } });
    assert(screening.blocked);
    assert.equal(await prisma.mealPlan.count({ where: { userId: two.id, status: 'APPROVED' } }), 0, 'New limits withdraw obsolete untouched approvals.');
    assert.equal((await prisma.patientNutritionLimit.findMany({ where: { userId: one.id } })).length, 0);
    results.patientLimitIsolatedAndEnforced = true;
    const report = await NutritionReportService.getReport(two.id);
    assert(report?.profileSummary.some(row => row.label === 'Age' && row.value === '24 years'));
    assert(report?.profileSummary.some(row => row.label === 'Biological sex' && row.value === 'Male'));
    const pdf = await renderToBuffer(NutritionReportPDF({user:two,report}));
    assert.equal(pdf.subarray(0,4).toString(),'%PDF');
    writeFileSync('.local/guidance-update/nutrition-guidance.pdf',pdf);
    results.pdfGenerated = true;
    const source = await prisma.clinicalEvidenceSource.create({ data: { code:`SYNTHETIC_${randomUUID()}`,issuingOrganization:'Software test',
      title:'Synthetic rule test, not clinical guidance',documentType:'GOVERNMENT_GUIDANCE',domain:'DIABETES',canonicalUrl:'https://example.invalid/rule',
      sourceVersion:'fixture-v1',retrievedAt:new Date(),population:'Synthetic fixtures only',jurisdiction:'Software test',exclusionsAndCaveats:'Never use for patient care.' } });
    const draft = {condition:'DIABETES',nutrientRules:[{nutrient:'CARBOHYDRATE_G',operator:'LESS_THAN_OR_EQUAL',threshold:999,
      unit:'g',basis:'PER_SERVING',severity:'FLAG',evaluationScope:'MEAL',evidenceSourceId:source.id,evidenceLocator:'Synthetic fixture paragraph',
      applicablePopulation:'Synthetic fixtures only',exclusionsAndCaveats:'Not a clinical threshold',rationale:'Test the existing governed activation workflow.',requiredInputs:{carbsG:true}}],ingredientRules:[]};
    assert.equal((await call(two,'/admin/nutrition-rules',draft)).status,403);
    const created = await call(admin,'/admin/nutrition-rules',draft);
    assert.equal(created.status,201,JSON.stringify(created.body));
    const policyId = created.body.data.id;
    assert.equal(created.body.data.state,'DRAFT');
    assert.notEqual((await call(admin,`/admin/nutrition-rules/${policyId}/approve`,{reason:'Admin cannot activate rules.'})).status,200);
    assert.equal((await call(reviewerUser,`/nutritionist/nutrition-rules/${policyId}/impact`,{reason:'Synthetic impact before decisions.'})).status,200);
    const votes = await Promise.all([reviewerUser,other].map(actor => call(actor,`/nutritionist/nutrition-rules/${policyId}/approve`,{reason:'Synthetic independent activation decision.'})));
    assert(votes.every(row => row.status === 200),JSON.stringify(votes));
    const activated = await prisma.conditionRulePolicyVersion.findUniqueOrThrow({where:{id:policyId}});
    assert.equal(activated.state,'ACTIVE');assert.equal(activated.automationAllowed,false);
    assert.equal(await prisma.conditionRulePolicyApproval.count({where:{policyVersionId:policyId}}),2);
    results.adminDraftAndConcurrentIndependentActivation = true;
    assert.equal(await prisma.aiUsageEvent.count(), 0);
    results.aiCalls = 0;
    writeFileSync('.local/guidance-update/acceptance-result.json', JSON.stringify({ at: new Date().toISOString(), target: 'disposable loopback', results }, null, 2));
    console.log(JSON.stringify(results));
  } finally { server.close(); UpcomingPlanPreparationService.triggerNonBlocking = trigger; globalThis.fetch = nativeFetch; await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
