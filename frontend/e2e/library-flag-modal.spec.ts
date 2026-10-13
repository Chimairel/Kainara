import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`meal approvals shortcut and flag modal at ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(value => localStorage.setItem('nutrimind-theme', value), theme);
    const user = { id: 'library-rnd-fixture', name: 'Synthetic RND', email: 'library@example.invalid', role: 'NUTRITIONIST', emailVerified: true, onboardingDone: true, tosAccepted: true, onboardingStatus: { acceptedCurrentConsent: true, nextPath: null } };
    const claims = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })).toString('base64url');
    await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
    const meal = { id: 'modal-meal', mealName: 'Measured vegetable omelette', mealType: 'LUNCH', calories: 450, proteinG: 25, carbsG: 45, fatG: 15, description: 'A recorded serving with measured ingredients.', status: 'APPROVED', baseVerification: 'VERIFIED', safetyEvidenceStatus: 'COMPLETE', safetyEvidenceRevision: 1, usageCount: 0, flags: [], ingredients: [{ id: 'ingredient', ingredientName: 'Eggs', quantity: 2, unit: 'pieces' }], nutritionServingDescription: 'One measured plate', image: { url: '/meals/pandesal.jpg', altText: 'Synthetic meal photo', kind: 'REPRESENTATIVE', attribution: { creator: 'Synthetic photo', sourcePageUrl: null, licenseCode: 'OWNED', licenseUrl: null, modifications: null } }, verifiedByNutritionist: { id: 'rnd-profile', userId: user.id, user: { name: user.name }, prcLicenseNumber: '1234567', prcLicenseExpiry: '2099-12-31', specialization: 'Nutrition', university: 'Synthetic university' } };
    let sends = 0;
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
      if (route.request().method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
      if (route.request().method() === 'POST') {
        expect(path).toBe('/api/nutritionist/library/modal-meal/flag');
        sends++;
        expect(route.request().postDataJSON()).toMatchObject({ expectedVersion: 'a'.repeat(64), notes: { category: 'NUTRITION', affectedFields: ['sodiumMg'], explanation: 'The measured ingredients need independent review.', reference: 'Recorded source reference.', proposedCorrection: 'Reconcile the measured amounts.' } });
        if (sends === 1) return route.fulfill({ status: 409, headers, json: { success: false, error: 'Meal evidence changed. Review the current version.' } });
        return route.fulfill({ headers, json: { success: true, data: {} } });
      }
      let data: unknown = [];
      if (path.endsWith('/user/profile')) data = user;
      else if (path.endsWith('/credential-status')) data = { eligible: true, reason: null, expiryDate: '2099-12-31', pendingRequest: null };
      else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.endsWith('/review-work-counts')) data = { meal: 0, case: 0, profile: 0, audit: 0 };
      else if (path.endsWith('/library')) data = { meals: [meal], total: 1, page: 1, limit: 20 };
      else if (path.endsWith('/library/modal-meal')) data = meal;
      else if (path.endsWith('/meal-review-cases/modal-meal')) data = { state: 'PUBLISHED', recipeVersion: 'a'.repeat(64), reviewVersion: 'b'.repeat(64), incident: null, history: [], incidentCount: 0, legacyHistoryUnknown: false, validConfirmations: [], canAdminRelease: false };
      else if (path.endsWith('/audit-history/member-case')) data = { facts: [{ label: 'Decision', value: 'Approved recorded meal' }], reason: null, food: null, effective: null, previous: null };
      else if (path.endsWith('/case-history')) {
        expect(new URL(route.request().url()).searchParams.get('approvalsOnly')).toBe('true');
        data = { rows: [{ id: 'member-case', occurredAt: '2026-10-13T08:00:00Z', actor: 'Synthetic RND', role: 'NUTRITIONIST', subject: meal.mealName, type: 'Meal approval', action: 'Approved a case', outcome: 'Completed' }], total: 1, totalPages: 1 };
      }
      else if (path.endsWith('/library/modal-meal/approvals')) data = [{ ...meal, recipeVersion: 'a'.repeat(64), approvals: [{ id: 'approval', kind: 'PROFILE', scope: { conditions: ['DIABETES'] }, reviewerName: 'Synthetic RND', reviewedAt: '2026-10-12T08:00:00Z', status: 'ACTIVE', flagReason: null }] }];
      return route.fulfill({ headers, json: { success: true, data } });
    });
    await page.goto('/nutritionist/library');
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await expect(page.getByRole('heading', { name: meal.mealName, level: 1 })).toBeVisible();
    await expect(page.getByLabel('Explanation', { exact: true })).toHaveCount(0);
    const flag = page.locator('.dashboard-meal').getByRole('button', { name: 'Flag meal', exact: true });
    await expect(flag).toBeVisible();
    await expect(page.getByRole('button', { name: 'Meal details', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Meal review', exact: true })).toHaveCount(0);
    await expect(page.getByText('Representative image', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Meal details' })).toBeVisible();
    const ingredients = page.getByRole('table', { name: 'Meal ingredients' });
    await expect(ingredients.getByRole('cell', { name: '2', exact: true })).toBeVisible();
    for (const name of ['Amount', 'Unit']) {
      const heading = ingredients.getByRole('columnheader', { name, exact: true });
      expect(await heading.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); return range.getClientRects().length; })).toBe(1);
    }

    await page.getByRole('button', { name: /Reviewed by Synthetic/ }).click();
    await expect(page.getByRole('dialog', { name: 'Meal verifier' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Meal verifier' }).getByRole('button', { name: /Close/ }).click();
    await page.screenshot({ path: testInfo.outputPath(`meal-detail-${width}-${theme}.png`) });
    await page.getByRole('button', { name: 'Approvals', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Approvals', exact: true })).toBeInViewport();
    await expect(page.getByRole('table', { name: 'Audit records' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Details:/ }).click();
    await expect(page.getByRole('dialog', { name: /Meal approval/ })).toBeVisible();
    await expect(page.getByText('Approved recorded meal')).toBeVisible();
    await page.getByRole('dialog', { name: /Meal approval/ }).getByRole('button', { name: /Close/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await flag.click();
    const dialog = page.getByRole('dialog', { name: 'Flag meal', exact: true });
    await expect(dialog).toBeVisible();
    await page.getByLabel('Explanation', { exact: true }).fill('The measured ingredients need independent review.');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(flag).toBeFocused();
    await flag.press('Enter');
    await expect(page.getByLabel('Explanation', { exact: true })).not.toHaveValue('');
    await page.getByLabel('Affected ingredients or nutrition fields').fill('sodiumMg');
    await page.getByLabel('Supporting evidence or reference', { exact: true }).fill('Recorded source reference.');
    await page.getByLabel('Proposed correction', { exact: true }).fill('Reconcile the measured amounts.');
    const actionBounds = (await dialog.getByRole('button', { name: 'Flag and withhold meal' }).boundingBox())!;
    expect(actionBounds.y + actionBounds.height).toBeLessThan(950);
    await dialog.screenshot({ path: testInfo.outputPath(`flag-modal-${width}-${theme}.png`) });
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await dialog.getByRole('button', { name: 'Flag and withhold meal' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Meal evidence changed.' })).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel('Explanation', { exact: true })).not.toHaveValue('');
    await dialog.getByRole('button', { name: 'Flag and withhold meal' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Meal flagged for review.' })).toBeVisible();
    expect(sends).toBe(2);
    await expect(page.getByLabel('Explanation', { exact: true })).toHaveCount(0);
  });
}
