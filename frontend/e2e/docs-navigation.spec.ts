import { expect, test } from '@playwright/test';

test('chapter navigation swaps the article and the right outline', async ({ page }) => {
  await page.goto('/docs');

  await expect(page.getByRole('heading', { name: 'The complete guide to KAINARA.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What KAINARA is', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Documentation chapters' })
    .getByRole('button', { name: /Privacy Policy/ })
    .click();

  await expect(page).toHaveURL(/#privacy-policy$/);
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What KAINARA is', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('complementary', { name: 'On this page' }).getByRole('button', { name: 'Data collected' })
  ).toBeVisible();

  await page
    .getByRole('complementary', { name: 'On this page' })
    .getByRole('button', { name: 'Who can access it' })
    .click();
  await expect(page).toHaveURL(/#privacy-policy-access$/);
  await expect(page.getByRole('heading', { name: 'Who can access it' })).toBeInViewport();
});

test('onboarding legal links load the correct article', async ({ page }) => {
  await page.goto('/docs#clinical-guidelines');
  await expect(page.getByRole('heading', { name: 'Clinical Guidelines', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Clinical Guidelines', exact: true })).toBeInViewport();

  await page.goto('/docs#terms-of-service');
  await expect(page.getByRole('heading', { name: 'Terms of Service', exact: true })).toBeInViewport();
});

test('narrow screens can select a chapter without the desktop outline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs');

  await page.getByLabel('Choose a documentation chapter').selectOption('medical-disclaimers');
  await expect(page.getByRole('heading', { name: 'Medical Disclaimers', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'On this page' })).toBeHidden();
});

test('the former Sources page opens the full evidence register in Docs', async ({ page }) => {
  await page.goto('/sources');

  await expect(page).toHaveURL(/\/docs#data-sources$/);
  await expect(page.getByRole('heading', { name: 'Sources and evidence', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Background guidance and inactive policies' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Philippine nutrition and consumption data' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How to read source statuses' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Sources' })
  ).toHaveCount(0);

  await page
    .getByRole('complementary', { name: 'On this page' })
    .getByRole('button', { name: 'Background guidance and inactive policies' })
    .click();
  await expect(page).toHaveURL(/#data-sources-policy-map$/);
  await expect(page.getByRole('heading', { name: 'Background guidance and inactive policies' })).toBeInViewport();
});
