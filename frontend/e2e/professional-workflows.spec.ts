import { expect, test, type Page, type Route } from '@playwright/test';

async function portalFixture(
  page: Page,
  role: 'USER' | 'ADMIN' | 'NUTRITIONIST',
  resolve: (path: string, route: Route) => unknown
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
      };
    else if (path === '/user/notifications') data = { notifications: [], unreadCount: 0 };
    else if (path === '/user/membership') data = { enabled: false };
    else if (path === '/user/meals/cycles') data = { current: null, upcoming: null };
    await route.fulfill({ headers, json: { success: true, data: data ?? [] } });
  });
}

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
  await page.getByRole('button', { name: /^Professionals/ }).click();
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
  await page.getByRole('button', { name: /Profile queue/ }).click();
  await page.getByRole('button', { name: /Synthetic Patient/ }).click();
  await expect(page.getByText('Synthetic user-reported diabetes context')).toBeVisible();
  await page.getByRole('textbox', { name: 'Review notes' }).fill('Reviewed the synthetic details for planning.');
  await expect(page.getByRole('button', { name: 'Confirm for planning' })).toBeDisabled();
  await page.getByRole('button', { name: 'Claim profile' }).click();
  await expect(page.getByRole('button', { name: 'Confirm for planning' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm for planning' }).click();
  await expect(page.getByText('Profile queue is clear.')).toBeVisible();
  expect(decision).toMatchObject({ decision: 'APPROVED', profileRevision: 4, scopeKey: 'synthetic-scope-4' });
  expect(errors).toEqual([]);
});
