import { expect, test } from '@playwright/test';

for (const role of ['ADMIN', 'NUTRITIONIST'] as const) {
  for (const width of [320, 390, 1440]) {
    test(`${role} expands recorded food and retries at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const rolePath = role.toLowerCase();
      const user = {
        id: `audit-${rolePath}`,
        name: 'Synthetic staff',
        email: 'audit@example.invalid',
        role,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        nutritionReport: null,
      };
      const claims = Buffer.from(
        JSON.stringify({ userId: user.id, email: user.email, role, exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      await page.context().addCookies([
        {
          name: 'nutrimind_session',
          value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`,
          url: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin,
        },
      ]);
      const row = {
        id: 'food-review',
        occurredAt: '2026-10-05T01:00:00Z',
        actor: 'Synthetic reviewer',
        role: 'NUTRITIONIST',
        action: 'Corrected outside food',
        subject: 'Outside food log',
        outcome: 'Completed',
      };
      let detailReads = 0;
      let failDetails = true;
      let mutations = 0;
      let mineReads = 0;
      await page.route('**/api/**', async (route) => {
        const request = route.request();
        if (!['GET', 'OPTIONS'].includes(request.method())) mutations++;
        const url = new URL(request.url());
        const path = url.pathname;
        let data: unknown = null;
        if (path.endsWith('/user/profile')) data = user;
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/review-work-counts')) data = { meal: 0, case: 0, profile: 0, audit: 0 };
        else if (path.endsWith('/audit-history')) {
          if (url.searchParams.get('mine') === 'true') mineReads++;
          data = { rows: [row], total: 1, page: 1, totalPages: 1 };
        } else if (path.endsWith('/audit-history/food-review')) {
          detailReads++;
          if (failDetails) {
            await route.fulfill({ status: 503, json: { success: false, error: 'Details temporarily unavailable.' } });
            return;
          }
          data = {
            facts: [{ label: 'Revision', value: '2' }],
            reason: 'Checked the serving size.',
            food: {
              name: 'Sardines with egg',
              portionGrams: 150,
              source: 'NUTRITIONIST_REVIEWED',
              nutritionStatus: 'CORRECTED',
              ingredients: [
                { name: 'sardines', quantity: null, unit: null },
                { name: 'egg', quantity: 1, unit: 'piece' },
              ],
            },
            previous: { calories: 320, proteinG: 22, carbsG: 0, fatG: 12 },
            effective: { calories: 300, proteinG: 24, carbsG: 0, fatG: null },
          };
        }
        await route.fulfill({ json: { success: true, data } });
      });
      await page.goto(`/${rolePath}/audit`);
      if (role === 'ADMIN') await page.getByRole('button', { name: 'RND history' }).click();
      await expect(page.getByText('Synthetic reviewer', { exact: true })).toBeVisible();
      expect(detailReads).toBe(0);
      const button = page.getByRole('button', { name: /^Details:/ });
      await button.click();
      await expect(page.getByRole('alert').filter({ hasText: 'Details temporarily unavailable.' })).toBeVisible();
      failDetails = false;
      await page.getByRole('button', { name: 'Retry details' }).click();
      const panel = page.getByRole('region', { name: 'Corrected outside food details' });
      await expect(panel.getByRole('heading', { name: 'Sardines with egg' })).toBeVisible();
      await expect(panel.getByText('Not recorded', { exact: true })).toBeVisible();
      await expect(panel.getByText('egg · 1 piece')).toBeVisible();
      const box = await button.boundingBox();
      expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`audit-${rolePath}-${width}.png`), fullPage: true });
      await button.click();
      await expect(panel).toBeHidden();
      if (role === 'NUTRITIONIST') {
        await page.getByRole('combobox', { name: 'Staff filter' }).click();
        await page.getByRole('option', { name: 'Me', exact: true }).click();
        await expect.poll(() => mineReads).toBeGreaterThan(0);
        await expect(page.getByRole('link', { name: 'Reviewed plans' })).toBeVisible();
      }
      expect(errors).toEqual([]);
      expect(mutations).toBe(0);
    });
  }
}

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`admin case report uses saved changes at ${width}px in ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const user = {
        id: 'synthetic-admin',
        name: 'Synthetic admin',
        email: 'audit@example.invalid',
        role: 'ADMIN',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        nutritionReport: null,
      };
      const claims = Buffer.from(
        JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      await page.context().addCookies([
        {
          name: 'nutrimind_session',
          value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`,
          url: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin,
        },
      ]);
      let reads = 0;
      let mutations = 0;
      await page.route('**/api/**', async (route) => {
        const request = route.request();
        if (!['GET', 'OPTIONS'].includes(request.method())) mutations++;
        const path = new URL(request.url()).pathname;
        let data: unknown = null;
        if (path.endsWith('/user/profile')) data = user;
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/audit-history'))
          data = {
            rows: [
              {
                id: 'case',
                occurredAt: '2026-10-05T01:00:00Z',
                actor: 'Synthetic RND',
                role: 'NUTRITIONIST',
                action: 'Approved meal plan',
                subject: 'Synthetic member case',
                outcome: 'Approved',
              },
            ],
            total: 1,
            page: 1,
            totalPages: 1,
          };
        else if (path.endsWith('/audit-history/case'))
          data = {
            facts: [{ label: 'Revision', value: '2' }],
            reason: 'Saved case approval.',
            food: null,
            previous: null,
            effective: null,
          };
        else if (path.endsWith('/case/review-context')) {
          reads++;
          data = {
            currentProfile: {
              name: 'Synthetic member',
              userProfile: {
                age: 22,
                biologicalSex: 'MALE',
                heightCm: 160,
                weightKg: 57,
                targetWeightKg: 65,
                goal: 'BUILD_MUSCLE',
                activityLevel: 'ACTIVE',
                dietaryPreference: 'OMNIVORE',
                planningReportVersion: 1,
                revision: 2,
                safetyRevision: 1,
                firstReportAcknowledgedAt: '2026-10-05T20:32:22.051Z',
              },
              healthConditions: [{ condition: 'HEART_DISEASE' }],
              allergies: [],
            },
            reviewedSnapshot: { profile: { age: 21, weightKg: 55 } },
            decisions: [
              {
                id: 'old',
                decision: 'APPROVED',
                submittedAt: '2026-10-05T01:00:00Z',
                rationale: 'Original saved findings.',
                evidenceSnapshot: { dailyCalorieTarget: 1800, sodiumMg: null },
              },
              {
                id: 'new',
                decision: 'REJECTED',
                submittedAt: '2026-10-06T01:00:00Z',
                rationale: 'Later saved concern.',
                evidenceSnapshot: { dailyCalorieTarget: 2200 },
              },
            ],
            clinicalEvidence: [],
            historicalInformation: null,
          };
        }
        await route.fulfill({ json: { success: true, data } });
      });
      await page.goto('/admin/audit');
      await page.getByRole('button', { name: 'RND history' }).click();
      await page.getByRole('button', { name: /^Details:/ }).click();
      await page.getByRole('button', { name: 'Open related review details' }).click();
      const picker = page.getByRole('combobox', { name: 'Case record' });
      await expect(picker).toHaveText(/Change 2/);
      await picker.click();
      await page.getByRole('option', { name: /^Change 1/ }).click();
      await expect(page.getByText('Original saved findings.', { exact: true })).toBeVisible();
      await expect(page.getByText('2200', { exact: true })).toHaveCount(0);
      await picker.click();
      await page.getByRole('option', { name: /^Current member profile/ }).click();
      await expect(page.getByRole('article', { name: 'Current member profile' })).toBeVisible();
      await expect(page.getByText('Height (cm)', { exact: true })).toBeVisible();
      await expect(page.getByText('Build muscle', { exact: true })).toBeVisible();
      const reader = page.getByRole('region', { name: 'Admin review canvas', exact: true });
      await reader.scrollIntoViewIfNeeded();
      expect(await reader.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`case-report-${width}-${theme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Expand canvas' }).click();
      const fullscreen = page.getByRole('dialog', { name: 'Case review record — fullscreen' });
      await expect(fullscreen).toBeVisible();
      await expect(fullscreen.getByRole('article', { name: 'Current member profile' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(picker).toHaveText(/Current member profile/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(reads).toBe(1);
      expect(mutations).toBe(0);
      expect(errors).toEqual([]);
    });
  }
}
