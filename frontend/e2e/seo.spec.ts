import { expect, test } from '@playwright/test';
import { PUBLIC_SEARCH_PAGES, SITE_URL } from '../src/lib/seo';
import { displayPrices } from '../src/features/membership/checkout';

// This suite compiles several App Router routes on the existing development server.
test.setTimeout(90_000);

test('public metadata is rendered before JavaScript and stays consistent after hydration', async ({
  page,
  request,
}) => {
  // Anonymous public browsing only; intercept browser API calls without changing accounts or records.
  await page.route('**/api/**', (route) =>
    new URL(route.request().url()).pathname === '/api/membership/plans'
      ? route.fulfill({ json: { success: true, data: { prices: displayPrices, currency: 'PHP', mode: 'TEST' } } })
      : route.fulfill({ status: 401, json: { success: false } })
  );
  for (const [path, info] of Object.entries(PUBLIC_SEARCH_PAGES)) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toContain(`<title>${info.title.replaceAll('&', '&amp;')}</title>`);
    expect(html).toContain(`rel="canonical" href="${SITE_URL}${path === '/' ? '' : path}"`);
    expect(html).toContain('property="og:image"');
    await page.goto(path);
    await expect(page).toHaveTitle(info.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', info.description);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${SITE_URL}${path === '/' ? '' : path}`
    );
    await expect(page.locator('h1')).toHaveCount(1);
  }
});

test('anonymous workspace/account HTML is noindex and has no inherited home canonical', async ({ request }) => {
  for (const path of [
    '/login',
    '/register',
    '/dashboard',
    '/meals',
    '/profile/health',
    '/nutritionist/reviews',
    '/admin/overview',
    '/onboarding/stats',
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).not.toContain('rel="canonical"');
  }
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml.match(/<loc>/g)).toHaveLength(4);
  for (const path of ['/dashboard', '/profile/', '/admin/', '/sources', '/help', '/login'])
    expect(xml).not.toContain(path);
  const graph = await (await request.get('/')).text();
  expect(graph).toContain('"@type":"WebSite"');
  expect(graph).toContain('"name":"Kainara"');
  const image = await request.get('/opengraph-image');
  expect(image.ok()).toBe(true);
  expect(image.headers()['content-type']).toContain('image/png');
});

test('documentation introduction exists without JavaScript and chapter links still navigate', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/docs')).text();
  expect(html).toContain('KAINARA helps people plan meals and record nutrition in a Filipino food context.');
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
  await page.goto('/docs#data-sources');
  await expect(page.locator('article')).toContainText('Sources and evidence');
  await expect(page).toHaveTitle(PUBLIC_SEARCH_PAGES['/docs'].title);
});
