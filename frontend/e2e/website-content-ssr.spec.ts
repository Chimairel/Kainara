import { test, expect } from '@playwright/test';
const fixture = 'http://127.0.0.1:3101/__fixture';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=',
  'base64'
);
for (const mode of ['automatic', 'custom'] as const) {
  test(`initial HTML includes the ${mode} poster and preserves playback fallback`, async ({ page, request }) => {
    await request.post(fixture, { data: { mode } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let browserSettingsReads = 0;
    await page.route('**/api/public/landing-media', (route) => {
      browserSettingsReads++;
      return route.fulfill({ json: { success: true, data: null } });
    });
    await page.route('https://res.cloudinary.com/**', (route) =>
      route.fulfill({ contentType: 'image/png', body: png })
    );
    const response = await page.goto('/');
    const html = await response!.text();
    const poster =
      mode === 'automatic'
        ? 'https://res.cloudinary.com/fixture/video/upload/so_1/promo.jpg'
        : 'https://res.cloudinary.com/fixture/image/upload/custom.jpg';
    expect(html).toContain(`poster="${poster}"`);
    expect(html).not.toContain('Loading website media');
    expect(html).not.toContain('src="/dashboard-actual.png"');
    const video = page.locator('video[aria-label="KAINARA promotion"]');
    await expect(video).toHaveAttribute('poster', poster);
    await expect(video).toHaveAttribute('playsinline', '');
    await expect(page.getByRole('button', { name: 'Play promotional video' })).toBeAttached();
    expect(browserSettingsReads).toBe(0);
    const state = await (await request.get(fixture)).json();
    expect(state).toEqual({ reads: 1, hadPrivateHeaders: false });
    await video.evaluate((element) => element.dispatchEvent(new Event('error')));
    await expect(page.getByRole('img', { name: 'KAINARA promotion' })).toHaveAttribute('src', poster);
    await request.post(fixture, { data: { mode: 'image' } });
    const refreshed = await page.reload();
    expect(await refreshed!.text()).toContain('src="https://res.cloudinary.com/fixture/image/upload/promo.jpg"');
    await expect(page.getByRole('img', { name: 'KAINARA still image' })).toBeAttached();
  });
}
for (const mode of ['none', 'failure']) {
  test(`public landing remains available when metadata is ${mode}`, async ({ page, request }) => {
    await request.post(fixture, { data: { mode } });
    const response = await page.goto('/');
    expect(response!.status()).toBe(200);
    expect(await response!.text()).toContain('src="/dashboard-actual.png"');
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading website media' })).toHaveCount(0);
  });
}
