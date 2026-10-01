import { expect, test } from '@playwright/test';

test.skip(process.env.ISOLATED_MEMBERSHIP_PREVIEW !== 'true', 'Requires the guarded local membership preview.');

test('a free account confirms unchanged context and activates its new dated report without an upgrade', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('free@preview.invalid');
  await page.getByLabel(/^Password$/).fill('Development123!');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Complete check-in' }).click();
  await page.getByRole('button', { name: 'Still the same' }).click();
  await expect(page).toHaveURL(/\/profile\/nutrition-report$/, { timeout: 20_000 });
  await expect(page.getByText(/Profile confirmed unchanged on/)).toBeVisible();
  const response = page.waitForResponse((result) => result.url().endsWith('/nutrition-report/acknowledge'));
  await page.getByRole('button', { name: 'Use this report for meal planning' }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('dialog', { name: /membership needed/ })).toHaveCount(0);
  await page.goto('/membership?tab=plans');
  await expect(page.getByRole('heading', { name: 'Lifestyle', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Health', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Profile planning status' })).toHaveCount(0);
});
