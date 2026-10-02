import { expect, test, type Page } from '@playwright/test';

// Presentation fixtures only. Guarded PostgreSQL acceptance verifies writes and provider evidence.
async function setup(page: Page, scenario: 'trial' | 'scheduled' | 'upgrade') {
  const now = Date.now();
  const start = new Date(now - 86400000).toISOString();
  const end = new Date(now + 7 * 86400000).toISOString();
  const nextEnd = new Date(now + 37 * 86400000).toISOString();
  const owner = 'transition-browser-fixture';
  const payload = Buffer.from(
    JSON.stringify({
      userId: owner,
      email: 'fixture@preview.invalid',
      role: 'USER',
      exp: Math.floor(now / 1000) + 3600,
    })
  ).toString('base64url');
  await page
    .context()
    .addCookies([
      {
        name: 'nutrimind_session',
        value: `fixture.${payload}.fixture`,
        url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      },
    ]);
  const usage = { used: 0, cap: 10, remaining: 10 };
  let confirmed = 0;
  const quote = {
    id: 'quote-browser-fixture',
    tier: scenario === 'upgrade' ? 'HEALTH' : 'LIFESTYLE',
    period: 'MONTHLY',
    status: 'QUOTED',
    mode: 'TEST',
    action: scenario === 'upgrade' ? 'UPGRADE' : 'AFTER_TRIAL',
    listPriceCentavos: scenario === 'upgrade' ? 149900 : 24900,
    creditCentavos: scenario === 'upgrade' ? 149900 : 0,
    carryoverCentavos: scenario === 'upgrade' ? 1000 : 0,
    amountCentavos: scenario === 'upgrade' ? 0 : 24900,
    startsAt: scenario === 'upgrade' ? new Date(now).toISOString() : end,
    endsAt: nextEnd,
    expiresAt: new Date(now + 600000).toISOString(),
  };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
      return route.fulfill({ status: 204, headers });
    let data: unknown = [];
    if (path.endsWith('/user/profile'))
      data = {
        id: owner,
        name: 'Fixture User',
        email: 'fixture@preview.invalid',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        nutritionReport: { acknowledgedAt: start, isStale: false },
        userProfile: { age: 25, heightCm: 170, weightKg: 65, revision: 1, safetyRevision: 1, planningReportVersion: 1 },
        healthConditions: [],
        allergies: [],
        safetyEntries: [],
      };
    else if (path.endsWith('/checkout/quote')) data = quote;
    else if (path.endsWith('/checkout')) {
      confirmed++;
      expect(route.request().postDataJSON()).toMatchObject({
        tier: quote.tier,
        period: quote.period,
        quoteId: quote.id,
      });
      expect(Object.keys(route.request().postDataJSON()).sort()).toEqual(['period', 'quoteId', 'requestKey', 'tier']);
      data = { ...quote, status: 'PAID' };
    } else if (path.endsWith('/checkout/quote-browser-fixture'))
      data = {
        ...quote,
        status: 'PAID',
        effectiveFrom: quote.startsAt,
        effectiveUntil: quote.endsAt,
        transition: quote,
      };
    else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
    else if (path.endsWith('/checkin/status')) data = { isDue: false };
    else if (path.endsWith('/user/membership'))
      data = {
        enabled: true,
        tier: scenario === 'upgrade' ? 'LIFESTYLE' : 'HEALTH',
        level: scenario === 'upgrade' ? 'MEMBER' : 'TRIAL',
        enhanced: true,
        healthAccess: scenario !== 'upgrade',
        purchasesAvailable: true,
        autoRenews: false,
        serverTime: new Date(now).toISOString(),
        trialStartedAt: start,
        trialEndsAt: end,
        paidUntil: scenario === 'upgrade' ? end : null,
        resetsAt: end,
        requiresCaseReview: false,
        limits: {
          freeSwaps: 3,
          freeEstimates: 2,
          memberSwaps: 6,
          memberEstimates: 10,
          memberReplans: 2,
          memberPlanReviews: 1,
          memberOutsideReviews: 1,
        },
        swaps: { used: 1, cap: 6, remaining: 5 },
        usage: { AI_ESTIMATE: usage, REPLAN: usage, PLAN_REVIEW: usage, OUTSIDE_REVIEW: usage },
        transitions: {
          current:
            scenario === 'upgrade'
              ? { id: 'old', tier: 'LIFESTYLE', period: 'YEARLY', effectiveFrom: start, effectiveUntil: end }
              : null,
          scheduled:
            scenario === 'scheduled'
              ? [{ id: 'next', tier: 'LIFESTYLE', period: 'MONTHLY', effectiveFrom: end, effectiveUntil: nextEnd }]
              : [],
          creditBalanceCentavos: 0,
          blockedReason: scenario === 'scheduled' ? 'Your next membership is already paid and scheduled.' : null,
          openCheckout: null,
        },
      };
    return route.fulfill({ headers, json: { success: true, data } });
  });
  return { confirmed: () => confirmed };
}

test('trial purchase explains preserved Health benefits before opening payment', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = await setup(page, 'trial');
  await page.goto('/membership?plans=true');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Get Lifestyle' }).click();
  await expect(dialog.getByRole('region', { name: 'Payment summary' })).toBeVisible();
  await expect(dialog.getByText(/Your Health trial continues/)).toBeVisible();
  await expect(dialog.getByText('Due now')).toBeVisible();
  expect(state.confirmed()).toBe(0);
  await dialog.getByRole('button', { name: 'Back to plans' }).click();
  await expect(dialog.getByRole('button', { name: 'Get Lifestyle' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('already paid next plan is visible and prevents another purchase', async ({ page }) => {
  await setup(page, 'scheduled');
  await page.goto('/membership?plans=true');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Already paid/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Next plan scheduled', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Next plan already scheduled', exact: true })).toBeDisabled();
});

test('mobile upgrade displays credit, keeps confirmation explicit, and returns to a receipt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page, 'upgrade');
  await page.goto('/membership?plans=true');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Upgrade to Health' }).click();
  await expect(dialog.getByRole('region', { name: 'Payment summary' })).toBeVisible();
  await expect(dialog.getByText(/Unused Lifestyle value is credited/)).toBeVisible();
  await expect(dialog.getByText('Credit remaining after purchase')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Use membership credit' })).toBeVisible();
  expect(state.confirmed()).toBe(0);
  await dialog.getByRole('button', { name: 'Use membership credit' }).click();
  await expect(page).toHaveURL(/membership\/checkout\?purchase=quote-browser-fixture/);
  await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
  expect(state.confirmed()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
