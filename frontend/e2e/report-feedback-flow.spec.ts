import { expect, test } from '@playwright/test';

// Browser presentation fixtures only; every API request is intercepted.
for (const width of [390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`report canvas and saved-food feedback ${width} ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const now = new Date().toISOString();
      const owner = 'report-ui-fixture';
      const profile = {
        id: owner,
        name: 'Synthetic Member',
        email: 'fixture@example.invalid',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        userProfile: {
          revision: 0,
          safetyRevision: 0,
          age: 30,
          biologicalSex: 'MALE',
          heightCm: 170,
          weightKg: 65,
          goal: 'MAINTAIN',
          activityLevel: 'LIGHTLY_ACTIVE',
          dailyCalorieTarget: 2155,
        },
        healthConditions: [],
        allergies: [],
        safetyEntries: [],
        nutritionReport: { acknowledgedAt: now, isStale: false },
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: '/dashboard' },
      };
      const report = {
        id: 'report',
        userId: owner,
        version: 1,
        profileRevision: 0,
        isStale: false,
        generatedAt: now,
        acknowledgedAt: now,
        profileSummary: [
          { label: 'Name', value: 'Synthetic Member' }, { label: 'Age', value: '30 years' },
          { label: 'Biological sex', value: 'Male' }, { label: 'Height', value: '170 cm' },
          { label: 'Current weight', value: '65 kg' }, { label: 'Goal', value: 'Maintain' },
          { label: 'Activity level', value: 'Lightly active' }, { label: 'Meal times', value: 'Not recorded' },
        ],
        generalSummary:
          'The saved meal-planning energy estimate is 2,155 kcal/day. Population references and individual meal review are separate.',
        reportPolicyVersion: 'NUTRITION_GUIDANCE_DETERMINISTIC_V1',
        referenceItems: [],
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        basedOnConditions: [],
        basedOnAllergies: [],
        calorieCalculation: {
          rawBmr: 1567.5,
          rawTdee: 2155.3125,
          bmr: 1568,
          tdee: 2155,
          sexTerm: 5,
          activityMultiplier: 1.375,
          goalAdjustment: 0,
          minimumDailyCalories: 500,
          dailyCalorieTarget: 2155,
          recordedTarget: 2155,
          inputs: profile.userProfile,
          sourceTitle: 'A new predictive equation for resting energy expenditure in healthy individuals',
          sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
        },
        planningTargets: {
          calories: 2155,
          proteinG: 67,
          carbsG: 337,
          fatG: 60,
          explanation: 'General planning point; these are estimated daily amounts.',
        },
        foodGuidance: {
          formatVersion: 1,
          avoid: [],
          limit: [],
          choose: [
            {
              name: 'Vegetables and fruit',
              reason: 'Include variety in the recorded meal pattern.',
              tip: 'Use familiar ingredients.',
              sourceCode: 'FNRI',
            },
          ],
          discuss: [],
          sources: [],
        },
      };
      const food = {
        id: 'food',
        name: 'Synthetic rice bowl',
        currentRevision: 0,
        includedInTotals: true,
        source: 'USER_REPORTED',
        portionGrams: 100,
        calories: 400,
        proteinG: 20,
        carbsG: 50,
        fatG: 13,
      };
      let logged = false,
        requested = false,
        saves = 0;
      const log = () => ({
        id: 'log',
        mealName: food.name,
        loggedAt: now,
        mealType: 'LUNCH',
        source: 'USER_LOGGED',
        status: 'DONE',
        calories: 400,
        proteinG: 20,
        carbsG: 50,
        fatG: 13,
        outsideItems: [
          {
            ...food,
            ...(requested ? { review: { id: 'review', status: 'PENDING', requestedByUserAt: now, messages: [] } } : {}),
          },
        ],
      });
      const claims = Buffer.from(
        JSON.stringify({
          userId: owner,
          email: profile.email,
          role: 'USER',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      await page
        .context()
        .addCookies([
          {
            name: 'nutrimind_session',
            value: `fixture.${claims}.fixture`,
            url: testInfo.project.use.baseURL as string,
          },
        ]);
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const headers = {
          'Access-Control-Allow-Origin': testInfo.project.use.baseURL as string,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        };
        if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
          return route.fulfill({ status: 204, headers });
        let data: unknown = [];
        if (path.endsWith('/user/profile')) data = profile;
        else if (path.endsWith('/nutrition-report/history')) data = [];
        else if (path.endsWith('/nutrition-report')) data = report;
        else if (path.endsWith('/membership')) data = { enabled: false };
        else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/meal-clarifications')) data = { enabled: true, forms: [] };
        else if (path.endsWith('/history/count')) data = { total: logged ? 1 : 0 };
        else if (path.endsWith('/meals/history')) data = logged ? [log()] : [];
        else if (path.includes('/verified-recipes'))
          data = { total: 0, restrictedProfile: false, page: 1, pageCount: 0, items: [] };
        else if (path.endsWith('/cycles')) data = { current: null, upcoming: null };
        else if (path.endsWith('/water')) data = { totalMl: 0 };
        else if (path.endsWith('/request-review')) {
          requested = true;
          data = {};
        } else if (path.endsWith('/log-outside')) {
          const body = route.request().postDataJSON();
          expect(body.requestRndReview).toBeUndefined();
          if (body.warningAcknowledged) {
            logged = true;
            saves++;
            data = { warningRequired: false, log: log() };
          } else
            data = {
              warningRequired: true,
              confirmationId: 'confirmation',
              estimate: food,
              items: [food],
              summary: {
                provisionalCalories: 0,
                provisionalItemCount: 0,
                unresolvedItemCount: 0,
                completeness: 'COMPLETE',
              },
              reasons: [],
            };
        }
        return route.fulfill({ headers, json: { success: true, data, meta: {} } });
      });
      await page.goto('/profile/nutrition-report');
      await expect(page.getByText('How the daily kcal target is calculated')).toBeVisible();
      await expect(page.getByText('30 years', { exact: true })).toBeVisible();
      await expect(page.getByText('Lightly active', { exact: true })).toBeVisible();
      await expect(page.locator('.outline-brand-accent')).toHaveCount(0);
      if (width > 639) {
        const box = await page.getByRole('region', { name: 'Nutrition report canvas' }).boundingBox();
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
        expect(await page.getByRole('region', { name: 'Nutrition report canvas' }).boundingBox()).toEqual(box);
      }
      await page.screenshot({ path: testInfo.outputPath('report.png'), fullPage: true });
      await page.goto('/meals?tab=history');
      await page.getByRole('button', { name: 'Log food or snack', exact: true }).click();
      await page.getByPlaceholder('e.g. Chicken adobo, apple, brown rice').fill(food.name);
      for (const [label, value] of [
        ['Calories (kcal)', '400'],
        ['Protein (g)', '20'],
        ['Carbs (g)', '50'],
        ['Fat (g)', '13'],
      ])
        await page.getByLabel(label, { exact: true }).fill(value);
      await page.getByRole('button', { name: 'Preview nutrition', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Request RND feedback', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Save food', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Food logged', exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('feedback-prompt.png'), fullPage: true });
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      expect(saves).toBe(1);
      expect(requested).toBe(false);
      await page.reload();
      await page.getByRole('button', { expanded: false }).filter({ hasText: food.name }).click();
      await expect(page.getByRole('region', { name: 'RND feedback' })).toBeVisible();
      await expect(page.getByLabel('Personal Meal Notes')).toHaveCount(0);
      await page.getByRole('button', { name: 'Request RND feedback', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('history.png'), fullPage: true });
      await page.getByRole('button', { name: 'Request RND feedback', exact: true }).click();
      await expect(page.getByText('RND feedback requested', { exact: true })).toBeVisible();
      expect(saves).toBe(1);
      profile.reportAcknowledged = false;
      await page.goto('/dashboard');
      await expect(
        page.getByText('Review and acknowledge your current nutrition report first.', { exact: false })
      ).toBeVisible();
      await expect(page.getByRole('img', { name: 'Meal plan status' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('home-pending.png'), fullPage: true });
    });
  }
