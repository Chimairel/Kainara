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
    await expect(page.getByRole('heading', { name: 'Could not load your account' })).toBeVisible({ timeout: 12_000 });
    await expect(page).toHaveURL(new RegExp(`${entry}$`));
    failedProfile = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page).toHaveURL(/\/onboarding\/stats$/);
  });
}

for (const role of ['USER', 'NUTRITIONIST', 'ADMIN'] as const) {
  test(`${role} recovers from a brief API restart without manual retry or a false OTP redirect`, async ({ page }) => {
    const payload = Buffer.from(
      JSON.stringify({
        userId: 'restart-fixture',
        email: 'restart@example.invalid',
        role,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    await page
      .context()
      .addCookies([
        {
          name: 'nutrimind_session',
          value: `fixture.${payload}.fixture`,
          url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        },
      ]);
    let attempts = 0;
    const visited: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url());
    });
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/user/profile')) {
        attempts++;
        if (attempts === 1) return route.abort('connectionrefused');
        if (attempts === 2) return route.fulfill({ status: 503, json: { success: false } });
        return route.fulfill({
          json: {
            success: true,
            data: {
              id: 'restart-fixture',
              name: 'Restart Fixture',
              email: 'restart@example.invalid',
              role,
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
    await page.goto('/login');
    const destination =
      role === 'USER' ? /\/onboarding\/stats$/ : role === 'ADMIN' ? /\/admin\/overview$/ : /\/nutritionist\/reviews$/;
    await expect(page).toHaveURL(destination, { timeout: 25_000 });
    expect(attempts).toBe(3);
    expect(visited.some((url) => url.includes('/verify-email'))).toBe(false);
    await expect(page.getByText('Could not load your account', { exact: true })).toHaveCount(0);
  });
}

test('a slow destination keeps the signed-in loading state beyond eight seconds', async ({ page }) => {
  const payload = Buffer.from(
    JSON.stringify({
      userId: 'slow-route-fixture',
      email: 'slow@example.invalid',
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  await page
    .context()
    .addCookies([
      {
        name: 'nutrimind_session',
        value: `fixture.${payload}.fixture`,
        url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      },
    ]);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/onboarding/stats*', async (route) => {
    await held;
    return route.continue();
  });
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/user/profile')) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            id: 'slow-route-fixture',
            name: 'Slow Route',
            email: 'slow@example.invalid',
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
  try {
    await page.goto('/login');
    await expect(page.getByText('Redirecting to your workspace...')).toBeVisible();
    await page.waitForTimeout(10_000);
    await expect(page.getByText('Your workspace took too long to open')).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/onboarding\/stats$/, { timeout: 25_000 });
});
