import { expect, test, type Page } from '@playwright/test';

// Synthetic inbox/session only; the actual public MP3 and browser audio decoder are used.
async function setup(page: Page) {
  const now = Date.now();
  const owner = 'notification-audio-fixture';
  const payload = Buffer.from(
    JSON.stringify({
      userId: owner,
      email: 'notification@preview.invalid',
      role: 'USER',
      exp: Math.floor(now / 1000) + 3600,
    })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `fixture.${payload}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  await page.addInitScript(() => {
    const stats = { plays: 0, duration: 0 };
    (window as unknown as { notificationAudio: typeof stats }).notificationAudio = stats;
    const prototype = window.AudioContext.prototype;
    const decode = prototype.decodeAudioData;
    prototype.decodeAudioData = function (data, success, failure) {
      return decode.call(
        this,
        data,
        (buffer) => {
          stats.duration = buffer.duration;
          success?.(buffer);
        },
        failure
      );
    };
    const create = prototype.createBufferSource;
    prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = (when = 0, offset = 0, duration?: number) => {
        if (duration === undefined) start(when, offset);
        else start(when, offset, duration);
        stats.plays++;
      };
      return source;
    };
  });
  let notifications = [
    {
      id: 'old',
      title: 'Old fixture alert',
      message: 'Already in the inbox',
      type: 'PLAN_APPROVED',
      isRead: false,
      createdAt: new Date(now - 60000).toISOString(),
    },
  ];
  let plannerRequests = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
      return route.fulfill({ status: 204, headers });
    if (path.endsWith('/meals/readiness') || path.endsWith('/meals/cycles')) plannerRequests++;
    let data: unknown = [];
    if (path.endsWith('/notifications')) data = { notifications, unreadCount: notifications.length };
    else if (path.endsWith('/user/profile'))
      data = {
        id: owner,
        name: 'Audio Fixture',
        email: 'notification@preview.invalid',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        nutritionReport: { acknowledgedAt: new Date(now).toISOString(), isStale: false },
        userProfile: { revision: 1, safetyRevision: 1 },
        healthConditions: [],
        allergies: [],
        safetyEntries: [],
      };
    else if (path.endsWith('/user/membership')) data = { enabled: false };
    else if (path.endsWith('/meals/readiness'))
      data = { canRequestPlan: true, title: 'Ready', message: 'Fixture status' };
    else if (path.endsWith('/meals/cycles')) data = { current: null, upcoming: null };
    await route.fulfill({ headers, json: { success: true, data } });
  });
  const refresh = () => page.evaluate(() => window.dispatchEvent(new Event('kainara:live-update')));
  return {
    refresh,
    plannerRequests: () => plannerRequests,
    async add(id: string) {
      notifications = [
        {
          ...notifications[0],
          id,
          title: `New alert ${id}`,
          createdAt: new Date(now + notifications.length * 1000).toISOString(),
        },
        ...notifications,
      ];
      await refresh();
      await expect(page.getByText(`New alert ${id}`, { exact: true })).toBeVisible();
    },
  };
}

for (const width of [1440, 390]) {
  test(`provided MP3, new alerts and persistent mute at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await setup(page);
    const stats = () =>
      page.evaluate(
        () => (window as unknown as { notificationAudio: { plays: number; duration: number } }).notificationAudio
      );
    await page.goto('/profile/security');
    await page.getByRole('button', { name: 'View notifications' }).click();
    await expect(page.getByText('Old fixture alert', { exact: true })).toBeVisible();
    await expect(page.getByText('Planner Status', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Starter Plan Active', { exact: true })).toHaveCount(0);
    expect(fixture.plannerRequests()).toBe(0);
    await expect.poll(async () => (await stats()).duration).toBeGreaterThan(0);
    expect((await stats()).plays).toBe(0);
    await fixture.add('first');
    await expect.poll(async () => (await stats()).plays).toBe(1);
    await fixture.refresh();
    expect((await stats()).plays).toBe(1);
    const sound = page.getByRole('switch', { name: 'Notification sound' });
    await sound.click();
    await expect(sound).toHaveAttribute('aria-checked', 'false');
    await fixture.add('muted');
    expect((await stats()).plays).toBe(1);
    const box = await sound.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
    await page.reload();
    await page.getByRole('button', { name: 'View notifications' }).click();
    await expect(sound).toHaveAttribute('aria-checked', 'false');
    expect((await stats()).plays).toBe(0);
    await sound.click();
    await expect.poll(async () => (await stats()).duration).toBeGreaterThan(0);
    await fixture.add('enabled');
    await expect.poll(async () => (await stats()).plays).toBe(1);
    expect(fixture.plannerRequests()).toBe(0);
    expect(errors).toEqual([]);
  });
}
