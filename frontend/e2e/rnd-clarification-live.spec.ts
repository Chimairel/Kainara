import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test.skip(process.env.RND_BATCH5_BROWSER !== 'true', 'Requires guarded task-owned Batch 5 APIs.');
type Fixture = {
  apiOrigin: string;
  memberId: string;
  mealId?: string;
  actors: Record<string, { userId: string; token: string }>;
};
const fixture = (kind: string): Fixture =>
  JSON.parse(readFileSync(path.resolve(`../backend/.local/batch5-${kind}-browser.json`), 'utf8'));

async function connect(context: BrowserContext, page: Page, state: Fixture, role: string) {
  const api = new URL(state.apiOrigin);
  expect(api.hostname).toBe('127.0.0.1');
  expect(api.port).not.toBe('5000');
  await context.addCookies([
    { name: 'nutrimind_session', value: state.actors[role].token, url: 'http://localhost:3000' },
  ]);
  // Forward every API operation to the authenticated disposable backend, never the shared API.
  await context.route('**/api/**', async (route) => {
    const request = new URL(route.request().url());
    expect(['localhost', '127.0.0.1']).toContain(request.hostname);
    const target = `${api.origin}${request.pathname}${request.search}`;
    if (request.pathname === '/api/live/events') return route.continue({ url: target });
    await route.fulfill({ response: await route.fetch({ url: target }) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

for (const width of [390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`repaired member history and purchases at ${width}px in ${theme}`, async ({ page, context }) => {
      test.setTimeout(90_000);
      const state = fixture('repair');
      await connect(context, page, state, 'member');
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/dashboard');
      await expect(page.getByText('Meals already recorded')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Preparing Your First Meal Plan')).toHaveCount(0);
      await expect(page.getByText('Eaten · 650 kcal')).toBeVisible();
      await page.goto('/meals');
      await expect(page.getByText('Meals already recorded')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Skipped', { exact: true })).toBeVisible();
      await page.goto('/grocery');
      await expect(page.getByText('Previous plan purchases')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Synthetic purchased ingredient', { exact: true })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
        .toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    });
  }

test('RND exact reference, canvas zoom, persistent questions, late member answer and successor handoff', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180_000);
  const state = fixture('reference');
  await connect(context, page, state, 'successor');
  await page.goto('/nutritionist/reviews');
  await page.getByRole('button', { name: /Case approval/i }).click();
  await page.getByText('Exact measured recipe', { exact: true }).first().click();
  await expect(page.getByLabel('Prior review references')).toBeAttached({ timeout: 30_000 });
  await page.getByRole('button', { name: /Claim review/i }).click();
  await page.getByRole('button', { name: /Expand canvas/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const viewport = page.getByLabel('Review canvas viewport');
  const before = await page.locator('[data-canvas-world]').evaluate((node) => (node as HTMLElement).style.transform);
  await viewport.hover();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect
    .poll(() => page.locator('[data-canvas-world]').evaluate((node) => (node as HTMLElement).style.transform))
    .not.toBe(before);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: /Hand tool/i })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('v');
  await page.getByRole('button', { name: /Move.*clarification.*sheet/i }).focus();
  await page.getByRole('button', { name: 'Fit selected sheet' }).click();
  await page.getByLabel('Form title').fill('Recorded context follow-up');
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByLabel('Question 1', { exact: true }).fill('Has your recorded health context changed?');
  await page.getByRole('button', { name: 'Send questions' }).click();
  await expect(page.getByText('A clear path to every review')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/nutritionist\/reviews/);
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await connect(memberContext, memberPage, state, 'member');
  await memberPage.goto('/profile/clinical-evidence');
  await expect(memberPage.getByText('Recorded context follow-up', { exact: true })).toBeVisible({ timeout: 30_000 });
  await memberPage
    .getByLabel(/Has your recorded health context changed/)
    .fill('My recorded context is unchanged. This is a late answer.');
  await memberPage.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(memberPage.getByText(/Awaiting RND review/)).toBeVisible();
  await memberContext.close();
  // Another eligible RND resumes the Profile case; the source meal claim was released automatically.
  await context.clearCookies();
  await context.addCookies([
    { name: 'nutrimind_session', value: state.actors.rnd.token, url: 'http://localhost:3000' },
  ]);
  await page.goto('/nutritionist/reviews');
  await page.getByRole('button', { name: /Member queue/i }).click();
  await page.getByText('Synthetic USER', { exact: true }).first().click();
  await expect(page.getByText('Recorded context follow-up', { exact: true }).first()).toBeAttached({ timeout: 30_000 });
  await expect(page.getByLabel(/Has your recorded health context changed/)).toHaveValue(
    'My recorded context is unchanged. This is a late answer.'
  );
});
