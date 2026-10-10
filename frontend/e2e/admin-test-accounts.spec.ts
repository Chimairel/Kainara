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
  test(`admin can preview and create test RNDs at ${width}px`, async ({ page }) => {
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
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
      let data: unknown = { notifications: [], unreadCount: 0 };
      if (path.endsWith('/user/profile')) data = profile;
      if (path.endsWith('/admin/users')) data = { users: [], total: 0, totalPages: 1 };
      if (path.endsWith('/test-accounts/preview')) {
        expect(request.postDataJSON()).toMatchObject({ role: 'RND', rndStatus: 'ACTIVE', conditions: ['NONE'] });
        data = { accounts, target: 'localhost:5432/dev', previewToken: 'signed-preview' };
      } else if (path.endsWith('/test-accounts') && request.method() === 'POST') {
        expect(request.postDataJSON()).toMatchObject({ confirmedTarget: true, previewToken: 'signed-preview' });
        creations++;
        data = { accounts, newAccountPassword: 'synthetic-browser-password' };
      } else if (path.endsWith('/test-accounts'))
        data = { available: true, conditions: ['NONE', 'DIABETES'], allergens: ['NONE', 'NUTS'] };
      return route.fulfill({ headers, json: { success: true, data } });
    });
    await page.goto('/admin/users?tab=accounts');
    await page.getByRole('button', { name: 'Create test accounts' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create test accounts' });
    await dialog.getByLabel('Group name').fill('defense');
    await dialog.getByLabel('Role', { exact: true }).selectOption('RND');
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
