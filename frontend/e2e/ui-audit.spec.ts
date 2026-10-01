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
