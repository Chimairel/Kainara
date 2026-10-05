import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { harness, password } from './helpers/system-audit-harness';
import { queryEligibleLibraryMeals } from '../src/services/meal-library-candidate-query.service';

async function main() {
  const h = await harness('5');
  try {
    const admin = await h.staff('admin', 'ADMIN');
    const a = await h.staff('rnd-a', 'NUTRITIONIST');
    const b = await h.staff('rnd-b', 'NUTRITIONIST');
    await h.login('none');
    const member = h.state.fixtures.none;
    await h.check('Admin overview, users, licenses, data and audit workspaces load', async () => {
      const routes = [
        '/api/admin/analytics',
        '/api/admin/users?page=1&limit=10',
        '/api/admin/nutritionists',
        '/api/admin/nutritionist-applications',
        '/api/admin/data',
        '/api/admin/meals',
        '/api/admin/library',
        '/api/admin/audit-events',
        '/api/admin/structured-safety-operations',
      ];
      for (const route of routes) {
        const response = await h.request(route, 'GET', undefined, admin.token);
        assert.equal(response.status, 200, `${route}: ${JSON.stringify(response.body)}`);
        assert.equal((await h.request(route, 'GET', undefined, member.token)).status, 403);
      }
      return { routes: routes.length };
    });
    await h.check(
      'Admin suspension invalidates existing staff token and unsuspension restores eligibility',
      async () => {
        assert.equal(
          (
            await h.request(
              `/api/admin/users/${b.id}/suspension`,
              'PATCH',
              { suspended: true, reason: 'Synthetic audit suspension.' },
              admin.token
            )
          ).status,
          200
        );
        assert.equal((await h.request('/api/nutritionist/queue', 'GET', undefined, b.token)).status, 401);
        assert.equal(
          (await h.request(`/api/admin/users/${b.id}/suspension`, 'PATCH', { suspended: false }, admin.token)).status,
          200
        );
        await h.login('rnd-b');
        assert.equal((await h.request('/api/nutritionist/queue', 'GET', undefined, b.token)).status, 200);
      }
    );
    await h.check(
      'Admin authoring, stale edits, base verification, nutrition preparation and reusable allergy facts',
      async () => {
        const food = await prisma.foodItem.findFirstOrThrow({ where: { source: 'FNRI', name: 'Egg, chicken, whole' } });
        const input = {
          mealName: `Synthetic FNRI egg recipe ${Date.now()}`,
          mealType: 'BREAKFAST',
          summary: 'Isolated software fixture using actual FNRI egg composition.',
          instructions: 'Synthetic recipe instructions for workflow validation only. Cook thoroughly.',
          nutritionBasis: 'Actual FNRI food record scaled from 100 g to 400 g for this isolated fixture.',
          nutritionServingDescription: '400 g edible egg',
          calories: food.calories * 4,
          proteinG: food.proteinG * 4,
          carbsG: food.carbsG * 4,
          fatG: food.fatG * 4,
          sodiumMg: null,
          sugarG: null,
          fiberG: null,
          potassiumMg: null,
          phosphorusMg: null,
          saturatedFatG: null,
          ingredients: [{ foodItemId: food.id, gramsPerServing: 400 }],
        };
        const created = await h.request('/api/admin/meals', 'POST', input, admin.token);
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const id = created.body.data.id;
        let meal = await prisma.mealLibrary.findUniqueOrThrow({ where: { id }, include: { ingredients: true } });
        assert.equal(meal.safetyEvidenceStatus, 'INCOMPLETE');
        assert.ok(
          !(
            await queryEligibleLibraryMeals({
              mealType: 'BREAKFAST',
              dailyCalorieTarget: 2300,
              profile: { dietaryPreference: 'OMNIVORE', otherConditions: null, otherAllergies: null },
              userConditions: [],
              userAllergens: [],
            })
          ).some((row) => row.id === id)
        );
        assert.equal((await h.request('/api/admin/meals', 'POST', input, member.token)).status, 403);
        const stale = await h.request(
          `/api/admin/meals/${id}`,
          'PATCH',
          { ...input, expectedRevision: meal.safetyEvidenceRevision - 1 },
          admin.token
        );
        assert.ok(stale.status >= 400 && stale.status < 500);
        const prepared = await h.request(
          `/api/nutritionist/library/${id}/nutrition-evidence/prepare`,
          'POST',
          {
            expectedRevision: meal.safetyEvidenceRevision,
            portionBasis: 'Actual FNRI egg composition for a synthetic 400 g edible serving.',
            ingredients: meal.ingredients.map((row) => ({
              id: row.id,
              foodItemId: row.foodItemId,
              gramsPerServing: row.quantity,
            })),
          },
          a.token
        );
        assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
        meal = await prisma.mealLibrary.findUniqueOrThrow({ where: { id }, include: { ingredients: true } });
        assert.equal(
          (await h.request(`/api/nutritionist/meal-verification/LIBRARY_MEAL/${id}/claim`, 'POST', {}, a.token)).status,
          200
        );
        const verified = await h.request(
          `/api/nutritionist/meal-verification/LIBRARY_MEAL/${id}/decision`,
          'POST',
          { decision: 'VERIFIED', rationale: 'Synthetic fixture verification only; no clinical certification.' },
          a.token
        );
        assert.equal(verified.status, 200, JSON.stringify(verified.body));
        const cert = await h.request(
          `/api/nutritionist/library/${id}/safety-evidence/certify`,
          'POST',
          {
            expectedRevision: meal.safetyEvidenceRevision,
            conditionDeclarationState: 'NOT_REVIEWED',
            allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
            crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
            suitableConditions: [],
            allergensPresent: ['EGGS'],
            allergensReviewedAbsent: ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN'],
            usdaUseAccepted: false,
          },
          a.token
        );
        assert.equal(cert.status, 200, JSON.stringify(cert.body));
        const allowed = await queryEligibleLibraryMeals({
          mealType: 'BREAKFAST',
          dailyCalorieTarget: 2300,
          skipCalorieFilter: true,
          profile: { dietaryPreference: 'OMNIVORE', otherConditions: null, otherAllergies: null },
          userConditions: [],
          userAllergens: ['SHELLFISH'],
        });
        assert.ok(allowed.some((row) => row.id === id));
        const forbidden = await queryEligibleLibraryMeals({
          mealType: 'BREAKFAST',
          dailyCalorieTarget: 2300,
          skipCalorieFilter: true,
          profile: { dietaryPreference: 'OMNIVORE', otherConditions: null, otherAllergies: null },
          userConditions: [],
          userAllergens: ['EGGS'],
        });
        assert.ok(!forbidden.some((row) => row.id === id));
        const flag = await h.request(
          `/api/admin/library/${id}/flag`,
          'POST',
          { reason: 'Synthetic audit withdrawal of the reviewed recipe.' },
          admin.token
        );
        assert.equal(flag.status, 200, JSON.stringify(flag.body));
        assert.ok(
          !(
            await queryEligibleLibraryMeals({
              mealType: 'BREAKFAST',
              dailyCalorieTarget: 2300,
              skipCalorieFilter: true,
              profile: { dietaryPreference: 'OMNIVORE', otherConditions: null, otherAllergies: null },
              userConditions: [],
              userAllergens: ['SHELLFISH'],
            })
          ).some((row) => row.id === id)
        );
        return {
          unreviewedDraftHidden: true,
          shellfishAbsenceReusable: true,
          eggAllergyExcluded: true,
          flagRemovesEligibility: true,
        };
      }
    );
    await h.check('Applicant inbox proof, call gates, invitation activation and replay rejection', async () => {
      const email = `system-audit-applicant-${Date.now()}@example.invalid`;
      const base = '/api/nutritionist-applications';
      assert.equal((await h.request(`${base}/email/send`, 'POST', { email })).status, 200);
      const code = (await h.mails(email, 'EMAIL_VERIFICATION')).at(-1).token;
      const verified = await h.request(`${base}/email/verify`, 'POST', { email, code });
      assert.equal(verified.status, 200, JSON.stringify(verified.body));
      const submitted = await h.request(base, 'POST', {
        emailVerificationProof: verified.body.data.proof,
        fullName: 'Synthetic Audit Applicant',
        email,
        phoneNumber: '09170000000',
        prcLicenseNumber: `SYNTHETIC-${Date.now()}`,
        prcLicenseExpiry: '2099-12-31T00:00:00.000Z',
        specialization: 'Synthetic workflow testing',
        yearsOfExperience: 0,
        university: 'Synthetic test university',
        professionalBio:
          'Synthetic software applicant fixture in an isolated local database; not a professional identity.',
        officialHeadshot:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=',
        photoRecentAttested: true,
        availableCallSlots: [1, 2].map((days) => new Date(Date.now() + days * 86400_000).toISOString()),
        consent: true,
      });
      assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
      const application = await prisma.nutritionistApplication.findUniqueOrThrow({
        where: { referenceCode: submitted.body.data.referenceCode },
      });
      const route = `/api/admin/nutritionist-applications/${application.id}`;
      assert.equal((await h.request(`${route}/decision`, 'PATCH', { decision: 'approve' }, admin.token)).status, 400);
      for (const status of ['UNDER_REVIEW', 'CALL_REQUIRED'])
        assert.equal((await h.request(`${route}/stage`, 'PATCH', { status }, admin.token)).status, 200);
      assert.equal(
        (
          await h.request(
            `${route}/schedule`,
            'PATCH',
            {
              scheduledCallAt: new Date(Date.now() + 60000).toISOString(),
              meetingUrl: 'https://example.invalid/synthetic-call',
            },
            admin.token
          )
        ).status,
        200
      );
      assert.equal(
        (await h.request(`${route}/call-verification`, 'PATCH', { identityMatched: true }, admin.token)).status,
        400
      );
      await prisma.nutritionistApplication.update({
        where: { id: application.id },
        data: { scheduledCallAt: new Date(Date.now() - 60000) },
      });
      assert.equal(
        (await h.request(`${route}/call-verification`, 'PATCH', { identityMatched: true }, admin.token)).status,
        200
      );
      assert.equal((await h.request(`${route}/decision`, 'PATCH', { decision: 'approve' }, admin.token)).status, 200);
      const token = (await h.mails(email, 'NUTRITIONIST_INVITATION')).at(-1).token;
      assert.equal((await h.request(`${base}/activate`, 'POST', { token, password })).status, 200);
      assert.equal((await h.request(`${base}/activate`, 'POST', { token, password })).status, 400);
      const login = await h.request('/api/auth/login', 'POST', { email, password });
      assert.equal(login.status, 200);
      assert.equal(
        (await h.request('/api/nutritionist/profile', 'GET', undefined, login.body.data.accessToken)).status,
        200
      );
      return { externalEmail: false, callClockAdvancedOnFixture: true, activationWorks: true, replayRejected: true };
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
