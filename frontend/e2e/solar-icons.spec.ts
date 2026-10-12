import { expect, test } from '@playwright/test';
import { analyticsFixture } from '../src/features/admin-analytics/analytics-fixture';

// Normal localhost UI; every API request uses synthetic, intercepted data.
for (const role of ['ADMIN', 'NUTRITIONIST'] as const) {
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1440]) {
      test(`${role} Solar icons at ${width}px in ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
        const origin = 'http://localhost:3000';
        const profile = {
          id: 'solar-preview',
          name: 'Icon preview',
          email: 'solar@example.invalid',
          role,
          emailVerified: true,
          onboardingDone: true,
          tosAccepted: true,
          onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        };
        const claims = Buffer.from(
          JSON.stringify({ userId: profile.id, email: profile.email, role, exp: 4102444800 })
        ).toString('base64url');
        await page
          .context()
          .addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: origin }]);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        let analyticsRequests = 0;
        await page.route('**/api/**', (route) => {
          const path = new URL(route.request().url()).pathname;
          const headers = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          };
          if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
            return route.fulfill({ status: 204, headers });
          let data: unknown = [];
          if (path.endsWith('/user/profile')) data = profile;
          else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
          else if (path.endsWith('/credential-status'))
            data = { eligible: true, reason: null, expiryDate: '2027-12-31', canSubmitUpdate: true };
          else if (path.endsWith('/review-work-counts')) data = { case: 0, meal: 0, profile: 0 };
          else if (path.endsWith('/admin/analytics')) {
            analyticsRequests++;
            data = {
              ...analyticsFixture,
              aiUsageByOperation30d: [
                { operation: 'MEAL_PLAN_GENERATION', purpose: 'UNMATCHED_SLOT_ATTEMPT_1', status: 'SUCCESS', count: 4 },
              ],
            };
          }
          return route.fulfill({ headers, json: { success: true, data } });
        });
        await page.goto(role === 'ADMIN' ? '/admin/overview' : '/nutritionist/reviews');
        if (role === 'ADMIN') {
          await expect(page.getByText('Member accounts', { exact: true })).toBeVisible();
          const refresh = page.getByRole('button', { name: 'Refresh statistics' });
          await expect(refresh.locator('.solar-refresh-bold')).toBeVisible();
          expect(await refresh.locator('svg').evaluate((svg) => getComputedStyle(svg).width)).toBe('14px');
          const previous = analyticsRequests;
          await refresh.click();
          await expect.poll(() => analyticsRequests).toBeGreaterThan(previous);
          await page.getByRole('button', { name: 'Recorded AI activity', exact: true }).click();
          await expect(page.getByRole('table', { name: 'Recorded AI operations' })).toBeVisible();
        } else if (width < 1024) {
          await expect(page.getByRole('heading', { name: 'Use a desktop to review meals' })).toBeVisible();
          await expect(page.locator('main .solar-monitor-bold-duotone')).toBeVisible();
        } else {
          await expect(page.getByRole('navigation', { name: 'RND review queues' })).toBeVisible();
          await page.getByRole('button', { name: 'Meal verification', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Meal verification', exact: true })).toHaveAttribute(
            'aria-pressed',
            'true'
          );
          await page.getByRole('button', { name: 'Case approval', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Case approval', exact: true })).toHaveAttribute(
            'aria-pressed',
            'true'
          );
        }
        const context = page.locator('.app-icon-duotone:visible').first();
        await expect(context).toBeVisible();
        const paints = await context.evaluate((svg) => {
          const accent = svg.querySelector('[style*="--solar-secondary-color"]')!;
          return {
            primary: getComputedStyle(svg).color,
            secondary: getComputedStyle(accent).color,
            opacity: Number(getComputedStyle(accent).opacity),
          };
        });
        expect(paints.primary).not.toBe(paints.secondary);
        expect(paints.opacity).toBeGreaterThanOrEqual(0.65);
        expect(
          await page
            .locator('.solar[class*="-linear"], .solar[class*="-line-duotone"], .solar[class*="-outline"]')
            .count()
        ).toBe(0);
        const icons = page.locator('main .solar:visible');
        expect(await icons.count()).toBeGreaterThan(0);
        for (const icon of await icons.all()) {
          const box = await icon.boundingBox();
          expect(box!.width).toBeGreaterThanOrEqual(12);
          expect(box!.width).toBeLessThanOrEqual(96);
          await expect(icon).toHaveAttribute('aria-hidden', 'true');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({
          path: `../backend/.local/meal-presentation-audit/solar-${role.toLowerCase()}-${width}-${theme}.png`,
          fullPage: true,
          animations: 'disabled',
        });
        expect(errors).toEqual([]);
      });
    }
  }
}
