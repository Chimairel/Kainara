import { expect, test } from '@playwright/test';

// Disposable browser responses only: these journeys never delete a real account.
for (const width of [390, 1440]) {
  for (const passwordEnabled of [false, true]) {
    test(`profile privacy uses one delete action with password=${passwordEnabled} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const owner = `privacy-${width}-${passwordEnabled}`;
      const user = {
        id: owner,
        name: 'Synthetic Member',
        email: 'privacy@example.invalid',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        authMethods: { password: passwordEnabled, google: true },
        image: 'Chimay',
        googleImage: 'https://lh3.googleusercontent.com/synthetic-photo',
        userProfile: { revision: 1, safetyRevision: 1 },
        healthConditions: [],
        allergies: [],
        safetyEntries: [],
      };
      const payload = Buffer.from(
        JSON.stringify({
          userId: owner,
          email: user.email,
          role: 'USER',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
      await page
        .context()
        .addCookies([{ name: 'nutrimind_session', value: `fixture.${payload}.fixture`, url: origin }]);
      let deletionBody: unknown;
      let avatarBody: unknown;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const headers = {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
        };
        if (route.request().method() === 'OPTIONS' || path.includes('/live/')) {
          return route.fulfill({ status: 204, headers });
        }
        let data: unknown = [];
        if (path.endsWith('/user/profile')) data = user;
        if (path.endsWith('/user/membership'))
          data = {
            enabled: true,
            level: 'TRIAL',
            tier: 'HEALTH',
            healthAccess: true,
            trialEndsAt: new Date(Date.now() + 27 * 86400000).toISOString(),
          };
        if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        if (path.endsWith('/profile/avatar') && route.request().method() === 'PUT') {
          avatarBody = route.request().postDataJSON();
          user.image = 'Default';
          data = { image: 'Default' };
        }
        if (path.endsWith('/user/account') && route.request().method() === 'DELETE') {
          deletionBody = route.request().postDataJSON();
          data = {};
        }
        return route.fulfill({ headers, json: { success: true, data } });
      });
      await page.goto('/profile/personal');
      const profileMenu =
        width < 768
          ? page.getByRole('button', { name: 'Profile', exact: true })
          : page.getByRole('link', { name: 'Profile: Synthetic Member', exact: true });
      await profileMenu.click();
      await expect(page.getByRole('menu', { name: 'Account menu' }).getByText(/^Health · \d+d left$/)).toBeVisible();
      await expect(page.getByRole('menu').getByText(/Health trial/i)).toHaveCount(0);
      await profileMenu.click();
      await page.getByRole('button', { name: 'Avatar', exact: true }).click();
      await expect(page.getByText(/Sync Google profile picture|Choose your Google account photo/)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Continue with Google/ })).toHaveCount(0);
      await page.getByRole('button', { name: /Default$/ }).click();
      await page.getByRole('button', { name: 'Save Avatar', exact: true }).click();
      await expect(page.getByText('Avatar updated successfully!')).toBeVisible();
      expect(avatarBody).toEqual({ image: 'Default' });
      await page.reload();
      await page.getByRole('button', { name: 'Avatar', exact: true }).click();
      await expect(page.getByText('Default · Initials')).toBeVisible();
      await page.goto('/profile/security');
      await page.getByRole('button', { name: 'Privacy', exact: true }).click();
      await expect(page.getByText(/Reauthenticate with the Google identity/)).toHaveCount(0);
      const button = page.getByRole('button', { name: 'Permanently delete account', exact: true });
      await expect(button).toBeDisabled();
      await page.getByLabel('Type DELETE MY KAINARA ACCOUNT').fill('DELETE MY KAINARA ACCOUNT');
      if (passwordEnabled) {
        await expect(button).toBeDisabled();
        await page.getByLabel('Current password', { exact: true }).fill('Synthetic!123');
      } else {
        await expect(page.getByLabel('Current password', { exact: true })).toHaveCount(0);
      }
      await expect(button).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await button.click();
      await expect(page).toHaveURL(/\/login\?accountDeleted=1$/);
      await expect(page.getByText('Your account and health data were deleted.')).toBeVisible();
      expect(deletionBody).toEqual({
        confirmation: 'DELETE MY KAINARA ACCOUNT',
        ...(passwordEnabled ? { password: 'Synthetic!123' } : {}),
      });
      expect((await page.context().cookies()).some((cookie) => cookie.name === 'nutrimind_session')).toBe(false);
      expect(errors).toEqual([]);
    });
  }
}
