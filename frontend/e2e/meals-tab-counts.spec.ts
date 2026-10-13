import { expect, test } from '@playwright/test';

// Shared frontend at 3000; every API is intercepted with synthetic data.
for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`Meals counts visible before entering tabs ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((theme) => localStorage.setItem('nutrimind-theme', theme), theme);
    const user = { id: 'count-preview', name: 'Synthetic count preview', email: 'counts@example.invalid', role: 'USER',
      emailVerified: true, onboardingDone: true, tosAccepted: true, reportAcknowledged: true,
      onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      userProfile: { revision: 1, safetyRevision: 1, dailyCalorieTarget: 2000 } };
    const claims = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })).toString('base64url');
    await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
    const reads: string[] = [];
    let fail = true;
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
      if (route.request().method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
      reads.push(path);
      let data: unknown = [], meta: unknown = {};
      if (path.endsWith('/user/profile')) data = user;
      else if (path.endsWith('/user/membership')) data = { enabled: false };
      else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.endsWith('/history/count')) data = { total: 8 };
      else if (path.endsWith('/verified-recipes/summary')) {
        if (fail) { fail = false; return route.fulfill({ headers, json: { success: false, error: 'Count unavailable' } }); }
        data = { total: 1960, restrictedProfile: false };
      }
      else if (path.endsWith('/meals/workspace')) {
        const now = new Date(); const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
        data = ['BREAKFAST', 'LUNCH', 'DINNER'].map((mealType, i) => ({ id: `slot-${i}`, mealName: `Synthetic ${mealType.toLowerCase()} meal`,
          mealType, status: 'APPROVED', scheduledDate: date, calories: 600, proteinG: 20, carbsG: 80, fatG: 15 }));
        meta = { cycles: { current: { id: 'cycle', status: 'ACTIVE', startDate: date, endDate: date }, upcoming: null }, generationStatus: { current: 'COMPLETE' } };
      }
      return route.fulfill({ headers, json: { success: true, data, meta } });
    });
    await page.goto('/meals');
    const tabs = page.getByRole('navigation', { name: 'Meal workspace sections' });
    await expect(tabs.getByRole('button', { name: /History/ })).toContainText('8');
    await expect(page.getByRole('button', { name: 'Retry counts' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry counts' }).click();
    await expect(tabs.getByRole('button', { name: /Library/ })).toContainText('1960');
    await expect(page.getByRole('button', { name: 'Retry counts' })).toBeHidden();
    await expect(tabs.getByRole('button', { name: /Plan/ })).toHaveAttribute('aria-current', 'page');
    expect(reads.some((path) => path.endsWith('/history') || path.endsWith('/compatible-library') || path.endsWith('/verified-recipes'))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await tabs.screenshot({ path: `../backend/.local/meals-tab-counts/tabs-${width}-${theme}.png` });
  });
}
