/** Targeted delivery audit. Never run against a shared database; pending meals count as delivery. */
import assert from 'node:assert/strict';
import { open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';
import type { SafetyEntryInput } from '../src/domain/safety-intake.policy';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { sourceRawRecipeCandidates } from '../src/services/raw-recipe-candidate.service';
import { validateGeneratedMealCandidate } from '../src/domain/generated-meal-validation.policy';
import { assertRecipeNotRejectedForSlot } from '../src/services/rejected-slot-recipes.service';
import { DietaryPreference, MealType } from '@prisma/client';

const directory = path.resolve('../.codex-runtime/meal-preview-audit');
const password = 'SyntheticSystemAudit123!';
type Fixture = { id: string; email: string; token: string; reviewerId?: string };
type Scenario = {
  key: string;
  fixture?: string;
  entries: SafetyEntryInput[];
  diet?: DietaryPreference;
  rice?: 'WITH_RICE' | 'NO_RICE';
  sex?: 'MALE' | 'FEMALE';
  weight?: number;
  height?: number;
  activity?: 'SEDENTARY' | 'VERY_ACTIVE';
};
const entry = (
  domain: SafetyEntryInput['domain'],
  value: string,
  provenance: 'PREDEFINED' | 'CUSTOM' = 'PREDEFINED'
): SafetyEntryInput => ({ domain, value, provenance });
const restrictions = (conditions: string[] = [], allergens: string[] = []): SafetyEntryInput[] => [
  ...(conditions.length ? conditions : ['NONE']).map((value) => entry('CONDITION', value)),
  ...(allergens.length ? allergens : ['NONE']).map((value) => entry('ALLERGY', value)),
];
const original: Scenario[] = [
  { key: 'none', entries: restrictions() },
  { key: 'shellfish', entries: restrictions([], ['SHELLFISH']) },
  { key: 'multi-allergy', entries: restrictions([], ['NUTS', 'EGGS', 'DAIRY']) },
  { key: 'diabetes', entries: restrictions(['DIABETES']) },
  { key: 'hypertension', entries: restrictions(['HYPERTENSION']) },
  { key: 'kidney-shellfish', entries: restrictions(['KIDNEY_DISEASE'], ['SHELLFISH']) },
  {
    key: 'heart-nuts-msg',
    entries: [...restrictions(['HEART_CONDITION'], ['NUTS']), entry('INTOLERANCE', 'MSG', 'CUSTOM')],
  },
  { key: 'pregnant', entries: restrictions(['PREGNANT']), sex: 'FEMALE' },
  { key: 'gout', entries: restrictions(['GOUT']) },
  {
    key: 'unknown',
    entries: [
      entry('CONDITION', 'Unlisted synthetic condition', 'CUSTOM'),
      entry('ALLERGY', 'Unlisted synthetic allergy', 'CUSTOM'),
    ],
  },
  { key: 'pollen', entries: [entry('CONDITION', 'NONE'), entry('ALLERGY', 'Pollen', 'CUSTOM')] },
  { key: 'non-food', entries: [entry('CONDITION', 'Myopia', 'CUSTOM'), entry('ALLERGY', 'Dust mites', 'CUSTOM')] },
  {
    key: 'intolerance',
    entries: [
      ...restrictions(),
      entry('INTOLERANCE', 'Lactose intolerance', 'CUSTOM'),
      entry('AVOIDED_INGREDIENT', 'Pork', 'CUSTOM'),
    ],
  },
  { key: 'vegan', entries: restrictions(), diet: 'VEGAN' },
  { key: 'vegetarian', entries: restrictions(), diet: 'VEGETARIAN' },
  { key: 'pescatarian', entries: restrictions(), diet: 'PESCATARIAN', rice: 'NO_RICE' },
  { key: 'positive-multi-allergy', entries: restrictions([], ['SHELLFISH', 'GLUTEN']) },
];
const harder: Scenario[] = [
  { key: 'diabetes-hypertension', entries: restrictions(['DIABETES', 'HYPERTENSION']) },
  { key: 'diabetes-gluten', entries: restrictions(['DIABETES'], ['GLUTEN']) },
  { key: 'hypertension-dairy', entries: restrictions(['HYPERTENSION'], ['DAIRY']) },
  { key: 'diabetes-three-allergies', entries: restrictions(['DIABETES'], ['NUTS', 'EGGS', 'DAIRY']) },
  { key: 'all-five-allergies', entries: restrictions([], ['NUTS', 'EGGS', 'DAIRY', 'SHELLFISH', 'GLUTEN']) },
  { key: 'diabetes-all-five', entries: restrictions(['DIABETES'], ['NUTS', 'EGGS', 'DAIRY', 'SHELLFISH', 'GLUTEN']) },
  { key: 'vegan-diabetes-eggs', entries: restrictions(['DIABETES'], ['EGGS']), diet: 'VEGAN' },
  { key: 'vegetarian-diabetes-eggs', entries: restrictions(['DIABETES'], ['EGGS']), diet: 'VEGETARIAN' },
  {
    key: 'pescatarian-hypertension-dairy',
    entries: restrictions(['HYPERTENSION'], ['DAIRY']),
    diet: 'PESCATARIAN',
    rice: 'NO_RICE',
  },
  {
    key: 'kidney-heart-hypertension-shellfish',
    entries: restrictions(['KIDNEY_DISEASE', 'HEART_CONDITION', 'HYPERTENSION'], ['SHELLFISH']),
  },
  { key: 'celiac-gluten', entries: restrictions(['CELIAC_DISEASE'], ['GLUTEN']) },
  { key: 'pcos-diabetes', entries: restrictions(['PCOS', 'DIABETES']) },
  { key: 'gerd-hypertension', entries: restrictions(['GERD', 'HYPERTENSION']) },
  {
    key: 'vegan-lower-target',
    entries: restrictions(),
    diet: 'VEGAN',
    sex: 'FEMALE',
    weight: 50,
    height: 155,
    activity: 'SEDENTARY',
  },
  {
    key: 'vegan-higher-target',
    entries: restrictions(),
    diet: 'VEGAN',
    weight: 95,
    height: 185,
    activity: 'VERY_ACTIVE',
  },
  { key: 'diabetes-no-rice', entries: restrictions(['DIABETES']), rice: 'NO_RICE' },
].map((s) => ({ ...s, fixture: 'diabetes' }) as Scenario);

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55480');
  assert.equal(target.pathname, '/kainara_meal_preview');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.GEMINI_API_KEY || '', '');
  assert.equal(process.env.MEMBERSHIP_ENABLED, 'true');
  assert.equal(path.resolve(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH || ''), path.join(directory, 'mail.jsonl'));
  for (const key of ['SMTP_PASS', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY', 'CLOUDINARY_API_SECRET'])
    assert.equal(process.env[key] || '', '');
  const runStartedAt = new Date();
  const phase = process.argv[2] || 'original';
  assert.ok(['original', 'harder', 'sources', 'reviewers'].includes(phase));
  // Each process owns its output; journey batches sharing fixtures must be sequential.
  const lockPath = path.join(directory, phase === 'sources' ? 'sources.lock' : 'journeys.lock');
  const lock = await open(lockPath, 'wx');
  await lock.close();
  const statePath = path.join(directory, phase === 'sources' ? 'source-state.json' : 'state.json');
  const originalState = JSON.parse(await readFile('../.codex-runtime/system-audit/state.json', 'utf8'));
  const state: { fixtures: Record<string, Fixture>; results: any[]; probes: any[]; reviewer: any[] } = await readFile(
    statePath,
    'utf8'
  )
    .then(JSON.parse)
    .catch(() => ({ fixtures: originalState.fixtures, results: [], probes: [], reviewer: [] }));
  const save = () => writeFile(statePath, JSON.stringify(state, null, 2));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  async function request(route: string, method = 'GET', body?: unknown, token?: string) {
    const res = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json()) as any };
  }
  function ok(res: { status: number; body: any }, expected = 200) {
    assert.equal(res.status, expected, JSON.stringify(res.body));
    return res.body;
  }
  async function login(key: string) {
    const f = state.fixtures[key];
    assert.ok(f.email.endsWith('@example.invalid'));
    const user = await prisma.user.findUnique({ where: { id: f.id } });
    if (!user) {
      assert.equal(key, 'pescatarian', 'Only the privacy-deleted fixture may be recreated');
      const email = `preview-audit-pescatarian-${Date.now()}@example.invalid`;
      const reg = ok(
        await request('/api/auth/register', 'POST', { name: 'Synthetic preview pescatarian', email, password }),
        201
      );
      f.id = reg.data.user.id;
      f.email = email;
      f.token = reg.data.accessToken;
      const mails = (await readFile(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH!, 'utf8'))
        .trim()
        .split('\n')
        .map((row) => JSON.parse(row));
      ok(
        await request(
          '/api/auth/verify-email',
          'POST',
          { otp: mails.filter((row) => row.to === email).at(-1).token },
          f.token
        )
      );
    } else {
      // Prior negative tests suspended staff; restore only copied synthetic fixtures.
      await prisma.user.update({ where: { id: f.id }, data: { isSuspended: false, passwordLoginEnabled: true } });
      const res = ok(await request('/api/auth/login', 'POST', { email: f.email, password }));
      f.token = res.data.accessToken;
    }
    return f;
  }
  async function settle(userId: string) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const end = Date.now() + 60000;
    while (Date.now() < end) {
      const count = await prisma.mealPlanGenerationJob.count({
        where: { userId, status: { in: ['GENERATING', 'PROCESSING_AI'] } },
      });
      if (!count) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Preparation did not settle within 60 seconds');
  }
  async function reset(f: Fixture) {
    assert.ok(f.email.endsWith('@example.invalid'));
    // A previous disposable runner can exit after a response starts another background
    // job. It is abandoned, not a failure of this scenario's fresh generation.
    await prisma.mealPlanGenerationJob.updateMany({
      where: { userId: f.id, status: { in: ['GENERATING', 'PROCESSING_AI'] }, updatedAt: { lt: runStartedAt } },
      data: { status: 'FAILED', lastErrorCode: 'AUDIT_PREVIOUS_PROCESS_STOPPED' },
    });
    await settle(f.id);
    await prisma.$transaction(
      async (tx) => {
        await tx.mealPlanReviewDecision.deleteMany({ where: { mealPlan: { userId: f.id } } });
        await tx.mealPlanCycle.deleteMany({ where: { userId: f.id } });
        await tx.mealPlan.deleteMany({ where: { userId: f.id } });
        await tx.mealPlanGenerationJob.deleteMany({ where: { userId: f.id } });
        await tx.membershipUsage.deleteMany({ where: { userId: f.id } });
        await tx.membershipAccount.upsert({
          where: { userId: f.id },
          create: { userId: f.id },
          update: { trialStartedAt: null },
        });
        // Prior accepted report state is cleared only in this cloned fixture.
        await tx.userProfile.updateMany({
          where: { userId: f.id },
          data: { planningReportVersion: null, firstReportAcknowledgedAt: null },
        });
        await tx.nutritionReportVersion.updateMany({ where: { userId: f.id }, data: { acknowledgedAt: null } });
        await tx.nutritionReport.updateMany({ where: { userId: f.id }, data: { acknowledgedAt: null } });
        await tx.clinicalProfileReview.deleteMany({ where: { userId: f.id } });
      },
      { timeout: 30000 }
    );
  }
  try {
    const reviewer = await login('rnd-a');
    await prisma.nutritionistProfile.update({
      where: { id: reviewer.reviewerId },
      data: { isVerified: true, prcLicenseExpiry: new Date('2099-12-31') },
    });
    if (phase === 'reviewers') {
      const f = await login('hypertension');
      const current = ok(await request('/api/user/meals/current', 'GET', undefined, f.token));
      const plan = await prisma.mealPlan.findFirstOrThrow({
        where: { userId: f.id, planGroupId: current.meta.cycle.id, status: 'PENDING_REVIEW', mealType: 'LUNCH' },
      });
      ok(await request(`/api/nutritionist/queue/${plan.id}/claim`, 'POST', {}, reviewer.token));
      ok(
        await request(
          `/api/nutritionist/review/${plan.id}`,
          'PATCH',
          { action: 'approve', note: 'Synthetic software workflow decision; no clinical validation.' },
          reviewer.token
        )
      );
      const saved = await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } });
      assert.equal(saved.status, 'APPROVED');
      assert.equal(
        await prisma.mealPlanReviewDecision.count({ where: { mealPlanId: plan.id, decision: 'APPROVE' } }),
        1
      );
      const visible = ok(await request('/api/user/meals/current', 'GET', undefined, f.token));
      state.reviewer.push({
        check: 'Approve actual sourced candidate',
        status: saved.status,
        visibleActionable: visible.data.length,
        pending: visible.meta.pendingReview?.mealCount ?? 0,
        auditDecisionCount: 1,
      });
      const rejectedFixture = await login('heart-nuts-msg');
      const before = ok(await request('/api/user/meals/current', 'GET', undefined, rejectedFixture.token));
      const targetPlan = await prisma.mealPlan.findFirstOrThrow({
        where: {
          userId: rejectedFixture.id,
          planGroupId: before.meta.cycle.id,
          status: 'PENDING_REVIEW',
          mealType: 'LUNCH',
        },
      });
      ok(await request(`/api/nutritionist/queue/${targetPlan.id}/claim`, 'POST', {}, reviewer.token));
      ok(
        await request(
          `/api/nutritionist/review/${targetPlan.id}`,
          'PATCH',
          { action: 'reject', note: 'Synthetic software rejection; try another source. No clinical validation.' },
          reviewer.token
        )
      );
      assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: targetPlan.id } })).status, 'REJECTED');
      assert.equal(
        await prisma.mealPlanReviewDecision.count({ where: { mealPlanId: targetPlan.id, decision: 'REJECT' } }),
        1
      );
      const replacements = await prisma.mealPlan.findMany({
        where: {
          userId: rejectedFixture.id,
          planGroupId: targetPlan.planGroupId,
          scheduledDate: targetPlan.scheduledDate,
          mealType: targetPlan.mealType,
          status: 'PENDING_REVIEW',
          id: { not: targetPlan.id },
        },
        include: { servingComponents: true, sourceRawRecipeCandidate: true },
      });
      assert.equal(replacements.length, 1);
      assert.equal(replacements[0].status, 'PENDING_REVIEW');
      assert.notEqual(replacements[0].sourceRawRecipeCandidateId, targetPlan.sourceRawRecipeCandidateId);
      const priorRejected = await prisma.mealPlan.findMany({
        where: {
          userId: rejectedFixture.id,
          planGroupId: targetPlan.planGroupId,
          scheduledDate: targetPlan.scheduledDate,
          mealType: targetPlan.mealType,
          status: 'REJECTED',
        },
      });
      assert.ok(
        priorRejected.every(
          (row) =>
            !row.sourceRawRecipeCandidateId ||
            row.sourceRawRecipeCandidateId !== replacements[0].sourceRawRecipeCandidateId
        )
      );
      // Exercise the shared certified/AI persistence guard with real rejection
      // rows: an alternate library ID cannot disguise the same source/signature.
      const firstRejected = priorRejected.find((row) => row.sourceRawRecipeCandidateId && row.baseRecipeSignature)!;
      assert.ok(firstRejected);
      await assert.rejects(
        assertRecipeNotRejectedForSlot(prisma, targetPlan, {
          libraryMealId: 'synthetic-alternate-variant',
          sourceRawRecipeCandidateId: firstRejected.sourceRawRecipeCandidateId,
        }),
        /already rejected/
      );
      await assert.rejects(
        assertRecipeNotRejectedForSlot(prisma, targetPlan, { baseRecipeSignature: firstRejected.baseRecipeSignature }),
        /already rejected/
      );
      const anotherDay = new Date(targetPlan.scheduledDate);
      anotherDay.setUTCDate(anotherDay.getUTCDate() + 30);
      await assertRecipeNotRejectedForSlot(
        prisma,
        { ...targetPlan, scheduledDate: anotherDay },
        {
          sourceRawRecipeCandidateId: firstRejected.sourceRawRecipeCandidateId,
          baseRecipeSignature: firstRejected.baseRecipeSignature,
        }
      );
      const after = ok(await request('/api/user/meals/current', 'GET', undefined, rejectedFixture.token));
      assert.equal(after.data.length, 0);
      const replacementHasRiceSide = replacements[0].servingComponents.some((c) => c.componentType === 'COOKED_RICE');
      const replacementIncludesRice = replacements[0].sourceRawRecipeCandidate?.riceRole === 'INCLUDES_RICE';
      assert.ok(replacementHasRiceSide || replacementIncludesRice);
      state.reviewer.push({
        check: 'Reject actual sourced candidate',
        rejectedStatus: 'REJECTED',
        replacementStatus: replacements[0].status,
        pending: after.meta.pendingReview?.mealCount,
        actionable: after.data.length,
        replacementHasRiceSide,
        replacementIncludesRice,
        auditDecisionCount: 1,
        priorRejectedRecipes: priorRejected.length,
        variantAndSignatureGuard: true,
        rejectionScopedToSlot: true,
      });
      await settle(rejectedFixture.id);
      console.log('REVIEWER_RESULTS', JSON.stringify(state.reviewer));
      return;
    }
    if (phase === 'sources') {
      const riceFood = await prisma.foodItem.findFirst({
        where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
      });
      const names = ['NUTS', 'EGGS', 'DAIRY', 'SHELLFISH', 'GLUTEN'];
      const slots = Array.from({ length: 7 }, (_, i) =>
        [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER].map((mealType) => ({
          dayNumber: i + 1,
          mealType,
          scheduledDate: new Date(Date.UTC(2026, 9, 7 + i)),
        }))
      ).flat();
      for (const diet of Object.values(DietaryPreference))
        for (let mask = 0; mask < 32; mask++) {
          if (state.probes.some((p) => p.diet === diet && p.mask === mask && p.screened)) continue;
          const allergens = names.filter((_, i) => mask & (1 << i));
          const result = await sourceRawRecipeCandidates({
            slots,
            dailyCalorieTarget: 2400,
            dietaryPreference: diet,
            conditions: [],
            allergens,
            reviewFreeBaseOnly: false,
            ricePreference: 'WITH_RICE',
            riceFood,
          });
          assert.ok(
            result.meals.every(
              (m) =>
                validateGeneratedMealCandidate({ ingredients: m.ingredients, dietaryPreference: diet, allergens })
                  .accepted
            )
          );
          state.probes = state.probes.filter((p) => p.diet !== diet || p.mask !== mask);
          state.probes.push({
            diet,
            mask,
            allergens,
            screened: true,
            slots: result.meals.length,
            missing: result.remainingSlots.map((s) => s.mealType),
            uniqueSources: new Set(result.meals.map((m) => m.rawCandidateId)).size,
            ricePlates: result.meals.filter((m) => m.pairedRiceG).length,
          });
          await save();
          console.log('SOURCE', diet, mask, result.meals.length);
        }
      return;
    }
    const cases = phase === 'harder' ? harder : original;
    for (const scenario of cases) {
      if (state.results.some((row) => row.key === scenario.key && !row.technicalError)) continue;
      const started = Date.now();
      console.log('START', scenario.key);
      try {
        const f = await login(scenario.fixture || scenario.key);
        await reset(f);
        ok(
          await request(
            '/api/user/onboarding/profile',
            'POST',
            {
              age: 28,
              biologicalSex: scenario.sex || 'MALE',
              heightCm: scenario.height || 170,
              weightKg: scenario.weight || 70,
              targetWeightKg: scenario.weight || 70,
              goal: 'MAINTAIN',
              activityLevel: scenario.activity || 'LIGHTLY_ACTIVE',
              dietaryPreference: scenario.diet || 'OMNIVORE',
              ricePreference: scenario.rice || 'WITH_RICE',
              foodCulture: 'Filipino',
              shoppingDayOfWeek: 6,
            },
            f.token
          )
        );
        ok(
          await request(
            '/api/user/onboarding/safety',
            'POST',
            {
              entries: scenario.entries,
              editableDomains: ['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'],
              confirmed: true,
            },
            f.token
          )
        );
        const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: f.id } });
        for (const requirement of await ClinicalEvidenceService.requirementsForUser(f.id))
          ok(
            await request(
              '/api/user/onboarding/clinical-evidence/details',
              'PUT',
              {
                area: requirement.area,
                expectedSafetyRevision: profile.safetyRevision,
                conditionDetails: 'Synthetic software fixture; no real patient or clinical validation.',
                medications: 'Unknown',
                dietaryAdvice: 'Unknown',
                recentSymptoms: 'Unknown',
                measurements: 'No clinical measurement in this fixture',
              },
              f.token
            )
          );
        ok(
          await request(
            '/api/user/onboarding/tos',
            'POST',
            {
              termsVersion: CURRENT_TERMS_VERSION,
              privacyVersion: CURRENT_PRIVACY_VERSION,
              medicalDisclaimerAccepted: true,
              privacyPolicyAccepted: true,
              healthDataProcessingAccepted: true,
            },
            f.token
          )
        );
        ok(await request('/api/user/onboarding/complete', 'POST', {}, f.token));
        ok(await request('/api/user/nutrition-report/generate', 'POST', {}, f.token));
        const report = await NutritionReportService.getReport(f.id);
        assert.ok(report);
        const scope = await ClinicalProfileReviewService.status(f.id);
        await NutritionReportService.acknowledgeReport(f.id, report.version);
        let decisionCode: string | null = null;
        if (scope.required && !scope.approved) {
          ok(await request(`/api/nutritionist/profile-reviews/${f.id}/claim`, 'POST', {}, reviewer.token));
          const detail = await ClinicalProfileReviewService.detail(f.id, reviewer.reviewerId);
          const decision = await request(
            `/api/nutritionist/profile-reviews/${f.id}/decision`,
            'POST',
            {
              decision: 'APPROVED',
              notes: 'Synthetic software test; not clinical validation.',
              profileRevision: detail.profileRevision,
              scopeKey: detail.scopeKey,
            },
            reviewer.token
          );
          decisionCode = decision.body.errorCode ?? decision.body.code ?? null;
          if (decision.status === 422 && decisionCode === 'PROFILE_CLARIFICATION_REQUIRED') {
            assert.equal(await prisma.mealPlan.count({ where: { userId: f.id } }), 0);
            state.results.push({
              key: scenario.key,
              batch: phase,
              outcome: 'CLARIFICATION_REQUIRED',
              mealCount: 0,
              profileDecision: decisionCode,
              elapsedMs: Date.now() - started,
            });
            await save();
            console.log('RESULT', scenario.key, 'CLARIFICATION_REQUIRED');
            continue;
          }
          ok(decision);
        }
        await settle(f.id);
        const current = ok(await request('/api/user/meals/current', 'GET', undefined, f.token));
        const cycleId = current.meta.cycle?.id;
        const rows = cycleId
          ? await prisma.mealPlan.findMany({
              where: { planGroupId: cycleId },
              include: { servingComponents: true, ingredients: true },
            })
          : [];
        const delivered = (current.data?.length || 0) + (current.meta.pendingReview?.mealCount || 0);
        const requested = current.meta.cycle?.expectedSlotCount ?? 0;
        const outcome =
          delivered === 0 ? 'NO_DELIVERY' : delivered === requested ? 'COMPLETE_DELIVERY' : 'PARTIAL_DELIVERY';
        const jobs = await prisma.mealPlanGenerationJob.findMany({
          where: { userId: f.id },
          select: { status: true, lastErrorCode: true, planGroupId: true },
        });
        const repeat = cycleId && rows.length ? await MealGenerationService.generatePlanForUser(f.id) : null;
        if (repeat) assert.equal(repeat, cycleId);
        assert.equal(
          new Set(rows.map((row) => `${row.scheduledDate.toISOString()}:${row.mealType}`)).size,
          rows.length
        );
        assert.ok(rows.every((row) => row.calories > 0 && Number.isFinite(row.calories)));
        if (scenario.rice === 'NO_RICE')
          assert.ok(rows.every((row) => row.servingComponents.every((c) => c.componentType !== 'COOKED_RICE')));
        for (const route of ['/api/admin/analytics', '/api/nutritionist/queue'])
          assert.equal((await request(route, 'GET', undefined, f.token)).status, 403);
        const firstPending = rows.find((row) => row.status === 'PENDING_REVIEW');
        if (firstPending) {
          const blocked = await request(
            `/api/user/meals/${firstPending.id}/status`,
            'PATCH',
            { status: 'DONE' },
            f.token
          );
          assert.equal(blocked.status, 409);
          assert.match(blocked.body.error, /not currently loggable/i);
        }
        state.results = state.results.filter((row) => row.key !== scenario.key);
        state.results.push({
          key: scenario.key,
          batch: phase,
          outcome,
          requested,
          mealCount: delivered,
          pending: current.meta.pendingReview?.mealCount || 0,
          actionable: current.data.length,
          missing: current.meta.awaitingGenerationCount,
          generationStatus: current.meta.generationStatus,
          jobs: jobs.map((j) => ({ status: j.status, error: j.lastErrorCode, current: j.planGroupId === cycleId })),
          dailyCalorieTarget: report.planningTargets?.calories,
          ricePlates: rows.filter((row) => row.servingComponents.some((c) => c.componentType === 'COOKED_RICE')).length,
          profileReviewRequired: scope.required,
          repeatPreserved: repeat === cycleId,
          elapsedMs: Date.now() - started,
        });
        console.log('RESULT', scenario.key, outcome, delivered, '/', requested);
        await settle(f.id);
      } catch (error: any) {
        state.results.push({
          key: scenario.key,
          batch: phase,
          technicalError: error.message,
          elapsedMs: Date.now() - started,
        });
        console.log('AUDIT_ERROR', scenario.key, error.message);
        process.exitCode = 1;
      }
      await save();
    }
  } finally {
    state.results = state.results.filter(
      (row) => !row.technicalError || !state.results.some((other) => other.key === row.key && !other.technicalError)
    );
    await save();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
    await unlink(lockPath);
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode || 0));
