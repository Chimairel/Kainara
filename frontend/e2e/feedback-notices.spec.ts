import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  expect(['localhost', '127.0.0.1']).toContain(
    new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').hostname
  );
  await page.route('https://accounts.google.com/gsi/client*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: {
      initialize() {},
      renderButton(host) {
        const button = document.createElement('button');
        button.textContent = 'Synthetic Google sign-in';
        host.append(button);
      }
    } } };`,
    })
  );
});

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`sign-in feedback remains clear and retryable at ${width}px ${theme}`, async ({ page }, testInfo) => {
      expect(['localhost', '127.0.0.1']).toContain(
        new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').hostname
      );
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(error.message));
      await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
      const submitted: unknown[] = [];
      await page.route('**/api/auth/login', async (route) => {
        submitted.push(route.request().postDataJSON());
        await route.fulfill({ status: 401, json: { success: false, error: 'Invalid email or password credentials.' } });
      });
      await page.goto('/login');
      await page.getByLabel('Email address').fill('preview@example.invalid');
      await page.getByLabel('Password', { exact: true }).fill('SyntheticPassword1');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      const alert = page.getByRole('alert').filter({ hasText: "Couldn't sign in" });
      await expect(alert).toHaveCount(1);
      await expect(alert).toContainText("Couldn't sign in");
      await expect(alert).toContainText('Check your email and password, then try again.');
      await expect(page.getByLabel('Email address')).toHaveValue('preview@example.invalid');
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue('SyntheticPassword1');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: testInfo.outputPath('sign-in-error.png'), fullPage: true });
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect.poll(() => submitted.length).toBe(2);
      expect(submitted[0]).toEqual({ email: 'preview@example.invalid', password: 'SyntheticPassword1' });
      expect(failures).toEqual([]);
    });
  }
}

test('field errors stay associated with inputs and reset failures preserve their recovery link', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await page.getByLabel('Email address').getAttribute('aria-describedby');
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText('Email');
  await page.goto('/reset-password');
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid or missing reset token' })).toContainText(
    'Invalid or missing reset token'
  );
  await expect(page.getByRole('link', { name: /request a new|reset link/i })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reset-recovery.png'), fullPage: true });
});
