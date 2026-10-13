import { expect, test } from '@playwright/test';

for (const width of [320, 390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`health forms and notification layout ${width}px ${theme}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 844 });
      const owner = 'synthetic-mobile-member',
        now = new Date().toISOString();
      const claims = Buffer.from(
        JSON.stringify({
          userId: owner,
          email: 'fixture@example.invalid',
          role: 'USER',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      await page
        .context()
        .addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const errors: string[] = [],
        mutations: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let unread = 20;
      const notices = Array.from({ length: 20 }, (_, index) => ({
        id: `notice-${index}`,
        title: 'Health profile awaiting nutritionist review',
        message:
          'A nutritionist must review your declared conditions and allergies before meal candidates can be prepared. Individual meals will then need separate case approval.',
        type: 'REVIEW_REQUEST',
        targetPath: '/profile/clinical-evidence',
        isRead: false,
        createdAt: now,
      }));
      await page.route('**/api/**', async (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname;
        const headers = {
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
        };
        if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
        let data: unknown = [];
        if (request.method() !== 'GET') {
          mutations.push(path);
          if (path.includes('/notifications')) unread = 0;
        }
        if (path.endsWith('/notifications'))
          data = { notifications: notices.map((item) => ({ ...item, isRead: unread === 0 })), unreadCount: unread };
        else if (path.endsWith('/user/profile'))
          data = {
            id: owner,
            name: 'Synthetic member',
            email: 'fixture@example.invalid',
            role: 'USER',
            emailVerified: true,
            onboardingDone: true,
            tosAccepted: true,
            reportAcknowledged: true,
            onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
            nutritionReport: { acknowledgedAt: now, isStale: false },
            userProfile: { revision: 1, safetyRevision: 1 },
            healthConditions: [],
            allergies: [{ allergen: 'SHELLFISH' }],
            safetyEntries: [],
          };
        else if (path.endsWith('/user/membership')) data = { enabled: false };
        else if (path.endsWith('/clinical-profile-review/status'))
          data = { required: true, approved: false, detailsRequest: null };
        else if (path.endsWith('/user/clinical-evidence'))
          data = {
            safetyRevision: 1,
            availableAreas: ['FOOD_ALLERGY'],
            requirements: [{ area: 'FOOD_ALLERGY', state: 'READY', message: 'Your details are saved for RND review.' }],
            contexts: [
              {
                area: 'FOOD_ALLERGY',
                responses: {
                  conditionDetails: 'Synthetic shellfish restriction and recorded reaction.',
                  medications: 'None',
                  dietaryAdvice: 'Avoid declared foods',
                  recentSymptoms: 'None',
                  measurements: '',
                },
              },
            ],
            clarifications: { enabled: true, forms: [] },
            profileProposals: { enabled: true, proposals: [] },
          };
        else if (path.endsWith('/meals/readiness'))
          data = {
            canRequestPlan: false,
            title: 'Health profile awaiting nutritionist review',
            message: 'Your RND is reviewing your recorded declaration.',
          };
        else if (path.endsWith('/meals/cycles')) data = { current: null, upcoming: null };
        return route.fulfill({ status: 200, headers, json: { success: true, data } });
      });
      await page.goto('/profile/clinical-evidence');
      await page.getByRole('button', { name: /Your health details.*Allergy details/ }).click();
      await expect(page.getByRole('heading', { name: 'Allergy details' })).toBeVisible();
      const input = page.getByRole('textbox', {
        name: 'Food allergies, intolerances or avoided foods and their reactions',
      });
      expect(await input.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(
        width < 640 ? 16 : 14
      );
      await input.fill('Synthetic unsent allergy detail draft.');
      if (width < 1024) {
        await page.getByRole('button', { name: 'Back to forms' }).click();
        await page.getByRole('button', { name: /Your health details.*Allergy details/ }).click();
      }
      await expect(input).toHaveValue('Synthetic unsent allergy detail draft.');
      await page.getByRole('button', { name: 'View notifications' }).click();
      const dialog = page.getByRole('dialog', { name: 'Notifications' });
      await expect(dialog).toBeVisible();
      const heading = await dialog.getByRole('heading', { name: 'Notifications' }).boundingBox();
      const controls = await dialog.getByRole('group', { name: 'Notification controls' }).boundingBox();
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      if (width < 640) expect(controls!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
      else expect(controls!.x).toBeGreaterThanOrEqual(heading!.x + heading!.width);
      for (const control of [
        dialog.getByRole('button', { name: 'Device alerts' }),
        dialog.getByRole('switch', { name: 'Notification sound' }),
        dialog.getByRole('button', { name: 'Mark all notifications as read' }),
      ]) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      const preview = dialog.getByText(notices[0].message, { exact: true }).first();
      const previewHeight = (await preview.boundingBox())!.height;
      const lineHeight = await preview.evaluate((node) => parseFloat(getComputedStyle(node).lineHeight));
      expect(previewHeight).toBeLessThanOrEqual(lineHeight * (width < 640 ? 3 : 2) + 1);
      expect(await dialog.locator('.custom-scrollbar').evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(
        true
      );
      await page.screenshot({ path: info.outputPath(`notifications-${width}-${theme}.png`) });
      await dialog.getByRole('button', { name: 'Mark all notifications as read' }).click();
      await expect(dialog.getByText('All caught up with updates')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      const save = page.getByRole('button', { name: 'Save health details' });
      await save.scrollIntoViewIfNeeded();
      if (width < 768) {
        const saveBounds = await save.boundingBox(),
          navBounds = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
        expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(navBounds!.y);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`health-form-${width}-${theme}.png`) });
      expect(mutations.every((path) => path.includes('/notifications'))).toBe(true);
      expect(errors).toEqual([]);
    });
  }
