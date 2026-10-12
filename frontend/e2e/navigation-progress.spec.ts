import { expect, test } from '@playwright/test';

for (const width of [400, 1440]) {
  test(`guidance loading survives refresh and clears on resolution at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(
      (theme) => localStorage.setItem('nutrimind-theme', theme),
      width === 400 ? 'dark' : 'light'
    );
    const user = {
      id: 'loading-fixture',
      name: 'Preview Member',
      email: 'preview@example.invalid',
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      reportAcknowledged: true,
      onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      userProfile: { dailyCalorieTarget: 2000, revision: 1, safetyRevision: 1, goal: 'MAINTAIN' },
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
    let release = () => {};
    let ready = false;
    let failed = false;
    let requests = 0;
    let wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const unexpected: string[] = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      if (path.includes('/live/') || method === 'OPTIONS') return route.fulfill({ status: 204 });
      if (method !== 'GET') {
        unexpected.push(`${method} ${path}`);
        return route.fulfill({ status: 422, json: { success: false, error: 'Unexpected fixture mutation' } });
      }
      if (path.endsWith('/user/nutrition-report')) {
        requests++;
        if (!ready) await wait;
        if (failed)
          return route.fulfill({ status: 422, json: { success: false, error: 'Guidance temporarily unavailable' } });
        return route.fulfill({
          json: {
            success: true,
            data: {
              reportPolicyVersion: 'NUTRITION_GUIDANCE_DETERMINISTIC_V1',
              referenceItems: [],
              version: 1,
              profileRevision: 1,
              generatedAt: '2026-10-12T00:00:00Z',
              isStale: false,
              acknowledgedAt: '2026-10-12T00:00:00Z',
              basedOnConditions: [],
              basedOnAllergies: [],
              generalSummary: 'Current guidance',
              foodsToAvoid: [],
              foodsToLimit: [],
              foodsRecommended: [],
              drinksGuidance: [],
            },
          },
        });
      }
      let data: unknown = [];
      if (path.endsWith('/user/profile')) data = user;
      else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.endsWith('/user/membership')) data = { enabled: false };
      else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
      return route.fulfill({ json: { success: true, data } });
    });
    const bar = page.locator('[data-navigation-progress]');
    await page.goto('/profile/nutrition-report');
    await expect.poll(() => requests).toBeGreaterThan(0);
    await expect(bar).toHaveAttribute('data-progress-active', 'true');
    await page.waitForTimeout(1000); // Longer than the former route-completion hide delay.
    await expect(bar).toHaveAttribute('data-progress-active', 'true');
    const bounds = (await bar.boundingBox())!;
    expect(bounds.y).toBe(0);
    // The app reserves a scrollbar gutter even when document.clientWidth includes it.
    expect(bounds.x).toBe(0);
    expect(bounds.width).toBeGreaterThanOrEqual(width - 20);
    expect(bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`loading-${width}.png`) });
    ready = true;
    release();
    await expect(page.getByText('Current guidance', { exact: true })).toBeVisible();
    await expect(bar).toHaveCount(0);

    ready = false;
    failed = true;
    wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const before = requests;
    await page.reload();
    await expect.poll(() => requests).toBeGreaterThan(before);
    await expect(bar).toHaveAttribute('data-progress-active', 'true');
    ready = true;
    release();
    await expect(page.getByText('Report Resolution Failed')).toBeVisible();
    await expect(bar).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });
}
