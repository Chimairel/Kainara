import { expect, test } from '@playwright/test';
import { analyticsFixture } from '../src/features/admin-analytics/analytics-fixture';

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`admin overview has plain cards and keyboard-only panel focus at ${width}px in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
      const user = {
        id: 'admin-surface-fixture',
        name: 'Synthetic Admin',
        email: 'admin@example.invalid',
        role: 'ADMIN',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      };
      const claims = Buffer.from(
        JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: origin }]);
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const headers = {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        };
        if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
          return route.fulfill({ status: 204, headers });
        const data = path.endsWith('/user/profile')
          ? user
          : path.endsWith('/admin/analytics')
            ? {
                ...analyticsFixture,
                aiUsageByOperation30d: [
                  {
                    operation: 'MEAL_PLAN_CORPUS_LOOKUP',
                    purpose: 'RAW_CORPUS_CANDIDATE_SELECTION',
                    status: 'SUCCESS',
                    count: 10,
                  },
                  {
                    operation: 'MEAL_PLAN_GENERATION',
                    purpose: 'UNMATCHED_SLOT_ATTEMPT_1',
                    status: 'FAILED',
                    count: 4,
                  },
                ],
                planSelectionsByProvenance30d: [{ provenance: 'RAW_RECIPE_CORPUS', count: 321 }],
              }
            : path.endsWith('/notifications')
              ? { notifications: [], unreadCount: 0 }
              : [];
        return route.fulfill({ headers, json: { success: true, data } });
      });
      await page.goto('/admin/overview');
      await expect(page.getByText('Member accounts', { exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
      await expect(page.locator('[data-card-decoration]:not([data-card-decoration="none"])')).toHaveCount(0);
      const panel = page
        .getByRole('tabpanel')
        .filter({ has: page.getByRole('button', { name: 'Refresh statistics' }) });
      await panel.click({ position: { x: 2, y: 2 } });
      await expect(panel).toBeFocused();
      expect(await panel.evaluate((element) => getComputedStyle(element).boxShadow)).toBe('none');
      await page.getByRole('tab', { name: 'Summary & analytics', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(panel).toBeFocused();
      expect(await panel.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      expect(await panel.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.getByRole('button', { name: 'Recorded AI activity', exact: true }).click();
      await expect(page.getByRole('table', { name: 'Recorded AI operations' })).toBeVisible();
      await expect(page.getByRole('table', { name: 'Saved candidate sources' })).toBeVisible();
      await page.getByRole('table', { name: 'Recorded AI operations' }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('columnheader', { name: 'Operation', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`record-tables-${width}-${theme}.png`), fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [390, 1440]) {
  test(`landing theme toggle keeps focus feedback for the keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => localStorage.setItem('nutrimind-theme', 'light'));
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ });
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(toggle).toBeFocused();
    expect(await toggle.evaluate((element) => getComputedStyle(element).boxShadow)).toBe('none');
    expect(await toggle.evaluate((element) => element.matches(':focus-visible'))).toBe(false);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    expect(await toggle.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    expect(await toggle.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveClass(/\blight\b/);
    expect(await page.evaluate(() => localStorage.getItem('nutrimind-theme'))).toBe('light');
  });
}
