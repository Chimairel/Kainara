import { expect, test, type Page } from '@playwright/test';
import { createECDH } from 'node:crypto';

const keyPair = createECDH('prime256v1');
keyPair.generateKeys();
const publicKey = keyPair.getPublicKey().toString('base64url');
async function fixtures(page: Page, onboarded: boolean) {
  const schedule = {
    breakfastTime: '07:00',
    lunchTime: '12:00',
    dinnerTime: '18:00',
    timeZone: 'Asia/Manila',
    remindersEnabled: false,
    prepareEnabled: true,
    logEnabled: true,
  };
  const user = {
    id: 'reminder-browser',
    name: 'Synthetic Member',
    email: 'reminders@example.invalid',
    role: 'USER',
    emailVerified: true,
    onboardingDone: onboarded,
    tosAccepted: onboarded,
    reportAcknowledged: true,
    onboardingStatus: { acceptedCurrentConsent: onboarded, nextPath: onboarded ? null : '/onboarding/preferences' },
    userProfile: {
      revision: 1,
      safetyRevision: 1,
      age: 25,
      heightCm: 170,
      weightKg: 65,
      targetWeightKg: 65,
      biologicalSex: 'MALE',
      dietaryPreference: 'OMNIVORE',
      ricePreference: 'FLEXIBLE',
      foodCulture: 'Filipino',
      activityLevel: 'ACTIVE',
      goal: 'MAINTAIN',
      dailyCalorieTarget: 2000,
      shoppingDayOfWeek: 6,
    },
    mealReminderSettings: schedule,
    healthConditions: [],
    allergies: [],
    safetyEntries: [],
  };
  const payload = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `fixture.${payload}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  let saves = 0,
    subscribed = false,
    tests = 0;
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.includes('/live/') || route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path.endsWith('/user/profile') || path.endsWith('/user/onboarding/profile')) data = user;
    else if (path.endsWith('/user/membership')) data = { enabled: false };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    else if (path.endsWith('/user/meal-reminders')) {
      if (route.request().method() === 'PUT') {
        Object.assign(schedule, route.request().postDataJSON());
        saves++;
      }
      data = schedule;
    } else if (path.endsWith('/push/config')) data = { available: true, publicKey };
    else if (path.endsWith('/push/status')) data = { subscribed };
    else if (path.endsWith('/push/subscription')) subscribed = route.request().method() === 'POST';
    else if (path.endsWith('/push/test')) {
      tests++;
      data = { accepted: true };
    }
    return route.fulfill({ json: { success: true, data } });
  });
  return { schedule, saves: () => saves, subscribed: () => subscribed, tests: () => tests };
}

for (const width of [390, 1280]) {
  test(`onboarding saves editable meal times with preferences at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await fixtures(page, false);
    await page.goto('/onboarding/preferences');
    await expect(page.getByLabel('Breakfast', { exact: true })).toHaveValue('07:00');
    await page.getByLabel('Breakfast', { exact: true }).fill('08:30');
    await page.getByLabel('Lunch', { exact: true }).fill('13:15');
    await page.getByLabel('Dinner', { exact: true }).fill('19:45');
    await page.getByLabel('Timezone', { exact: true }).fill('Asia/Manila');
    await page.getByRole('button', { name: /Continue to Step 3/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/conditions$/);
    expect(fixture.schedule.breakfastTime).toBe('08:30');
    expect(fixture.schedule.lunchTime).toBe('13:15');
    expect(fixture.schedule.dinnerTime).toBe('19:45');
    expect(fixture.schedule.remindersEnabled).toBe(false);
    expect(fixture.saves()).toBe(1);
  });
  test(`meal reminder settings enable, test and disable this device at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.context().grantPermissions(['notifications']);
    const fixture = await fixtures(page, true);
    await page.addInitScript(
      ({ publicKey }) => {
        let current: PushSubscription | null = null;
        PushManager.prototype.getSubscription = async () => current;
        PushManager.prototype.subscribe = async (options) => {
          const json = {
            endpoint: 'https://fcm.googleapis.com/send/browser-fixture',
            keys: { p256dh: publicKey, auth: 'AAAAAAAAAAAAAAAAAAAAAA' },
          };
          current = {
            endpoint: json.endpoint,
            options,
            toJSON: () => json,
            unsubscribe: async () => {
              current = null;
              return true;
            },
          } as unknown as PushSubscription;
          return current;
        };
      },
      { publicKey }
    );
    await page.goto('/profile/planning');
    await expect(page.getByRole('heading', { name: 'Meal times & reminders' })).toBeVisible();
    await page.getByLabel('Breakfast', { exact: true }).fill('08:30');
    await page.getByLabel('Send meal reminders', { exact: true }).check();
    await expect(page.getByLabel('Prepare: 60 minutes before eating')).toBeChecked();
    await page.getByRole('button', { name: 'Save meal times', exact: true }).click();
    await expect(page.getByText('Meal times and reminder preferences saved.')).toBeVisible();
    await page.getByRole('button', { name: 'Enable on this device', exact: true }).click();
    await expect(page.getByText('Notifications are enabled on this device.')).toBeVisible();
    expect(fixture.subscribed()).toBe(true);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL)).toContain(
      '/kainara-notifications-sw.js'
    );
    await page.getByRole('button', { name: 'Send test notification', exact: true }).click();
    await expect(page.getByText('Test sent. Check your device notification panel.')).toBeVisible();
    expect(fixture.tests()).toBe(1);
    await page.screenshot({ path: testInfo.outputPath('meal-reminders.png') });
    await page.getByRole('button', { name: 'Disable on this device', exact: true }).click();
    await expect(page.getByText('Notifications are disabled on this device.')).toBeVisible();
    expect(fixture.subscribed()).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
