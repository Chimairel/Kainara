import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test('login waits locally after a limit, then recovery confirms through Sonner without replacing its form', async ({ page }) => {
  let loginCalls = 0;
  let recoveryCalls = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.endsWith('/auth/login')) {
      loginCalls++;
      return route.fulfill({ status: 429, headers, json: { success: false, error: 'Too many failed sign-in attempts.', retryAfterSeconds: 120 } });
    }
    if (path.endsWith('/auth/forgot-password')) {
      recoveryCalls++;
      return route.fulfill({ headers, json: { success: true, data: { message: 'If the account exists, a link has been sent.' } } });
    }
    return route.fulfill({ status: 401, headers, json: { success: false } });
  });
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill('fixture@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Fixture123!');
  const form = page.locator('.auth-card form');
  const before = (await form.boundingBox())!;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('[data-sonner-toast]')).toContainText('Try again in 2 minutes.');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('[data-sonner-toast]')).toContainText('Please wait before trying again.');
  expect(loginCalls).toBe(1);
  expect(Math.abs((await form.boundingBox())!.height - before.height)).toBeLessThan(2);
  await expect(form.getByRole('alert')).toHaveCount(0);

  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await page.waitForURL('**/forgot-password');
  await expect(page.getByRole('heading', { name: 'Reset your access' })).toBeVisible();
  await page.getByLabel('Email address', { exact: true }).fill('fixture@example.invalid');
  const recoveryForm = page.locator('.auth-card form');
  const initial = (await recoveryForm.boundingBox())!;
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Check your inbox' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reset your access' })).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('fixture@example.invalid');
  expect(Math.abs((await recoveryForm.boundingBox())!.height - initial.height)).toBeLessThan(2);
  expect(recoveryCalls).toBe(1);
});
