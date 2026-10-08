import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    for (const view of ['audit', 'popularity']) {
      test(`admin meal ${view} at ${width}px in ${theme}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const now = Date.now(),
          date = new Date(now).toISOString();
        const user = {
          id: 'meal-log-admin',
          name: 'Synthetic admin',
          email: 'audit@example.test',
          role: 'ADMIN',
          emailVerified: true,
          onboardingDone: true,
          tosAccepted: true,
          reportAcknowledged: true,
          onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
          nutritionReport: { acknowledgedAt: date, isStale: false },
          userProfile: { revision: 1, safetyRevision: 1, planningReportVersion: 1 },
        };
        const claims = Buffer.from(
          JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: Math.floor(now / 1000) + 3600 })
        ).toString('base64url');
        await page.context().addCookies([
          {
            name: 'nutrimind_session',
            value: `fixture.${claims}.fixture`,
            url: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin,
          },
        ]);
        const snapshot = {
          mealName: 'Chicken Tinola',
          source: 'USER_LOGGED',
          mealType: 'LUNCH',
          status: 'DONE',
          calories: 420,
          mealDate: date,
          dataSource: 'USER_REPORTED',
        };
        const record = {
          logId: 'outside-fixture',
          memberId: 'fixture-member',
          memberName: 'Synthetic member',
          snapshot,
          ageGroup: '18-24',
          membership: 'FREE_HEALTH',
          contextVersion: 'RECORDED_CONTEXT_V1',
          firstRecordedAt: date,
          lastActionAt: date,
          deleted: false,
        };
        let mutations = 0;
        await page.route('**/api/**', async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            path = url.pathname;
          if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204 });
          if (request.method() !== 'GET') mutations++;
          let data: unknown = [];
          if (path.endsWith('/user/profile')) data = user;
          else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
          else if (path.endsWith('/checkin/status')) data = { isDue: false };
          else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
          else if (path.endsWith('/audit-history')) data = { rows: [], total: 0, page: 1, totalPages: 0 };
          else if (path.endsWith('/meal-logs/popularity'))
            data = {
              rows: [
                {
                  key: 'library:tinola',
                  name: 'Chicken Tinola',
                  eaten: 6,
                  members: 5,
                  repeatEaters: 1,
                  skipped: 1,
                  eatenPercentage: 85.7,
                },
              ],
              total: 1,
              page: 1,
              totalPages: 1,
              unmatchedItems: 2,
              legacyLogs: 3,
              minimumCohort: 5,
            };
          else if (path.endsWith('/meal-logs/outside-fixture'))
            data = {
              record,
              items: [],
              events: [
                {
                  id: 'rnd-correction',
                  sequence: '2',
                  entityType: 'ITEM',
                  action: 'UPDATE',
                  actorName: 'Synthetic reviewer',
                  actorRole: 'NUTRITIONIST',
                  occurredAt: date,
                  reason: 'Corrected portion using recorded evidence.',
                  before: { name: 'Chicken Tinola', calories: 440 },
                  after: { name: 'Chicken Tinola', calories: 420 },
                },
              ],
              total: 1,
              page: 1,
              totalPages: 1,
            };
          else if (path.endsWith('/meal-logs')) data = { rows: [record], total: 1, page: 1, totalPages: 1 };
          await route.fulfill({ json: { success: true, data } });
        });
        await page.goto(view === 'audit' ? '/admin/audit?view=meal-logs' : '/admin/overview?tab=meal-popularity');
        if (view === 'popularity') {
          await expect(page.getByRole('heading', { name: '1. Chicken Tinola' })).toBeVisible();
          await expect(page.getByText('85.7%')).toBeVisible();
          const link = page.getByRole('link', { name: 'View meal logs →' });
          await expect(link).toHaveAttribute('href', /recipeKey=library%3Atinola/);
          await page.getByLabel('Recorded age group').click();
          await page.getByRole('option', { name: '18-24', exact: true }).click();
          await page.getByRole('button', { name: 'Apply filters' }).click();
          await expect(page.getByText(/at least 5 distinct eaters/)).toBeVisible();
          await page.getByRole('heading', { name: '1. Chicken Tinola' }).scrollIntoViewIfNeeded();
        } else {
          await page.getByRole('button', { name: 'Details', exact: true }).click();
          await page.getByLabel('Meal log change').click();
          await page.getByRole('option', { name: /Updated dish/ }).click();
          await expect(page.getByText('Corrected portion using recorded evidence.')).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Before', exact: true })).toBeVisible();
          await expect(page.getByText('440', { exact: true })).toBeVisible();
          await expect(page.getByText('420', { exact: true })).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`meal-${view}-${width}-${theme}.png`), fullPage: true });
        expect(mutations).toBe(0);
        expect(errors).toEqual([]);
      });
    }
  }
}
