import { expect, test } from '@playwright/test';
const accounts = [
  {
    id: 'devfixture_defense_rnd-1',
    email: 'qa-defense-rnd-1@example.test',
    name: '[TEST defense] RND 1',
    role: 'NUTRITIONIST',
    exists: false,
  },
];
for (const width of [390, 1440]) {
  for (const role of ['RND', 'USER']) {
    test(`admin can preview and create test ${role} accounts at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const profile = {
        id: 'test-tool-admin',
        name: 'Admin',
        email: 'admin@example.test',
        role: 'ADMIN',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
      };
      const claims = Buffer.from(
        JSON.stringify({
          userId: profile.id,
          email: profile.email,
          role: 'ADMIN',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      await page.context().addCookies([
        {
          name: 'nutrimind_session',
          value: `fixture.${claims}.fixture`,
          url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        },
      ]);
      const headers = {
        'Access-Control-Allow-Origin': process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      };
      let creations = 0;
      const rows = accounts.map((account) => ({ ...account, role: role === 'USER' ? 'USER' : 'NUTRITIONIST' }));
      await page.route('**/api/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
        let data: unknown = { notifications: [], unreadCount: 0 };
        if (path.endsWith('/user/profile')) data = profile;
        if (path.endsWith('/admin/users')) data = { users: [], total: 0, totalPages: 1 };
        if (path.endsWith('/test-accounts/preview')) {
          expect(request.postDataJSON()).toMatchObject({ role, rndStatus: 'ACTIVE', conditions: ['NONE'] });
          if (role === 'USER')
            expect(request.postDataJSON().profile).toMatchObject({
              age: 45,
              weightKg: 72,
              targetWeightKg: 65,
              goal: 'LOSE_WEIGHT',
              activityLevel: 'ACTIVE',
              dietaryPreference: 'PESCATARIAN',
              shoppingDayOfWeek: 2,
            });
          else expect(request.postDataJSON()).not.toHaveProperty('profile');
          data = { accounts: rows, target: 'localhost:5432/dev', previewToken: 'signed-preview' };
        } else if (path.endsWith('/test-accounts') && request.method() === 'POST') {
          expect(request.postDataJSON()).toMatchObject({ confirmedTarget: true, previewToken: 'signed-preview' });
          if (role === 'USER')
            expect(request.postDataJSON().profile).toMatchObject({
              age: 45,
              weightKg: 72,
              targetWeightKg: 65,
              goal: 'LOSE_WEIGHT',
              activityLevel: 'ACTIVE',
              shoppingDayOfWeek: 2,
            });
          creations++;
          data = { accounts: rows, newAccountPassword: 'synthetic-browser-password' };
        } else if (path.endsWith('/test-accounts'))
          data = { available: true, conditions: ['NONE', 'DIABETES'], allergens: ['NONE', 'NUTS'] };
        return route.fulfill({ headers, json: { success: true, data } });
      });
      await page.goto('/admin/users?tab=accounts');
      await page.getByRole('button', { name: 'Create test accounts' }).click();
      const dialog = page.getByRole('dialog', { name: 'Create test accounts' });
      await dialog.getByLabel('Group name').fill('defense');
      await dialog.getByLabel('Role', { exact: true }).selectOption(role);
      if (role === 'USER') {
        await dialog.getByLabel('Age', { exact: true }).fill('45');
        await dialog.getByLabel('Current weight (kg)', { exact: true }).fill('72');
        await expect(dialog.getByLabel('Target weight (kg)')).toHaveValue('72');
        await dialog.getByLabel('Goal', { exact: true }).selectOption('LOSE_WEIGHT');
        await dialog.getByLabel('Target weight (kg)').fill('65');
        await dialog.getByLabel('Activity level', { exact: true }).selectOption('ACTIVE');
        await dialog.getByLabel('Dietary preference').selectOption('PESCATARIAN');
        await dialog.getByLabel('Shopping day').selectOption('2');
        await dialog.getByLabel('Age', { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: test.info().outputPath('member-profile-fields.png') });
      }
      await dialog.getByRole('button', { name: 'Preview accounts' }).click();
      await expect(dialog.getByText('Database: localhost:5432/dev')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Create accounts' })).toBeDisabled();
      await dialog.getByLabel(/I confirm this is the development database/).check();
      await dialog.getByRole('button', { name: 'Create accounts' }).click();
      await expect(dialog.getByLabel('Password for newly created accounts')).toHaveValue('synthetic-browser-password');
      expect(creations).toBe(1);
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: test.info().outputPath('test-account-dialog.png') });
      await dialog.getByRole('button', { name: 'Done' }).click();
      await expect(dialog).not.toBeVisible();
    });
  }
}
