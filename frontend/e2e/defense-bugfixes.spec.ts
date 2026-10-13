import { expect, test, type Page } from '@playwright/test';

// Actual shared frontend at 3000; all APIs are intercepted. No Neon or provider mutations.
async function session(page: Page, role: string, theme: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
  const profile = { id: 'bugfix-preview', name: 'Synthetic preview', email: 'preview@example.invalid', role,
    emailVerified: true, onboardingDone: true, tosAccepted: true, reportAcknowledged: true,
    onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
    userProfile: { revision: 1, safetyRevision: 1, dailyCalorieTarget: 2000 } };
  const claims = Buffer.from(JSON.stringify({ userId: profile.id, email: profile.email, role, exp: 4102444800 })).toString('base64url');
  await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
  return profile;
}
for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  for (const role of ['ADMIN', 'NUTRITIONIST']) test(`${role} saved meal canvas modal ${width} ${theme}`, async ({ page }) => {
    const profile = await session(page, role, theme, width);
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    let contextReads = 0;
    const row = { id: 'decision', occurredAt: '2026-10-13T08:00:00Z', actor: 'Synthetic RND', role: 'NUTRITIONIST',
      type: 'Meal approval', action: 'Approved a case', subject: 'Bam-I Recipe', outcome: 'Completed' };
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
      if (route.request().method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
      let data: unknown = [];
      if (path.endsWith('/user/profile')) data = profile;
      else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.endsWith('/credential-status')) data = { eligible: true, reason: null, expiryDate: '2099-01-01', canSubmitUpdate: true };
      else if (path.endsWith('/review-work-counts')) data = { meal: 0, case: 0, profile: 0, audit: 0 };
      else if (path.endsWith('/audit-history')) data = { rows: [row], total: 1, page: 1, totalPages: 1 };
      else if (path.endsWith('/audit-history/decision')) data = { contextAvailable: true, facts: [{ label: 'Policy version', value: 'NUTRIMIND_PLAN_SAFETY_V2' }], reason: null, food: null, effective: null, previous: null };
      else if (path.endsWith('/decision/review-context')) {
        contextReads++;
        data = { currentProfile: null, reviewedSnapshot: null, clinicalEvidence: [], selectedDecisionId: 'saved', historicalInformation: null,
          decisions: [{ id: 'saved', decision: 'APPROVE', rationale: 'Checked saved ingredient quantities.', submittedAt: '2026-10-13T08:00:00Z',
            evidenceSnapshot: { recordedProfile: { weightKg: 57 }, reviewedBy: { name: 'Synthetic RND', role: 'RND' },
              original: { mealName: 'Bam-I Recipe', calories: 912, ingredients: [{ ingredientName: 'Cabbage', quantity: 50, unit: 'g' }] },
              effective: { mealName: 'Bam-I Recipe', calories: 912, ingredients: [{ ingredientName: 'Cabbage', quantity: 50, unit: 'g' }] } } }] };
      }
      return route.fulfill({ headers, json: { success: true, data } });
    });
    await page.goto(`/${role.toLowerCase()}/audit`);
    if (role === 'ADMIN') await page.getByRole('button', { name: 'RND history' }).click();
    await expect(page.getByRole('columnheader', { name: 'Type', exact: true })).toBeVisible();
    await expect(page.getByText('Bam-I', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Details:/ }).click();
    const modal = page.getByRole('dialog', { name: 'Meal approval · Bam-I', exact: true });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('article', { name: 'Recorded meal evidence' })).toBeVisible();
    await expect(modal.getByText('Bam-I', { exact: true })).toHaveCount(2);
    await expect(modal.getByText('Checked saved ingredient quantities.', { exact: true })).toBeVisible();
    await expect(modal.getByText('57', { exact: true })).toBeVisible();
    expect(contextReads).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../backend/.local/defense-bugfixes/audit-${role}-${width}-${theme}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });
  test(`pending grocery toast and rounded search focus ${width} ${theme}`, async ({ page }) => {
    const profile = await session(page, 'USER', theme, width);
    let acknowledgments = 0, toggles = 0, checked = false;
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
      if (route.request().method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
      let data: unknown = [];
      const item = { id: 'rice', ingredientName: 'Rice', category: 'Grains', quantity: 100, unit: 'g', isChecked: checked, isPantryStaple: false, sourceMealCount: 1 };
      if (path.endsWith('/user/profile')) data = profile;
      else if (path.endsWith('/user/membership')) data = { enabled: false };
      else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.endsWith('/acknowledge-incomplete')) { acknowledgments++; data = {}; }
      else if (path.endsWith('/rice/toggle')) { toggles++; checked = !checked; data = { ...item, isChecked: checked }; }
      else if (path.endsWith('/grocery/workspace')) data = { upcoming: null, current: { scope: 'CURRENT',
        cycle: { id: 'cycle', status: 'ACTIVE', startDate: '2026-10-13', endDate: '2026-10-18' },
        coverage: { clearedSlotCount: 1, expectedSlotCount: 3, unresolvedSlotCount: 2 },
        actionability: { canCheckItems: acknowledgments > 0, canExportPdf: false, requiresIncompleteAcknowledgment: acknowledgments === 0, message: 'Some meal slots are still unresolved.' },
        groceryList: { id: 'list', weekLabel: 'Current', groceryItems: [item] } } };
      return route.fulfill({ headers, json: { success: true, data } });
    });
    await page.goto('/grocery');
    const checkbox = page.getByRole('checkbox', { name: 'Mark as available: Rice' });
    await checkbox.click();
    await expect(page.getByText('Some meals are still pending.', { exact: true })).toBeVisible();
    expect(toggles).toBe(0);
    await expect(checkbox).not.toBeChecked();
    if (width < 768) {
      const nav = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
      await expect.poll(async () => { const toast = await page.locator('[data-sonner-toast]').boundingBox(); return toast!.y + toast!.height; }).toBeLessThanOrEqual(nav!.y - 8);
    }
    await page.screenshot({ path: `../backend/.local/defense-bugfixes/grocery-pending-${width}-${theme}.png`, fullPage: true });
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Use available meals only' }).click();
    await expect.poll(() => acknowledgments).toBe(1);
    await checkbox.click();
    await expect(page.getByRole('checkbox', { name: 'Mark as needed: Rice' })).toBeChecked();
    await page.getByRole('checkbox', { name: 'Mark as needed: Rice' }).click();
    await expect(checkbox).not.toBeChecked();
    expect(toggles).toBe(2);
    const input = page.getByPlaceholder('Search ingredients, category...');
    await input.focus();
    expect(await input.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
    expect(await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThan(0);
    await page.screenshot({ path: `../backend/.local/defense-bugfixes/grocery-focus-${width}-${theme}.png`, fullPage: true });
  });
}
