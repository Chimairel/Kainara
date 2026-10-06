import { expect, test } from '@playwright/test';

// Exercise the real credential callback/session/router with synthetic HTTP responses.
// No Google verification, real account, email or database write is performed.
for (const width of [1440, 390]) {
  for (const entry of ['/login', '/register']) {
    test(`${entry} retains its layout through OAuth at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem('nutrimind-theme', theme),
        width === 390 ? 'dark' : 'light'
      );
      let releaseProfile!: () => void;
      let releaseDestination!: () => void;
      const profileReady = new Promise<void>((resolve) => {
        releaseProfile = resolve;
      });
      const destinationReady = new Promise<void>((resolve) => {
        releaseDestination = resolve;
      });
      const claims = Buffer.from(
        JSON.stringify({
          userId: 'oauth-transition-fixture',
          email: 'oauth@example.invalid',
          role: 'USER',
          exp: 4102444800,
        })
      ).toString('base64url');
      await page.route('https://accounts.google.com/gsi/client', (route) =>
        route.fulfill({
          contentType: 'application/javascript',
          body: `window.google = { accounts: { id: {
          initialize(config) { window.syntheticCredential = config.callback; },
          renderButton(element) {
            const button = document.createElement('button');
            button.textContent = 'Synthetic Google sign-in';
            button.style.height = '40px';
            button.onclick = () => window.syntheticCredential({ credential: 'synthetic-google-id' });
            element.appendChild(button);
          }
        } } };`,
        })
      );
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/auth/google/continue')) {
          return route.fulfill({ json: { success: true, data: { accessToken: `fixture.${claims}.fixture` } } });
        }
        if (path.endsWith('/user/profile')) {
          await profileReady;
          return route.fulfill({
            json: {
              success: true,
              data: {
                id: 'oauth-transition-fixture',
                name: 'OAuth Fixture',
                email: 'oauth@example.invalid',
                role: 'USER',
                emailVerified: true,
                onboardingDone: false,
                tosAccepted: false,
                reportAcknowledged: false,
                onboardingStatus: { acceptedCurrentConsent: false, nextPath: '/onboarding/stats' },
                healthConditions: [],
                allergies: [],
                userProfile: null,
              },
            },
          });
        }
        return route.fulfill({ status: 401, json: { success: false } });
      });
      await page.route(
        (url) => url.pathname === '/onboarding/stats',
        async (route) => {
          await destinationReady;
          await route.continue();
        }
      );
      try {
        await page.goto(entry);
        await expect(page.getByRole('button', { name: 'Synthetic Google sign-in' })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const card = page.locator('.auth-card');
        const originalCard = await card.elementHandle();
        const before = await card.boundingBox();
        await originalCard!.evaluate((element, authPath) => {
          const tracker = window as typeof window & { missingAuthFrames: number };
          tracker.missingAuthFrames = 0;
          const sampleFrame = () => {
            if (location.pathname !== authPath) return;
            if (!element.isConnected) tracker.missingAuthFrames++;
            requestAnimationFrame(sampleFrame);
          };
          requestAnimationFrame(sampleFrame);
        }, entry);
        const profileRequest = page.waitForRequest((request) =>
          new URL(request.url()).pathname.endsWith('/user/profile')
        );
        await page.getByRole('button', { name: 'Synthetic Google sign-in' }).click();
        await profileRequest;
        // Profile verification is still in flight: the same card must remain mounted.
        await expect(card).toBeVisible();
        expect(await originalCard!.evaluate((element) => element.isConnected)).toBe(true);
        await expect(page.getByText('Checking your account…', { exact: true })).toBeVisible();
        expect(await card.boundingBox()).toEqual(before);
        const destinationRequest = page.waitForRequest(
          (request) => new URL(request.url()).pathname === '/onboarding/stats'
        );
        releaseProfile();
        await destinationRequest;
        // Route loading is also delayed, exposing any intermediate full-screen flash.
        await expect(page.getByText('Redirecting to your workspace...', { exact: true })).toBeVisible();
        expect(await originalCard!.evaluate((element) => element.isConnected)).toBe(true);
        expect(await card.boundingBox()).toEqual(before);
        releaseDestination();
        await expect(page).toHaveURL(/\/onboarding\/stats$/);
        await expect(page.getByRole('heading', { name: 'PERSONAL METRICS', exact: true })).toBeVisible();
        await expect(card).toHaveCount(0);
        expect(
          await page.evaluate(() => (window as typeof window & { missingAuthFrames: number }).missingAuthFrames)
        ).toBe(0);
      } finally {
        releaseProfile();
        releaseDestination();
      }
    });
  }
}
