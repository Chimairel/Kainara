import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { harness, password } from './helpers/system-audit-harness';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { assertEmptyPlanRetry, emptyFailedPlanWindow } from '../src/services/empty-plan-retry.service';

async function main() {
  const h = await harness('7-allergy-source');
  try {
    const a = await h.staff('rnd-a', 'NUTRITIONIST');
    const b = await h.staff('rnd-b', 'NUTRITIONIST');
    const c = await h.staff('rnd-c', 'NUTRITIONIST');
    const admin = await h.staff('admin', 'ADMIN');
    await h.login('shellfish');
    let member = h.state.fixtures.shellfish;
    const meal = await prisma.mealLibrary.findFirstOrThrow({
      where: { mealName: { startsWith: 'Synthetic FNRI egg recipe' }, status: 'FLAGGED' },
      orderBy: { addedAt: 'desc' },
    });
    await h.check('Only an uninvolved RND can release an admin-flagged recipe', async () => {
      const body = { rationale: 'Synthetic software fixture release; no clinical validation.' };
      const route = `/api/nutritionist/library/${meal.id}/release-flag`;
      const involved = await h.request(route, 'POST', body, a.token);
      assert.ok(involved.status >= 400 && involved.status < 500, JSON.stringify(involved.body));
      const independent = await h.request(route, 'POST', body, c.token);
      assert.equal(independent.status, 200, JSON.stringify(independent.body));
      assert.equal(
        (
          await h.request(
            `/api/admin/library/${meal.id}/flag`,
            'POST',
            { reason: 'Synthetic source re-withdrawn before cold-start allergy test.' },
            admin.token
          )
        ).status,
        200
      );
      return { originalVerifierBlocked: true, independentRelease: true };
    });
    await h.check('Fresh multi-allergy account fails safely before compatible reviewed evidence exists', async () => {
      const email = `system-audit-positive-allergy-${Date.now()}@example.invalid`;
      const registered = await h.request('/api/auth/register', 'POST', {
        name: 'Synthetic positive allergy',
        email,
        password,
      });
      assert.equal(registered.status, 201, JSON.stringify(registered.body));
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      member = h.state.fixtures['positive-multi-allergy'] = {
        id: user.id,
        email,
        token: registered.body.data.accessToken,
      };
      const otp = (await h.mails(email, 'EMAIL_VERIFICATION')).at(-1).token;
      assert.equal((await h.request('/api/auth/verify-email', 'POST', { otp }, member.token)).status, 200);
      assert.equal(
        (
          await h.request(
            '/api/user/onboarding/profile',
            'POST',
            {
              age: 28,
              biologicalSex: 'MALE',
              heightCm: 170,
              weightKg: 70,
              targetWeightKg: 70,
              goal: 'MAINTAIN',
              activityLevel: 'LIGHTLY_ACTIVE',
              dietaryPreference: 'OMNIVORE',
              ricePreference: 'WITH_RICE',
              foodCulture: 'Filipino',
              shoppingDayOfWeek: 6,
            },
            member.token
          )
        ).status,
        200
      );
      assert.equal(
        (
          await h.request(
            '/api/user/onboarding/safety',
            'POST',
            {
              entries: [
                { domain: 'CONDITION', value: 'NONE', provenance: 'PREDEFINED' },
                { domain: 'ALLERGY', value: 'SHELLFISH', provenance: 'PREDEFINED' },
                { domain: 'ALLERGY', value: 'GLUTEN', provenance: 'PREDEFINED' },
              ],
              editableDomains: ['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'],
              confirmed: true,
            },
            member.token
          )
        ).status,
        200
      );
      assert.equal(
        (
          await h.request(
            '/api/user/onboarding/tos',
            'POST',
            {
              termsVersion: CURRENT_TERMS_VERSION,
              privacyVersion: CURRENT_PRIVACY_VERSION,
              medicalDisclaimerAccepted: true,
              privacyPolicyAccepted: true,
              healthDataProcessingAccepted: true,
            },
            member.token
          )
        ).status,
        200
      );
      assert.equal((await h.request('/api/user/onboarding/complete', 'POST', {}, member.token)).status, 200);
      const report = await h.request('/api/user/nutrition-report/generate', 'POST', {}, member.token);
      assert.equal(report.status, 200, JSON.stringify(report.body));
      await NutritionReportService.acknowledgeReport(member.id, report.body.data.version);
      const until = Date.now() + 30_000;
      while (Date.now() < until) {
        const failed = await prisma.mealPlanGenerationJob.findFirst({ where: { userId: member.id, status: 'FAILED' } });
        if (failed) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(await prisma.mealPlan.count({ where: { userId: member.id } }), 0);
      assert.ok(await prisma.mealPlanGenerationJob.findFirst({ where: { userId: member.id, status: 'FAILED' } }));
      return { savedMeals: 0, expectedFailure: 'NO_REVIEW_FREE_SOURCE' };
    });
    let selectedMealId = meal.id;
    await h.check('Reviewed shellfish absence supplies an actual allergy member plan', async () => {
      // A changed rice role is a new draft; parent approvals cannot transfer.
      const parent = await prisma.mealLibrary.findUniqueOrThrow({
        where: { id: meal.id },
        include: { ingredients: true },
      });
      const derived = await h.request(
        `/api/nutritionist/library/${meal.id}/derive`,
        'POST',
        {
          expectedRevision: parent.safetyEvidenceRevision,
          mealName: `Synthetic egg serving for rice pairing ${Date.now()}`,
          summary: 'Synthetic egg serving intended to be paired with separately composed rice.',
          instructions: 'Synthetic workflow recipe instructions only. Cook thoroughly.',
          mealType: 'BREAKFAST',
          ingredients: parent.ingredients.map((row) => ({ foodItemId: row.foodItemId, grams: row.quantity })),
          riceRole: 'PAIR_WITH_RICE',
          riceMinHalfCups: 1,
          riceMaxHalfCups: 3,
          imageUrl: null,
          imageMatchesRecipe: true,
          rationale: 'Synthetic serving classification for software workflow validation only.',
        },
        a.token
      );
      assert.equal(derived.status, 201, JSON.stringify(derived.body));
      selectedMealId = derived.body.data.id;
      let source = await prisma.mealLibrary.findUniqueOrThrow({
        where: { id: selectedMealId },
        include: { ingredients: true },
      });
      const prepared = await h.request(
        `/api/nutritionist/library/${selectedMealId}/nutrition-evidence/prepare`,
        'POST',
        {
          expectedRevision: source.safetyEvidenceRevision,
          portionBasis: 'Synthetic fixture using governed FNRI egg composition per 400 g edible serving.',
          ingredients: source.ingredients.map((row) => ({
            id: row.id,
            foodItemId: row.foodItemId,
            gramsPerServing: row.quantity,
          })),
        },
        a.token
      );
      assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
      source = await prisma.mealLibrary.findUniqueOrThrow({
        where: { id: selectedMealId },
        include: { ingredients: true },
      });
      const verificationRoute = `/api/nutritionist/meal-verification/LIBRARY_MEAL/${selectedMealId}`;
      assert.equal((await h.request(`${verificationRoute}/claim`, 'POST', {}, b.token)).status, 200);
      const verified = await h.request(
        `${verificationRoute}/decision`,
        'POST',
        {
          decision: 'VERIFIED',
          rationale: 'Synthetic fixture verification only; no clinical validation.',
        },
        b.token
      );
      assert.equal(verified.status, 200, JSON.stringify(verified.body));
      const certified = await h.request(
        `/api/nutritionist/library/${selectedMealId}/safety-evidence/certify`,
        'POST',
        {
          expectedRevision: source.safetyEvidenceRevision,
          conditionDeclarationState: 'NOT_REVIEWED',
          allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
          crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
          suitableConditions: [],
          allergensPresent: ['EGGS'],
          allergensReviewedAbsent: ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN'],
          usdaUseAccepted: false,
        },
        b.token
      );
      assert.equal(certified.status, 200, JSON.stringify(certified.body));
      const generated = await h.request('/api/user/meals/generate', 'POST', {}, member.token);
      assert.equal(generated.status, 200, JSON.stringify(generated.body));
      const rows = await prisma.mealPlan.findMany({
        where: { userId: member.id, libraryMealId: selectedMealId },
        include: { ingredients: true },
      });
      assert.ok(rows.length > 0, 'The reviewed library fixture must supply at least one real slot.');
      assert.ok(rows.every((row) => row.status === 'APPROVED' && !row.requiresSafetyRevalidation));
      const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
      assert.equal(await emptyFailedPlanWindow(member.id, rows[0].planGroupId!), null);
      assert.equal(await emptyFailedPlanWindow(h.state.fixtures.none.id, rows[0].planGroupId!), null);
      await assert.rejects(
        prisma.$transaction((tx) =>
          assertEmptyPlanRetry(tx, member.id, rows[0].planGroupId!, profile.revision, profile.safetyRevision)
        ),
        { errorCode: 'EMPTY_PLAN_RETRY_CHANGED' }
      );
      const repeat = await h.request('/api/user/meals/generate', 'POST', {}, member.token);
      assert.equal(repeat.status, 200, JSON.stringify(repeat.body));
      assert.equal(await prisma.mealPlan.count({ where: { userId: member.id } }), rows.length);
      const current = await h.request('/api/user/meals/current', 'GET', undefined, member.token);
      assert.equal(current.status, 200, JSON.stringify(current.body));
      assert.ok(current.body.data.some((row: { id: string }) => rows.some((saved) => saved.id === row.id)));
      return { reviewedSlots: rows.length, actionableCurrentSlots: current.body.data.length };
    });
    await h.check('Withdrawing the reviewed allergy source immediately blocks existing slots', async () => {
      const flagged = await h.request(
        `/api/admin/library/${selectedMealId}/flag`,
        'POST',
        {
          reason: 'Synthetic source withdrawn after allergy-member positive-path testing.',
        },
        admin.token
      );
      assert.equal(flagged.status, 200, JSON.stringify(flagged.body));
      const current = await h.request('/api/user/meals/current', 'GET', undefined, member.token);
      assert.equal(current.status, 200, JSON.stringify(current.body));
      assert.ok(!current.body.data.some((row: { libraryMealId?: string }) => row.libraryMealId === selectedMealId));
      const rows = await prisma.mealPlan.findMany({ where: { userId: member.id, libraryMealId: selectedMealId } });
      assert.ok(rows.length > 0 && rows.every((row) => row.requiresSafetyRevalidation));
      return { withdrawnSlots: rows.length, usableWithdrawnSlots: 0 };
    });
  } finally {
    await h.close();
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode || 0));
