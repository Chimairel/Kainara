import { expect, test } from '@playwright/test';

for (const role of ['USER', 'ADMIN']) {
  for (const width of [390, 1440]) {
    for (const theme of ['light', 'dark']) {
      test(`${role} subscription history at ${width}px in ${theme}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const now = Date.now(),
          start = new Date(now - 86_400_000).toISOString(),
          end = new Date(now + 29 * 86_400_000).toISOString();
        const user = {
          id: `history-${role}`,
          name: 'Synthetic staff',
          email: 'history@example.test',
          role,
          emailVerified: true,
          onboardingDone: true,
          tosAccepted: true,
          reportAcknowledged: true,
          onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
          nutritionReport: { acknowledgedAt: start, isStale: false },
          userProfile: { revision: 1, safetyRevision: 1, planningReportVersion: 1 },
        };
        const claims = Buffer.from(
          JSON.stringify({ userId: user.id, email: user.email, role, exp: Math.floor(now / 1000) + 3600 })
        ).toString('base64url');
        await page.context().addCookies([
          {
            name: 'nutrimind_session',
            value: `fixture.${claims}.fixture`,
            url: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin,
          },
        ]);
        let mutations = 0;
        await page.route('**/api/**', async (route) => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204 });
          if (request.method() !== 'GET') mutations++;
          let data: unknown = [];
          if (path.endsWith('/user/profile')) data = user;
          else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
          else if (path.endsWith('/checkin/status')) data = { isDue: false };
          else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
          else if (path.endsWith('/audit-history')) data = { rows: [], total: 0, page: 1, totalPages: 0 };
          else if (path.endsWith('/membership-history/members'))
            data = {
              rows: [{ id: 'member', name: 'Synthetic member', email: 'member@example.test' }],
              total: 1,
              page: 1,
              totalPages: 1,
            };
          else if (path.endsWith('/user/membership'))
            data = {
              enabled: true,
              tier: 'HEALTH',
              level: 'TRIAL',
              enhanced: true,
              requiresCaseReview: false,
              healthAccess: true,
              healthUntil: end,
              serverTime: new Date(now).toISOString(),
              trialStartedAt: start,
              trialEndsAt: end,
              paidUntil: null,
              resetsAt: end,
              purchasesAvailable: false,
              autoRenews: false,
              price: null,
              usage: {
                AI_ESTIMATE: { used: 0, cap: 10, remaining: 10 },
                PLAN_REVIEW: { used: 0, cap: 1, remaining: 1 },
                OUTSIDE_REVIEW: { used: 0, cap: 1, remaining: 1 },
              },
              swaps: { used: 1, cap: 21, remaining: 20 },
              limits: {
                freeSwaps: 3,
                freeEstimates: 2,
                lifestyleSwaps: 10,
                healthSwaps: 21,
                memberEstimates: 10,
                memberPlanReviews: 1,
                memberOutsideReviews: 1,
              },
            };
          else if (path.endsWith('/membership/history') || path.endsWith('/membership-history/member')) {
            data = {
              member: { id: 'member', name: 'Synthetic member' },
              total: 2,
              page: 1,
              totalPages: 1,
              rows: [
                {
                  id: 'trial',
                  plan: 'Free Health Plan',
                  period: '30 days',
                  source: 'Introductory access',
                  status: 'ACTIVE',
                  startsAt: start,
                  endsAt: end,
                  recordedAt: start,
                  revokedAt: null,
                  supersededAt: null,
                  amountCentavos: null,
                  currency: null,
                  note: null,
                },
                {
                  id: 'paid',
                  plan: 'Health',
                  period: 'Monthly',
                  source: 'Test checkout',
                  status: 'SCHEDULED',
                  startsAt: end,
                  endsAt: new Date(now + 59 * 86_400_000).toISOString(),
                  recordedAt: start,
                  revokedAt: null,
                  supersededAt: null,
                  amountCentavos: 99900,
                  currency: 'PHP',
                  note: null,
                },
              ],
            };
          }
          await route.fulfill({ json: { success: true, data } });
        });
        await page.goto(role === 'USER' ? '/membership' : '/admin/audit');
        if (role === 'ADMIN') await page.getByRole('button', { name: 'Member subscriptions' }).click();
        const card = page.getByLabel('Subscription history', { exact: true });
        await expect(card.getByRole('heading', { name: 'Free Health Plan' })).toBeVisible();
        await expect(card.getByText('30 days · Introductory access', { exact: true })).toBeVisible();
        await expect(card.getByText('Monthly · Test checkout', { exact: true })).toBeVisible();
        await expect(card.getByText('Scheduled', { exact: true })).toBeVisible();
        if (role === 'USER') {
          const historyTop = (await card.boundingBox())!.y;
          expect((await page.getByRole('heading', { name: 'Plan Statistics' }).boundingBox())!.y).toBeLessThan(
            historyTop
          );
          expect((await page.getByRole('heading', { name: 'Plan Schedule' }).boundingBox())!.y).toBeLessThan(
            historyTop
          );
        }
        await card.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(await card.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`subscription-${role}-${width}-${theme}.png`),
          fullPage: true,
        });
        expect(mutations).toBe(0);
        expect(errors).toEqual([]);
      });
    }
  }
}
