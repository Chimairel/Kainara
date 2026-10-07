import { expect, test } from '@playwright/test';

// Synthetic SDK cases do not depend on Google's font CDN.
test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.gstatic.com/s/googlesans/**', (route) => route.abort());
});

// Delay the provider button to reproduce its arrival after the email form paints.
// No real provider credentials, delivery or account writes are exercised.
for (const width of [1440, 390]) {
  for (const route of ['/login', '/register', '/forgot-password', '/reset-password']) {
    test(`${route} keeps its form stable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      let releaseGoogle!: () => void;
      const googleReady = new Promise<void>((resolve) => {
        releaseGoogle = resolve;
      });
      await page.route('https://accounts.google.com/gsi/client*', async (request) => {
        await googleReady;
        await request.fulfill({
          contentType: 'application/javascript',
          body: `
          window.google = { accounts: { id: {
            initialize() {},
            renderButton(element) {
              const button = document.createElement('button');
              button.textContent = 'Synthetic Google sign-in';
              button.style.height = '40px';
              element.appendChild(button);
            }
          } } };
        `,
        });
      });
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const card = page.locator('.auth-card');
      await expect(card).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const before = await card.boundingBox();
      releaseGoogle();
      if (route === '/login' || route === '/register') {
        await expect(page.getByRole('button', { name: 'Synthetic Google sign-in' })).toBeVisible();
      }
      const after = await card.boundingBox();
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      for (const dimension of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(after![dimension] - before![dimension])).toBeLessThanOrEqual(1);
      }
      await expect(page.getByText('Google window didn’t open?', { exact: true })).toHaveCount(0);
      await expect(
        page.getByText('New here? Continuing with Google creates your account.', { exact: true })
      ).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}
