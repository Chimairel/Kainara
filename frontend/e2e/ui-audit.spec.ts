import { expect, test, type Page } from '@playwright/test';

async function fixtureSession(page: Page, onboarded = false) {
  const user = {
    id: 'ui-audit-user',
    name: 'Preview User',
    email: 'preview@example.invalid',
    role: 'USER',
    emailVerified: true,
    onboardingDone: onboarded,
    tosAccepted: onboarded,
    onboardingStatus: { acceptedCurrentConsent: onboarded, nextPath: onboarded ? null : '/onboarding/preferences' },
    nutritionReport: { acknowledgedAt: '2026-10-01T00:00:00Z', isStale: false, profileRevision: 1 },
    userProfile: {
      age: 25,
      biologicalSex: 'FEMALE',
      heightCm: 165,
      weightKg: 60,
      targetWeightKg: 60,
      activityLevel: 'SEDENTARY',
      goal: 'MAINTAIN',
      dietaryPreference: 'OMNIVORE',
      ricePreference: 'FLEXIBLE',
      foodCulture: 'Filipino',
      revision: 1,
      safetyRevision: 1,
      shoppingDayOfWeek: 6,
    },
    healthConditions: [],
    allergies: [],
    safetyEntries: [],
  };
  const claims = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`,
      url: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin,
    },
  ]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = null;
    if (path.endsWith('/user/profile') || path.endsWith('/user/onboarding/profile')) data = user;
    else if (path.endsWith('/user/clinical-profile-review/status')) data = { required: false, approved: true };
    else if (path.endsWith('/user/membership')) data = { enabled: false };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
}

for (const width of [390, 1440]) {
  test(`dashboard preloads meals then groceries and reuses them on navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixtureSession(page, true);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const cycle = {
      id: 'preload-cycle',
      planType: 'WEEKLY',
      startDate: `${today}T00:00:00Z`,
      endDate: `${today}T23:59:59Z`,
      status: 'ACTIVE',
    };
    const meals = ['BREAKFAST', 'LUNCH', 'DINNER'].map((mealType, index) => ({
      id: `preload-slot-${index}`,
      planGroupId: cycle.id,
      mealName: `Preloaded ${mealType.toLowerCase()} dish`,
      mealType,
      scheduledDate: `${today}T04:00:00Z`,
      status: 'APPROVED',
      aiConfidenceFlag: 'CAUTION',
      calories: 500,
      proteinG: 25,
      carbsG: 60,
      fatG: 18,
      ingredients: [],
      mealLogs: [],
      ricePortion: index === 1 ? '½ cup cooked rice (75 g)' : null,
    }));
    let finishHistory!: () => void;
    let finishMeals!: () => void;
    let finishGroceries!: () => void;
    const historyGate = new Promise<void>((resolve) => {
      finishHistory = resolve;
    });
    const mealsGate = new Promise<void>((resolve) => {
      finishMeals = resolve;
    });
    const groceryGate = new Promise<void>((resolve) => {
      finishGroceries = resolve;
    });
    let mealReads = 0;
    let groceryReads = 0;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/user/meals/current', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: meals,
          meta: {
            cycle,
            generationStatus: 'COMPLETED',
            planSnapshot: {
              dailyCalorieTarget: 1500,
              dailyMacroTargets: { [today]: { calories: 1500, proteinG: 75, carbsG: 180, fatG: 54 } },
            },
          },
        },
      })
    );
    await page.route('**/api/user/meals/history*', async (route) => {
      await historyGate;
      await route.fulfill({ json: { success: true, data: [] } });
    });
    await page.route('**/api/user/meals/workspace', async (route) => {
      mealReads++;
      await mealsGate;
      await route.fulfill({
        json: {
          success: true,
          data: meals,
          meta: {
            cycles: { current: cycle, upcoming: null },
            generationStatus: { current: 'COMPLETED', upcoming: null },
            pendingReview: null,
          },
        },
      });
    });
    await page.route('**/api/user/grocery/workspace', async (route) => {
      groceryReads++;
      await groceryGate;
      await route.fulfill({
        json: {
          success: true,
          data: {
            current: {
              scope: 'CURRENT',
              cycle: { ...cycle, deadlineOutcome: 'COMPLETE', incompleteAcknowledgedAt: null, shoppingStartedAt: null },
              groceryList: {
                id: 'preload-list',
                weekLabel: 'Current',
                generatedAt: `${today}T00:00:00Z`,
                groceryItems: [
                  {
                    id: 'rice',
                    ingredientName: 'Preloaded rice',
                    category: 'Grains',
                    isChecked: false,
                    quantity: 75,
                    unit: 'g',
                    sourceMealCount: 1,
                    isPantryStaple: false,
                  },
                ],
              },
              coverage: { clearedSlotCount: 3, expectedSlotCount: 3, unresolvedSlotCount: 0 },
              actionability: {
                canCheckItems: true,
                canExportPdf: true,
                isFinal: true,
                isIncomplete: false,
                quantitiesMayIncrease: false,
                requiresIncompleteAcknowledgment: false,
                message: 'Ready for shopping.',
              },
            },
            upcoming: null,
          },
        },
      });
    });
    await page.goto('/dashboard');
    await expect(page.getByText(meals[0].mealName, { exact: true })).toBeVisible();
    // Dashboard is usable, but an essential history read is still pending.
    await page.waitForTimeout(1_200);
    expect(mealReads).toBe(0);
    expect(groceryReads).toBe(0);
    finishHistory();
    await expect.poll(() => mealReads).toBe(1);
    expect(groceryReads).toBe(0);
    finishMeals();
    await expect.poll(() => groceryReads).toBe(1);
    // Navigate during the grocery preload: the mounted page must adopt that request.
    await page.getByRole('link', { name: 'Groceries', exact: true }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/grocery$/);
    finishGroceries();
    await expect(page.getByText('Preloaded rice', { exact: true })).toBeVisible();
    expect(groceryReads).toBe(1);
    await page.getByRole('link', { name: 'Meals', exact: true }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/meals$/);
    for (const meal of meals) await expect(page.getByText(meal.mealName, { exact: true })).toBeVisible();
    await expect(page.getByText('+ ½ cup cooked rice (75 g)', { exact: true })).toBeVisible();
    await expect.poll(() => mealReads).toBe(2); // Cached data renders; the page still revalidates.
    expect(errors).toEqual([]);
  });
  test(`dashboard and weekly plan agree after a failed workspace read and retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixtureSession(page, true);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const cycle = {
      id: 'read-cycle',
      planType: 'WEEKLY',
      startDate: `${today}T00:00:00Z`,
      endDate: `${today}T23:59:59Z`,
      status: 'ACTIVE',
    };
    const meals = ['BREAKFAST', 'LUNCH', 'DINNER'].map((mealType, index) => ({
      id: `read-slot-${index}`,
      planGroupId: cycle.id,
      mealName: `Saved ${mealType.toLowerCase()} dish`,
      mealType,
      scheduledDate: `${today}T04:00:00Z`,
      status: 'APPROVED',
      aiConfidenceFlag: 'CAUTION',
      calories: 500,
      proteinG: 25,
      carbsG: 60,
      fatG: 18,
      ingredients: [],
      mealLogs: [],
      ricePortion: index === 1 ? '½ cup cooked rice (75 g)' : null,
    }));
    await page.route('**/api/user/meals/current', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: meals,
          meta: { cycle, generationStatus: 'COMPLETED', pendingReview: null },
        },
      })
    );
    let attempts = 0;
    let allowRetry: (() => void) | undefined;
    const retryGate = new Promise<void>((resolve) => {
      allowRetry = resolve;
    });
    await page.route('**/api/user/meals/workspace', async (route) => {
      attempts++;
      if (attempts <= 2) {
        await route.fulfill({ status: 503, json: { success: false, error: 'Saved plan request timed out.' } });
        return;
      }
      await retryGate;
      await route.fulfill({
        json: {
          success: true,
          data: meals,
          meta: {
            cycles: { current: cycle, upcoming: null },
            generationStatus: { current: 'COMPLETED', upcoming: null },
            pendingReview: null,
          },
        },
      });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/dashboard');
    for (const meal of meals) await expect(page.getByText(meal.mealName, { exact: true })).toBeVisible();
    await page.goto('/meals');
    await expect(page.getByRole('heading', { name: 'Could not load your meal plan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
    await expect.poll(() => attempts).toBeGreaterThanOrEqual(3);
    await expect(page.getByRole('heading', { name: 'Could not load your meal plan' })).toBeVisible();
    allowRetry?.();
    for (const meal of meals) await expect(page.getByText(meal.mealName, { exact: true })).toBeVisible();
    await expect(page.getByText('+ ½ cup cooked rice (75 g)', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Could not load your meal plan' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
  test(`whole-plate rice swap shows fresh portions and submits the selected plate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixtureSession(page, true);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    let swapped = false;
    const current = {
      id: 'rice-slot',
      planGroupId: 'rice-cycle',
      mealName: 'BBQ Baby Back Ribs Recipe',
      mealType: 'LUNCH',
      scheduledDate: `${today}T04:00:00Z`,
      status: 'APPROVED',
      aiConfidenceFlag: 'CAUTION',
      calories: 758,
      proteinG: 51,
      carbsG: 44,
      fatG: 42,
      ingredients: [],
      mealLogs: [],
      ricePortion: '½ cup cooked rice (75 g)',
    };
    const replacement = {
      id: 'source:chicken',
      mealName: 'Chicken dish',
      mealType: 'LUNCH',
      mealTypes: ['LUNCH'],
      calories: 795,
      nutritionFitScore: 0.3,
      proteinG: 44,
      carbsG: 65,
      fatG: 20,
      riceRole: 'PAIR_WITH_RICE',
      reuseBasis: 'PANLASANG_GENERAL_BASE',
      pairedRiceG: 150,
      ricePortionLabel: '1 cup cooked rice (150 g)',
      canFavorite: false,
      servingDescription: 'One dish serving + 1 cup cooked rice (150 g)',
      verifiedBy: 'Panlasang Pinoy source',
    };
    await page.route('**/api/user/meals/workspace', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            {
              ...current,
              ...(swapped
                ? {
                    mealName: replacement.mealName,
                    calories: replacement.calories,
                    proteinG: replacement.proteinG,
                    carbsG: replacement.carbsG,
                    fatG: replacement.fatG,
                    ricePortion: replacement.ricePortionLabel,
                  }
                : {}),
            },
          ],
          meta: {},
        },
      })
    );
    await page.route('**/api/user/meals/rice-slot/swap-options', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { swapOptions: [replacement] },
        },
      })
    );
    await page.route('**/api/user/meals/rice-slot/swap-preview*', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            replacement,
            previewToken: 'signed-fixture',
            requestKey: 'rice-swap-key',
            originalCalories: 758,
            newCalories: 795,
            calorieDelta: 37,
            projectedDayTotal: 2000,
            dailyTarget: 2000,
            shoppingStarted: true,
            groceryDeltaAcknowledgmentRequired: true,
            warningRequired: false,
            shoppingNeeds: [
              {
                ingredientName: 'Rice, well-milled, boiled',
                unit: 'g',
                additionalQuantity: 75,
                remainingQuantity: 225,
              },
            ],
            shoppingRemovals: [{ ingredientName: 'Pork ribs', unit: 'g', removableQuantity: 100 }],
            nutritionAnalysis: {
              before: { calories: 1963, proteinG: 82, carbsG: 220, fatG: 95 },
              after: { calories: 2000, proteinG: 75, carbsG: 241, fatG: 73 },
              target: {
                calories: 2000,
                proteinG: 120,
                carbsG: 250,
                fatG: 58,
                explanation: 'Fixture report estimate',
                basis: 'MUSCLE_BUILDING_ESTIMATE',
              },
              completeDay: true,
              warnings: ['Protein is below the daily planning estimate.'],
            },
          },
        },
      })
    );
    await page.route('**/api/user/meals/rice-slot/swap', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.newLibraryMealId).toBe('source:chicken');
      expect(body.previewToken).toBe('signed-fixture');
      expect(body.requestKey).toBe('rice-swap-key');
      expect(body.groceryDeltaAcknowledged).toBe(true);
      swapped = true;
      await route.fulfill({ json: { success: true } });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/meals?date=${today}&mealId=rice-slot`);
    await page.getByRole('button', { name: 'Swap meal', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('+ ½ cup cooked rice (75 g)', { exact: true })).toBeVisible();
    await expect(dialog.getByText('+ 1 cup cooked rice (150 g)', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Source:/)).toBeVisible();
    await expect(dialog.getByText(/Verified by:/)).toHaveCount(0);
    await dialog.getByRole('button').filter({ hasText: 'Chicken dish' }).click();
    await expect(dialog.getByText('One dish serving + 1 cup cooked rice (150 g)', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Rice, well-milled, boiled: \+75 g/)).toBeVisible();
    await expect(dialog.getByText('Pork ribs: −100 g')).toBeVisible();
    await expect(dialog.getByText('Protein is below the daily planning estimate.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm Swap', exact: true })).toBeDisabled();
    await dialog.getByRole('checkbox', { name: /I reviewed the grocery changes above/ }).check();
    await expect(dialog.getByRole('button', { name: 'Confirm Swap', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Confirm Swap', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('+ 1 cup cooked rice (150 g)', { exact: true })).toBeVisible();
    expect(swapped).toBe(true);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
  test(`retired-slot warning repairs the existing cycle and refreshes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixtureSession(page, true);
    let retiredCount = 2;
    let repairRequests = 0;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    await page.route('**/api/user/meals/workspace', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [],
          meta: {
            cycles: {
              current: {
                id: 'retired-cycle',
                planType: 'WEEKLY',
                startDate: `${today}T00:00:00Z`,
                endDate: `${today}T23:59:59Z`,
                status: 'ACTIVE',
                unavailableMealCount: retiredCount,
                retiredMealCount: retiredCount,
              },
              upcoming: null,
            },
          },
        },
      })
    );
    await page.route('**/api/user/meals/cycles/retired-cycle/replace-retired', async (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postDataJSON()).toEqual({});
      repairRequests++;
      retiredCount = 0;
      await route.fulfill({ json: { success: true, data: { replaced: 2, awaitingReplacement: 0 } } });
    });
    await page.goto('/meals');
    await expect(page.getByText('Current plan: 2 unavailable meals')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Replace retired meals', exact: true }).click();
    await expect(page.getByText('Current plan: 2 unavailable meals')).toBeHidden();
    expect(repairRequests).toBe(1);
  });
}

test('public pages keep legal links and readable layouts at phone and desktop widths', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Eat with intention.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true })).toHaveAttribute(
      'href',
      '/docs#privacy-policy'
    );
    await expect(page.getByRole('link', { name: 'Terms of Service', exact: true })).toHaveAttribute(
      'href',
      '/docs#terms-of-service'
    );
    await expect(page.getByRole('link', { name: 'chimairelp@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:chimairelp@gmail.com'
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('reduced-motion source links are unique and keyboard focus makes normal animation static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const sources = page.locator('#sources');
  await expect(sources.getByRole('link', { name: /Open citation/ })).toHaveCount(6);
  await expect(sources.locator('[aria-hidden="true"] a')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  const first = sources.getByRole('link', { name: /Open citation/ }).first();
  await first.focus();
  await expect(first).toBeFocused();
  await expect(sources.locator('[aria-hidden="true"] a')).toHaveCount(0);
});

test('applicants can choose photos with the keyboard and invalid uploads stay blocked', async ({ page }) => {
  await page.goto('/nutritionist-apply');
  const choose = page.getByRole('button', { name: 'Choose identity photo' });
  await choose.focus();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid image') });
  await expect(page.getByRole('alert').filter({ hasText: 'JPEG or PNG' })).toHaveText(/JPEG or PNG/);
  await page.getByRole('button', { name: /Continue to Credentials/ }).click();
  await expect(page.getByText('Please correct the highlighted fields before continuing.')).toBeVisible();
});

test('onboarding saves without region/city and profile no longer exposes them', async ({ page }) => {
  await fixtureSession(page);
  await page.goto('/onboarding/preferences');
  await expect(page.getByRole('heading', { name: 'DIETARY PREFERENCES' })).toBeVisible();
  await expect(page.getByText('Meal-planning location', { exact: true })).toHaveCount(0);
  const request = page.waitForRequest(
    (request) => request.url().includes('/user/onboarding/profile') && request.method() === 'POST'
  );
  await page.getByRole('button', { name: /Continue to Step 3/ }).click();
  const payload = (await request).postDataJSON();
  for (const field of ['planningGeographyLevel', 'planningRegionName', 'planningProvinceHucName'])
    expect(payload).not.toHaveProperty(field);
  await fixtureSession(page, true);
  await page.goto('/profile/planning');
  await expect(page.getByText('Meal-planning location', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Region', exact: true })).toHaveCount(0);
});

test('the dashboard preview can be captured with anonymous disposable data', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1020 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixtureSession(page, true);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const meals = [
    ['BREAKFAST', 'Egg and rice bowl', 450, '/meals/scrambled-egg-rice.jpg'],
    ['LUNCH', 'Tofu and vegetable bowl', 600, '/meals/tofu-bowl.jpg'],
    ['DINNER', 'Tuna and rice bowl', 750, '/meals/tuna-bowl.jpg'],
  ].map(([mealType, mealName, calories, image], index) => ({
    id: `preview-meal-${index}`,
    userId: 'ui-audit-user',
    mealType,
    mealName,
    calories,
    proteinG: Number(calories) / 20,
    carbsG: Number(calories) / 8,
    fatG: Number(calories) / 30,
    status: 'APPROVED',
    planType: 'WEEKLY',
    scheduledDate: `${today}T04:00:00Z`,
    isActionable: true,
    ingredients: [],
    mealLogs: [],
    image: { url: image, altText: `${mealName} illustration`, kind: 'REPRESENTATIVE', attribution: {} },
  }));
  await page.route('**/api/user/meals/current', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: meals,
        meta: {
          cycle: {
            id: 'preview-cycle',
            planType: 'WEEKLY',
            startDate: `${today}T00:00:00Z`,
            endDate: `${today}T23:59:59Z`,
            status: 'ACTIVE',
          },
          planSnapshot: { dailyCalorieTarget: 1800, dailyMacroTargets: {} },
        },
      },
    })
  );
  await page.route('**/api/user/water/today', (route) =>
    route.fulfill({ json: { success: true, data: { totalMl: 0 } } })
  );
  await page.route('**/api/user/checkin/status', (route) =>
    route.fulfill({ json: { success: true, data: { isDue: false, streak: 0, lastCheckinAt: null } } })
  );
  await page.goto('/dashboard');
  await expect(page.getByText('Mabuhay, Preview.')).toBeVisible();
  await expect(page.getByText('Tuna and rice bowl')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const name of ['Egg and rice bowl', 'Tofu and vegetable bowl', 'Tuna and rice bowl']) {
    const image = page.getByRole('img', { name: `${name} illustration` });
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveClass(/opacity-100/);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.KAINARA_PREVIEW_CAPTURE) await page.screenshot({ path: process.env.KAINARA_PREVIEW_CAPTURE });
});
