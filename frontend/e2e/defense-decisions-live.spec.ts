import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test.skip(process.env.RND_BATCH5_BROWSER !== 'true', 'Requires task-owned loopback acceptance API.');
type Fixture = {
  apiOrigin: string;
  outsideName: string;
  decisionMeals: Record<string, string>;
  actors: Record<string, { token: string }>;
};
const fixture = (): Fixture =>
  JSON.parse(readFileSync(path.resolve('../backend/.local/batch5-reference-browser.json'), 'utf8'));
async function connect(context: BrowserContext, page: Page, role = 'successor') {
  const state = fixture();
  const api = new URL(state.apiOrigin);
  expect(api.hostname).toBe('127.0.0.1');
  expect(api.port).not.toBe('5000');
  await context.addCookies([
    { name: 'nutrimind_session', value: state.actors[role].token, url: test.info().project.use.baseURL! },
  ]);
  await context.route('**/api/**', async (route) => {
    const request = new URL(route.request().url());
    expect(['localhost', '127.0.0.1']).toContain(request.hostname);
    const url = `${api.origin}${request.pathname}${request.search}`;
    if (request.pathname === '/api/live/events') return route.continue({ url });
    const headers = { ...route.request().headers() };
    delete headers.origin;
    await route.fulfill({ response: await route.fetch({ url, headers }) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  return state;
}
async function claim(page: Page, action: string) {
  await page.goto('/nutritionist/reviews');
  await page.getByRole('button', { name: /Case approval/i }).click();
  await page.getByText(`Browser ${action} plate`, { exact: true }).first().click();
  await page.getByRole('button', { name: /Claim review/i }).click();
  await expect(page.getByRole('button', { name: /Release claim/i })).toBeVisible();
}

for (const action of ['approve', 'reject']) {
  test(`actual RND ${action} confirmation and persisted decision`, async ({ page, context }) => {
    test.setTimeout(90_000);
    const state = await connect(context, page);
    await claim(page, action);
    await page.getByRole('button', { name: action === 'approve' ? 'Approve' : 'Reject', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').fill('Browser rehearsal: recorded evidence checked against the member context.');
    const decision = page.waitForResponse(
      (response) => response.request().method() === 'PATCH' && response.url().includes('/nutritionist/')
    );
    await dialog.getByRole('button', { name: action === 'approve' ? 'Confirm approval' : 'Confirm rejection' }).click();
    const response = await decision;
    expect(response.status()).toBe(200);
    await expect(dialog).toHaveCount(0);
    const status = await page.request.get(
      `${state.apiOrigin}/api/nutritionist/queue/${state.decisionMeals[action]}/status`,
      { headers: { Authorization: `Bearer ${state.actors.successor.token}` } }
    );
    expect(status.status()).toBe(409);
    expect((await status.json()).errorCode).toBe('MEAL_REVIEW_INACTIVE');
  });
}

test('RND swap stays pending until a separate approval', async ({ page, context }) => {
  test.setTimeout(90_000);
  const state = await connect(context, page);
  await claim(page, 'swap');
  await page.getByRole('button', { name: 'Swap', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Mini Meal Library', { exact: true })).toBeVisible();
  const option = dialog
    .getByRole('button')
    .filter({ has: page.locator('h4') })
    .first();
  await expect(option).toBeVisible();
  await option.click();
  await dialog
    .getByLabel('Replacement rationale (at least 10 characters)')
    .fill('Selected an eligible alternate plate after checking its recorded evidence.');
  const swapped = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/swap')
  );
  await dialog.getByRole('button', { name: 'Confirm swap', exact: true }).click();
  const response = await swapped;
  expect(response.status()).toBe(200);
  const replacement = (await response.json()).data.replacementPlanId;
  const detail = await page.request.get(`${state.apiOrigin}/api/nutritionist/queue/${replacement}`, {
    headers: { Authorization: `Bearer ${state.actors.successor.token}` },
  });
  expect(detail.status()).toBe(200);
  expect((await detail.json()).data.mealPlan.status).toBe('PENDING_REVIEW');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
});

test('admin opens the newly approved historical case in the read-only canvas', async ({ page, context }) => {
  test.setTimeout(90_000);
  await connect(context, page, 'admin');
  await page.goto('/admin/audit');
  await page.getByRole('button', { name: 'RND history', exact: true }).click();
  await page.getByLabel('Action', { exact: true }).click();
  await page.getByRole('option', { name: 'Approvals', exact: true }).click();
  await page
    .getByRole('button', { name: /^Details/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Open related review details', exact: true }).click();
  await expect(page.getByLabel('Review canvas viewport')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Claim review', exact: true })).toHaveCount(0);
  await expect(page.getByText('Case details could not be loaded.')).toHaveCount(0);
});

test('member explicitly requests outside-food review and RND corrects the saved estimate', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90_000);
  const state = await connect(context, page, 'outsideMember');
  await page.goto('/meals');
  await page.getByRole('button', { name: /^History/ }).click();
  await expect(page.getByText(state.outsideName, { exact: true }).first()).toBeVisible();
  await page.getByRole('button').filter({ hasText: state.outsideName }).first().click();
  const requested = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/request-review')
  );
  await page.getByRole('button', { name: 'Ask RND to review', exact: true }).click();
  expect((await requested).status()).toBe(200);
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await connect(staffContext, staff);
  await staff.goto('/nutritionist/reviews');
  await staff.getByRole('button', { name: /Case approval/i }).click();
  await staff.getByRole('button', { name: 'Outside food logs', exact: true }).click();
  await staff.getByRole('button').filter({ hasText: state.outsideName }).first().click();
  await staff.getByLabel(/Calories \(kcal\)/).fill('330');
  await staff
    .getByLabel('Reference and review notes (required)')
    .fill('Synthetic browser check: adjusted the reported portion against the recorded reference.');
  const corrected = staff.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.url().includes('/outside-meal-reviews/')
  );
  await staff.getByRole('button', { name: 'Save correction', exact: true }).click();
  expect((await corrected).status()).toBe(200);
  await staffContext.close();
  await page.reload();
  await page.getByRole('button', { name: /^History/ }).click();
  await page.getByRole('button').filter({ hasText: state.outsideName }).first().click();
  await expect(page.getByText(/330 kcal/).first()).toBeVisible();
});
