import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page, role: 'USER' | 'NUTRITIONIST', paused: string, due = false) {
  const user = {
    id: 'loading-layout-fixture',
    name: 'Preview Member',
    email: 'preview@example.invalid',
    role,
    emailVerified: true,
    onboardingDone: true,
    tosAccepted: true,
    reportAcknowledged: true,
    onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
    userProfile: { weightKg: 58, targetWeightKg: 65, dailyCalorieTarget: 2786, revision: 1, safetyRevision: 1 },
    healthConditions: [],
    allergies: [],
    safetyEntries: [],
  };
  const payload = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, role, exp: 4102444800 })).toString(
    'base64url'
  );
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `fixture.${payload}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  let submitted: unknown = null;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/live/') || route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (paused && path.includes(paused)) return;
    let data: unknown = [];
    if (path.endsWith('/user/profile')) data = user;
    else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
    else if (path.endsWith('/user/membership')) data = { enabled: false };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    else if (path.endsWith('/checkin/status'))
      data = { isDue: due, hasPendingChanges: false, profileRevision: 1, weeksSinceConfirmation: 1 };
    else if (path.endsWith('/checkin/submit')) {
      submitted = route.request().postDataJSON();
      due = false;
      data = { id: 'checkin' };
    } else if (path.endsWith('/progress/history')) data = { weightLogs: [], dailyNutritionLogs: [] };
    return route.fulfill({ json: { success: true, data } });
  });
  return () => submitted;
}

const pages = [
  { url: '/dashboard', role: 'USER', paused: '/meals/current', label: 'Loading daily dashboard' },
  { url: '/grocery', role: 'USER', paused: '/grocery/workspace', label: 'Loading grocery checklist' },
  { url: '/progress', role: 'USER', paused: '/progress/history', label: 'Loading progress data' },
  { url: '/meals', role: 'USER', paused: '/user/meals/', label: 'Loading meal plan schedule' },
  {
    url: '/nutritionist/library',
    role: 'NUTRITIONIST',
    paused: '/nutritionist/library',
    label: 'Loading meal library grid',
  },
  {
    url: '/nutritionist/approved',
    role: 'NUTRITIONIST',
    paused: '/nutritionist/approved',
    label: 'Loading approved reviews archive',
  },
  {
    url: '/nutritionist/profile',
    role: 'NUTRITIONIST',
    paused: '/nutritionist/profile',
    label: 'Loading professional profile',
  },
  {
    url: '/nutritionist/reviews',
    role: 'NUTRITIONIST',
    paused: '/nutritionist/queue',
    label: 'Loading review queue items',
  },
  {
    url: '/nutritionist/outside-meals',
    role: 'NUTRITIONIST',
    paused: '/outside-meals',
    label: 'Loading outside food estimates',
  },
] as const;

for (const width of [320, 1440])
  for (const item of pages) {
    test(`${item.url} loading layout fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await fixture(page, item.role, item.paused);
      await page.goto(item.url);
      await expect(page.getByLabel(item.label, { exact: true })).toBeVisible();
      expect(await page.getByRole('heading', { level: 1 }).count()).toBeLessThanOrEqual(1);
      expect(await page.locator('main').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      const circles = page.getByLabel(item.label, { exact: true }).locator('.rounded-full');
      if (await circles.count()) {
        expect(
          await circles.evaluateAll((nodes) =>
            nodes.every(
              (node) => parseFloat(getComputedStyle(node).borderRadius) >= node.getBoundingClientRect().height / 2
            )
          )
        ).toBe(true);
      }
      await page.screenshot({ path: test.info().outputPath('loading-layout.png') });
    });
  }

test('weekly check-in remains available when due and submits the unchanged profile', async ({ page }) => {
  const submission = await fixture(page, 'USER', '/progress/history', true);
  await page.goto('/progress');
  await page.getByRole('button', { name: 'Complete check-in', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Weekly Check-in Due', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Still the same', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(submission()).toEqual({ changed: false, profileRevision: 1 });
});

test('weekly check-in is hidden when the server says it is not due', async ({ page }) => {
  await fixture(page, 'USER', '/progress/history');
  await page.goto('/progress');
  await expect(page.getByLabel('Loading progress data')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete check-in' })).toHaveCount(0);
});
