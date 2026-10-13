import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const id = '78b6b17a-d281-46d5-a88f-535558f4b160';
const request = { id, category: 'GROCERIES', replyEmail: 'alternate@example.invalid', deliveryStatus: 'ACCEPTED', createdAt: '2026-10-13T10:00:00Z', user: { name: 'Support Test Member', email: 'member@example.invalid' }, message: 'My grocery checklist did not update after I clicked the item.', replies: [] };
for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`Admin support inbox ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(theme => localStorage.setItem('nutrimind-theme', theme), theme);
    const claims = Buffer.from(JSON.stringify({ userId: 'admin-support-fixture', email: 'admin@example.invalid', role: 'ADMIN', exp: 4102444800 })).toString('base64url');
    await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
    let sends = 0; let requestKey = '';
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
      if (route.request().method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
      let data: unknown = [];
      if (path.endsWith('/user/profile')) data = { id: 'admin-support-fixture', name: 'Support Test Admin', email: 'admin@example.invalid', role: 'ADMIN', emailVerified: true };
      else if (path.endsWith('/admin/support')) data = { items: [request], total: 1, page: 1, pageSize: 20 };
      else if (path.endsWith(`/admin/support/${id}`)) data = request;
      else if (path.endsWith(`/admin/support/${id}/replies`)) {
        sends++; const body = route.request().postDataJSON();
        expect(body.message).toBe('Thanks for the report. We checked the grocery checklist.');
        expect(body.requestKey).toMatch(/^[a-f0-9-]{36}$/);
        if (sends === 1) { requestKey = body.requestKey; return route.fulfill({ status: 503, headers, json: { success: false } }); }
        expect(body.requestKey).toBe(requestKey);
        data = { id: 'saved-support-reply', message: body.message, deliveryStatus: 'ACCEPTED', createdAt: '2026-10-13T11:00:00Z', author: { name: 'Support Test Admin' } };
      } else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
      return route.fulfill({ headers, json: { success: true, data } });
    });
    await page.goto('/admin/support');
    await expect(page.getByRole('heading', { name: 'Support inbox' })).toBeVisible();
    await page.getByRole('button', { name: /Support Test Member/ }).click();
    await expect(page.getByText(request.message)).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: 'alternate@example.invalid' })).toBeVisible();
    const textarea = page.getByLabel('Your reply');
    await textarea.fill('Thanks for the report. We checked the grocery checklist.');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByRole('region', { name: 'Request conversation' }).getByRole('alert')).toContainText('Your draft is kept');
    await expect(textarea).not.toHaveValue('');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('Reply saved and accepted by the email provider.')).toBeVisible();
    await expect(textarea).toHaveValue(''); expect(sends).toBe(2);
    await expect(page.getByRole('list', { name: 'Support replies' })).toContainText('Thanks for the report.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../backend/.local/docs-support/admin-support-${width}-${theme}.png`, fullPage: true, style: 'nextjs-portal { display:none; }' });
    if (width < 768) { await page.getByRole('button', { name: 'All requests' }).click(); await expect(page.getByRole('button', { name: /Support Test Member/ })).toBeVisible(); }
    else await expect(page.locator('a[href="/admin/support"]').filter({ visible: true })).toBeVisible();
  });
}

test('Nara scroll handling does not measure layout while scrolling; pointer and keyboard reactions still work', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: { success: false } }));
  await page.goto('/help');
  await expect(page.locator('[data-auth-kubo-stage]')).toHaveAttribute('data-auth-scene-ready', 'true');
  const nara = page.getByRole('button', { name: 'Boop the Nara' }).filter({ visible: true });
  await nara.focus(); await nara.press('Enter');
  const reaction = nara.locator('span > span').last();
  await expect(reaction).toHaveCSS('opacity', '1');
  await page.mouse.move(700, 700);
  const count = await page.evaluate(async () => {
    const original = Element.prototype.getBoundingClientRect; let reads = 0;
    Element.prototype.getBoundingClientRect = function () { if (this.closest('[data-auth-mascot]')) reads++; return original.call(this); };
    for (let index = 0; index < 20; index++) { window.scrollTo({ top: index % 2 ? 0 : 400, behavior: 'instant' }); await new Promise(resolve => requestAnimationFrame(resolve)); }
    Element.prototype.getBoundingClientRect = original; return reads;
  });
  expect(count).toBe(0);
});
