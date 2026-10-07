import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('https://accounts.google.com/gsi/client*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: {
        initialize() {},
        renderButton(host) {
          const button = document.createElement('button');
          button.textContent = 'Synthetic Google sign-in';
          button.style.height = '40px';
          host.append(button);
        }
      } } };`,
    })
  );
});

test('Nara follows eight pointer directions and reacts to keyboard without changing the form', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/login');
  const mascot = page.getByRole('button', { name: 'Boop the Nara' });
  await expect(mascot).toBeVisible();
  const layers = mascot.locator('span[style*="background-image"]');
  const bounds = (await mascot.boundingBox())!;
  for (const [dx, dy, position] of [
    [-100, -100, '0% 0%'],
    [0, -100, '50% 0%'],
    [100, -100, '100% 0%'],
    [-100, 0, '0% 50%'],
    [100, 0, '100% 50%'],
    [-100, 100, '0% 100%'],
    [0, 100, '50% 100%'],
    [100, 100, '100% 100%'],
  ] as const) {
    await page.mouse.move(bounds.x + bounds.width / 2 + dx, bounds.y + bounds.height / 2 + dy);
    await expect(layers.first()).toHaveCSS('background-position', position);
  }
  await page.getByLabel('Email address').fill('fixture@example.invalid');
  await page.clock.install();
  await mascot.focus();
  await mascot.press('Enter');
  await expect(layers.last()).toHaveCSS('opacity', '1');
  await page.clock.runFor(150);
  await expect(layers.last()).toHaveCSS('background-position', '50% 0%');
  await page.clock.runFor(500);
  await expect(layers.first()).toHaveCSS('opacity', '1');
  await expect(page.getByLabel('Email address')).toHaveValue('fixture@example.invalid');
  await expect(page).toHaveURL(/\/login$/);
});

for (const theme of ['light', 'dark']) {
  test(`Nara renders cleanly in ${theme} mode and honors live reduced motion`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/register');
    await expect(page.getByRole('button', { name: 'Boop the Nara' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: testInfo.outputPath(`nara-${theme}.png`), fullPage: true });
    await page
      .locator('[data-auth-mascot]:visible')
      .screenshot({ path: testInfo.outputPath(`nara-${theme}-portrait.png`) });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const portrait = page.getByRole('img', { name: 'Nara wearing her tanod costume' });
    await expect(portrait).toBeVisible();
    await expect(page.getByRole('button', { name: 'Boop the Nara' })).toHaveCount(0);
    await expect(portrait).toHaveCSS('background-position', '50% 50%');
  });
}

test.describe('touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('Nara stays centered, accepts taps, and does not overflow mobile forms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/register');
    const mascot = page.getByRole('button', { name: 'Boop the Nara' });
    const layers = mascot.locator('span[style*="background-image"]');
    await expect(mascot).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(layers.first()).toHaveCSS('background-position', '50% 50%');
    await mascot.tap();
    await expect(layers.last()).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Create account', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeInViewport();
  });
});
