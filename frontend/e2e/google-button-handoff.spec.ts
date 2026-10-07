import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`hides intermediate Google layouts without moving the form at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let releaseFrame!: () => void;
    const frameLoaded = new Promise<void>((resolve) => {
      releaseFrame = resolve;
    });
    await page.route('https://accounts.google.com/gsi/button-fixture', async (route) => {
      await frameLoaded;
      await route.fulfill({ contentType: 'text/html', body: '<button>Continue with Google</button>' });
    });
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
    await page.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.google = { accounts: { id: {
          initialize() {},
          renderButton(host) {
            const temporary = document.createElement('div');
            temporary.style.height = '40px';
            const frame = document.createElement('iframe');
            frame.src = 'https://accounts.google.com/gsi/button-fixture';
            frame.title = 'Synthetic Google sign-in';
            frame.style.cssText = 'display:block;width:100%;height:0;border:0';
            host.append(temporary, frame);
            window.finishGooglePhase = (phase) => {
              if (phase === 'stacked') frame.style.height = '44px';
              if (phase === 'ready') temporary.remove();
            };
          }
        } } };`,
      })
    );
    await page.goto('/login');
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('.auth-card');
    const frame = page.getByTitle('Synthetic Google sign-in');
    await expect(frame).toHaveCount(1);
    const original = await card.boundingBox();
    await expect(frame).toBeHidden();
    await page.evaluate(() =>
      (window as unknown as { finishGooglePhase: (phase: string) => void }).finishGooglePhase('stacked')
    );
    await expect.poll(() => frame.evaluate((element) => element.getBoundingClientRect().height)).toBe(44);
    await expect(frame).toBeHidden();
    expect(await card.boundingBox()).toEqual(original);
    await page.evaluate(() =>
      (window as unknown as { finishGooglePhase: (phase: string) => void }).finishGooglePhase('ready')
    );
    await expect(frame).toBeHidden();
    releaseFrame();
    await expect(frame).toBeVisible();
    expect(await card.boundingBox()).toEqual(original);
    expect(await frame.evaluate((element) => element.closest('[inert]'))).toBeNull();
    await expect(page.getByLabel('Email address')).toBeEnabled();
  });
}
