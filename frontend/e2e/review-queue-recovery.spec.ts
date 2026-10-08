import { expect, test } from '@playwright/test';

for (const width of [400, 1440]) {
  test(`review queue recovers and tab highlight fits at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin;
    const user = {
      id: 'synthetic-review-rnd',
      role: 'NUTRITIONIST',
      name: 'Synthetic reviewer',
      email: 'fixture@example.invalid',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      nutritionReport: null,
    };
    const claims = Buffer.from(
      JSON.stringify({ userId: user.id, role: user.role, email: user.email, exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString('base64url');
    await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: origin }]);
    let queueReads = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      };
      if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
        return route.fulfill({ status: 204, headers });
      let data: unknown = [];
      if (path.endsWith('/user/profile')) data = user;
      else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.endsWith('/review-work-counts')) data = { case: 46, meal: 16, profile: 4 };
      else if (path.endsWith('/queue') && ++queueReads <= 2)
        return route.fulfill({
          status: 503,
          headers,
          json: { success: false, error: 'Synthetic review queue unavailable. Please retry.' },
        });
      await route.fulfill({ headers, json: { success: true, data } });
    });
    await page.goto('/nutritionist/reviews');
    const tabs = page.getByRole('navigation', { name: 'RND review queues' });
    const active = tabs.getByRole('button', { name: /Case approval/ });
    await expect(active).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('alert').filter({ hasText: 'Synthetic review queue unavailable' })).toBeVisible();
    await expect(page.getByText('Queue clear', { exact: true })).toBeHidden();
    const indicator = tabs.locator('[data-workspace-tab-indicator]');
    const activeBox = await active.boundingBox();
    if (width < 640) {
      await expect(indicator).toBeHidden();
      const color = await active.evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(color).not.toBe('rgba(0, 0, 0, 0)');
      expect(activeBox!.height).toBeLessThan(80);
      const firstBox = await tabs.getByRole('button', { name: /Meal verification/ }).boundingBox();
      const lastBox = await tabs.getByRole('button', { name: /Member queue/ }).boundingBox();
      expect(firstBox!.y + firstBox!.height).toBeLessThanOrEqual(activeBox!.y);
      expect(activeBox!.y + activeBox!.height).toBeLessThanOrEqual(lastBox!.y);
    } else {
      await expect(indicator).toBeVisible();
      const indicatorBox = await indicator.boundingBox();
      expect(Math.abs(indicatorBox!.height - activeBox!.height)).toBeLessThan(3);
      expect(Math.abs(indicatorBox!.width - activeBox!.width)).toBeLessThan(3);
    }
    await page.getByRole('button', { name: 'Retry queue' }).click();
    await expect(page.getByText('Queue clear', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry queue' })).toBeHidden();
    expect(queueReads).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`review-queue-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
