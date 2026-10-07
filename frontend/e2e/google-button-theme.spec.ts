import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  for (const path of ['/login', '/register']) {
    test(`${path} reuses Google's loaded controls on rapid theme switches at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => localStorage.setItem('nutrimind-theme', 'dark'));
      await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
      await page.route('https://fonts.gstatic.com/s/googlesans/**', (route) => route.abort());
      let frameRequests = 0;
      await page.route('https://accounts.google.com/gsi/button-fixture*', (route) => {
        frameRequests += 1;
        return route.fulfill({ contentType: 'text/html', body: '<button>Provider frame</button>' });
      });
      await page.route('https://accounts.google.com/gsi/client*', (route) =>
        route.fulfill({
          contentType: 'application/javascript',
          body: `window.google = { accounts: { id: {
            initialize() {},
            renderButton(host, options) {
              const button = document.createElement('button');
              button.textContent = 'Synthetic Google sign-in';
              button.style.cssText = 'height:40px;width:'+options.width+'px';
              button.onclick = () => { window.googleClickedTheme = options.theme; };
              const frame = document.createElement('iframe');
              frame.title = 'Google theme fixture';
              frame.src = 'https://accounts.google.com/gsi/button-fixture?theme='+options.theme;
              frame.style.cssText = 'position:absolute;width:1px;height:1px;border:0';
              host.append(button, frame);
            }
          } } };`,
        })
      );
      await page.goto(path);
      await expect.poll(() => frameRequests).toBe(2);
      await page.evaluate(() => document.fonts.ready);
      const card = page.locator('.auth-card');
      const initial = await card.boundingBox();
      await page.evaluate(() => {
        (window as typeof window & { originalFrames: Element[] }).originalFrames = [
          ...document.querySelectorAll('[data-google-theme] iframe'),
        ];
      });
      const light = page.locator('[data-google-theme="light"]');
      const dark = page.locator('[data-google-theme="dark"]');
      const google = page.getByRole('button', { name: 'Synthetic Google sign-in' });
      for (const next of ['light', 'dark', 'light', 'dark']) {
        await page
          .getByRole('button', { name: `Switch to ${next} mode` })
          .filter({ visible: true })
          .click();
        const active = next === 'dark' ? dark : light;
        const inactive = next === 'dark' ? light : dark;
        await expect(active).toHaveCSS('opacity', '1');
        await expect(active).not.toHaveAttribute('inert');
        await expect(inactive).toHaveCSS('opacity', '0');
        await expect(inactive).toHaveAttribute('inert');
        await expect(google).toHaveCount(1);
        await google.focus();
        await expect(google).toBeFocused();
        await google.click();
        expect(
          await page.evaluate(() => (window as typeof window & { googleClickedTheme: string }).googleClickedTheme)
        ).toBe(next === 'dark' ? 'outline_dark' : 'outline');
        expect(await card.boundingBox()).toEqual(initial);
      }
      expect(frameRequests).toBe(2);
      expect(
        await page.evaluate(() =>
          (window as typeof window & { originalFrames: Element[] }).originalFrames.every((frame) => frame.isConnected)
        )
      ).toBe(true);
    });
  }
}
