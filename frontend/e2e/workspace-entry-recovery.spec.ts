import { expect, test, type Page } from '@playwright/test';

type Role = 'USER' | 'NUTRITIONIST' | 'ADMIN';
const target = (role: Role) =>
  role === 'USER' ? '/onboarding/stats' : role === 'ADMIN' ? '/admin/overview' : '/nutritionist/reviews';
const profile = (role: Role, verified = true) => ({
  id: 'workspace-entry-fixture',
  name: 'Entry Fixture',
  email: 'entry@example.invalid',
  role,
  emailVerified: verified,
  onboardingDone: false,
  tosAccepted: false,
  reportAcknowledged: false,
  userProfile: null,
  healthConditions: [],
  allergies: [],
  safetyEntries: [],
  nutritionReport: null,
  onboardingStatus: { acceptedCurrentConsent: false, nextPath: '/onboarding/stats' },
});

async function setup(page: Page, role: Role, verified = true) {
  const claims = Buffer.from(
    JSON.stringify({
      userId: profile(role).id,
      email: profile(role).email,
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `fixture.${claims}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  const state = { verified, verifyRequests: 0, failed: false };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/user/profile'))
      return route.fulfill({
        status: state.failed ? 503 : 200,
        json: state.failed ? { success: false } : { success: true, data: profile(role, state.verified) },
      });
    if (path.endsWith('/auth/verify-email')) {
      state.verifyRequests++;
      state.verified = true;
      return route.fulfill({ json: { success: true } });
    }
    if (path.endsWith('/notifications'))
      return route.fulfill({ json: { success: true, data: { notifications: [], unreadCount: 0 } } });
    return route.fulfill({ status: 204 });
  });
  return state;
}

for (const role of ['NUTRITIONIST', 'ADMIN', 'USER'] as const) {
  for (const entry of ['/login', '/']) {
    test(`${role} recovers a stuck ${entry} client transition with one document navigation`, async ({ page }) => {
      await setup(page, role);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let softRequests = 0,
        documentRequests = 0;
      await page.route(`**${target(role)}*`, async (route) => {
        if (route.request().isNavigationRequest()) {
          documentRequests++;
          return route.continue();
        }
        softRequests++;
        await held;
        await route.abort().catch(() => undefined);
      });
      await page.clock.install();
      try {
        await page.goto(entry);
        await expect.poll(() => softRequests, { timeout: 20_000 }).toBeGreaterThan(0);
        await expect(page.getByText('Redirecting to your workspace...')).toBeVisible();
        await page.clock.fastForward(16_000);
        await expect(page).toHaveURL(new RegExp(`${target(role)}$`), { timeout: 25_000 });
        expect(documentRequests).toBe(1);
        await expect(page.getByText('Your workspace took too long to open')).toHaveCount(0);
      } finally {
        release();
      }
    });
  }
  test(`${role} verifies email once and follows its actual role instead of assuming member onboarding`, async ({
    page,
  }) => {
    const state = await setup(page, role, false);
    await page.goto('/verify-email');
    for (let digit = 1; digit <= 6; digit++)
      await page.getByLabel(`Verification code digit ${digit}`).fill(String(digit));
    await expect(page).toHaveURL(new RegExp(`${target(role)}$`), { timeout: 25_000 });
    expect(state.verifyRequests).toBe(1);
  });
}

test('the home entry shows profile recovery instead of a blank page or a false OTP requirement', async ({ page }) => {
  const state = await setup(page, 'NUTRITIONIST');
  state.failed = true;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Could not load your account' })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/$/);
  state.failed = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page).toHaveURL(/\/nutritionist\/reviews$/, { timeout: 25_000 });
});

test('a recent document fallback cannot turn a failed client transition into a reload loop', async ({ page }) => {
  await setup(page, 'NUTRITIONIST');
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'kainara-workspace-navigation-recovery',
      JSON.stringify({
        ownerId: 'workspace-entry-fixture',
        destination: '/nutritionist/reviews',
        attemptedAt: Date.now(),
      })
    )
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let documentRequests = 0;
  await page.route('**/nutritionist/reviews*', async (route) => {
    if (route.request().isNavigationRequest()) documentRequests++;
    await held;
    await route.abort().catch(() => undefined);
  });
  await page.clock.install();
  try {
    await page.goto('/login');
    await expect(page.getByText('Redirecting to your workspace...')).toBeVisible();
    await page.clock.fastForward(31_000);
    await expect(page.getByRole('heading', { name: 'Your workspace took too long to open' })).toBeVisible();
    expect(documentRequests).toBe(0);
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    release();
  }
});
