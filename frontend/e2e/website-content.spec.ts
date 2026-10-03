import { test, expect } from '@playwright/test';

const image = {
  kind: 'image',
  url: 'https://res.cloudinary.com/fixture/image/upload/promo.png',
  bytes: 1000,
  duration: null,
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=',
  'base64'
);
test('admin saves, previews, publishes and restores website media on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
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
  let draft: { asset: typeof image; poster: null; altText: string } | null = null;
  let published: typeof draft = null;
  let publishCount = 0;
  await page.route('https://res.cloudinary.com/**', (route) => route.fulfill({ contentType: 'image/png', body: png }));
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
        draft = { asset: image, poster: null, altText: 'KAINARA platform preview' };
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
    .setInputFiles({ name: 'promo.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Media description').fill('Ten-second promotional preview');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  expect(publishCount).toBe(0);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Website media published. Visitors will see it within a minute.')).toBeVisible();
  expect(publishCount).toBe(1);
  await expect(page.getByRole('img', { name: 'Ten-second promotional preview' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Restore original', exact: true }).click();
  await expect(page.getByText('Original dashboard image restored.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Example KAINARA nutrition dashboard' })).toHaveCount(2);
});

test('public promo video has controls and falls back to its poster if playback fails', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/public/landing-media', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        success: true,
        data: {
          kind: 'video',
          url: 'https://res.cloudinary.com/fixture/video/upload/promo.mp4',
          posterUrl: image.url,
          altText: 'KAINARA promotion',
        },
      },
    })
  );
  await page.route('https://res.cloudinary.com/fixture/image/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: png })
  );
  // Delay media until we verify the visible controls; no real provider calls.
  let releaseMedia: (() => void) | undefined;
  await page.route('https://res.cloudinary.com/fixture/video/**', async (route) => {
    await new Promise<void>((resolve) => {
      releaseMedia = resolve;
    });
    await route.abort();
  });
  const response = await page.goto('/');
  expect(response!.headers()['content-security-policy']).toContain("media-src 'self' blob: https://res.cloudinary.com");
  const video = page.locator('video[aria-label="KAINARA promotion"]');
  await expect(video).toHaveAttribute('playsinline', '');
  await expect(page.getByRole('button', { name: 'Play promotional video' })).toBeAttached();
  await video.evaluate((element) => element.dispatchEvent(new Event('error')));
  releaseMedia?.();
  await expect(page.getByRole('img', { name: 'KAINARA promotion' })).toHaveAttribute('src', image.url);
});
