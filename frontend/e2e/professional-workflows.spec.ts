import { expect, test, type Page, type Route } from '@playwright/test';

async function portalFixture(
  page: Page,
  role: 'USER' | 'ADMIN' | 'NUTRITIONIST',
  resolve: (path: string, route: Route) => unknown,
  profileOverrides: Record<string, unknown> = {}
) {
  const owner = `professional-workflow-${role.toLowerCase()}`;
  const payload = Buffer.from(
    JSON.stringify({ userId: owner, email: 'tester@example.invalid', role, exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `fixture.${payload}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const headers = {
      'Access-Control-Allow-Origin': process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
      return route.fulfill({ status: 204, headers });
    let data = resolve(path, route);
    if (path === '/user/profile')
      data = {
        id: owner,
        name: 'Synthetic Tester',
        email: 'tester@example.invalid',
        role,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        userProfile: { revision: 1, safetyRevision: 2 },
        healthConditions: [],
        allergies: [],
        safetyEntries: [],
        ...profileOverrides,
      };
    else if (path === '/user/notifications') data = { notifications: [], unreadCount: 0 };
    else if (path === '/user/membership') data = { enabled: false };
    else if (path === '/user/meals/cycles') data = { current: null, upcoming: null };
    else if (path === '/admin/users') data = { users: [], total: 0, page: 1, limit: 20 };
    else if (path === '/admin/review-routing') data = { config: { enabled: false, retired: true }, episodes: [] };
    await route.fulfill({ headers, json: { success: true, data: data ?? [] } });
  });
}

test('health details empty state reuses sleeping Nara and fades across themes without moving', async ({
  page,
}, testInfo) => {
  await portalFixture(page, 'USER', (path) => {
    if (path.startsWith('/user/clinical-evidence'))
      return { safetyRevision: 2, availableAreas: [], requirements: [], contexts: [] };
    if (path === '/user/clinical-profile-review/status')
      return { required: false, approved: true, declarationRequired: false, detailsRequest: null };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/profile/clinical-evidence');
  await expect(
    page.getByRole('heading', { name: 'No health details are needed for your current profile' })
  ).toBeVisible();
  const light = page.locator('img[src*="sleeping-light"]');
  const dark = page.locator('img[src*="sleeping-dark"]');
  await light.evaluate((img: HTMLImageElement) => img.decode());
  await dark.evaluate((img: HTMLImageElement) => img.decode());
  const bounds = await light.boundingBox();
  await page.screenshot({ path: testInfo.outputPath('health-details-light.png') });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(dark).toHaveCSS('transition-duration', '0.25s');
  await expect(dark).toHaveCSS('opacity', '1');
  await expect(light).toHaveCSS('opacity', '0');
  expect(await dark.boundingBox()).toEqual(bounds);
  await page.screenshot({ path: testInfo.outputPath('health-details-dark.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(light).toHaveCSS('transition-duration', '0s');
  await expect(light).toHaveCSS('opacity', '1');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByAltText('Sleeping Nara')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// Every API call is intercepted. No application, account, OTP or email is created.
test('applicant verifies the corrected inbox before leaving the identity step', async ({ page }) => {
  const addresses: string[] = [];
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (pathname.endsWith('/email/send')) {
      addresses.push(route.request().postDataJSON().email);
      return route.fulfill({ headers, json: { success: true, data: { resendAfterSeconds: 60 } } });
    }
    if (pathname.endsWith('/email/verify'))
      return route.fulfill({ headers, json: { success: true, data: { proof: 'x'.repeat(43) } } });
    if (pathname.includes('/auth/')) return route.fulfill({ status: 401, headers, json: { success: false } });
    return route.fulfill({ headers, json: { success: true, data: [] } });
  });
  await page.goto('/nutritionist-apply');
  await page.locator('#fullName').fill('Browser Test Applicant');
  await page.locator('#applicationEmail').fill('corrected@example.invalid');
  await page.locator('#phoneNumber').fill('+63 917 555 0123');
  await page.locator('#official-headshot').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=',
      'base64'
    ),
  });
  await page.getByRole('checkbox', { name: /30-Day Photo Attestation/ }).check();
  await page.getByRole('button', { name: 'Continue to Credentials' }).click();
  await expect(page.getByText('Verify your email address before continuing.')).toBeVisible();
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByText('Email verified', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Credentials' }).click();
  await expect(page.getByRole('heading', { name: 'PRC credentials and licensure' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.locator('#applicationEmail').fill('another@example.invalid');
  await expect(page.getByRole('button', { name: 'Send verification code' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Credentials' }).click();
  await expect(page.getByText('Verify your email address before continuing.')).toBeVisible();
  expect(addresses).toEqual(['corrected@example.invalid']);
});

test('mobile user saves health details and taps stable navigation targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let saved: Record<string, unknown> | undefined;
  await portalFixture(page, 'USER', (path, route) => {
    if (path === '/user/clinical-evidence/details') saved = route.request().postDataJSON();
    if (path.startsWith('/user/clinical-evidence'))
      return { safetyRevision: 2, availableAreas: ['HEART_CONDITION'], requirements: [], contexts: [] };
    if (path === '/user/clinical-profile-review/status')
      return { required: false, approved: true, declarationRequired: false, detailsRequest: null };
    if (path === '/user/meals/readiness')
      return { canRequestPlan: false, title: 'No plan yet', message: 'Synthetic fixture' };
  });
  await page.goto('/profile/clinical-evidence');
  await expect(page.getByLabel('Condition or restriction details')).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  for (const label of [
    'Condition or restriction details',
    'Current medication or supplements',
    'Dietary advice you have received',
    'Recent symptoms or episodes',
  ])
    await page.getByLabel(label, { exact: true }).fill('Unknown; please review my details.');
  await page.getByRole('button', { name: 'Save health details' }).click();
  await expect(page.getByText(/Health details saved/)).toBeVisible();
  expect(saved).toMatchObject({ area: 'HEART_CONDITION', expectedSafetyRevision: 2 });
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  for (const label of ['Home', 'Meals', 'Groceries', 'Progress']) {
    const box = await nav.getByRole('link', { name: label, exact: true }).boundingBox();
    expect(box && box.width >= 44 && box.height >= 44).toBeTruthy();
  }
  await nav.getByRole('link', { name: 'Meals', exact: true }).click();
  await expect(page).toHaveURL(/\/meals$/);
  await nav.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Profile', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(errors).toEqual([]);
});

test('administrator can revoke and restore access with records preserved in the UI', async ({ page }) => {
  let suspended = false;
  const requests: unknown[] = [];
  await portalFixture(page, 'ADMIN', (path, route) => {
    if (path === '/admin/users/professional-account/suspension') {
      const body = route.request().postDataJSON();
      requests.push(body);
      suspended = body.suspended;
      return { isSuspended: suspended };
    }
    if (path === '/admin/nutritionists')
      return [
        {
          id: 'professional',
          isVerified: true,
          prcLicenseNumber: 'TEST-ONLY',
          prcLicenseExpiry: '2099-12-31T00:00:00Z',
          totalVerified: 12,
          canLeadReview: false,
          user: {
            id: 'professional-account',
            name: 'Synthetic Dietitian',
            email: 'dietitian@example.invalid',
            isSuspended: suspended,
          },
        },
      ];
  });
  await page.goto('/admin/nutritionists');
  await page.getByRole('button', { name: /^Professional records/ }).click();
  await expect(page.getByText('Lead review capability')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Enable Lead|Lead enabled/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect(page.getByText('Past reviews and audit records are preserved.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm revocation' })).toBeDisabled();
  await page.getByLabel('Reason', { exact: true }).fill('Synthetic contract ended');
  await page.getByRole('button', { name: 'Confirm revocation' }).click();
  await expect(page.getByRole('button', { name: 'Restore access', exact: true })).toBeVisible();
  expect(requests[0]).toMatchObject({ suspended: true, reason: 'Synthetic contract ended' });
  await page.getByRole('button', { name: 'Restore access', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore access', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Revoke access', exact: true })).toBeVisible();
  expect(requests[1]).toMatchObject({ suspended: false });
  await expect(page.getByText('12', { exact: true })).toBeVisible();
});

test('nutritionist claims a profile and confirms the submitted health form', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let mine = false;
  let confirmed = false;
  let decision: unknown;
  const review = () => ({
    profileRevision: 4,
    scopeKey: 'synthetic-scope-4',
    claim: { active: mine, mine, expiresAt: null },
    needsClarification: false,
    requirements: [],
    availableAreas: ['DIABETES'],
    healthDetails: [
      {
        area: 'DIABETES',
        responses: {
          conditionDetails: 'Synthetic user-reported diabetes context',
          medications: 'Unknown',
          dietaryAdvice: 'None reported',
          recentSymptoms: 'None reported',
        },
      },
    ],
  });
  await portalFixture(page, 'NUTRITIONIST', (path, route) => {
    if (path === '/nutritionist/review-work-counts') return { case: 0, meal: 0, profile: confirmed ? 0 : 1 };
    if (path === '/nutritionist/profile-work')
      return confirmed
        ? []
        : [
            {
              userId: 'synthetic-patient',
              name: 'Synthetic Patient',
              conditions: ['DIABETES'],
              allergies: [],
              profileStatus: 'PENDING',
              documentCount: 0,
              documentIds: [],
            },
          ];
    if (path === '/nutritionist/profile-work/synthetic-patient')
      return {
        userId: 'synthetic-patient',
        name: 'Synthetic Patient',
        profileStatus: 'PENDING',
        currentProfile: { revision: 4, conditions: ['DIABETES'], allergies: [] },
        profileReview: review(),
        reports: [],
        documents: [],
        availableAreas: ['DIABETES'],
        requirements: [],
      };
    if (path === '/nutritionist/profile-reviews/synthetic-patient/claim') {
      mine = true;
      return review();
    }
    if (path === '/nutritionist/profile-reviews/synthetic-patient/decision' && route.request().method() === 'POST') {
      decision = route.request().postDataJSON();
      confirmed = true;
      return { status: 'APPROVED' };
    }
  });
  await page.goto('/nutritionist/reviews');
  await page.getByRole('button', { name: /Member queue/ }).click();
  await page.getByRole('button', { name: /Synthetic Patient/ }).click();
  await expect(page.getByText('Synthetic user-reported diabetes context')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Review notes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Profile decision' })).toHaveCount(0);
  const claim = page.getByRole('button', { name: 'Claim profile' });
  await expect(claim.locator('xpath=ancestor::header')).toHaveCount(1);
  await page.getByRole('button', { name: 'Expand canvas' }).click();
  await expect(claim).toBeVisible();
  await expect(claim.locator('xpath=ancestor::header')).toHaveCount(1);
  await claim.click();
  await page.getByRole('button', { name: 'Profile decision', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Record profile decision' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm for planning' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Review notes' }).fill('Reviewed the synthetic details for planning.');
  await expect(page.getByRole('button', { name: 'Confirm for planning' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm for planning' }).click();
  await expect(page.getByText('Profile queue is clear.')).toBeVisible();
  expect(decision).toMatchObject({ decision: 'APPROVED', profileRevision: 4, scopeKey: 'synthetic-scope-4' });
  expect(errors).toEqual([]);
});

test('nutritionist sees missing allergy details and an open deleted case closes on refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let deleted = false;
  const requirements = [
    { area: 'HEART_CONDITION', state: 'READY', message: 'Heart condition details available.' },
    { area: 'FOOD_ALLERGY', state: 'CONTEXT_REQUIRED', message: 'Complete food allergy details.' },
  ];
  await portalFixture(page, 'NUTRITIONIST', (path) => {
    if (path === '/nutritionist/review-work-counts') return { case: 0, meal: 0, profile: deleted ? 0 : 1 };
    if (path === '/nutritionist/profile-work')
      return deleted
        ? []
        : [
            {
              userId: 'synthetic-deleted-member',
              name: 'Synthetic Member',
              conditions: ['HEART_CONDITION'],
              allergies: ['NUTS'],
              profileStatus: 'PENDING',
              documentCount: 0,
              documentIds: [],
            },
          ];
    if (path === '/nutritionist/profile-work/synthetic-deleted-member')
      return {
        userId: 'synthetic-deleted-member',
        name: 'Synthetic Member',
        profileStatus: 'PENDING',
        currentProfile: { revision: 4, conditions: ['HEART_CONDITION'], allergies: ['NUTS'] },
        profileReview: {
          profileRevision: 4,
          scopeKey: 'synthetic-allergy-scope',
          claim: { active: true, mine: true, expiresAt: null },
          needsClarification: false,
          healthDetails: [
            { area: 'HEART_CONDITION', responses: { conditionDetails: 'Saved synthetic heart condition details' } },
          ],
          requirements,
          availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
        },
        reports: [],
        documents: [],
        requirements,
        availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
      };
  });
  await page.goto('/nutritionist/reviews');
  await page.getByRole('button', { name: /Member queue/ }).click();
  await page.getByRole('button', { name: /Synthetic Member/ }).click();
  await page.getByRole('button', { name: 'Expand canvas' }).click();
  await page.getByRole('button', { name: 'Profile decision', exact: true }).click();
  await page.getByRole('textbox', { name: 'Review notes' }).fill('Reviewed the saved heart condition details.');
  await expect(page.getByRole('button', { name: 'Confirm for planning' })).toBeDisabled();
  await expect(page.getByText('Ask the member to complete and save food allergy details.')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Details request area' })).toHaveText('FOOD ALLERGY');
  await expect(page.getByRole('button', { name: 'Request details' })).toBeEnabled();
  deleted = true;
  await page.evaluate(() => window.dispatchEvent(new Event('kainara:live-update')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Profile queue is clear.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm for planning' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('onboarding declarations always open their separate details page before shopping day', async ({ page }) => {
  let conditionSaved = false;
  let allergySaved = false;
  const overrides: Record<string, unknown> = {
    onboardingDone: false,
    tosAccepted: false,
    safetyEntries: [],
    healthConditions: [],
    allergies: [],
  };
  const item = (code: string, displayName: string, domains: string[]) => ({
    code,
    displayName,
    domains,
    aliases: [],
    searchTerms: [],
    supportState: 'SUPPORTED',
    policyReference: 'FIXTURE',
  });
  const catalogue = {
    conditions: [item('HEART_CONDITION', 'Heart condition', ['CONDITION'])],
    foodSafety: [
      item('NUTS', 'Peanuts and tree nuts', ['ALLERGY']),
      item('NONE', 'No food restriction', ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT']),
    ],
  };
  await portalFixture(
    page,
    'USER',
    (path, route) => {
      if (path.endsWith('/safety-catalogue')) return catalogue;
      if (path.endsWith('/safety-preview') || path.endsWith('/safety')) {
        const input = route.request().postDataJSON();
        const entries = input.entries.map((entry: { domain: string; value: string }) => ({
          domain: entry.domain,
          canonicalCode: entry.value,
          originalText: entry.value,
          provenance: 'PREDEFINED',
          displayName: entry.value,
          supportState: 'SUPPORTED',
        }));
        if (path.endsWith('/safety')) {
          overrides.safetyEntries = [
            ...(overrides.safetyEntries as Array<{ domain: string }>).filter(
              (entry) => !input.editableDomains.includes(entry.domain)
            ),
            ...entries,
          ];
          overrides.healthConditions = ['HEART_CONDITION'];
          if (!input.editableDomains.includes('CONDITION')) overrides.allergies = ['NUTS'];
        }
        return {
          entries,
          changed: true,
          canSave: true,
          errors: [],
          requiresReview: false,
          nextHealthDetailsPath: input.editableDomains.includes('CONDITION')
            ? '/onboarding/condition-details'
            : '/onboarding/allergy-details',
        };
      }
      if (path.endsWith('/clinical-evidence/details')) {
        const input = route.request().postDataJSON();
        if (input.area === 'HEART_CONDITION') conditionSaved = true;
        if (input.area === 'FOOD_ALLERGY') allergySaved = true;
      }
      if (path.includes('/onboarding/clinical-evidence')) {
        const hasAllergy = (overrides.allergies as string[]).includes('NUTS');
        return {
          safetyRevision: 2,
          availableAreas: ['HEART_CONDITION', ...(hasAllergy ? ['FOOD_ALLERGY'] : [])],
          contexts: [],
          requirements: [
            {
              area: 'HEART_CONDITION',
              state: conditionSaved ? 'READY' : 'CONTEXT_REQUIRED',
              message: 'Condition form status.',
            },
            ...(hasAllergy
              ? [
                  {
                    area: 'FOOD_ALLERGY',
                    state: allergySaved ? 'READY' : 'CONTEXT_REQUIRED',
                    message: 'Allergy form status.',
                  },
                ]
              : []),
          ],
        };
      }
    },
    overrides
  );
  const saveDeclarations = async () => {
    await page.getByRole('button', { name: 'Save and continue →', exact: true }).click();
    await page.getByRole('checkbox', { name: /I reviewed these entries/ }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  };
  await page.goto('/onboarding/conditions');
  await page.getByRole('button', { name: 'Heart condition', exact: true }).click();
  await saveDeclarations();
  await expect(page).toHaveURL(/\/onboarding\/condition-details$/);
  for (const label of [
    'Condition or restriction details',
    'Current medication or supplements',
    'Dietary advice you have received',
    'Recent symptoms or episodes',
  ])
    await page.getByLabel(label, { exact: true }).fill('Synthetic condition details for review');
  await page.getByRole('button', { name: 'Save health details' }).click();
  await page.getByRole('button', { name: 'Continue to allergies' }).click();
  await expect(page).toHaveURL(/\/onboarding\/allergies$/);
  await page.getByRole('button', { name: 'Peanuts and tree nuts', exact: true }).click();
  await page.getByRole('tab', { name: /^Intolerances/ }).click();
  await page.getByRole('button', { name: 'No food restriction', exact: true }).click();
  await page.getByRole('tab', { name: /^Foods to Avoid/ }).click();
  await page.getByRole('button', { name: 'No food restriction', exact: true }).click();
  await saveDeclarations();
  await expect(page).toHaveURL(/\/onboarding\/allergy-details$/);
  await expect(page.getByRole('button', { name: 'Continue to shopping day' })).toBeDisabled();
  for (const label of [
    'Food allergies, intolerances or avoided foods and their reactions',
    'Medication or supplements used for these restrictions',
    'Dietary advice for these allergies or restrictions',
    'Recent allergic reactions or food-related symptoms',
  ])
    await page.getByLabel(label, { exact: true }).fill('Synthetic allergy details for review');
  await page.getByRole('button', { name: 'Save health details' }).click();
  await page.getByRole('button', { name: 'Continue to shopping day' }).click();
  await expect(page).toHaveURL(/\/onboarding\/shopping-day$/);
  expect(conditionSaved && allergySaved).toBe(true);
});

test('onboarding shows separate condition and allergy fields and saves the allergy form', async ({ page }) => {
  let saved: Record<string, unknown> | undefined;
  await portalFixture(
    page,
    'USER',
    (path, route) => {
      if (path === '/user/onboarding/clinical-evidence/details') saved = route.request().postDataJSON();
      if (path.startsWith('/user/onboarding/clinical-evidence'))
        return {
          safetyRevision: 2,
          availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
          requirements: [
            { area: 'HEART_CONDITION', state: 'READY', message: 'Condition details saved.' },
            { area: 'FOOD_ALLERGY', state: saved ? 'READY' : 'CONTEXT_REQUIRED', message: 'Allergy details needed.' },
          ],
          contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Saved synthetic condition' } }],
        };
    },
    { onboardingDone: false, tosAccepted: false }
  );
  await page.goto('/onboarding/condition-details');
  await expect(page.getByRole('heading', { name: 'Condition details' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Allergy details', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Condition or restriction details')).toHaveValue('Saved synthetic condition');
  await expect(page.getByRole('button', { name: 'Continue to allergies' })).toBeEnabled();
  await page.goto('/onboarding/allergy-details');
  await expect(page.getByRole('heading', { name: 'Allergy details' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'heart condition', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to shopping day' })).toBeDisabled();
  for (const label of [
    'Food allergies, intolerances or avoided foods and their reactions',
    'Medication or supplements used for these restrictions',
    'Dietary advice for these allergies or restrictions',
    'Recent allergic reactions or food-related symptoms',
  ])
    await page.getByLabel(label, { exact: true }).fill('Synthetic allergy details for review');
  await page.getByRole('button', { name: 'Save health details' }).click();
  await expect(page.getByRole('button', { name: 'Continue to shopping day' })).toBeEnabled();
  expect(saved).toMatchObject({ area: 'FOOD_ALLERGY', expectedSafetyRevision: 2 });
  await page.getByRole('button', { name: 'Continue to shopping day' }).click();
  await expect(page).toHaveURL(/\/onboarding\/shopping-day$/);
});

test('member completes separate allergy details without overwriting their saved heart form', async ({ page }) => {
  const answers = {
    conditionDetails: 'Saved synthetic heart condition',
    medications: 'None',
    dietaryAdvice: 'None',
    recentSymptoms: 'None',
  };
  let allergySaved = false;
  let submitted: Record<string, unknown> | undefined;
  await portalFixture(page, 'USER', (path, route) => {
    if (path === '/user/clinical-evidence/details') {
      submitted = route.request().postDataJSON();
      allergySaved = true;
    }
    if (path.startsWith('/user/clinical-evidence'))
      return {
        safetyRevision: 2,
        availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
        requirements: [
          { area: 'HEART_CONDITION', state: 'READY', message: 'Heart details available.' },
          { area: 'FOOD_ALLERGY', state: allergySaved ? 'READY' : 'CONTEXT_REQUIRED', message: 'Allergy form status.' },
        ],
        contexts: [
          { area: 'HEART_CONDITION', responses: answers },
          ...(allergySaved ? [{ area: 'FOOD_ALLERGY', responses: submitted }] : []),
        ],
      };
    if (path === '/user/clinical-profile-review/status')
      return { required: true, approved: false, detailsRequest: null };
  });
  await page.goto('/profile/clinical-evidence');
  await expect(page.getByText('1 of 2 health detail forms complete.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Allergy details', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.getByLabel('Food allergies, intolerances or avoided foods and their reactions')).toHaveValue('');
  for (const label of [
    'Food allergies, intolerances or avoided foods and their reactions',
    'Medication or supplements used for these restrictions',
    'Dietary advice for these allergies or restrictions',
    'Recent allergic reactions or food-related symptoms',
  ])
    await page.getByLabel(label, { exact: true }).fill('Synthetic allergy information for review');
  await page.getByRole('button', { name: 'Save health details' }).click();
  await expect(page.getByText('2 of 2 health detail forms complete.')).toBeVisible();
  expect(submitted).toMatchObject({ area: 'FOOD_ALLERGY', expectedSafetyRevision: 2 });
  await page.getByRole('button', { name: 'heart condition', exact: true }).click();
  await expect(page.getByLabel('Condition or restriction details')).toHaveValue(answers.conditionDetails);
});
