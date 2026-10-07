import { expect, test } from '@playwright/test';

// Late font downloads must still restore the brand typography on public/auth pages.
// OAuth layout stabilization must not disable font swapping throughout the app.
for (const width of [1440, 390]) {
  for (const entry of ['/', '/login', '/register']) {
    test(`${entry} applies brand fonts after a delayed download at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
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
        await expect(page.locator('main h1')).toBeVisible();
        await page.waitForTimeout(200);
        expect(await page.evaluate(() => document.fonts.status)).toBe('loading');
        releaseFonts();
        await page.evaluate(() => document.fonts.ready);
        const typography = await page.evaluate(() => {
          const primary = (element: Element) =>
            getComputedStyle(element).fontFamily.split(',')[0].replaceAll('"', '').trim();
          const fonts: { family: string; status: string; display: string }[] = [];
          document.fonts.forEach((font) =>
            fonts.push({ family: font.family.replaceAll('"', ''), status: font.status, display: font.display })
          );
          return { heading: primary(document.querySelector('main h1')!), body: primary(document.body), fonts };
        });
        for (const family of [typography.heading, typography.body]) {
          expect(family.toLowerCase()).not.toContain('fallback');
          expect(typography.fonts).toContainEqual({ family, status: 'loaded', display: 'swap' });
        }
      } finally {
        releaseFonts();
      }
    });
  }
}
