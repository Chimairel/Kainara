import { test, expect } from '@playwright/test';

const image = {
  kind: 'image',
  url: 'https://res.cloudinary.com/fixture/image/upload/promo.png',
  bytes: 1000,
  duration: null,
};
const automaticPoster = 'https://res.cloudinary.com/fixture/video/upload/so_1/promo.jpg';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=',
  'base64'
);
for (const upload of [
  { name: 'promo.png', mimeType: 'image/png', buffer: png, asset: image },
  {
    name: 'promo.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('synthetic video payload'),
    asset: { ...image, kind: 'video', url: 'https://res.cloudinary.com/fixture/video/upload/promo.mp4', duration: 10 },
  },
]) {
  test(`admin saves, previews, publishes and restores ${upload.mimeType} on mobile`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const origin = baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    const payload = Buffer.from(
      JSON.stringify({
        userId: 'website-admin-fixture',
        email: 'fixture@example.invalid',
        role: 'ADMIN',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${payload}.fixture`, url: origin }]);
    let revision = 0;
    let draft: {
      asset: typeof upload.asset;
      poster: typeof image | null;
      posterUrl?: string | null;
      altText: string;
    } | null = null;
    let published: typeof draft = null;
    let publishCount = 0;
    await page.route('https://res.cloudinary.com/**', (route) =>
      route.fulfill({ contentType: 'image/png', body: png })
    );
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
      const headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      };
      if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
        return route.fulfill({ status: 204, headers });
      let data: unknown = [];
      if (path === '/user/profile')
        data = {
          id: 'website-admin-fixture',
          name: 'Synthetic Admin',
          email: 'fixture@example.invalid',
          role: 'ADMIN',
          emailVerified: true,
          onboardingDone: true,
          tosAccepted: true,
          reportAcknowledged: true,
          onboardingStatus: { acceptedCurrentConsent: true },
          userProfile: {},
        };
      else if (path === '/user/membership') data = { enabled: false };
      else if (path.includes('notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.startsWith('/admin/website-content')) {
        if (path.endsWith('/upload')) {
          // Check the wire payload: mocked success alone misses Axios serializing FormData as JSON.
          expect(route.request().headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
          const body = route.request().postDataBuffer()!;
          const posterUpload = body.toString().includes('name="slot"\r\n\r\nposter');
          const filename = posterUpload ? 'poster.png' : upload.name;
          expect(body.toString()).toContain(`name="file"; filename="${filename}"`);
          expect(body.toString()).toContain(`name="revision"\r\n\r\n${revision}`);
          expect(body.includes(posterUpload ? png : upload.buffer)).toBe(true);
          if (posterUpload) {
            draft!.poster = image;
            draft!.posterUrl = image.url;
          } else
            draft = {
              asset: upload.asset,
              poster: null,
              posterUrl: upload.asset.kind === 'video' ? automaticPoster : null,
              altText: 'KAINARA platform preview',
            };
          revision++;
        } else if (path.endsWith('/draft')) {
          draft!.altText = route.request().postDataJSON().altText;
          revision++;
        } else if (path.endsWith('/publish')) {
          published = structuredClone(draft);
          publishCount++;
          revision++;
        } else if (path.endsWith('/reset')) {
          published = null;
          draft = null;
          revision++;
        }
        data = { revision, draft, published, publishedAt: published ? '2026-10-04T03:00:00Z' : null };
      }
      return route.fulfill({ headers, json: { success: true, data } });
    });
    await page.goto('/admin/website');
    await expect(page.getByRole('heading', { name: 'Website content' })).toBeVisible();
    await page
      .getByLabel('Image or video', { exact: true })
      .setInputFiles({ name: upload.name, mimeType: upload.mimeType, buffer: upload.buffer });
    if (upload.asset.kind === 'image')
      await page.getByLabel('Video poster image', { exact: true }).setInputFiles({
        name: 'poster.png',
        mimeType: 'image/png',
        buffer: png,
      });
    await page.getByLabel('Media description').fill('Ten-second promotional preview');
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    expect(publishCount).toBe(0);
    if (upload.asset.kind === 'video') {
      const preview = page.locator('video[aria-label="Ten-second promotional preview"]');
      // Reduced motion and preload=none keep the fixture video idle while we inspect its poster.
      await expect(preview).toHaveAttribute('poster', automaticPoster);
      await page.getByLabel('Video poster image', { exact: true }).setInputFiles({
        name: 'poster.png',
        mimeType: 'image/png',
        buffer: png,
      });
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
      expect(draft!.posterUrl).toBe(image.url);
    }
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Website media published.')).toBeVisible();
    expect(publishCount).toBe(1);
    if (upload.asset.kind === 'image')
      await expect(page.getByRole('img', { name: 'Ten-second promotional preview' })).toHaveCount(2);
    else expect(published!.asset).toEqual(upload.asset);
    expect(draft!.poster).toEqual(image);
    await page.getByRole('button', { name: 'Restore original', exact: true }).click();
    await expect(page.getByText('Original dashboard image restored.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Example KAINARA nutrition dashboard' })).toHaveCount(2);
  });
}
