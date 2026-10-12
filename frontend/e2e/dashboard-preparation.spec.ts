import { expect, test } from '@playwright/test';

// Synthetic API responses exercise the normal localhost:3000 application without changing Neon records.
for (const theme of ['light', 'dark'])
  for (const width of [390, 1440]) {
    test(`cooking waits for today, then future gaps use skeletons at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const tomorrowDate = new Date(`${today}T04:00:00Z`);
      tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
      const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(tomorrowDate);
      const profile = {
        id: 'preparation-preview',
        name: 'Preparation preview',
        email: 'preparation@example.invalid',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        userProfile: { weightKg: 58, targetWeightKg: 65, dailyCalorieTarget: 2000, revision: 2, safetyRevision: 1 },
        healthConditions: [],
        allergies: [],
        safetyEntries: [],
      };
      const claims = Buffer.from(
        JSON.stringify({ userId: profile.id, email: profile.email, role: profile.role, exp: 4102444800 })
      ).toString('base64url');
      await page
        .context()
        .addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
      const meal = (mealType: string) => ({
        id: mealType,
        mealName: `Sample ${mealType.toLowerCase()}`,
        mealType,
        scheduledDate: `${today}T00:00:00+08:00`,
        calories: 500,
        proteinG: 20,
        carbsG: 60,
        fatG: 15,
        status: 'APPROVED',
        mealLogs: [],
        ingredients: [],
      });
      let ready = false;
      const headers = {
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      };
      await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
          return route.fulfill({ status: 204, headers });
        let data: unknown = [],
          meta: unknown;
        if (path.endsWith('/user/profile')) data = profile;
        else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
        else if (path.endsWith('/user/membership')) data = { enabled: false };
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/checkin/status')) data = { isDue: false, hasPendingChanges: false };
        else if (path.endsWith('/water/today')) data = { totalMl: 0 };
        else if (path.endsWith('/user/meals/cycles')) data = { upcoming: null };
        else if (path.endsWith('/user/meals/current')) {
          data = [meal('BREAKFAST'), ...(ready ? [meal('DINNER')] : [])];
          const gaps = [
            ...(!ready ? [{ scheduledDate: today, mealType: 'DINNER' }] : []),
            ...['BREAKFAST', 'LUNCH', 'DINNER'].map((mealType) => ({ scheduledDate: tomorrow, mealType })),
          ];
          meta = {
            generationStatus: 'GENERATING',
            cycle: { id: 'preview-cycle', startDate: today, endDate: tomorrow },
            awaitingGenerationCount: gaps.length,
            awaitingGenerationSlots: gaps,
            pendingReview: null,
            retainedMealLogs: [{ ...meal('LUNCH'), id: 'retained-lunch', status: 'DONE' }],
            planSnapshot: { dailyCalorieTarget: 2000, dailyMacroTargets: {} },
          };
        }
        return route.fulfill({ headers, json: { success: true, data, meta } });
      });
      await page.clock.install();
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Preparing your meal plan', exact: true })).toBeVisible();
      await page.screenshot({
        path: `../backend/.local/preparation-ui/cooking-${width}-${theme}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.clock.fastForward(8_000);
      await expect(page.getByRole('heading', { name: 'Preparing your meal plan', exact: true })).toBeVisible();
      ready = true;
      await page.clock.fastForward(3_000);
      await expect(page.getByText('Eaten · previous plan', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'On your menu' })).toBeVisible();
      await page.getByRole('button', { name: 'Next day', exact: true }).click();
      for (const label of ['Breakfast', 'Lunch', 'Dinner'])
        await expect(page.getByLabel(`${label} is being prepared`, { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Preparing your meal plan', exact: true })).toHaveCount(0);
      expect(await page.locator('main').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await page.screenshot({
        path: `../backend/.local/preparation-ui/slots-${width}-${theme}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
