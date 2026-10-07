import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.gstatic.com/s/googlesans/**', (route) => route.abort());
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

for (const theme of ['light', 'dark']) {
  test(`split layout, password control and theme remain usable in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
    await page.goto('/login');
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('.auth-card');
    const artwork = page.getByRole('complementary', { name: 'About KAINARA' });
    expect((await card.boundingBox())!.x).toBeGreaterThan((await artwork.boundingBox())!.x);
    await expect(artwork.locator('[data-grid-tile]')).toHaveCount(0);
    const nara = artwork.getByRole('button', { name: 'Boop the Nara' });
    await expect(nara).toBeVisible();
    const stageBounds = (await artwork.locator('[data-auth-kubo-stage]').boundingBox())!;
    const windowBounds = (await artwork.locator('[data-auth-kubo-window]').boundingBox())!;
    expect(windowBounds.width).toBeGreaterThan(stageBounds.width * 0.6);
    expect(windowBounds.x).toBeGreaterThanOrEqual(stageBounds.x);
    expect(windowBounds.x + windowBounds.width).toBeLessThanOrEqual(stageBounds.x + stageBounds.width);
    expect(windowBounds.y).toBeGreaterThanOrEqual(stageBounds.y);
    expect(windowBounds.y + windowBounds.height).toBeLessThanOrEqual(stageBounds.y + stageBounds.height);
    expect(stageBounds.x + stageBounds.width).toBeLessThan((await card.boundingBox())!.x);
    const submit = page.getByRole('button', { name: 'Sign in', exact: true });
    const google = page.getByRole('button', { name: 'Synthetic Google sign-in' });
    await expect(google).toBeVisible();
    expect((await google.boundingBox())!.y).toBeGreaterThan((await submit.boundingBox())!.y);
    await expect(card).toHaveCSS('box-shadow', 'none');
    const password = page.getByLabel('Password', { exact: true });
    await password.fill('SyntheticPassword1');
    const toggle = page.getByRole('button', { name: 'Show password' });
    const fieldBounds = (await password.boundingBox())!;
    const toggleBounds = (await toggle.boundingBox())!;
    expect(Math.abs(fieldBounds.y + fieldBounds.height / 2 - toggleBounds.y - toggleBounds.height / 2)).toBeLessThan(1);
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(password).toHaveValue('SyntheticPassword1');
    const lamp = artwork.locator('[data-auth-bulb]');
    const themeToggle = lamp.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` });
    const lampBounds = (await lamp.boundingBox())!;
    const themeBounds = (await themeToggle.boundingBox())!;
    expect(themeBounds.width).toBeGreaterThanOrEqual(44);
    expect(themeBounds.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(themeBounds.x + themeBounds.width / 2 - lampBounds.x - lampBounds.width / 2)).toBeLessThan(1);
    expect(Math.abs(themeBounds.y + themeBounds.height / 2 - lampBounds.y - lampBounds.height * 0.685)).toBeLessThan(1);
    await themeToggle.focus();
    await themeToggle.press('Enter');
    await expect(page.locator('html')).toHaveClass(new RegExp(theme === 'dark' ? 'light' : 'dark'));
    await expect(password).toHaveValue('SyntheticPassword1');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(artwork).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('email sign-in still submits the validated credentials and shows server feedback', async ({ page }) => {
  let credentials: unknown;
  await page.route('**/api/auth/login', async (route) => {
    credentials = route.request().postDataJSON();
    await route.fulfill({ status: 401, json: { success: false, error: 'Synthetic rejected credentials' } });
  });
  await page.goto('/login');
  await page.getByLabel('Email address').fill('fixture@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPassword1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Synthetic rejected credentials')).toBeVisible();
  expect(credentials).toEqual({ email: 'fixture@example.invalid', password: 'SyntheticPassword1' });
});

test('recovery keeps its existing request and privacy-preserving confirmation', async ({ page }) => {
  let payload: unknown;
  await page.route('**/api/auth/forgot-password', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: { success: true } });
  });
  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill('fixture@example.invalid');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox', exact: true })).toBeVisible();
  await expect(page.getByText(/If that account supports password sign-in/)).toBeVisible();
  expect(payload).toEqual({ email: 'fixture@example.invalid' });
});
