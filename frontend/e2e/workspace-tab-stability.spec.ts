import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`grocery tab highlights stay aligned through scroll and filtering at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 620 });
    const user = {
      id: 'grocery-tab-stability',
      name: 'Synthetic Member',
      email: 'tabs@example.invalid',
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      reportAcknowledged: true,
      onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      userProfile: { revision: 1, safetyRevision: 1 },
      healthConditions: [],
      allergies: [],
      safetyEntries: [],
    };
    const payload = Buffer.from(
      JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })
    ).toString('base64url');
    await page
      .context()
      .addCookies([
        {
          name: 'nutrimind_session',
          value: `fixture.${payload}.fixture`,
          url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        },
      ]);
    const items = Array.from({ length: 40 }, (_, index) => ({
      id: `ingredient-${index}`,
      ingredientName: `Ingredient ${index}`,
      category: index === 0 ? 'Fruit' : 'Vegetables',
      isChecked: index === 0,
      isPantryStaple: false,
      quantity: 100,
      unit: 'g',
      purchasedQuantity: index === 0 ? 100 : 0,
      sourceMealCount: 1,
    }));
    const projection = {
      scope: 'CURRENT',
      cycle: {
        id: 'tab-cycle',
        startDate: '',
        endDate: '',
        status: 'READY_TO_SHOP',
        deadlineOutcome: 'COMPLETE',
        incompleteAcknowledgedAt: null,
        shoppingStartedAt: null,
      },
      groceryList: { id: 'tab-list', weekLabel: 'Current', generatedAt: '', groceryItems: items },
      coverage: { clearedSlotCount: 3, expectedSlotCount: 3, unresolvedSlotCount: 0 },
      actionability: {
        canCheckItems: true,
        canExportPdf: true,
        isFinal: true,
        isIncomplete: false,
        quantitiesMayIncrease: false,
        requiresIncompleteAcknowledgment: false,
        message: 'Ready.',
      },
    };
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes('/live/') || route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
      const data = path.endsWith('/user/profile')
        ? user
        : path.endsWith('/user/membership')
          ? { enabled: false }
          : path.endsWith('/notifications')
            ? { notifications: [], unreadCount: 0 }
            : path.endsWith('/user/grocery/workspace')
              ? { current: projection, upcoming: null }
              : [];
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/grocery');
    const weekTabs = page.getByRole('navigation', { name: 'Grocery week', exact: true });
    const statusTabs = page.getByRole('navigation', { name: 'Filter grocery items by status', exact: true });
    await expect(page.getByRole('cell', { name: 'Ingredient 39', exact: true })).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    await weekTabs.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });

    // Observe both rails from before the list shrinks, including the browser's scroll clamp.
    const beginSampling = async () =>
      page.evaluate(() => {
        const samples = { drift: 0, widthError: 0 };
        (window as unknown as { tabSamples: Promise<typeof samples> }).tabSamples = new Promise((resolve) => {
          const start = performance.now();
          const sample = () => {
            document
              .querySelectorAll('nav[aria-label="Grocery week"], nav[aria-label="Filter grocery items by status"]')
              .forEach((nav) => {
                const active = nav.querySelector('button[aria-pressed="true"]')!;
                const indicator = nav.querySelector('[data-workspace-tab-indicator]')!;
                const buttonRect = active.getBoundingClientRect(),
                  rect = indicator.getBoundingClientRect();
                samples.drift = Math.max(samples.drift, Math.abs(rect.top - buttonRect.top));
                samples.widthError = Math.max(samples.widthError, Math.abs(rect.width - buttonRect.width));
              });
            if (performance.now() - start < 600) requestAnimationFrame(sample);
            else resolve(samples);
          };
          requestAnimationFrame(sample);
        });
      });
    const assertSamples = async () => {
      const samples = await page.evaluate(
        () =>
          (
            window as unknown as {
              tabSamples: Promise<{ drift: number; widthError: number }>;
            }
          ).tabSamples
      );
      expect(samples.drift, 'highlight must follow its rail when the scroll position changes').toBeLessThan(1);
      expect(samples.widthError, 'highlight must not stretch when filtering rerenders the page').toBeLessThan(1);
      for (const tabs of [weekTabs, statusTabs]) {
        const alignment = await tabs.evaluate((nav) => {
          const button = nav.querySelector('button[aria-pressed="true"]')!.getBoundingClientRect();
          const indicator = nav.querySelector('[data-workspace-tab-indicator]')!.getBoundingClientRect();
          return Math.abs(indicator.left - button.left);
        });
        expect(alignment, 'highlight must settle beneath the selected label').toBeLessThan(1);
      }
    };
    for (let repeat = 0; repeat < 2; repeat++) {
      await page.locator('.portal-main').evaluate((element) => {
        element.scrollTop = 180;
      });
      const before = await page.locator('.portal-main').evaluate((element) => element.scrollTop);
      expect(before).toBeGreaterThan(0);
      await page.getByRole('combobox', { name: 'Filter by department category', exact: true }).click();
      await beginSampling();
      await page.getByRole('option', { name: 'Fruit (1)', exact: true }).click();
      await expect(page.getByRole('cell', { name: 'Ingredient 39', exact: true })).toHaveCount(0);
      await assertSamples();
      await page.getByRole('combobox', { name: 'Filter by department category', exact: true }).click();
      await beginSampling();
      await page.getByRole('option', { name: 'All Departments (40)', exact: true }).click();
      await assertSamples();
    }
    // Switch local tabs while scrolled; vertical movement is never part of tab animation.
    await page.locator('.portal-main').evaluate((element) => {
      element.scrollTop = 180;
    });
    await beginSampling();
    await statusTabs.getByRole('button', { name: /Have it/ }).click();
    await expect(statusTabs.getByRole('button', { name: /Have it/ })).toHaveAttribute('aria-pressed', 'true');
    await assertSamples();
    await beginSampling();
    await statusTabs.evaluate(async (nav) => {
      const buttons = nav.querySelectorAll<HTMLButtonElement>('button');
      for (const index of [0, 1, 2, 0, 2]) {
        buttons[index].click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });
    await assertSamples();
    await page.screenshot({ path: testInfo.outputPath('grocery-tabs.png') });
    // Resizing changes the rail geometry immediately, rather than springing from old page bounds.
    await page.setViewportSize({ width: width === 390 ? 430 : 1100, height: 620 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await beginSampling();
    await statusTabs.getByRole('button', { name: /All Items/ }).click();
    await assertSamples();
    await expect(statusTabs.locator('[data-workspace-tab-indicator]')).toHaveCSS('transition-property', 'none');
    await expect(weekTabs.getByRole('button', { name: 'Current week', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
