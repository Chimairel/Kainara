import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
  test(`admin message records and image framing ${width} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(value => localStorage.setItem('nutrimind-theme', value), theme);
    const user = { id: 'updates-browser-admin', userId: 'updates-browser-admin', name: 'Synthetic Admin', email: 'fixture@example.invalid', role: 'ADMIN', emailVerified: true, onboardingDone: true, tosAccepted: true, onboardingStatus: { acceptedCurrentConsent: true, nextPath: null } };
    const now = Math.floor(Date.now() / 1000);
    const claims = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, role: user.role, iat: now, exp: now + 3600 })).toString('base64url');
    await page.context().addCookies([{ name: 'nutrimind_session', value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`, url: new URL(testInfo.project.use.baseURL ?? 'http://localhost:3000').origin }]);
    let content = { revision: 1, draft: { asset: { kind: 'image', publicId: 'nutrimind/landing/fixture', url: '/dashboard-actual.png', bytes: 1000, duration: null }, poster: null, altText: 'Synthetic framing preview', framing: { fit: 'cover', x: 50, y: 0 } }, published: null as unknown, publishedAt: null as string | null };
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = {};
      if (path.endsWith('/user/profile')) data = user;
      else if (path.includes('/notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.endsWith('/nara-answers/activity')) data = { items: [{ id: 'record', message: 'How do I acknowledge my updated report?', mode: 'STANDARD', createdAt: '2026-10-20T02:00:00Z', user: { id: 'synthetic-member', name: 'Synthetic Member', email: 'member@example.invalid' } }], nextCursor: null, retentionDays: 30 };
      else if (path.endsWith('/nara-answers')) data = [];
      else if (path.endsWith('/website-content/gallery')) data = { items: [], nextCursor: null };
      else if (path.endsWith('/website-content/draft')) {
        const body = route.request().postDataJSON();
        content = { ...content, revision: content.revision + 1, draft: { ...content.draft, altText: body.altText, framing: body.framing } };
        data = content;
      } else if (path.endsWith('/website-content/publish')) {
        content = { ...content, revision: content.revision + 1, published: structuredClone(content.draft), publishedAt: new Date().toISOString() };
        data = content;
      } else if (path.endsWith('/website-content')) data = content;
      else if (path.endsWith('/profile/settings')) data = { requiresSignIn: false };
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/admin/nara');
    await page.getByRole('tab', { name: 'Submitted messages', exact: true }).click();
    await expect(page.getByText('How do I acknowledge my updated report?', { exact: true })).toBeVisible();
    await expect(page.getByText('member@example.invalid')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('submitted-messages.png'), fullPage: true });
    await page.goto('/admin/website');
    await page.getByLabel('Image fit', { exact: true }).selectOption('contain');
    await page.getByLabel('Vertical position').fill('75');
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    expect(content.draft.framing).toEqual({ fit: 'contain', x: 50, y: 75 });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText(/Published /).first()).toBeVisible();
    await page.getByLabel('Image fit', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('image-framing.png'), fullPage: true });
    await page.goto('/admin/profile');
    await page.getByLabel('Current Password', { exact: true }).fill('Current123!');
    await page.getByLabel('New Password', { exact: true }).fill('Replacement123!');
    await page.getByLabel('Confirm New Password', { exact: true }).fill('Replacement123!');
    await page.getByRole('button', { name: 'Update Password' }).click();
    await expect(page.getByText('Password changed. Sign in again with your new password.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
