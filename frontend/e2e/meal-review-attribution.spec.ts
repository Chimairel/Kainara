import { expect, test } from '@playwright/test';

for (const width of [400, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`meal details show recorded review attribution at ${width}px in ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const user = {
        id: 'attribution-fixture',
        name: 'Preview Member',
        email: 'preview@example.invalid',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        userProfile: { dailyCalorieTarget: 2000, revision: 1, safetyRevision: 1 },
        healthConditions: [],
        allergies: [],
        safetyEntries: [],
      };
      const claims = Buffer.from(
        JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })
      ).toString('base64url');
      await page.context().addCookies([
        {
          name: 'nutrimind_session',
          value: `fixture.${claims}.fixture`,
          url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        },
      ]);
      const date = new Date().toISOString();
      const cycle = { id: 'attribution-cycle', planType: 'WEEKLY', startDate: date, endDate: date, status: 'ACTIVE' };
      let scope: 'MEMBER' | 'RECIPE' | null = null;
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.includes('/live/') || route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const meal = {
          id: 'attribution-meal',
          mealName: 'Creamy Chicken Sopas',
          mealType: 'LUNCH',
          scheduledDate: date,
          planType: 'WEEKLY',
          status: 'APPROVED',
          calories: 500,
          proteinG: 25,
          carbsG: 60,
          fatG: 18,
          ingredients: [],
          mealLogs: [],
          verifier: scope ? { name: 'Recorded Reviewer', reviewScope: scope } : null,
          nutritionistNote: scope ? 'Recorded portion review.' : null,
        };
        if (path.endsWith('/meals/workspace'))
          return route.fulfill({
            json: {
              success: true,
              data: [meal],
              meta: {
                pendingReview: null,
                cycles: { current: cycle, upcoming: null },
                generationStatus: { current: 'COMPLETED', upcoming: null },
                awaitingGeneration: { current: 0, upcoming: 0 },
              },
            },
          });
        let data: unknown = [];
        if (path.endsWith('/user/profile')) data = user;
        else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
        else if (path.endsWith('/user/membership')) data = { enabled: false };
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/checkin/status')) data = { isDue: false, hasPendingChanges: false };
        return route.fulfill({ json: { success: true, data } });
      });
      for (const reviewScope of [null, 'RECIPE', 'MEMBER'] as const) {
        scope = reviewScope;
        await page.goto('/meals');
        await page.getByRole('button', { name: 'Open Creamy Chicken Sopas details' }).click();
        const attribution = page.getByRole('region', { name: 'Meal review attribution' });
        await expect(attribution).toBeVisible();
        const bounds = (await attribution.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(await attribution.evaluate((element) => element.parentElement?.firstElementChild === element)).toBe(
          true
        );
        if (!reviewScope) {
          await expect(attribution).toContainText('No RND review recorded for this meal.');
          await expect(attribution.getByRole('button')).toHaveCount(0);
        } else {
          await expect(attribution).toContainText(reviewScope === 'MEMBER' ? 'Your meal approval' : 'Recipe review');
          await page.screenshot({ path: testInfo.outputPath(`${reviewScope}-meal.png`) });
          await attribution.getByRole('button', { name: /Reviewed by Recorded Reviewer, RND/ }).click();
          const credentials = page.getByRole('dialog', { name: 'Credentials of Recorded Reviewer' });
          await expect(credentials).toBeVisible();
          await expect(credentials).toContainText('Not recorded');
          await expect(credentials).not.toContainText('Clinical Dietetics & Nutrition');
          await page.getByRole('button', { name: 'Close credential details' }).click();
          await expect(attribution).toBeVisible();
        }
        await expect(page.getByRole('button', { name: 'Mark as eaten' })).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }
}
