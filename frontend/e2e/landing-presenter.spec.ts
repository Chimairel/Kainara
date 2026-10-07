import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`Nara presents the live screen without blocking controls at ${width}px`, async ({ page, request }, testInfo) => {
    await request.post('http://127.0.0.1:3101/__fixture', { data: { mode: 'automatic' } });
    await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      // Test the real controls without contacting a video provider or decoding media.
      HTMLMediaElement.prototype.play = function () {
        Object.defineProperty(this, 'paused', { configurable: true, value: false });
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function () {
        Object.defineProperty(this, 'paused', { configurable: true, value: true });
        this.dispatchEvent(new Event('pause'));
      };
    });
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
    await page.route('https://res.cloudinary.com/**', (route) => route.abort());
    await page.goto('/');
    const screen = page.locator('[data-scroll-screen]');
    const body = page.locator('[data-nara-presenter="body"]');
    const hands = page.locator('[data-nara-presenter="hands"]');
    await body.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    await hands.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    await expect(hands).toHaveCSS('pointer-events', 'none');
    expect(await screen.evaluate((el) => el.contains(document.querySelector('[data-nara-presenter="hands"]')))).toBe(
      true
    );
    const initialRotation = await screen.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m23);
    expect(Math.abs(initialRotation)).toBeGreaterThan(0.2);
    await screen.evaluate((el) => {
      const hero = el.closest('section')!;
      window.scrollTo(0, hero.getBoundingClientRect().bottom + scrollY - innerHeight);
    });
    await expect
      .poll(() => screen.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m23)))
      .toBeLessThan(0.05);
    const video = page.locator('video');
    await expect(video).toHaveCount(1);
    const sound = page.getByRole('button', { name: 'Enable video sound' });
    await sound.click();
    await expect(page.getByRole('button', { name: 'Mute video sound' })).toBeVisible();
    const pause = page.getByRole('button', { name: 'Pause promotional video' });
    await pause.click();
    await expect(page.getByRole('button', { name: 'Play promotional video' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('presenter.png') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(() => screen.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m23)))
      .toBe(0);
  });
}
