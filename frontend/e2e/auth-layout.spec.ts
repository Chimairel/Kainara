import { expect, test, type Page } from '@playwright/test';

async function expectReachableCard(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const card = page.locator('.auth-card');
  await expect(card).toBeVisible();
  const stage = page.locator('[data-auth-kubo-stage]');
  if (await stage.isVisible()) {
    const stageBounds = (await stage.boundingBox())!;
    const cardBounds = (await card.boundingBox())!;
    expect(stageBounds.x + stageBounds.width).toBeLessThanOrEqual(cardBounds.x - 24);
  }
  expect(await card.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  const heading = card.getByRole('heading');
  await expect(heading.locator('..').locator(':scope > *')).toHaveCount(2);
  await expect(heading.locator('..').locator(':scope > p')).toBeVisible();
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeInViewport();
  const home = page.getByRole('link', { name: 'Back to home', exact: true });
  await home.scrollIntoViewIfNeeded();
  await expect(home).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Layout checks never create an account or call the Google provider.
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const [width, height] of [
  [1366, 600],
  [1280, 500],
  [1093, 480],
  [1024, 600],
  [1920, 1080],
  [390, 844],
  [320, 568],
]) {
  test(`registration stays reachable at ${width}x${height}, including validation errors`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/register');
    await page.evaluate(() => document.fonts.ready);
    await expectReachableCard(page);
    if (height === 1080) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
    }
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByText('First name is required.')).toBeVisible();
    await expectReachableCard(page);
  });
}

for (const path of ['/login', '/forgot-password', '/reset-password', '/verify-email', '/nutritionist-invitation']) {
  test(`${path} keeps its title and footer reachable on a short desktop`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expectReachableCard(page);
  });
}
