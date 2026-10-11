import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test.skip(process.env.DEFENSE_GOVERNANCE_BROWSER !== 'true', 'Requires guarded local governance API.');
test('only admin releases a twice-flagged recipe, without RND confirmations', async ({ page, context }) => {
  test.setTimeout(90_000);
  const state = JSON.parse(readFileSync(path.resolve('../backend/.local/defense-governance-browser.json'), 'utf8'));
  const api = new URL(state.apiOrigin);
  expect(api.hostname).toBe('127.0.0.1');
  expect(api.port).not.toBe('5000');
  await context.addCookies([
    { name: 'nutrimind_session', value: state.actors.admin.token, url: test.info().project.use.baseURL! },
  ]);
  await context.route('**/api/**', async (route) => {
    const source = new URL(route.request().url());
    expect(['localhost', '127.0.0.1']).toContain(source.hostname);
    const url = `${api.origin}${source.pathname}${source.search}`;
    if (source.pathname === '/api/live/events') return route.continue({ url });
    const headers = { ...route.request().headers() };
    delete headers.origin;
    await route.fulfill({ response: await route.fetch({ url, headers }) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/meals');
  await page.getByRole('button', { name: 'Review case', exact: true }).first().click();
  const panel = page.getByRole('region', { name: 'Meal-wide review', exact: true });
  await expect(panel.getByRole('strong').filter({ hasText: /^Quarantined$/ })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Confirm this version' })).toHaveCount(0);
  await panel
    .getByLabel('Administrative rationale')
    .fill('Reviewed the twice-flagged recipe evidence and recorded concerns for this browser rehearsal.');
  const released = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/release')
  );
  await panel.getByRole('button', { name: 'Release quarantine', exact: true }).click();
  expect((await released).status()).toBe(200);
  const detail = await page.request.get(`${api.origin}/api/admin/meal-review-cases/${state.mealId}`, {
    headers: { Authorization: `Bearer ${state.actors.admin.token}` },
  });
  expect(detail.status()).toBe(200);
  expect((await detail.json()).data.state).toBe('PUBLISHED');
});
