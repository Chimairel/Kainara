import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page, cycleExists = true) {
  const user = {
    id: 'preparation-refresh-fixture',
    name: 'Preview Member',
    email: 'preview@example.invalid',
    role: 'USER',
    emailVerified: true,
    onboardingDone: true,
    tosAccepted: true,
    reportAcknowledged: true,
    onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
    userProfile: { dailyCalorieTarget: 2000, revision: 1, safetyRevision: 1 },
    healthConditions: [],
    allergies: [],
    safetyEntries: [],
  };
  const claims = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `fixture.${claims}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  const date = new Date().toISOString();
  const cycle = { id: 'fixture-cycle', planType: 'WEEKLY', startDate: date, endDate: date, status: 'ACTIVE' };
  const meal = {
    id: 'fixture-meal',
    mealName: 'Prepared fixture meal',
    mealType: 'BREAKFAST',
    scheduledDate: date,
    planType: 'WEEKLY',
    status: 'APPROVED',
    calories: 500,
    proteinG: 25,
    carbsG: 60,
    fatG: 18,
    ingredients: [],
    mealLogs: [],
  };
  const state = { status: 'GENERATING', pending: false, readFailure: false, planReads: 0, navigations: 0 };
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) state.navigations++;
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/live/') || route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    // Slow auxiliary reads must not delay preparation updates.
    if (path.endsWith('/meals/history') || path.endsWith('/meals/cycles')) return;
    const workspace = path.endsWith('/meals/workspace');
    if (path.endsWith('/meals/current') || workspace) {
      state.planReads++;
      if (state.readFailure)
        return route.fulfill({ status: 503, json: { success: false, error: 'Status temporarily unavailable' } });
      const ready = state.status === 'COMPLETED';
      const pendingReview =
        ready && state.pending
          ? {
              mealCount: 1,
              planType: 'WEEKLY',
              reviewStatus: 'PENDING_REVIEW',
              meals: [{ ...meal, status: 'PENDING_REVIEW' }],
            }
          : null;
      return route.fulfill({
        json: {
          success: true,
          data: ready && !state.pending ? [meal] : [],
          meta: {
            pendingReview,
            ...(workspace
              ? {
                  cycles: { current: cycleExists || ready ? cycle : null, upcoming: null },
                  generationStatus: { current: state.status, upcoming: null },
                  awaitingGeneration: { current: ready ? 0 : 1, upcoming: 0 },
                }
              : {
                  cycle: cycleExists || ready ? cycle : null,
                  generationStatus: state.status,
                  awaitingGenerationCount: ready ? 0 : 1,
                }),
          },
        },
      });
    }
    let data: unknown = [];
    if (path.endsWith('/user/profile')) data = user;
    else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
    else if (path.endsWith('/user/membership')) data = { enabled: false };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    else if (path.endsWith('/checkin/status')) data = { isDue: false, hasPendingChanges: false };
    else if (path.endsWith('/water/today')) data = { totalMl: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
  return state;
}

for (const cycleExists of [false, true]) {
  test(`dashboard automatically shows prepared meals with cycle initially ${cycleExists ? 'present' : 'absent'}`, async ({
    page,
  }) => {
    const state = await fixture(page, cycleExists);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toBeVisible();
    const navigationCount = state.navigations;
    state.status = 'COMPLETED';
    await expect(page.getByRole('button', { name: 'Open Prepared fixture meal details' })).toBeVisible({
      timeout: 7_000,
    });
    await expect(page.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toHaveCount(0);
    expect(state.navigations).toBe(navigationCount);
  });
}

test('dashboard automatically shows failed preparation and a retry action', async ({ page }) => {
  const state = await fixture(page, false);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toBeVisible();
  const navigationCount = state.navigations;
  state.status = 'FAILED';
  await expect(page.getByRole('heading', { name: 'Meal plan preparation failed' })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByRole('button', { name: 'Retry Preparation' })).toBeEnabled();
  expect(state.navigations).toBe(navigationCount);
});

test('completed candidates remain previews until safety review is complete', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toBeVisible();
  const navigationCount = state.navigations;
  state.pending = true;
  state.status = 'COMPLETED';
  await expect(page.getByText('Prepared fixture meal', { exact: true })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as eaten' })).toHaveCount(0);
  expect(state.navigations).toBe(navigationCount);
});

test('temporary status errors show recovery and keep refreshing automatically', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toBeVisible();
  const navigationCount = state.navigations;
  state.readFailure = true;
  await expect(page.getByRole('heading', { name: 'Could not load your meal plan' })).toBeVisible({ timeout: 7_000 });
  state.readFailure = false;
  state.status = 'COMPLETED';
  await expect(page.getByRole('button', { name: 'Open Prepared fixture meal details' })).toBeVisible({
    timeout: 7_000,
  });
  expect(state.navigations).toBe(navigationCount);
});

test('Meals also replaces preparation with the server failure without a reload', async ({ page }) => {
  const state = await fixture(page);
  state.status = 'PROCESSING_AI';
  await page.goto('/meals');
  await expect(page.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toBeVisible();
  const navigationCount = state.navigations;
  state.status = 'FAILED';
  await expect(page.getByRole('heading', { name: 'Meal plan preparation failed' })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByRole('button', { name: 'Retry Preparation' })).toBeEnabled();
  expect(state.navigations).toBe(navigationCount);
});
