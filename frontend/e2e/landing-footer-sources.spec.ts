import { expect, test, type Page } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
async function prepare(page: Page, theme: string, width: number, reduced = false) {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.addInitScript((theme) => localStorage.setItem('nutrimind-theme', theme), theme);
  // External source navigation is fulfilled locally. No external site or account is changed.
  await page
    .context()
    .route(/^https:\/\/.*/, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<p>Source navigation fixture</p>' })
    );
  await page.route('**/api/**', (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.goto('/');
}
for (const theme of ['light', 'dark'])
  for (const width of [390, 1440]) {
    test(`footer and first-click source navigation ${width} ${theme}`, async ({ page }) => {
      test.setTimeout(70000);
      await prepare(page, theme, width);
      const sources = page.locator('#sources');
      await expect
        .poll(async () => {
          await sources.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
          return sources.isVisible();
        })
        .toBe(true);
      for (const repeat of [true, false]) {
        await page.mouse.move(0, 0);
        let point: { x: number; y: number; href: string } | null = null;
        await expect
          .poll(
            async () => {
              point = await sources.evaluate((section, repeat) => {
                const links = [...section.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')].filter(
                  (link) => Boolean(link.closest('[aria-hidden="true"]')) === repeat
                );
                const bounds = links[0]?.closest('.overflow-hidden')?.getBoundingClientRect();
                if (!bounds) return null;
                const inset = innerWidth < 640 ? 50 : 165;
                for (const link of links) {
                  const box = link.getBoundingClientRect();
                  const left = Math.max(box.left, bounds.left + inset),
                    right = Math.min(box.right, bounds.right - inset);
                  if (right - left > 50 && box.top > 0 && box.bottom < innerHeight)
                    return { x: (left + right) / 2, y: (box.top + box.bottom) / 2, href: link.href };
                }
                return null;
              }, repeat);
              return point !== null;
            },
            { timeout: 25000 }
          )
          .toBe(true);
        const target = point!;
        const popupPromise = page.waitForEvent('popup');
        await page.mouse.click(target.x, target.y);
        const popup = await popupPromise;
        await expect(popup).toHaveURL(target.href);
        await expect(sources.locator('a[target="_blank"]')).toHaveCount(10);
        await popup.close();
        await page.getByRole('link', { name: 'Read the complete evidence register' }).focus();
      }
      const footer = page.getByRole('contentinfo');
      await footer.scrollIntoViewIfNeeded();
      await expect(footer.getByText('Resources', { exact: true })).toBeVisible();
      await expect(footer.getByText('Contact', { exact: true })).toBeVisible();
      await expect(footer.getByText('For questions, feedback, or account support.')).toBeVisible();
      await expect(footer.getByRole('link', { name: 'chimairelp@gmail.com' })).toHaveAttribute(
        'href',
        'mailto:chimairelp@gmail.com'
      );
      await expect(footer.getByRole('link', { name: 'Log in', exact: true })).toHaveAttribute('href', '/login');
      expect(await footer.locator('a[href^="/admin"], a[href^="/dashboard"], a[href^="/nutritionist/"]').count()).toBe(
        0
      );
      await expect(footer).not.toContainText('Clinical Operations');
      await expect(footer).not.toContainText('Review Desk Hours');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await footer.screenshot({
        path: `../backend/.local/landing-footer-sources/footer-${width}-${theme}.png`,
        style: 'header { visibility: hidden; } nextjs-portal { display: none; }',
      });
    });
  }
test('keyboard citations stay static and activate with Enter', async ({ page }) => {
  await prepare(page, 'light', 1440);
  const sources = page.locator('#sources');
  await expect
    .poll(async () => {
      await sources.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      return sources.isVisible();
    })
    .toBe(true);
  await page.getByRole('link', { name: 'Read the complete evidence register' }).focus();
  await page.keyboard.press('Tab');
  await expect(sources.getByRole('link', { name: 'Open citation for DOST-FNRI PDRI', exact: true })).toBeFocused();
  await expect(sources.locator('a[target="_blank"]')).toHaveCount(5);
  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  const popup = await popupPromise;
  await expect(popup).toHaveURL('https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf');
  await popup.close();
  await page.keyboard.press('Tab');
  await expect(sources.getByRole('link', { name: 'Open citation for eNutrition / PhilFCT' })).toBeFocused();
});
test('reduced motion keeps one scrollable source list', async ({ page }) => {
  await prepare(page, 'dark', 390, true);
  const sources = page.locator('#sources');
  await expect
    .poll(async () => {
      await sources.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      return sources.isVisible();
    })
    .toBe(true);
  await expect(sources.locator('a[target="_blank"]')).toHaveCount(5);
  await sources.getByRole('link', { name: 'Open citation for DOST-FNRI PDRI', exact: true }).focus();
  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  const popup = await popupPromise;
  await expect(popup).toHaveURL('https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf');
  await popup.close();
});


test('pointer-opened source resumes moving after returning without a second click', async ({ page }) => {
  await prepare(page, 'light', 1440);
  const sources = page.locator('#sources');
  await expect.poll(async () => {
    await sources.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    return sources.isVisible();
  }).toBe(true);
  let point: { x: number; y: number } | null = null;
  await expect.poll(async () => {
    point = await sources.evaluate((section) => {
      const bounds = section.getBoundingClientRect();
      for (const link of section.querySelectorAll('a[target="_blank"]')) {
        const box = link.getBoundingClientRect();
        const x = box.left + box.width / 2, y = box.top + box.height / 2;
        if (x > bounds.left + 180 && x < bounds.right - 180 && y > 100 && y < innerHeight - 30) return { x, y };
      }
      return null;
    });
    return Boolean(point);
  }, { timeout: 20000 }).toBe(true);
  const popupPromise = page.waitForEvent('popup');
  await page.mouse.click(point!.x, point!.y);
  const popup = await popupPromise; await popup.close(); await page.bringToFront();
  const track = sources.locator('.flex.w-max');
  const original = await track.evaluate((el) => getComputedStyle(el).transform);
  await expect.poll(() => track.evaluate((el) => getComputedStyle(el).transform)).not.toBe(original);
  await expect(sources.locator('a[target="_blank"]')).toHaveCount(10);
});
