import { expect, test, type Page } from '@playwright/test';

const profile = (role: 'USER' | 'ADMIN') => ({
  id: 'ui-loading-fixture',
  name: 'Synthetic Member',
  email: 'loading@example.invalid',
  role,
  emailVerified: true,
  onboardingDone: false,
  tosAccepted: false,
  reportAcknowledged: false,
  onboardingStatus: { acceptedCurrentConsent: false, nextPath: '/onboarding/stats' },
  userProfile: null,
  healthConditions: [],
  allergies: [],
  safetyEntries: [],
  nutritionReport: null,
});

async function signInFixture(page: Page, role: 'USER' | 'ADMIN') {
  const claims = Buffer.from(
    JSON.stringify({
      userId: profile(role).id,
      email: profile(role).email,
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `fixture.${claims}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
}

const headers = () => ({
  'Access-Control-Allow-Origin': process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
});

for (const width of [390, 1440]) {
  test(`nutrition data loader fills the available workspace at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signInFixture(page, 'ADMIN');
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
        return route.fulfill({ status: 204, headers: headers() });
      if (path.endsWith('/admin/data')) {
        await held;
        return route.fulfill({ status: 503, headers: headers(), json: { success: false } });
      }
      return route.fulfill({
        headers: headers(),
        json: {
          success: true,
          data: path.endsWith('/user/profile') ? profile('ADMIN') : { notifications: [], unreadCount: 0 },
        },
      });
    });
    try {
      await page.goto('/admin/data');
      const loader = page.getByLabel('Loading governed nutrition data...', { exact: true });
      await expect(loader).toBeVisible();
      const main = await page.getByRole('main').boundingBox();
      const bounds = await loader.boundingBox();
      expect(Math.abs(bounds!.height - main!.height)).toBeLessThan(2);
      expect(Math.abs(bounds!.y - main!.y)).toBeLessThan(2);
      const artwork = await loader.locator(':scope > div').boundingBox();
      expect(Math.abs(artwork!.y + artwork!.height / 2 - (main!.y + main!.height / 2))).toBeLessThan(2);
    } finally {
      release();
    }
  });

  test(`onboarding progress thumb stays behind the sticky header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    await signInFixture(page, 'USER');
    await page.route('**/api/**', (route) =>
      route.fulfill({
        headers: headers(),
        json: {
          success: true,
          data: new URL(route.request().url()).pathname.endsWith('/user/profile') ? profile('USER') : {},
        },
      })
    );
    await page.goto('/onboarding/stats');
    const thumb = page.locator('[data-onboarding-progress-thumb]');
    await expect(thumb).toBeVisible();
    await page.evaluate(() => {
      const rect = document.querySelector('[data-onboarding-progress-thumb]')!.getBoundingClientRect();
      window.scrollBy(0, rect.top - 20);
    });
    const overlap = await thumb.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = Math.max(1, Math.min(40, rect.top + rect.height / 2));
      return { top: rect.top, headerOnTop: Boolean(document.elementFromPoint(x, y)?.closest('header')) };
    });
    expect(overlap.top).toBeLessThan(56);
    expect(overlap.headerOnTop).toBe(true);
  });
}

test('background profile recovery cannot redirect a confirmed admin to email verification', async ({ page }) => {
  await signInFixture(page, 'ADMIN');
  let reads = 0;
  let failProfile = true;
  let recoveryReads = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
      return route.fulfill({ status: 204, headers: headers() });
    if (path.endsWith('/user/profile')) {
      reads += 1;
      if (failProfile) return route.fulfill({ status: 503, headers: headers(), json: { success: false } });
      recoveryReads += 1;
      await held;
      return route.fulfill({ headers: headers(), json: { success: true, data: profile('ADMIN') } });
    }
    return route.fulfill({ status: 503, headers: headers(), json: { success: false } });
  });
  try {
    await page.goto('/admin/data');
    await expect(page.getByRole('heading', { name: 'Could not load your account profile' })).toBeVisible();
    expect(reads).toBeGreaterThanOrEqual(2);
    failProfile = false;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => recoveryReads).toBe(1);
    await expect(page.getByLabel('Loading', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/data$/);
    release();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/data$/);
    await expect(page.getByRole('heading', { name: 'Could not load your account profile' })).toHaveCount(0);
  } finally {
    release();
  }
});

test('loaded landing photos resume all columns without changing the gallery layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('**/_next/image?url=https%3A%2F%2Fpanlasangpinoy.com**', (route) =>
    route.fulfill({ path: 'public/meals/pork-bowl.jpg', contentType: 'image/jpeg' })
  );
  await page.goto('/');
  const gallery = page.locator('[data-meal-gallery]');
  await expect(gallery.locator('[data-gallery-photo-state="loaded"]')).toHaveCount(32);
  expect(
    await gallery
      .locator('[data-slot="marquee"] > div')
      .evaluateAll((tracks) => tracks.every((track) => getComputedStyle(track).animationPlayState === 'running'))
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('landing columns keep a local surface during slow photos and resume after failed photos', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_next/image?url=https%3A%2F%2Fpanlasangpinoy.com**', async (route) => {
    await held;
    await route.abort();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const gallery = page.locator('[data-meal-gallery]');
    await expect(gallery.locator('[data-gallery-photo-state="loading"]')).toHaveCount(32);
    expect(
      await gallery
        .locator('[data-slot="marquee"] > div')
        .evaluateAll((tracks) => tracks.every((track) => getComputedStyle(track).animationPlayState === 'paused'))
    ).toBe(true);
    expect(await gallery.locator(':scope > div').evaluate((el) => getComputedStyle(el).maskImage)).toContain(
      'data:image/svg+xml'
    );
    release();
    await expect(gallery.locator('[data-gallery-photo-state="unavailable"]')).toHaveCount(32);
    expect(
      await gallery
        .locator('[data-slot="marquee"] > div')
        .evaluateAll((tracks) => tracks.every((track) => getComputedStyle(track).animationPlayState === 'running'))
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('landing-photo-fallbacks.png'), fullPage: false });
  } finally {
    release();
  }
});
