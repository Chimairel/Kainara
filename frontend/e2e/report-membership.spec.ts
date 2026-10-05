import { expect, test, type Page } from '@playwright/test';

// Browser fixtures cover presentation. The guarded PostgreSQL scripts cover authorization and writes.
async function setup(page: Page, safetyChanged = false, weightOnly = false) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('close', () => expect(errors).toEqual([]));
  const user = {
    id: 'report-browser-fixture',
    name: 'Test User',
    email: 'report@example.invalid',
    role: 'USER',
    emailVerified: true,
    onboardingDone: true,
    tosAccepted: true,
    reportAcknowledged: !safetyChanged,
    onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
    nutritionReport: { acknowledgedAt: null, isStale: false, profileRevision: 2 },
    userProfile: {
      age: 25,
      heightCm: 170,
      weightKg: 65,
      biologicalSex: 'MALE',
      goal: 'MAINTAIN',
      activityLevel: 'SEDENTARY',
      dailyCalorieTarget: 2000,
      revision: 2,
      safetyRevision: 1,
      planningReportVersion: 1,
    },
    healthConditions: [],
    allergies: [],
    safetyEntries: [],
  };
  const payload = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  const report = {
    version: 2,
    generatedAt: '2026-10-02T00:00:00Z',
    isStale: false,
    acknowledgedAt: null,
    reportPolicyVersion: 'NUTRITION_GUIDANCE_DETERMINISTIC_V1',
    referenceItems: [],
    basedOnConditions: [],
    basedOnAllergies: [],
    generalSummary: 'Current profile guidance',
    foodsToAvoid: [],
    foodsToLimit: [],
    foodsRecommended: [],
    drinksGuidance: [],
    planningContext: {
      activeVersion: 1,
      activeGeneratedAt: '2026-09-01T00:00:00Z',
      pendingChanges: true,
      safetyChanged,
      activationTier: weightOnly ? null : safetyChanged ? 'HEALTH' : 'LIFESTYLE',
    },
  };
  let acknowledged = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/live/')) return route.fulfill({ status: 204 });
    if (path.endsWith('/nutrition-report/acknowledge') && weightOnly) {
      acknowledged = true;
      return route.fulfill({
        json: {
          success: true,
          data: {
            version: report.version,
            acknowledgedAt: '2026-10-05T00:00:00Z',
            planningReadiness: {
              status: 'REQUEST_ALLOWED',
              canRequestPlan: true,
              title: 'Meal planning is available',
              message: 'Ready',
              actionPath: '/meals',
            },
          },
        },
      });
    }
    if (path.endsWith('/nutrition-report/acknowledge'))
      return route.fulfill({
        status: 403,
        json: {
          success: false,
          error: 'Membership needed',
          errorCode: safetyChanged ? 'HEALTH_MEMBERSHIP_REQUIRED' : 'MEMBERSHIP_REQUIRED',
        },
      });
    let data: unknown = [];
    if (path.endsWith('/user/profile')) data = user;
    else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
    else if (path.endsWith('/checkin/status'))
      data = { isDue: true, hasPendingChanges: true, safetyChanged, weeksSinceConfirmation: 3, profileRevision: 2 };
    else if (path.endsWith('/nutrition-report'))
      data = acknowledged
        ? {
            ...report,
            acknowledgedAt: '2026-10-05T00:00:00Z',
            planningContext: { ...report.planningContext, activeVersion: 2, pendingChanges: false },
          }
        : report;
    else if (path.endsWith('/user/membership'))
      data = {
        enabled: true,
        tier: 'FREE',
        level: 'FREE',
        enhanced: false,
        healthAccess: false,
        purchasesAvailable: false,
        price: null,
        autoRenews: false,
        serverTime: '2026-10-02T00:00:00Z',
        trialEndsAt: '2026-09-30T00:00:00Z',
        paidUntil: null,
        resetsAt: '2026-10-04T16:00:00Z',
        requiresCaseReview: safetyChanged,
        swaps: { used: 0, cap: 3, remaining: 3 },
        limits: {
          freeSwaps: 3,
          freeEstimates: 2,
          lifestyleSwaps: 10,
          healthSwaps: 21,
          memberEstimates: 10,
          memberPlanReviews: 1,
          memberOutsideReviews: 1,
        },
        usage: {
          AI_ESTIMATE: { used: 0, cap: 2, remaining: 2 },
          PLAN_REVIEW: { used: 0, cap: 0, remaining: 0 },
          OUTSIDE_REVIEW: { used: 0, cap: 0, remaining: 0 },
        },
      };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
}
for (const width of [320, 390, 1440]) {
  test(`Free, Lifestyle and Health remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto('/membership?tab=plans');
    await expect(page.getByText('Replans', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Lifestyle', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Health', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Membership plans' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Lifestyle' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Get Health' })).toBeEnabled();
    await expect
      .poll(async () => (await page.getByRole('article', { name: 'Health plan' }).ariaSnapshot()).replace(/\s/g, ''))
      .toContain('₱999/month');
    await page.getByRole('button', { name: /Yearly Billing/ }).click();
    await expect
      .poll(async () => (await page.getByRole('article', { name: 'Health plan' }).ariaSnapshot()).replace(/\s/g, ''))
      .toContain('₱9,590/year');
    await page.getByRole('button', { name: 'Monthly Billing' }).click();
    await expect(page.getByText('10 meal swaps per cycle', { exact: true })).toBeVisible();
    await expect(page.getByText('21 meal swaps per cycle', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('article', { name: 'Lifestyle plan' }).getByText('Recommended', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('article', { name: 'Health plan' }).getByText('Recommended', { exact: true })
    ).toHaveCount(0);
    await expect(page.getByText('10 AI estimates per week', { exact: true })).toBeVisible();
    await expect(page.getByText(/Your first 30 days include the Health plan/)).toBeVisible();
    await expect(page.getByText(/Weekly allowances reset every Monday at midnight/)).toBeVisible();
    await expect(page.getByText(/per Manila week|development payment sandbox|Demo checkout uses/)).toHaveCount(0);
    await expect(page.getByText(/optional replans/i)).toHaveCount(0);
    const lifestyleInfo = page.getByRole('button', { name: 'Lifestyle planning details' });
    if (width === 1440) await lifestyleInfo.hover();
    else await lifestyleInfo.click();
    await expect(page.getByRole('tooltip')).toContainText('Activity level, weight loss');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Membership plans' })).toBeVisible();
    await page.getByRole('button', { name: 'Health planning details' }).click();
    const hint = page.getByRole('tooltip');
    await expect(hint).toContainText('shellfish (including shrimp)');
    await expect(hint).toContainText('Individual assessment: kidney disease');
    await expect(hint).toBeVisible();
    const bounds = await hint.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
    await page.screenshot({ path: test.info().outputPath('health-info.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('meter')).toHaveCount(4);
    await page.locator('[aria-label="Allowances and usage statistics"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('membership.png'), fullPage: true });
    await expect(page.getByRole('status', { name: 'Profile planning status' })).toContainText('3 weeks ago');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Complete check-in' }).click();
    await expect(page.getByRole('button', { name: 'Confirm my saved updates' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Profile planning status' })).toBeVisible();
    await page.goto('/profile/nutrition-report');
    await page.getByRole('button', { name: 'Use this report for meal planning' }).click();
    await expect(page.getByRole('dialog', { name: 'Lifestyle membership needed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep my previous planning report' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
test('new health disclosures offer Health without an older-report bypass', async ({ page }) => {
  await setup(page, true);
  await page.goto('/profile/nutrition-report');
  await page.getByRole('button', { name: 'Use this report for meal planning' }).click();
  await expect(page.getByRole('dialog', { name: 'Health membership needed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep my previous planning report' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continue to my saved records' })).toHaveAttribute('href', '/export');
});

test('declared health needs recommend Health on the plan comparison', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await setup(page, true);
  await page.goto('/membership?tab=plans');
  await expect(
    page.getByRole('article', { name: 'Health plan' }).getByText('Recommended', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'Lifestyle plan' }).getByText('Recommended', { exact: true })
  ).toHaveCount(0);
  await expect(page.getByText(/Your first 30 days include the Health plan/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Health plan needed' })).toBeDisabled();
  await expect(page.getByText(/Your health details require nutritionist review/)).toBeVisible();
});

test('Free weight-only report activation does not open a membership gate', async ({ page }) => {
  await setup(page, false, true);
  await page.goto('/profile/nutrition-report');
  await page.getByRole('button', { name: 'Use this report for meal planning' }).click();
  await expect(page.getByRole('dialog', { name: /membership needed/ })).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);
});
