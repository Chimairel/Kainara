import { expect, test } from '@playwright/test';

test('auth hydration keeps its disabled form painted and preserves busy-state feedback', async ({ page }) => {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  let releaseLogin!: () => void;
  const loginReady = new Promise<void>((resolve) => {
    releaseLogin = resolve;
  });
  await page.route('**/_next/static/**/*.js', async (route) => {
    await scriptsReady;
    await route.continue();
  });
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/auth/login')) await loginReady;
    await route.fulfill({ status: 401, json: { success: false, error: 'Synthetic sign-in failure' } });
  });
  try {
    await page.goto('/login', { waitUntil: 'commit' });
    const email = page.getByLabel('Email address');
    const submit = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(email).toBeVisible();
    await expect(email).toBeDisabled();
    await expect(submit).toBeDisabled();
    await expect(email).toHaveCSS('opacity', '1');
    await expect(submit).toHaveCSS('opacity', '1');
    releaseScripts();
    await expect(submit).toBeEnabled();
    await email.fill('fixture@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('SyntheticPassword1');
    await submit.click();
    const busy = page.getByRole('button', { name: 'Processing...' });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveCSS('opacity', '0.5');
    releaseLogin();
    await expect(page.getByText('Synthetic sign-in failure')).toBeVisible();
  } finally {
    releaseScripts();
    releaseLogin();
  }
});
