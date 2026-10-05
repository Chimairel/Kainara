import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, date = '2026-10-06') {
  await page.clock.setFixedTime(new Date(`${date}T04:00:00Z`));
  const user = {
    id: 'progress-history-fixture',
    name: 'Preview Member',
    email: 'preview@example.invalid',
    role: 'USER',
    emailVerified: true,
    onboardingDone: true,
    tosAccepted: true,
    reportAcknowledged: true,
    onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
    userProfile: { weightKg: 58, targetWeightKg: 65, dailyCalorieTarget: 2786, revision: 1, safetyRevision: 1 },
    healthConditions: [],
    allergies: [],
    safetyEntries: [],
  };
  const claims = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: 'USER', exp: 4102444800 })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `fixture.${claims}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/live/')) return route.fulfill({ status: 204 });
    let data: unknown = [];
    if (path.endsWith('/user/profile')) data = user;
    else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
    else if (path.endsWith('/user/membership')) data = { enabled: false };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    else if (path.endsWith('/progress/history'))
      data = {
        dailyNutritionLogs: [],
        weightLogs: [
          { id: 'start', weightKg: 57, loggedAt: '2026-09-29T04:00:00Z', source: 'INITIAL_REPORT', note: null },
          { id: 'latest', weightKg: 58, loggedAt: '2026-10-06T04:00:00Z', source: 'LOG', note: null },
        ],
      };
    return route.fulfill({ json: { success: true, data } });
  });
}

for (const width of [320, 358, 390, 1440]) {
  test(`weight chart has readable dimensions and labels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto('/progress');
    const chart = page.getByRole('img', { name: 'Weight progress chart' });
    await expect(chart).toBeVisible();
    if (width < 480) {
      await expect.poll(async () => (await chart.boundingBox())!.height).toBeGreaterThanOrEqual(250);
      expect(
        await chart
          .locator('text')
          .first()
          .evaluate((node) => {
            const text = node as SVGTextElement;
            return Number(text.getAttribute('font-size')) * text.getScreenCTM()!.a;
          })
      ).toBeGreaterThanOrEqual(10);
    }
    await expect(chart).toContainText('57 kg');
    await expect(chart).toContainText('58 kg');
    await expect(chart).toContainText('Target: 65 kg');
    expect(await chart.locator('circle').count()).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await chart.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('weight-progress.png') });
    await page.getByRole('combobox', { name: 'Weight progress period' }).click();
    await page.getByRole('option', { name: 'Monthly Progress', exact: true }).click();
    await expect(chart).toContainText('58 kg');
  });
}

for (const date of ['2026-01-02', '2026-10-06', '2026-12-30']) {
  test(`year activity starts at ${date} and keeps manual browsing`, async ({ page }) => {
    await page.setViewportSize({ width: 358, height: 808 });
    await setup(page, date);
    await page.goto('/meals');
    await page
      .getByRole('navigation', { name: 'Meal workspace sections' })
      .getByRole('button', { name: /History/ })
      .click();
    const scroller = page.locator('[aria-label="Year activity calendar"]');
    await expect(scroller).toBeVisible();
    const today = scroller.locator('[aria-current="date"]');
    await expect(today).toHaveAttribute('aria-label', new RegExp(`^${date}:`));
    const todayFits = () =>
      today.evaluate((node) => {
        const cell = node.getBoundingClientRect();
        const bounds = node.closest('[aria-label="Year activity calendar"]')!.getBoundingClientRect();
        return cell.left >= bounds.left && cell.right <= bounds.right;
      });
    await expect.poll(todayFits).toBe(true);
    if (date !== '2026-01-02') expect(await scroller.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath('year-current-date.png') });
    await scroller.evaluate((node) => {
      node.scrollLeft = 0;
    });
    await scroller.getByRole('button', { name: '2026-01-01: 0 meals logged', exact: true }).click();
    expect(await scroller.evaluate((node) => node.scrollLeft)).toBe(0);
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await page.getByRole('button', { name: 'Year', exact: true }).click();
    await expect.poll(todayFits).toBe(true);
  });
}
