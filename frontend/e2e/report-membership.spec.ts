import { expect, test, type Page } from '@playwright/test';

// Browser fixtures cover presentation. The guarded PostgreSQL scripts cover authorization and writes.
async function setup(page: Page, safetyChanged = false) {
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
    },
  };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/live/')) return route.fulfill({ status: 204 });
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
    else if (path.endsWith('/nutrition-report')) data = report;
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
          memberSwaps: 6,
          memberEstimates: 10,
          memberReplans: 2,
          memberPlanReviews: 1,
          memberOutsideReviews: 1,
        },
        usage: {
          AI_ESTIMATE: { used: 0, cap: 2, remaining: 2 },
          REPLAN: { used: 0, cap: 0, remaining: 0 },
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
    await expect(page.getByRole('heading', { name: 'Lifestyle', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Health', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Membership plans' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Lifestyle' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Get Health' })).toBeEnabled();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
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
