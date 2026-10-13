import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
async function prepare(page: Page, theme = 'light', member = false) {
  await page.addInitScript((theme) => localStorage.setItem('nutrimind-theme', theme), theme);
  if (member) {
    const claims = Buffer.from(JSON.stringify({ userId: 'support-preview', email: 'support@example.invalid', role: 'USER', exp: 4102444800 })).toString('base64url');
    await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
  }
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
    if (route.request().method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
    if (path.endsWith('/support/requests')) throw new Error('Support delivery must be explicitly intercepted by this test.');
    const data = path.endsWith('/user/profile') ? { id: 'support-preview', name: 'Synthetic Support Preview', email: 'support@example.invalid', role: 'USER', emailVerified: true, onboardingDone: false, tosAccepted: false, reportAcknowledged: false, onboardingStatus: { acceptedCurrentConsent: false, nextPath: '/onboarding/stats' } } : path.endsWith('/notifications') ? { notifications: [], unreadCount: 0 } : [];
    return route.fulfill({ headers, json: { success: true, data } });
  });
}

for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`Docs and Contact Support ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await prepare(page, theme, true);
    await page.goto('/docs');
    await expect(page.getByRole('heading', { name: 'Your Kainara guide.' })).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Search the guide and FAQs' });
    expect(await search.evaluate((element) => getComputedStyle(element.parentElement!).boxShadow)).not.toBe('none');
    await search.fill('previous plan');
    await page.screenshot({ path: `../backend/.local/docs-support/search-${width}-${theme}.png`, style: 'nextjs-portal { display:none; }' });
    await page.getByRole('link', { name: 'FAQs Where is a meal I ate from my previous plan?' }).click();
    const answer = page.getByRole('article').getByRole('button', { name: 'Where is a meal I ate from my previous plan?' });
    await expect(answer).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#faqs-previous-plan-content')).toContainText('Eaten · previous plan');
    await answer.click(); await expect(answer).toHaveAttribute('aria-expanded', 'false');
    await answer.press('Enter'); await expect(answer).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../backend/.local/docs-support/docs-${width}-${theme}.png`, style: 'nextjs-portal { display:none; }' });
    await search.fill('noexistingsupportterm'); await expect(page.locator('#docs-search-results')).toContainText('No matching sections');
    await page.getByRole('button', { name: 'Clear search' }).first().click(); await expect(search).toHaveValue('');
    await page.goto('/docs#help');
    await expect(page.getByRole('heading', { name: 'Looking for something specific?' })).toBeVisible();
    await expect(page.getByLabel('Your message')).toHaveCount(0);
    await expect(page.getByRole('article').getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', '/help');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('article').screenshot({ path: `../backend/.local/docs-support/help-${width}-${theme}.png`, style: 'nextjs-portal { display:none; }' });
    await page.getByRole('article').getByRole('link', { name: 'Contact Support' }).click();
    await expect(page.getByRole('heading', { name: 'Contact Support', exact: true })).toBeVisible();
    await expect(page.getByLabel('Reply email')).toHaveValue('support@example.invalid');
    await expect(page.getByLabel('Your name')).toHaveValue('Synthetic Support Preview');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Send a support request', exact: true })).toHaveAttribute('class', /font-display/);
    await expect(page.locator('main')).toHaveCount(1);
    if (width >= 1024) {
      const scene = page.locator('[data-auth-kubo-stage]');
      await expect(scene).toHaveAttribute('data-auth-scene-ready', 'true', { timeout: 15000 });
      const sceneBounds = (await scene.boundingBox())!;
      const formBounds = (await page.locator('.auth-card').boundingBox())!;
      expect(sceneBounds.height).toBeGreaterThan(300);
      expect(sceneBounds.x + sceneBounds.width).toBeLessThanOrEqual(formBounds.x - 20);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../backend/.local/docs-support/support-${width}-${theme}.png`, fullPage: true, style: 'nextjs-portal { display:none; }' });
    let calls = 0;
    await page.route('**/api/support/requests', (route) => {
      calls++;
      const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
      if (route.request().method() === 'OPTIONS') { calls--; return route.fulfill({ status: 204, headers }); }
      expect(route.request().postDataJSON()).toMatchObject({ replyEmail: 'alternate@example.invalid', requestKey: expect.any(String), category: 'MEALS', message: 'The grocery checklist did not update after I clicked an item.' });
      return route.fulfill({ status: calls === 1 ? 503 : 202, headers, json: calls === 1 ? { success: false, errorCode: 'SUPPORT_EMAIL_UNCONFIRMED' } : { success: true, data: { status: 'RECORDED', reference: 'synthetic-support-reference' } } });
    });
    await page.getByLabel('Reply email').fill('alternate@example.invalid');
    const message = page.getByLabel('Your message');
    await message.fill('The grocery checklist did not update after I clicked an item.');
    await page.getByRole('button', { name: 'Send a support request' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Your message is still here' })).toBeVisible();
    await expect(message).not.toHaveValue('');
    await page.getByRole('button', { name: 'Send a support request' }).click();
    await expect(page.getByText('Support request received', { exact: true })).toBeVisible();
    await expect(message).toHaveValue(''); expect(calls).toBe(2);
  });
}

test('deep links preserve separate chapters and the right outline', async ({ page }) => {
  await prepare(page);
  await page.goto('/docs#privacy-policy-access');
  await expect(page.getByRole('heading', { name: 'Who can access it' })).toBeVisible();
  await expect(page.locator('#privacy-policy-access')).toBeVisible();
  await page.getByRole('navigation', { name: 'Documentation chapters' }).getByRole('button', { name: /Terms of Service/ }).click();
  await expect(page).toHaveURL(/#terms-of-service$/);
  await expect(page.getByRole('heading', { name: 'Use and eligibility' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'On this page' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Looking for something specific?' })).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/#privacy-policy-access$/);
  await page.goto('/sources'); await expect(page).toHaveURL(/\/docs#data-sources$/);
  await expect(page.getByRole('heading', { name: 'Sources and evidence', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Published recipes and composition' })).toBeVisible();
});

test('mobile reduced motion supports chapters, FAQ search and anonymous support', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await prepare(page);
  await page.goto('/docs');
  await page.getByRole('combobox', { name: 'Choose a documentation chapter' }).click();
  await page.getByRole('option', { name: 'FAQs', exact: true }).click(); await expect(page).toHaveURL(/#faqs$/);
  await page.getByRole('searchbox').fill('shellfish pork');
  await page.getByRole('link', { name: /What is the difference between allergies/ }).click();
  await expect(page.locator('#faqs-restrictions-content')).toBeVisible();
  await page.goto('/help');
  await expect(page.getByLabel('Your message')).toBeVisible();
  await page.getByLabel('Your name').fill('Test Visitor');
  await page.getByLabel('Reply email').fill('visitor@example.invalid');
  await page.getByLabel('Your message').fill('I need help accessing my Kainara account.');
  await page.getByRole('button', { name: 'Send a support request' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Log in to send your request' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'chimairelp@gmail.com', exact: true }).first()).toHaveAttribute('href', 'mailto:chimairelp@gmail.com');
  await expect(page.getByRole('img', { name: 'Nara wearing her tanod costume' })).toBeVisible();
});
