import { expect, test } from '@playwright/test';

for (const width of [390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`batch editor, image and retained authoring drafts ${width} ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const user = {
        id: 'batch-editor-admin',
        name: 'Synthetic Admin',
        email: 'batch@example.invalid',
        role: 'ADMIN',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      };
      const now = Math.floor(Date.now() / 1000);
      const claims = Buffer.from(
        JSON.stringify({ userId: user.id, email: user.email, role: user.role, iat: now, exp: now + 3600 })
      ).toString('base64url');
      await page.context().addCookies([
        {
          name: 'nutrimind_session',
          value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`,
          url: new URL(process.env.PLAYWRIGHT_BASE_URL!).origin,
        },
      ]);
      const batch = {
        format: 'KAINARA_MEALS_V1',
        meals: [
          {
            mealName: 'Chicken and rice',
            mealType: 'LUNCH',
            summary: 'Measured chicken with rice for this browser fixture.',
            nutritionServingDescription: 'One plate',
            calories: 324.5,
            proteinG: 24.75,
            carbsG: 44.55,
            fatG: 5.3,
            ingredients: [{ foodItemId: 'fixture-rice', gramsPerServing: 150 }],
            image: {
              url: 'https://res.cloudinary.com/fixture/image/upload/chicken.jpg',
              altText: 'A representative chicken and rice meal',
              imageKind: 'REPRESENTATIVE',
              creator: 'Fixture photographer',
              licenseCode: 'OWNED',
            },
          },
        ],
      };
      let imports = 0;
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        let data: unknown = {};
        if (path.endsWith('/user/profile')) data = user;
        else if (path.includes('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/admin/library')) data = { meals: [], total: 0 };
        else if (path.endsWith('/admin/meals')) data = { items: [], total: 0 };
        else if (path.endsWith('/batch/preview'))
          data = {
            previewId: 'fixture-preview',
            valid: true,
            alreadyImported: false,
            results: [{ index: 0, mealName: 'Chicken and rice', errors: [] }],
          };
        else if (path.endsWith('/batch/import')) {
          imports++;
          data = { meals: [{ id: 'draft' }], replayed: false };
        }
        await route.fulfill({ json: { success: true, data } });
      });
      await page.route('**/_next/image?*', (route) =>
        route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#d9b78a"/><ellipse cx="300" cy="220" rx="210" ry="110" fill="#faf8f5"/><ellipse cx="240" cy="220" rx="90" ry="65" fill="#f3efe8"/><ellipse cx="365" cy="190" rx="75" ry="45" fill="#a96c3a"/></svg>',
        })
      );
      await page.goto('/admin/meals?tab=batch');
      await expect(page.getByRole('tab', { name: 'Author meals', exact: true })).toHaveAttribute(
        'data-state',
        'active'
      );
      await expect(page.getByRole('tab', { name: 'Batch JSON', exact: true })).toHaveAttribute('data-state', 'active');
      await page.getByRole('textbox', { name: 'Recipe JSON' }).fill(JSON.stringify(batch));
      await page.getByRole('button', { name: 'Format JSON' }).click();
      await expect(page.getByRole('textbox', { name: 'Recipe JSON' })).toHaveValue(JSON.stringify(batch, null, 2));
      expect(
        await page
          .getByRole('textbox', { name: 'Recipe JSON' })
          .evaluate((element) => ({ color: getComputedStyle(element).color, scrollLeft: element.scrollLeft }))
      ).toEqual({ color: 'rgba(0, 0, 0, 0)', scrollLeft: 0 });
      await expect(page.getByRole('img', { name: batch.meals[0].image.altText })).toBeVisible();
      await page.getByRole('button', { name: 'Preview and validate' }).click();
      await expect(page.getByText('Ready to import as unverified drafts')).toBeVisible();
      await page.getByRole('textbox', { name: 'Recipe JSON' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true });
      await page.getByRole('tab', { name: 'Single meal', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Author meal drafts' })).toBeVisible();
      await page.getByRole('tab', { name: 'Batch JSON', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Recipe JSON' })).toHaveValue(JSON.stringify(batch, null, 2));
      await page.getByRole('button', { name: 'Import all as drafts' }).click();
      await expect(
        page.getByText('1 unverified drafts imported. RND review is required before member use.')
      ).toBeVisible();
      expect(imports).toBe(1);
      await page.getByRole('textbox', { name: 'Recipe JSON' }).fill('{ invalid');
      await expect(page.getByRole('button', { name: 'Import all as drafts' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Preview and validate' }).click();
      await expect(page.getByText(/Invalid JSON\./)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
  }
