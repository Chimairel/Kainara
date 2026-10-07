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
    await page.route('**/_next/image?url=https%3A%2F%2Fpanlasangpinoy.com**', (route) =>
      route.fulfill({ path: 'public/meals/pork-bowl.jpg', contentType: 'image/jpeg' })
    );
    await page.goto('/');
    const gallery = page.locator('[data-meal-gallery]');
    await expect(gallery).toBeVisible();
    await expect(gallery.locator('[data-slot="marquee"]')).toHaveCount(4);
    const columnMeals = await gallery
      .locator('[data-slot="marquee"]')
      .evaluateAll((columns) =>
        columns.map((column) => [...column.firstElementChild!.querySelectorAll('p')].map((name) => name.textContent))
      );
    expect(columnMeals.every((meals) => meals.length === 4)).toBe(true);
    expect(new Set(columnMeals.flat()).size).toBe(16);
    const tracks = gallery.locator('[data-slot="marquee"] > div');
    await page.getByRole('button', { name: 'Pause meal gallery' }).click();
    expect(
      await tracks.evaluateAll((elements) =>
        elements.every((el) => getComputedStyle(el).animationPlayState === 'paused')
      )
    ).toBe(true);
    await page.getByRole('button', { name: 'Resume meal gallery' }).click();
    expect(
      await tracks.evaluateAll((elements) =>
        elements.every((el) => getComputedStyle(el).animationPlayState === 'running')
      )
    ).toBe(true);
    await gallery.getByText('Recipes & photos: Panlasang Pinoy').click();
    await expect(gallery.getByRole('link', { name: 'Menudo — Panlasang Pinoy' })).toHaveAttribute(
      'href',
      'https://panlasangpinoy.com/menudo-with-raisins-and-green-peas/'
    );
    await gallery.getByText('Recipes & photos: Panlasang Pinoy').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const screen = page.locator('[data-scroll-screen]');
    const body = page.locator('[data-nara-presenter="body"]');
    const hands = page.locator('[data-nara-presenter="hands"]');
    await body.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    await hands.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    await expect(hands).toHaveCSS('pointer-events', 'none');
    expect(await screen.evaluate((el) => el.contains(document.querySelector('[data-nara-presenter="hands"]')))).toBe(
      true
    );
    await expect
      .poll(() => screen.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m23)))
      .toBeGreaterThan(0.2);
    if (width > 1000) {
      const galleryBounds = (await gallery.boundingBox())!;
      const headerBounds = (await page.getByRole('banner').boundingBox())!;
      const copyBounds = (await page.locator('[data-hero-copy]').boundingBox())!;
      expect(copyBounds.x + copyBounds.width - galleryBounds.x).toBeGreaterThan(100);
      expect(
        await page.locator('[data-hero-copy] a[href="/docs"]').evaluate((el) => {
          const bounds = el.getBoundingClientRect();
          return document.elementFromPoint(bounds.right - 12, bounds.top + bounds.height / 2)?.closest('a') === el;
        })
      ).toBe(true);
      expect(Math.abs(galleryBounds.y - (headerBounds.y + headerBounds.height))).toBeLessThan(2);
      expect(Math.abs(galleryBounds.x + galleryBounds.width - width)).toBeLessThan(10);
    }
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
    expect(
      await tracks.evaluateAll((elements) => elements.every((el) => getComputedStyle(el).animationName === 'none'))
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(() => screen.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m23)))
      .toBe(0);
  });
}
