import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  for (const entry of ['/login', '/register']) {
    test(`${entry} retains painted text bounds when fonts arrive late at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
      // Isolate font arrival from provider failures that would correctly insert an error alert.
      await page.route('https://accounts.google.com/gsi/client', (route) =>
        route.fulfill({
          contentType: 'application/javascript',
          body: `window.google = { accounts: { id: {
          initialize() {},
          renderButton(host) {
            const button = document.createElement('button');
            button.textContent = 'Synthetic Google button';
            button.style.height = '40px';
            host.appendChild(button);
          }
        } } };`,
        })
      );
      let releaseFonts!: () => void;
      const fontsReady = new Promise<void>((resolve) => {
        releaseFonts = resolve;
      });
      await page.route(/\/_next\/static\/media\/.*\.(woff2?|ttf|otf)(\?.*)?$/, async (route) => {
        await fontsReady;
        await route.continue();
      });
      try {
        await page.goto(entry, { waitUntil: 'commit' });
        const title = page.locator('main h1');
        await expect(title).toBeVisible();
        // Let the font's brief initial block period expire while the request remains held.
        await page.waitForTimeout(200);
        const snapshot = () =>
          page.evaluate(() =>
            ['main h1', '.auth-card h2', '.auth-card', '.auth-card label'].map((selector) => {
              const element = document.querySelector(selector)!;
              const rect = element.getBoundingClientRect();
              return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })
          );
        const before = await snapshot();
        expect(await page.evaluate(() => document.fonts.status)).toBe('loading');
        releaseFonts();
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        );
        expect(await snapshot()).toEqual(before);
      } finally {
        releaseFonts();
      }
    });
  }
}
