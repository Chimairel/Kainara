import { expect, test } from '@playwright/test';

// Synthetic SDK cases do not depend on Google's font CDN.
test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.gstatic.com/s/googlesans/**', (route) => route.abort());
});

for (const width of [1440, 390]) {
  test(`usable standard button is visible while its optional frame is still loading at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let releaseFrame!: () => void;
    const frameReady = new Promise<void>((resolve) => {
      releaseFrame = resolve;
    });
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
    await page.route('https://accounts.google.com/gsi/button-fixture', async (route) => {
      await frameReady;
      await route.fulfill({ contentType: 'text/html', body: '<button>Final Google button</button>' });
    });
    await page.route('https://accounts.google.com/gsi/client*', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.google = { accounts: { id: {
        initialize() {},
        renderButton(host, options) {
          const button = document.createElement('button');
          button.textContent = 'Continue with Google';
          button.style.cssText = 'display:block;height:40px;width:190px';
          window.googleButtonOptions = Object.keys(options);
          button.onclick = () => { window.standardGoogleClicked = true; };
          const frame = document.createElement('iframe');
          frame.title = 'Optional personalized Google button';
          frame.src = 'https://accounts.google.com/gsi/button-fixture';
          frame.style.cssText = 'display:block;width:0;height:0;border:0';
          frame.onload = () => { frame.style.width = '100%'; frame.style.height = '44px'; requestAnimationFrame(() => button.remove()); };
          host.append(button, frame);
        }
      } } };`,
      })
    );
    try {
      await page.goto('/login');
      await page.evaluate(() => document.fonts.ready);
      const original = await page.locator('.auth-card').boundingBox();
      const standard = page.getByRole('button', { name: 'Continue with Google', exact: true });
      await expect(standard).toBeVisible();
      expect(
        await page.evaluate(() => (window as typeof window & { googleButtonOptions: string[] }).googleButtonOptions)
      ).toEqual(['locale', 'shape', 'width', 'click_listener']);
      expect(await standard.evaluate((element) => element.closest('[inert]'))).toBeNull();
      await standard.click();
      expect(
        await page.evaluate(() => (window as typeof window & { standardGoogleClicked: boolean }).standardGoogleClicked)
      ).toBe(true);
      await expect(page.getByTitle('Optional personalized Google button')).toBeHidden();
      releaseFrame();
      await expect(page.getByTitle('Optional personalized Google button')).toBeVisible();
      const after = await page.locator('.auth-card').boundingBox();
      expect(after?.width).toEqual(original?.width);
      expect(
        await page.evaluate(
          () => document.querySelectorAll('script[src^="https://accounts.google.com/gsi/client"]').length
        )
      ).toBe(1);
    } finally {
      releaseFrame();
    }
  });
}

for (const width of [1440, 390]) {
  test(`retains the standard Google button when its frame is rejected at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
    await page.route('https://accounts.google.com/gsi/button-fixture', (route) =>
      route.fulfill({ status: 403, contentType: 'text/html', body: 'Origin rejected' })
    );
    await page.route('https://accounts.google.com/gsi/client*', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.google = { accounts: { id: {
        initialize() {},
        renderButton(host, options) {
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

for (const width of [1440, 390]) {
  test(`Google's temporary stacked handoff cannot move the form at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
    await page.route('https://accounts.google.com/gsi/client*', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.google = { accounts: { id: {
          initialize() {},
          renderButton(host, options) {
            const wrapper = document.createElement('div');
            wrapper.style.width = '190px';
            const standard = document.createElement('button');
            standard.textContent = 'Default Google button';
            standard.style.cssText = 'display:block;width:190px;height:40px';
            const replacement = document.createElement('iframe');
            replacement.title = 'Replacement Google button';
            replacement.style.cssText = 'display:block;width:190px;height:0;border:0';
            wrapper.append(standard, replacement);
            host.append(wrapper);
            window.googleHandoffPhase = (phase) => {
              if (phase === 'stacked') replacement.style.height = '40px';
              if (phase === 'final') standard.remove();
            };
          }
        } } };`,
      })
    );
    await page.goto('/login');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('button', { name: 'Default Google button' })).toBeVisible();
    const card = page.locator('.auth-card');
    const initial = await card.boundingBox();
    await page.evaluate(() =>
      (window as typeof window & { googleHandoffPhase: (phase: string) => void }).googleHandoffPhase('stacked')
    );
    await expect
      .poll(() => page.getByTitle('Replacement Google button').evaluate((frame) => frame.parentElement!.clientHeight))
      .toBe(80);
    expect(await card.boundingBox()).toEqual(initial);
    const visibleBottom = await page.getByRole('button', { name: 'Default Google button' }).evaluate((button) => {
      const slot = button.closest('[aria-busy]')!;
      return button.getBoundingClientRect().bottom <= slot.getBoundingClientRect().bottom;
    });
    expect(visibleBottom).toBe(true);
    await page.evaluate(() =>
      (window as typeof window & { googleHandoffPhase: (phase: string) => void }).googleHandoffPhase('final')
    );
    await expect(page.getByTitle('Replacement Google button')).toBeVisible();
    expect(await card.boundingBox()).toEqual(initial);
  });
}
