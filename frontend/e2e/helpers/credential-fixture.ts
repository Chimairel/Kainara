import { expect, type Page } from '@playwright/test';

/** Browser presentation only; actual credential enforcement has guarded SQL/HTTP acceptance. */
export async function eligibleCredentialFixture(page: Page) {
  const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
  expect(['localhost', '127.0.0.1']).toContain(origin.hostname);
  await page.route('**/api/nutritionist/credential-status', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { eligible: true, reason: null, expiryDate: '2099-12-31', pendingRequest: null },
      },
    })
  );
}
