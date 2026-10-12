import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page, theme: 'light' | 'dark', healthDetails = false) {
  const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  expect(['localhost', '127.0.0.1']).toContain(new URL(origin).hostname);
  const user = {
    id: 'onboarding-presentation-fixture',
    name: 'Preview Member',
    email: 'preview@example.invalid',
    role: 'USER',
    emailVerified: true,
    onboardingDone: false,
    tosAccepted: false,
    healthConditions: [],
    allergies: [],
    safetyEntries: [] as Array<Record<string, unknown>>,
    userProfile: {
      age: 25,
      heightCm: 170,
      weightKg: 68.5,
      targetWeightKg: 68.5,
      goal: 'MAINTAIN',
      biologicalSex: 'MALE',
      activityLevel: 'LIGHTLY_ACTIVE',
      dietaryPreference: 'OMNIVORE',
      ricePreference: 'FLEXIBLE',
      foodCulture: 'Filipino',
      shoppingDayOfWeek: 0,
    },
    mealReminderSettings: { breakfastTime: '07:00', lunchTime: '12:00', dinnerTime: '18:00', timeZone: 'Asia/Manila' },
    onboardingStatus: {
      currentTermsVersion: '2026-09-27',
      currentPrivacyVersion: '2026-09-27',
      nextPath: '/onboarding/stats',
    },
  };
  const workspace = {
    safetyRevision: 1,
    availableAreas: ['DIABETES'],
    contexts: [] as unknown[],
    requirements: [{ area: 'DIABETES', state: 'MISSING', message: 'Complete health details before continuing.' }],
  };
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const claims = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })
  ).toString('base64url');
  await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: origin }]);
  await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
  const domains = ['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'];
  const catalogue = domains.map((domain) => ({
    code: 'NONE',
    displayName: 'None',
    aliases: [],
    searchTerms: [],
    domains: [domain],
    supportState: 'SUPPORTED',
    policyReference: 'fixture',
  }));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.includes('/live/') || method === 'OPTIONS') return route.fulfill({ status: 204 });
    const body = method === 'POST' || method === 'PUT' ? route.request().postDataJSON() || {} : {};
    if (method === 'POST' || method === 'PUT') requests.push({ path, body });
    let data: unknown = user;
    if (path.endsWith('/safety-catalogue'))
      data = { conditions: catalogue.slice(0, 1), foodSafety: catalogue.slice(1) };
    else if (path.endsWith('/safety-preview') || path.endsWith('/onboarding/safety')) {
      const entries = (body.entries as Array<{ domain: string; value: string; provenance: string }>).map((entry) => ({
        ...entry,
        canonicalCode: entry.value,
        displayName: entry.value === 'NONE' ? 'None' : entry.value,
        supportState: 'SUPPORTED',
      }));
      if (path.endsWith('/onboarding/safety')) {
        const editable = body.editableDomains as string[];
        user.safetyEntries = [
          ...user.safetyEntries.filter((entry) => !editable.includes(String(entry.domain))),
          ...entries,
        ];
      }
      data = { entries, errors: [], canSave: true, requiresReview: false, changed: true };
    } else if (path.endsWith('/onboarding/profile')) Object.assign(user.userProfile, body);
    else if (path.endsWith('/meal-reminders') && method === 'PUT') Object.assign(user.mealReminderSettings, body);
    else if (path.endsWith('/onboarding/shopping-day'))
      user.userProfile.shoppingDayOfWeek = body.shoppingDayOfWeek as number;
    else if (path.endsWith('/clinical-evidence/details')) {
      workspace.contexts = [{ area: 'DIABETES', responses: body }];
      workspace.requirements = [{ area: 'DIABETES', state: 'READY', message: 'Details saved for RND review.' }];
      data = workspace;
    } else if (path.endsWith('/onboarding/clinical-evidence'))
      data = healthDetails ? workspace : { ...workspace, availableAreas: [], requirements: [] };
    else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: false };
    else if (path.includes('notifications')) data = { notifications: [], unreadCount: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
  return requests;
}

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`onboarding saves choices and preserves consent at ${width}px ${theme}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 1050 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const requests = await fixture(page, theme);
      const screenshot = async (name: string) => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        // The shared choice/tab transition lasts 200ms; capture its settled state.
        await page.waitForTimeout(250);
        await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
      };
      await page.goto('/onboarding/stats');
      await expect(page.getByLabel('Age (Years)')).toHaveValue('25');
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
      await page.getByRole('button', { name: 'Lose Weight', exact: true }).focus();
      await page.keyboard.press('Space');
      await page.getByLabel('Target Weight (kg)').fill('65');
      await screenshot('metrics');
      await page.getByRole('button', { name: /Continue to Step 2/ }).click();
      await expect(page).toHaveURL(/onboarding\/preferences$/);
      await page.getByRole('button', { name: /^Vegetarian/ }).click();
      await page.getByRole('button', { name: /^No rice/ }).click();
      await screenshot('preferences');
      await page.getByRole('button', { name: /Continue to Step 3/ }).click();
      await expect(page).toHaveURL(/onboarding\/conditions$/);
      await page.getByRole('button', { name: /^None/ }).click();
      await screenshot('conditions');
      await page.getByRole('button', { name: /Save and continue/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
      await dialog.getByRole('checkbox').check();
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(page).toHaveURL(/onboarding\/allergies$/);
      for (const name of ['Food Allergies', 'Intolerances', 'Foods to Avoid']) {
        await page
          .getByRole('navigation', { name: 'Food safety categories' })
          .getByRole('button', { name: new RegExp(name) })
          .click();
        await page.getByRole('button', { name: /^None/ }).click();
      }
      await screenshot('food-safety');
      await page.getByRole('button', { name: /Save and continue/ }).click();
      await dialog.getByRole('checkbox').check();
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(page).toHaveURL(/onboarding\/shopping-day$/);
      await page.getByRole('button', { name: /^Wednesday/ }).click();
      await screenshot('shopping');
      await page.getByRole('button', { name: /Continue to Step 6/ }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review your onboarding details');
      await expect(page.getByRole('button', { name: /Complete Onboarding/ })).toBeDisabled();
      await page.getByRole('button', { name: 'Edit body & goal' }).click();
      await expect(page).toHaveURL(/stats\?from=review$/);
      await expect(page.getByLabel('Target Weight (kg)')).toHaveValue('65');
      await page.getByRole('link', { name: 'Back to Review' }).click();
      await expect(page.getByRole('button', { name: 'Edit body & goal' })).toBeVisible();
      await screenshot('review');
      for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
      await expect(page.getByRole('button', { name: /Complete Onboarding/ })).toBeEnabled();
      expect(requests.find((request) => request.path.endsWith('/onboarding/profile'))?.body).toMatchObject({
        goal: 'LOSE_WEIGHT',
        targetWeightKg: 65,
      });
      expect(
        requests.some(
          (request) => request.body.dietaryPreference === 'VEGETARIAN' && request.body.ricePreference === 'NO_RICE'
        )
      ).toBe(true);
      expect(requests.find((request) => request.path.endsWith('/onboarding/shopping-day'))?.body).toEqual({
        shoppingDayOfWeek: 3,
      });
      expect(requests.filter((request) => request.path.endsWith('/onboarding/safety'))).toHaveLength(2);
      expect(errors).toEqual([]);
    });
  }
  test(`required condition details remain gated at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1050 });
    const requests = await fixture(page, 'light', true);
    await page.goto('/onboarding/condition-details');
    const next = page.getByRole('button', { name: 'Continue to allergies' });
    await expect(next).toBeDisabled();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Condition details');
    for (const label of [
      'Condition or restriction details',
      'Current medication or supplements',
      'Dietary advice you have received',
      'Recent symptoms or episodes',
    ]) {
      await page.getByLabel(label, { exact: true }).fill('Synthetic acceptance details');
    }
    await page.screenshot({ path: testInfo.outputPath('required-details.png'), fullPage: true });
    await page.getByRole('button', { name: 'Save health details' }).click();
    await expect(next).toBeEnabled();
    expect(requests.find((request) => request.path.endsWith('/clinical-evidence/details'))?.body).toMatchObject({
      area: 'DIABETES',
      expectedSafetyRevision: 1,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await next.click();
    await expect(page).toHaveURL(/onboarding\/allergies$/);
  });
}
