import { expect, test } from '@playwright/test';

// UI fixtures only. Actual authorization/SQL coverage lives in the guarded backend acceptance script.
for (const width of [390, 1440]) {
  for (const role of ['ADMIN', 'NUTRITIONIST'] as const) {
    test(`specialist review controls for ${role} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
      const user = {
        id: `routing-${role}`,
        name: 'Synthetic Reviewer',
        email: 'routing@example.invalid',
        role,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      };
      const payload = Buffer.from(
        JSON.stringify({ userId: user.id, email: user.email, role, exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      await page
        .context()
        .addCookies([{ name: 'nutrimind_session', value: `fixture.${payload}.fixture`, url: origin }]);
      const professional = {
        id: 'routing-rnd',
        user: { id: 'rnd-user', name: 'Synthetic RND', email: 'rnd@example.invalid', role: 'NUTRITIONIST' },
        prcLicenseNumber: 'SYNTHETIC',
        prcLicenseExpiry: '2031-01-01',
        isVerified: true,
        totalVerified: 0,
        verifiedExpertise: ['HEART_CONDITION'],
        verifiedExperienceYears: 12,
        expertiseEvidence: 'Synthetic verified work history.',
      };
      let enabled = false;
      let expertiseBody: unknown;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const method = route.request().method();
        const headers = {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, PATCH, PUT, OPTIONS',
        };
        if (method === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
        let data: unknown = [];
        if (path.endsWith('/user/profile')) data = user;
        if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        if (path.endsWith('/admin/users')) data = { users: [], total: 0, page: 1, totalPages: 1 };
        if (path.endsWith('/admin/nutritionists')) data = [professional];
        if (path.endsWith('/nutritionist/profile')) data = professional;
        if (path.endsWith('/admin/review-routing')) {
          if (method === 'PATCH') enabled = route.request().postDataJSON().enabled;
          data = { config: { enabled }, episodes: [] };
        }
        if (path.endsWith('/review-routing/expertise/routing-rnd')) {
          expertiseBody = route.request().postDataJSON();
          data = {};
        }
        return route.fulfill({ headers, json: { success: true, data } });
      });
      if (role === 'ADMIN') {
        await page.goto('/admin/users?tab=nutritionists');
        await page.getByRole('button', { name: /Professional records/ }).click();
        const toggle = page.getByRole('switch', { name: 'Enable specialist review priority' });
        await expect(toggle).toBeEnabled();
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-checked', 'true');
        await page.getByText('Verify review expertise', { exact: true }).click();
        await page.getByLabel('Verified years of experience').fill('14');
        await page
          .getByLabel('Verification evidence or revocation reason')
          .fill('Synthetic qualification reference checked.');
        await page.getByRole('button', { name: 'Save verified expertise' }).click();
        await expect
          .poll(() => expertiseBody)
          .toEqual({
            conditions: ['HEART_CONDITION'],
            experienceYears: 14,
            evidence: 'Synthetic qualification reference checked.',
          });
      } else {
        await page.goto('/nutritionist/profile');
        await expect(page.getByRole('heading', { name: 'Review routing', exact: true })).toBeVisible();
        await expect(page.getByRole('switch', { name: 'Accepting new reviews' })).toHaveCount(0);
        await expect(page.getByText(/Cases appear automatically for every eligible RND/)).toBeVisible();
        await expect(page.getByText('Heart health nutrition', { exact: true })).toBeVisible();
        await expect(page.getByText('12 verified years of experience', { exact: true })).toBeVisible();
      }
      await page.screenshot({ path: testInfo.outputPath(`routing-${role}-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
