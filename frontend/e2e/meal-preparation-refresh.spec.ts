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
  const state = {
    status: 'GENERATING',
    pending: false,
    partial: false,
    readFailure: false,
    planReads: 0,
    navigations: 0,
    cycle,
  };
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
        (ready || state.partial) && state.pending
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
          data: (ready || state.partial) && !state.pending ? [meal] : [],
          meta: {
            pendingReview,
            ...(workspace
              ? {
                  cycles: { current: cycleExists || ready ? cycle : null, upcoming: null },
                  generationStatus: { current: state.status, upcoming: null },
                  awaitingGeneration: { current: state.partial ? 2 : ready ? 0 : 1, upcoming: 0 },
                }
              : {
                  cycle: cycleExists || ready ? cycle : null,
                  generationStatus: state.status,
                  awaitingGenerationCount: state.partial ? 2 : ready ? 0 : 1,
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

for (const width of [400, 1440]) {
  test(`partial-plan banners preserve previews and retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(
      (theme) => localStorage.setItem('nutrimind-theme', theme),
      width === 400 ? 'dark' : 'light'
    );
    const state = await fixture(page);
    state.partial = true;
    state.pending = true;
    state.cycle.planType = 'STARTER';
    await page.goto('/dashboard');
    const preparation = page.getByRole('complementary', { name: 'Meal preparation status' });
    const review = page.getByRole('complementary', { name: 'Meal review status' });
    await expect(preparation).toContainText('2 meal slots still awaiting generation.');
    await expect(review).toContainText('logging becomes available after approval.');
    const stack = page.getByRole('region', { name: 'Account and meal plan notices' });
    await expect(stack.getByRole('complementary')).toHaveCount(3);
    const starter = stack.getByRole('complementary', { name: 'Starter plan status' });
    await expect(starter).toContainText('You’re on a starter plan.');
    expect(await stack.evaluate((node) => node.parentElement?.firstElementChild === node)).toBe(true);
    expect(await stack.evaluate((node) => Boolean(node.closest('main')))).toBe(true);
    expect((await review.boundingBox())!.y).toBeLessThan((await preparation.boundingBox())!.y);
    expect((await preparation.boundingBox())!.y).toBeLessThan((await starter.boundingBox())!.y);
    await expect(page.getByRole('button', { name: 'Mark as eaten' })).toHaveCount(0);
    for (const banner of [preparation, review]) {
      const bounds = (await banner.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
    await page.screenshot({ path: test.info().outputPath('dashboard-banners.png'), fullPage: true });
    const originalY = (await stack.boundingBox())!.y;
    const scrolled = await page.locator('main.portal-main').evaluate((main) => {
      main.scrollTop = 300;
      return main.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(100);
    await expect.poll(async () => Math.abs((await stack.boundingBox())!.y - originalY + scrolled)).toBeLessThan(1);
    await page.locator('main.portal-main').evaluate((main) => {
      main.scrollTop = 0;
    });

    state.status = 'FAILED';
    await expect(preparation).toContainText('2 meal slots could not be prepared.', { timeout: 7_000 });
    await page.route('**/api/user/meals/cycles/fixture-cycle/retry-generation', async (route) => {
      state.partial = false;
      state.status = 'COMPLETED';
      await route.fulfill({ json: { success: true, data: {} } });
    });
    await page.getByRole('button', { name: 'Retry missing slots' }).click();
    await expect(preparation).toHaveCount(0);
    await expect(review).toBeVisible();
    await expect(stack.getByRole('complementary')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Mark as eaten' })).toHaveCount(0);

    state.partial = true;
    state.status = 'GENERATING';
    await page.goto('/meals');
    await expect(preparation).toContainText('2 meal slots still awaiting generation.');
    await expect(preparation).toContainText(
      'Empty slots cannot be reviewed, logged, swapped, or added to groceries yet.'
    );
    await page.goto('/profile/nutrition-report');
    await expect(page.getByRole('complementary', { name: 'Meal preparation status' })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Meal review status' })).toHaveCount(0);
  });
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
