import { test, expect } from '@playwright/test';

for (const width of [1920, 1440, 390]) {
  test(`Centered landing device overlaps the gallery and straightens on scroll at ${width}px`, async ({
    page,
    request,
  }, testInfo) => {
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
    await page.route('**/_next/image?url=https%3A%2F%2Fpanlasangpinoy.com**', (route) =>
      route.fulfill({ path: 'public/meals/pork-bowl.jpg', contentType: 'image/jpeg' })
    );
    await page.goto('/');
    const gallery = page.locator('[data-meal-gallery]');
    await expect(gallery).toBeVisible();
    await expect(gallery.locator('[data-slot="marquee"]')).toHaveCount(5);
    const columnMeals = await gallery
      .locator('[data-slot="marquee"]')
      .evaluateAll((columns) =>
        columns.map((column) => [...column.firstElementChild!.querySelectorAll('p')].map((name) => name.textContent))
      );
    expect(columnMeals.every((meals) => meals.length >= 3)).toBe(true);
    expect(new Set(columnMeals.flat()).size).toBe(16);
    const tracks = gallery.locator('[data-slot="marquee"] > div');
    await expect(gallery.locator('details')).toHaveCount(0);
    await expect(gallery.getByRole('button')).toHaveCount(0);
    await expect(page.locator('[data-nara-presenter]')).toHaveCount(0);
    expect(
      await tracks.evaluateAll((elements) =>
        elements.every((el) => getComputedStyle(el).animationPlayState === 'running')
      )
    ).toBe(true);
    const screen = page.locator('[data-scroll-screen]');
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => screen.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m23)))
      .toBeGreaterThan(0.2);
    const galleryBounds = (await gallery.boundingBox())!;
    const deviceBounds = (await screen.boundingBox())!;
    expect(deviceBounds.y).toBeLessThan(galleryBounds.y + galleryBounds.height - 8);
    const heroBounds = (await page.locator('section').filter({ has: screen }).boundingBox())!;
    expect(Math.abs(deviceBounds.x + deviceBounds.width / 2 - (heroBounds.x + heroBounds.width / 2))).toBeLessThan(2);
    if (width > 1000) {
      const headerBounds = (await page.getByRole('banner').boundingBox())!;
      const copyBounds = (await page.locator('[data-hero-copy]').boundingBox())!;
      expect(copyBounds.y + copyBounds.height).toBeLessThan(deviceBounds.y);
      expect(copyBounds.x + copyBounds.width - galleryBounds.x).toBeGreaterThan(100);
      expect(
        await page.locator('[data-hero-copy] a[href="/docs"]').evaluate((el) => {
          const bounds = el.getBoundingClientRect();
          return document.elementFromPoint(bounds.right - 12, bounds.top + bounds.height / 2)?.closest('a') === el;
        })
      ).toBe(true);
      expect(Math.abs(galleryBounds.y - (headerBounds.y + headerBounds.height))).toBeLessThan(2);
      expect(Math.abs(galleryBounds.x + galleryBounds.width - width)).toBeLessThan(10);
      expect(
        await screen.evaluate((el) => {
          const gallery = document.querySelector('[data-meal-gallery]')!.getBoundingClientRect();
          return el.contains(document.elementFromPoint(document.documentElement.clientWidth / 2, gallery.bottom - 10));
        })
      ).toBe(true);
    }
    const scrollRange = await page.locator('[data-scroll-presentation]').evaluate((el) => {
      const container = el.parentElement!.parentElement!.getBoundingClientRect();
      return { start: container.top + scrollY, distance: container.height };
    });
    await page.evaluate(({ start, distance }) => window.scrollTo(0, start + distance / 2), scrollRange);
    // Halfway through the original full-container scroll range, retain about 10 degrees of tilt.
    await expect
      .poll(() => screen.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m23)))
      .toBeGreaterThan(0.12);
    await expect
      .poll(() => screen.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m23)))
      .toBeLessThan(0.24);
    await page.evaluate(({ start, distance }) => window.scrollTo(0, start + distance), scrollRange);
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
    await page.screenshot({ path: testInfo.outputPath('device.png') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(gallery).toBeVisible();
    expect(
      await tracks.evaluateAll((elements) => elements.every((el) => getComputedStyle(el).animationName === 'none'))
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(() => screen.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m23)))
      .toBe(0);
  });
}
