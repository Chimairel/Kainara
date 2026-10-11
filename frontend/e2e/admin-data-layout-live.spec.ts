import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.skip(
  !process.env.SYNTHETIC_JOURNEY_GUIDE,
  'Requires the private marked-account guide and isolated localhost API.'
);
test('admin nutrition data retains catalogue navigation and omits retired ENNS across themes', async ({ page }) => {
  test.setTimeout(180_000);
  expect(['localhost', '127.0.0.1']).toContain(new URL(test.info().project.use.baseURL!).hostname);
  const guide = JSON.parse(readFileSync(process.env.SYNTHETIC_JOURNEY_GUIDE!, 'utf8'));
  expect(
    guide.accounts.some(
      (account: { email: string; role: string }) =>
        account.email === 'sleep-admin@example.test' && account.role === 'ADMIN'
    )
  ).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Email address').fill('sleep-admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill(guide.newAccountPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview(?:\?.*)?$/, { timeout: 60_000 });
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate((value) => localStorage.setItem('nutrimind-theme', value), theme);
    const loaded = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/admin/data' && response.ok()
    );
    await page.goto('/admin/data');
    const workspace = (await (await loaded).json()).data;
    expect(workspace.summary.consumptionStats).toBe(0);
    expect(workspace.sources.every((source: { domain: string }) => source.domain !== 'FOOD_CONSUMPTION')).toBe(true);
    await expect(page.getByRole('heading', { name: 'Nutrient catalogues' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Import & publish' })).toHaveCount(0);
    await expect(page.getByText('Consumption rows', { exact: true })).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(2);
    await page.screenshot({ path: test.info().outputPath('data-' + theme + '.png') });
    await page.getByRole('button', { name: 'FNRI catalogue', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'FNRI catalogue', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'USDA catalogue', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'USDA catalogue', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'View releases', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Sources & releases' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Register a source' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
