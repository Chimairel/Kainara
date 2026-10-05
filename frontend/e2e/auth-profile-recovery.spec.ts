import { expect, test } from '@playwright/test';

for (const entry of ['/login', '/register']) {
  test(`${entry} retries an unresolved profile without sending a verified member to OTP`, async ({ page }) => {
    const payload = Buffer.from(
      JSON.stringify({
        userId: 'auth-recovery-fixture',
        email: 'auth-recovery@example.invalid',
        role: 'USER',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    await page.context().addCookies([
      {
        name: 'nutrimind_session',
        value: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,
        url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      },
    ]);
    let failedProfile = true;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/user/profile')) {
        if (failedProfile) {
          return route.fulfill({ status: 503, json: { success: false, error: 'Fixture service unavailable' } });
        }
        return route.fulfill({
          json: {
            success: true,
            data: {
              id: 'auth-recovery-fixture',
              name: 'Auth Recovery Fixture',
              email: 'auth-recovery@example.invalid',
              role: 'USER',
              emailVerified: true,
              onboardingDone: false,
              tosAccepted: false,
              reportAcknowledged: false,
              onboardingStatus: { acceptedCurrentConsent: false, nextPath: '/onboarding/stats' },
            },
          },
        });
      }
      return route.fulfill({ status: 204 });
    });
    await page.goto(entry);
    await expect(page.getByRole('heading', { name: 'Could not load your account' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${entry}$`));
    failedProfile = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page).toHaveURL(/\/onboarding\/stats$/);
  });
}
