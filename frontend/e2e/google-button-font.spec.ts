import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GOOGLE_BUTTON_FONT_SRC } from '../src/components/auth/google-button-font';

const testFont = readFileSync(path.resolve(__dirname, '../src/app/fonts/outfit.ttf'));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('https://accounts.google.com/gsi/client*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: {
      initialize() {},
      renderButton(host, options) {
        window.googleButtonOptions = options;
        window.googleRenderedWithFont = document.fonts.check('500 14px "Google Sans"');
        const button = document.createElement('button');
        button.textContent = 'Synthetic Google sign-in';
        button.style.cssText = 'font-family:"Google Sans",Arial,sans-serif;font-size:14px;font-weight:500;height:40px;width:'+options.width+'px';
        host.append(button);
      }
    } } };`,
    })
  );
});

for (const width of [1440, 390]) {
  test(`first provider paint uses its loaded face at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(GOOGLE_BUTTON_FONT_SRC, async (route) => {
      await ready;
      await route.fulfill({ contentType: 'font/ttf', body: testFont });
    });
    try {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      const button = page.getByRole('button', { name: 'Synthetic Google sign-in' });
      await expect.poll(() => page.evaluate(() => !!window.google?.accounts?.id)).toBe(true);
      await page.evaluate(async () => {
        const card = document.querySelector('.auth-card')!;
        await Promise.all(
          [card, ...card.querySelectorAll('h1, label, input, a, button')].map((element) => {
            const style = getComputedStyle(element);
            return document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
          })
        );
      });
      const before = await page.locator('.auth-card').boundingBox();
      await expect(button).toHaveCount(0);
      release();
      await expect(button).toBeVisible();
      expect(
        await page.evaluate(
          () => (window as typeof window & { googleRenderedWithFont: boolean }).googleRenderedWithFont
        )
      ).toBe(true);
      expect(await button.evaluate((element) => getComputedStyle(element).lineHeight)).toBe('normal');
      expect(await page.locator('.auth-card').boundingBox()).toEqual(before);
      const emailButton = page.getByRole('button', { name: 'Sign in', exact: true });
      const bounds = await button.boundingBox();
      const emailBounds = await emailButton.boundingBox();
      expect(bounds?.width).toBe(emailBounds?.width);
      expect(bounds?.x).toBe(emailBounds?.x);
      expect(bounds!.width).toBeLessThanOrEqual(400);
      expect(
        await page.evaluate(
          () => (window as typeof window & { googleButtonOptions: { locale: string } }).googleButtonOptions.locale
        )
      ).toBe('en');
      if (width === 1440) {
        await page.setViewportSize({ width: 390, height: 900 });
        await expect
          .poll(async () => {
            const google = await button.boundingBox();
            const email = await emailButton.boundingBox();
            return google?.width === email?.width && google?.x === email?.x;
          })
          .toBe(true);
      }
    } finally {
      release();
    }
  });
}

test('font CDN failure preserves usable Google sign-in', async ({ page }) => {
  await page.route(GOOGLE_BUTTON_FONT_SRC, (route) => route.abort());
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Synthetic Google sign-in' })).toBeVisible();
  await expect(page.getByText('Google sign-in is temporarily unavailable.', { exact: false })).toHaveCount(0);
});
