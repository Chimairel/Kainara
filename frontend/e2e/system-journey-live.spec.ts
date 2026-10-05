import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test.skip(
  process.env.NUTRIMIND_SYSTEM_AUDIT_BROWSER !== '1',
  'Requires the guarded disposable system-audit API and synthetic fixture state.'
);

const root = path.resolve('../.codex-runtime/system-audit');
const targets = [
  {
    role: 'none',
    pages: [
      '/dashboard',
      '/meals',
      '/meals?tab=history',
      '/meals?tab=library',
      '/grocery',
      '/progress',
      '/membership',
      '/profile/personal',
      '/profile/nutrition-report',
    ],
  },
  { role: 'rnd-a', pages: ['/nutritionist/reviews', '/nutritionist/library', '/nutritionist/profile'] },
  {
    role: 'admin',
    pages: ['/admin/overview', '/admin/users', '/admin/users?tab=nutritionists', '/admin/data', '/admin/meals'],
  },
];

for (const width of [390, 1440]) {
  for (const target of targets) {
    test(`${target.role}: real API views at ${width}px`, async ({ page, context }) => {
      test.setTimeout(180_000);
      const state = JSON.parse(readFileSync(path.join(root, 'state.json'), 'utf8'));
      const base = new URL(JSON.parse(readFileSync(path.join(root, 'browser-api.json'), 'utf8')).base);
      expect(base.hostname).toBe('127.0.0.1');
      // Each case gets a fresh real login; fixture files may outlive an access token.
      const login = await context.request.post(`${base.origin}/api/auth/login`, {
        data: { email: state.fixtures[target.role].email, password: 'SyntheticSystemAudit123!' },
      });
      expect(login.status()).toBe(200);
      const account = await login.json();
      const errors: string[] = [];
      const apiFailures: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 500)
          apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
      await page.route('**/api/**', async (route) => {
        const incoming = new URL(route.request().url());
        if (!['localhost', '127.0.0.1'].includes(incoming.hostname)) return route.continue();
        if (incoming.pathname === '/api/live/events')
          return route.continue({ url: `${base.origin}${incoming.pathname}${incoming.search}` });
        const response = await route.fetch({ url: `${base.origin}${incoming.pathname}${incoming.search}` });
        await route.fulfill({ response });
      });
      await context.addCookies([
        { name: 'nutrimind_session', value: account.data.accessToken, url: 'http://localhost:3000' },
      ]);
      await page.setViewportSize({ width, height: 900 });
      for (const route of target.pages) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);
        await expect(page.locator('main').first(), route).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('main').first(), route).not.toHaveText(/^\s*$/, { timeout: 30_000 });
        await expect(page).toHaveURL(new RegExp(route.split('?')[0].replace(/\//g, '\\/')));
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), {
            message: `Page overflow: ${route}`,
          })
          .toBeLessThanOrEqual(2);
        await expect(page.getByText('Application error: a client-side exception has occurred')).toHaveCount(0);
        if (route === '/profile/nutrition-report') {
          const expand = page.getByRole('button', { name: /expand.*guidance|expand.*report/i });
          if (await expand.count()) {
            await expand.first().click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.keyboard.press('Escape');
          }
        }
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      expect(errors).toEqual([]);
      expect(apiFailures).toEqual([]);
    });
  }
}
