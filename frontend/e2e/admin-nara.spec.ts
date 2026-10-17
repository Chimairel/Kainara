import { expect, test } from '@playwright/test';

for (const width of [390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`Nara answer authoring ${width} ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const user = {
        id: 'nara-browser-admin',
        name: 'Synthetic Admin',
        email: 'fixture@example.invalid',
        role: 'ADMIN',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      };
      const now = Math.floor(Date.now() / 1000),
        claims = Buffer.from(
          JSON.stringify({ userId: user.id, email: user.email, role: user.role, iat: now, exp: now + 3600 })
        ).toString('base64url');
      await page.context().addCookies([
        {
          name: 'nutrimind_session',
          value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`,
          url: new URL(testInfo.project.use.baseURL ?? 'http://localhost:3000').origin,
        },
      ]);
      let entry: Record<string, unknown> | null = null;
      let writes = 0;
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        let data: unknown = {};
        if (path.endsWith('/user/profile')) data = user;
        else if (path.includes('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/admin/nara-answers')) {
          if (route.request().method() === 'GET') data = entry ? [entry] : [];
          else {
            writes++;
            entry = {
              id: 'nara-answer-fixture',
              revision: 1,
              draft: route.request().postDataJSON(),
              published: null,
              publishedAt: null,
            };
            data = entry;
          }
        } else if (path.endsWith('/publish') && entry) {
          writes++;
          entry = { ...entry, revision: 2, published: entry.draft, publishedAt: new Date().toISOString() };
          data = entry;
        }
        await route.fulfill({ json: { success: true, data } });
      });
      await page.goto('/admin/nara');
      await expect(page.getByRole('heading', { name: 'Nara answers', exact: true })).toBeVisible();
      await page.getByLabel('Topic', { exact: true }).selectOption('CONVERSATION');
      await expect(page.getByText(/This does not expand what \/ai can answer/)).toBeVisible();
      await page.getByLabel('Question', { exact: true }).fill('pasar daw ta bai');
      await page.getByLabel(/Alternative questions/).fill('nara, pasar daw ta');
      const answer = 'syur uypchs ✌️ 😭';
      await page.getByLabel('Instant answer').fill(answer);
      await page.getByRole('button', { name: 'Save draft' }).click();
      await expect(page.getByText('Draft saved. Publish it when the answer is ready.')).toBeVisible();
      await page.getByLabel('Test question').fill('NARA, pasar daw ta!');
      await page.getByRole('button', { name: 'Preview answer' }).click();
      await expect(page.getByRole('status').filter({ hasText: answer })).toBeVisible();
      expect(writes).toBe(1);
      await page.getByRole('button', { name: 'Publish answer', exact: true }).click();
      await expect(page.getByText(/Published. Nara can now answer/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
      expect(writes).toBe(2);
      expect(entry).toMatchObject({ draft: { category: 'CONVERSATION' }, published: { category: 'CONVERSATION' } });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('nara-answers.png'), fullPage: true });
    });
  }
