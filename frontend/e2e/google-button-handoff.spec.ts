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

for (const width of [1440, 390]) {
  test(`retains the standard Google button when its frame is rejected at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
    await page.route('https://accounts.google.com/gsi/button-fixture', (route) =>
      route.fulfill({ status: 403, contentType: 'text/html', body: 'Origin rejected' })
    );
    await page.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.google = { accounts: { id: {
        initialize() {},
        renderButton(host) {
          const button = document.createElement('div');
          button.setAttribute('role', 'button');
          button.setAttribute('tabindex', '0');
          button.style.cssText = 'height:40px;width:100%';
          button.textContent = 'Continue with Google';
          const frame = document.createElement('iframe');
          frame.src = 'https://accounts.google.com/gsi/button-fixture';
          frame.style.cssText = 'display:block;width:0;height:0;border:0';
          host.append(button, frame);
        }
      } } };`,
      })
    );
    await page.goto('/login');
    const button = page.getByRole('button', { name: 'Continue with Google' });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    expect(await button.evaluate((element) => element.closest('[inert]'))).toBeNull();
    // The old display check times out and replaces this standard button with an error.
    await page.clock.install();
    await page.clock.fastForward(11000);
    await expect(button).toBeVisible();
    await expect(page.getByText('Google sign-in is temporarily unavailable.', { exact: false })).toHaveCount(0);
  });
}
