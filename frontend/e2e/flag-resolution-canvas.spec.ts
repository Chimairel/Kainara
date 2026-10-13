import { expect, test, type Page } from '@playwright/test';

const concern = {
  id: 'flag',
  createdAt: '2026-10-13T00:00:00Z',
  actorSnapshot: { name: 'Synthetic flagger' },
  notes: {
    category: 'NUTRITION',
    affectedFields: ['sodiumMg'],
    explanation: 'Check the measured sodium source for this recorded recipe.',
    reference: 'Synthetic recorded composition reference.',
    proposedCorrection: 'Reconcile the measured ingredient grams.',
  },
};
const meal = {
  id: 'recipe',
  mealName: 'Synthetic measured plate',
  mealType: 'LUNCH',
  calories: 400,
  proteinG: 20,
  carbsG: 60,
  fatG: 10,
  description: 'Cook the recorded measured ingredients and serve one bowl.',
  status: 'FLAGGED',
  reviewLineage: { state: 'PENDING_REREVIEW', incidentCount: 1 },
  safetyEvidenceRevision: 1,
  safetyEvidenceStatus: 'STALE',
  baseVerification: 'REVIEW_PENDING',
  nutritionServingDescription: 'One measured bowl',
  ingredients: [],
  flags: [],
  usageCount: 0,
  conditionDeclarationState: 'NOT_REVIEWED',
  allergenDeclarationState: 'NOT_REVIEWED',
  crossContactAssessment: 'NOT_ASSESSED',
};
const resolution = 'Checked the recorded source and reconciled every measured ingredient quantity.';

async function fixture(page: Page, mode: 'recipe' | 'scoped' | 'case', theme = 'light') {
  const user = {
    id: 'synthetic-rnd',
    name: 'Independent synthetic RND',
    email: 'fixture@example.invalid',
    role: 'NUTRITIONIST',
    emailVerified: true,
    onboardingDone: true,
    tosAccepted: true,
    onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
    nutritionReport: null,
  };
  const claims = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  await page
    .context()
    .addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
  await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
  let claimed = mode === 'case',
    verified = false;
  const mutations: Array<{ path: string; body: Record<string, unknown> }> = [],
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const detail = () => ({
    meal: { ...meal, status: 'APPROVED' },
    originatingPlan: null,
    recordedScope: { conditions: ['HYPERTENSION'], allergens: [] },
    linkedUserCurrentProfile: null,
    flagReview: {
      expectedVersion: 'c'.repeat(64),
      state: 'FLAGGED',
      canResolve: true,
      blockedByRecipe: false,
      matchesCurrentRecipe: true,
      concern,
    },
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
    if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
    let data: unknown = [];
    if (request.method() !== 'GET') {
      mutations.push({ path, body: request.postDataJSON() });
      if (path.endsWith('/claim')) claimed = true;
      if (path.endsWith('/confirm') || path.endsWith('/recheck')) verified = true;
      data = { state: 'RELEASED' };
    } else if (path.endsWith('/user/profile')) data = user;
    else if (path.endsWith('/credential-status'))
      data = { eligible: true, reason: null, expiryDate: '2099-12-31', pendingRequest: null };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    else if (path.endsWith('/review-work-counts'))
      data = { meal: 0, case: mode === 'case' ? 1 : 0, profile: 0, audit: 1 };
    else if (path.endsWith('/audit-history')) data = { rows: [], page: 1, total: 0, totalPages: 1 };
    else if (path.endsWith('/meal-review-cases/recipe'))
      data = {
        state: verified ? 'PUBLISHED' : 'PENDING_REREVIEW',
        recipeVersion: 'a'.repeat(64),
        reviewVersion: 'b'.repeat(64),
        incidentCount: 1,
        incident: {
          id: 'incident',
          number: 1,
          state: 'PENDING_REREVIEW',
          reports: [concern],
          confirmations: [],
          decisions: [],
          claimedByNutritionistId: claimed ? 'reviewer' : null,
        },
        history: [],
        claimStatus: { claimedByMe: claimed, claimedByOther: false },
        validConfirmations: [],
        canAdminRelease: false,
        legacyHistoryUnknown: false,
      };
    else if (path.endsWith('/meal-review-cases'))
      data = [{ id: meal.id, mealName: meal.mealName, state: 'PENDING_REREVIEW', incidentCount: 1 }];
    else if (path.includes('/approvals/PROFILE/flag')) data = detail();
    else if (path.endsWith('/approval-follow-ups'))
      data = verified
        ? []
        : [
            {
              id: 'flag',
              mealLibraryId: meal.id,
              flaggedAt: '2026-10-13',
              flagReason: concern.notes.explanation,
              mealLibrary: { mealName: meal.mealName },
            },
          ];
    else if (path.endsWith('/governance/queue')) data = { clearances: [] };
    else if (path.endsWith('/library/recipe/approvals')) data = [];
    else if (path.endsWith('/library/recipe')) data = meal;
    else if (path.endsWith('/library')) data = { meals: [meal], total: 1, page: 1, limit: 20 };
    else if (path.endsWith('/queue/plan'))
      data = {
        mealPlan: {
          ...meal,
          id: 'plan',
          userId: 'member',
          status: 'PENDING_REVIEW',
          planGroupId: 'cycle',
          planType: 'FULL_WEEK',
          aiConfidenceFlag: 'NEEDS_REVIEW',
          scheduledDate: '2026-10-13T00:00:00Z',
          createdAt: '2026-10-13T00:00:00Z',
        },
        user: {
          name: 'Synthetic member',
          age: 28,
          sex: 'MALE',
          goal: 'MAINTAIN',
          dietaryPreference: 'OMNIVORE',
          ricePreference: 'NO_RICE',
          conditions: ['HYPERTENSION'],
          allergies: [],
        },
        ingredients: [],
        warnings: [],
        claimStatus: { claimedByMe: true, claimedByOther: false },
        reviewApprovalCount: 0,
        reviewReferences: [],
        flagConcerns: [
          {
            ...concern,
            kind: 'PROFILE',
            mealLibraryId: 'recipe',
            approvalId: 'flag',
            active: !verified,
            resolution: verified ? resolution : undefined,
          },
        ],
      };
    else if (path.endsWith('/queue'))
      data = [
        {
          ...meal,
          id: 'plan',
          userId: 'member',
          status: 'PENDING_REVIEW',
          scheduledDate: '2026-10-13T00:00:00Z',
          createdAt: '2026-10-13T00:00:00Z',
          planType: 'FULL_WEEK',
          aiConfidenceFlag: 'NEEDS_REVIEW',
          user: { id: 'member', name: 'Synthetic member' },
          claimStatus: { claimedByMe: true, claimedByOther: false },
          ingredients: [],
          reviewStage: 'PRIMARY',
          remainingReviewers: 1,
          coalescedDependentCount: 1,
          sourceProvenance: 'CERTIFIED_LIBRARY',
          assuranceTier: 'STANDARD',
          routing: 'GENERAL',
          rankingReasonCodes: [],
        },
      ];
    await route.fulfill({ headers, json: { success: true, data } });
  });
  return { mutations, errors };
}

for (const width of [390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`recipe flag paper requires written resolutions at ${width}px ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const { mutations, errors } = await fixture(page, 'recipe', theme);
      // Exercise the case-canvas link target directly: it must open the exact held recipe.
      await page.goto('/nutritionist/library?mealId=recipe');
      const panel = page.getByRole('region', { name: 'Meal-wide review' });
      await panel.getByRole('button', { name: 'Expand canvas', exact: true }).click();
      const canvas = page.getByRole('dialog', { name: /Recipe re-review.*fullscreen/ });
      await expect(canvas).toBeVisible();
      await canvas.getByRole('button', { name: 'Move Flag concerns and resolutions sheet' }).focus();
      await canvas.getByRole('button', { name: 'Fit selected sheet' }).click();
      await expect(canvas.getByText(concern.notes.explanation, { exact: true })).toBeVisible();
      await expect(canvas.getByRole('button', { name: 'Re-verify recipe' })).toBeDisabled();
      await expect(canvas.getByLabel('How you resolved this concern')).toHaveCount(0);
      await canvas.getByRole('button', { name: 'Claim re-review', exact: true }).click();
      await canvas.getByLabel('How you resolved this concern').fill(resolution);
      await canvas.getByLabel('Independent review findings').fill(resolution);
      await canvas.getByLabel(/I reviewed the nutrition evidence/).check();
      await expect(canvas.getByRole('button', { name: 'Re-verify recipe' })).toBeDisabled();
      await canvas.getByRole('button', { name: 'Mark resolved', exact: true }).click();
      await expect(canvas.getByRole('button', { name: 'Re-verify recipe' })).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath(`recipe-resolved-${width}-${theme}.png`) });
      await canvas.getByRole('button', { name: 'Re-verify recipe' }).click();
      await expect.poll(() => mutations.filter((value) => value.path.endsWith('/confirm')).length).toBe(1);
      expect(mutations.find((value) => value.path.endsWith('/confirm'))?.body.resolutions).toEqual([
        { reportId: concern.id, rationale: resolution },
      ]);
      expect(errors).toEqual([]);
    });
  }

test('Audit opens the shared flag canvas and saves the exact version', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { mutations, errors } = await fixture(page, 'scoped');
  await page.goto('/nutritionist/audit');
  await page.getByRole('button', { name: /Flagged approvals/ }).click();
  await page.getByRole('button', { name: 'View case', exact: true }).click();
  await page.getByRole('button', { name: 'Review flagged approval', exact: true }).click();
  const canvas = page.getByRole('dialog', { name: /Approval recheck.*fullscreen/ });
  await canvas.getByRole('button', { name: 'Move Flag concern and resolution sheet' }).focus();
  await canvas.getByRole('button', { name: 'Fit selected sheet' }).click();
  await expect(canvas.getByText(concern.notes.reference, { exact: false })).toBeVisible();
  await canvas.getByLabel('How you resolved this concern').fill(resolution);
  await expect(canvas.getByRole('button', { name: 'Verify resolved case' })).toBeDisabled();
  await canvas.getByRole('button', { name: 'Mark resolved', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('scoped-flag-resolved.png') });
  await canvas.getByRole('button', { name: 'Verify resolved case' }).click();
  await expect(canvas).toHaveCount(0);
  expect(mutations).toEqual([
    {
      path: '/api/nutritionist/library/recipe/approvals/flag/recheck',
      body: { kind: 'PROFILE', rationale: resolution, expectedVersion: 'c'.repeat(64), resolved: true },
    },
  ]);
  expect(errors).toEqual([]);
});

test('member-case canvas blocks approval and retains the saved resolution after recheck', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { errors } = await fixture(page, 'case');
  await page.goto('/nutritionist/reviews');
  await page.getByRole('button', { name: /Case approval/ }).click();
  await page.getByText(meal.mealName, { exact: true }).first().click();
  await page.getByRole('button', { name: 'Expand canvas', exact: true }).click();
  const parent = page.getByRole('dialog', { name: /Case approval.*fullscreen/ });
  await expect(parent.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await parent.getByRole('button', { name: 'Move Flag concerns sheet' }).focus();
  await parent.getByRole('button', { name: 'Fit selected sheet' }).click();
  await parent.getByRole('button', { name: 'Resolve flagged case', exact: true }).click();
  const child = page.getByRole('dialog', { name: /Approval recheck.*fullscreen/ });
  await child.getByRole('button', { name: 'Move Flag concern and resolution sheet' }).focus();
  await child.getByRole('button', { name: 'Fit selected sheet' }).click();
  await child.getByLabel('How you resolved this concern').fill(resolution);
  await child.getByRole('button', { name: 'Mark resolved', exact: true }).click();
  await child.getByRole('button', { name: 'Verify resolved case' }).click();
  await expect(child).toHaveCount(0);
  await expect(parent.getByText('Resolved in the recorded review', { exact: true })).toBeAttached();
  await expect(parent.getByText(resolution, { exact: true })).toBeAttached();
  await expect(parent.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('member-case-resolved.png') });
  expect(errors).toEqual([]);
});
