import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`Security and Privacy keep their tab bar and scroll position stable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 620 });
    const user = { id: 'tab-stability', name: 'Synthetic Member', email: 'tabs@example.invalid', role: 'USER',
      emailVerified: true, onboardingDone: true, tosAccepted: true, reportAcknowledged: true,
      onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      authMethods: { password: false, google: true }, userProfile: { revision: 1, safetyRevision: 1 },
      healthConditions: [], allergies: [], safetyEntries: [] };
    const payload = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })).toString('base64url');
    await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${payload}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000' }]);
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes('/live/') || route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
      const data = path.endsWith('/user/profile') ? user : path.endsWith('/user/membership') ? { enabled: false }
        : path.endsWith('/notifications') ? { notifications: [], unreadCount: 0 } : [];
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/profile/security');
    const tabs = page.getByRole('navigation', { name: 'Profile settings sections' });
    await expect(page.getByRole('heading', { name: 'Password', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.portal-main').evaluate(element => { element.scrollTop = 150; });
    const initial = await tabs.boundingBox();
    const scrollTop = await page.locator('.portal-main').evaluate(element => element.scrollTop);
    for (const name of ['Privacy', 'Security', 'Privacy', 'Security']) {
      await tabs.getByRole('button', { name, exact: true }).click();
      await expect(tabs.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
      const verticalDrift = await tabs.evaluate(async element => {
        let maxDrift = 0;
        const start = performance.now();
        await new Promise<void>(resolve => {
          const sample = () => {
            const button = element.querySelector('button[aria-pressed="true"]')!;
            const indicator = button.querySelector('[aria-hidden="true"]')!;
            maxDrift = Math.max(maxDrift, Math.abs(indicator.getBoundingClientRect().top - button.getBoundingClientRect().top));
            if (performance.now() - start < 400) requestAnimationFrame(sample); else resolve();
          };
          requestAnimationFrame(sample);
        });
        return maxDrift;
      });
      expect(verticalDrift).toBeLessThan(1);
      expect(await tabs.boundingBox()).toEqual(initial);
      expect(await page.locator('.portal-main').evaluate(element => element.scrollTop)).toBe(scrollTop);
      const other = name === 'Security' ? 'Delete account and health data' : 'Password';
      await expect(page.getByRole('heading', { name: other, exact: true })).toHaveCount(0);
    }
  });
}
