import { expect, test, type Page } from '@playwright/test';

// Browser fixtures cover presentation. The guarded PostgreSQL scripts cover authorization and writes.
async function setup(page: Page, safetyChanged = false, weightOnly = false) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('close', () => expect(errors).toEqual([]));
  const user = {
    id: 'report-browser-fixture',
    name: 'Test User',
    email: 'report@example.invalid',
    role: 'USER',
    emailVerified: true,
    onboardingDone: true,
    tosAccepted: true,
    reportAcknowledged: !safetyChanged,
    onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
    nutritionReport: { acknowledgedAt: null, isStale: false, profileRevision: 2 },
    userProfile: {
      age: 25,
      heightCm: 170,
      weightKg: 65,
      biologicalSex: 'MALE',
      goal: 'MAINTAIN',
      activityLevel: 'SEDENTARY',
      dailyCalorieTarget: 2000,
      revision: 2,
      safetyRevision: 1,
      planningReportVersion: 1,
    },
    healthConditions: [],
    allergies: [],
    safetyEntries: [],
  };
  const payload = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
  ]);
  const report = {
    version: 2,
    generatedAt: '2026-10-02T00:00:00Z',
    isStale: false,
    acknowledgedAt: null,
    reportPolicyVersion: 'NUTRITION_GUIDANCE_DETERMINISTIC_V1',
    referenceItems: [],
    basedOnConditions: [],
    basedOnAllergies: [],
    generalSummary: 'Current profile guidance',
    foodsToAvoid: [],
    foodsToLimit: [],
    foodsRecommended: [],
    drinksGuidance: [],
    planningContext: {
      activeVersion: 1,
      activeGeneratedAt: '2026-09-01T00:00:00Z',
      pendingChanges: true,
      safetyChanged,
      activationTier: weightOnly ? null : safetyChanged ? 'HEALTH' : 'LIFESTYLE',
    },
  };
  let acknowledged = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/live/')) return route.fulfill({ status: 204 });
    if (path.endsWith('/nutrition-report/acknowledge') && weightOnly) {
      acknowledged = true;
      return route.fulfill({
        json: {
          success: true,
          data: {
            version: report.version,
            acknowledgedAt: '2026-10-05T00:00:00Z',
            planningReadiness: {
              status: 'REQUEST_ALLOWED',
              canRequestPlan: true,
              title: 'Meal planning is available',
              message: 'Ready',
              actionPath: '/meals',
            },
          },
        },
      });
    }
    if (path.endsWith('/nutrition-report/acknowledge'))
      return route.fulfill({
        status: 403,
        json: {
          success: false,
          error: 'Membership needed',
          errorCode: safetyChanged ? 'HEALTH_MEMBERSHIP_REQUIRED' : 'MEMBERSHIP_REQUIRED',
        },
      });
    let data: unknown = [];
    if (path.endsWith('/user/profile')) data = user;
    else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
    else if (path.endsWith('/checkin/status'))
      data = { isDue: true, hasPendingChanges: true, safetyChanged, weeksSinceConfirmation: 3, profileRevision: 2 };
    else if (path.endsWith('/nutrition-report'))
      data = acknowledged
        ? {
            ...report,
            acknowledgedAt: '2026-10-05T00:00:00Z',
            planningContext: { ...report.planningContext, activeVersion: 2, pendingChanges: false },
          }
        : report;
    else if (path.endsWith('/user/membership/history'))
      data = {
        member: { id: user.id, name: user.name },
        rows: [],
        total: 0,
        page: 1,
        totalPages: 1,
        serverTime: '2026-10-02T00:00:00Z',
      };
    else if (path.endsWith('/user/membership'))
      data = {
        enabled: true,
        tier: 'FREE',
        level: 'FREE',
        enhanced: false,
        healthAccess: false,
        purchasesAvailable: false,
        price: null,
        autoRenews: false,
        serverTime: '2026-10-02T00:00:00Z',
        trialEndsAt: '2026-09-30T00:00:00Z',
        paidUntil: null,
        resetsAt: '2026-10-04T16:00:00Z',
        requiresCaseReview: safetyChanged,
        swaps: { used: 0, cap: 3, remaining: 3 },
        limits: {
          freeSwaps: 3,
          freeEstimates: 2,
          lifestyleSwaps: 10,
          healthSwaps: 21,
          memberEstimates: 10,
          memberPlanReviews: 1,
          memberOutsideReviews: 1,
        },
        usage: {
          AI_ESTIMATE: { used: 0, cap: 2, remaining: 2 },
          PLAN_REVIEW: { used: 0, cap: 0, remaining: 0 },
          OUTSIDE_REVIEW: { used: 0, cap: 0, remaining: 0 },
        },
      };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
  return report;
}

for (const width of [320, 400, 768, 1024, 1280, 1440]) {
  test(`nutrition guidance and history fit without overlapping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 808 });
    await page.addInitScript(
      (theme) => localStorage.setItem('nutrimind-theme', theme),
      width >= 1280 ? 'dark' : 'light'
    );
    const base = await setup(page);
    const report = {
      ...base,
      acknowledgedAt: '2026-10-02T00:00:00Z',
      planningContext: { ...base.planningContext, activeVersion: 2, pendingChanges: false },
      planningTargets: { calories: 2786, proteinG: 87, carbsG: 435, fatG: 77, goal: 'GAIN_WEIGHT' },
    };
    await page.route('**/api/user/nutrition-report', (route) =>
      route.fulfill({ json: { success: true, data: report } })
    );
    await page.route('**/api/user/nutrition-report/history', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [{ id: 'older', version: 1, generatedAt: '2026-09-29T00:00:00Z', content: { ...report, version: 1 } }],
        },
      })
    );
    await page.route('**/api/user/notifications', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            unreadCount: 3,
            notifications: [1, 2, 3].map((id) => ({
              id: `notice-${id}`,
              type: 'MEAL_APPROVED',
              title: `Review update ${id}`,
              message: 'Your meal review has been recorded. Open your meal details to view the result.',
              createdAt: new Date().toISOString(),
              isRead: false,
            })),
          },
        },
      })
    );
    await page.goto('/profile/nutrition-report');
    const paper = page.getByRole('article', { name: 'Nutrition guidance record' });
    await expect(paper).toBeVisible();
    const checkFit = async () => {
      await page.screenshot({ path: test.info().outputPath('report-layout.png') });
      const overflow = await paper.evaluate((article) => {
        const bounds = article.getBoundingClientRect();
        return [...article.querySelectorAll('h1,h2,h3,dt,dd,p,span')]
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
          })
          .map((node) => node.textContent?.slice(0, 80));
      });
      expect(overflow).toEqual([]);
      const controls = page.getByRole('button', { name: 'Expand document' });
      const overlaps = await controls.evaluate((button) => {
        const control = button.getBoundingClientRect();
        const header = button.closest('header')!;
        return [...header.querySelectorAll('span,button')]
          .filter((node) => node !== button)
          .some((node) => {
            const rect = node.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.right > control.left &&
              rect.left < control.right &&
              rect.bottom > control.top &&
              rect.top < control.bottom
            );
          });
      });
      expect(overlaps).toBe(false);
    };
    await checkFit();
    const beforeNotifications = await page.getByRole('region', { name: 'Document viewer', exact: true }).boundingBox();
    await page.getByRole('button', { name: 'View notifications' }).click();
    const notifications = page.getByRole('dialog', { name: 'Notifications', exact: true });
    await expect(notifications).toBeVisible();
    expect(
      await notifications.evaluate((panel) => {
        const rect = panel.getBoundingClientRect();
        return panel.contains(document.elementFromPoint(rect.left + 20, rect.top + Math.min(rect.height - 10, 90)));
      })
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(notifications).toHaveCount(0);
    expect(await page.getByRole('region', { name: 'Document viewer', exact: true }).boundingBox()).toEqual(
      beforeNotifications
    );
    const workspace = page.getByRole('region', { name: 'Document viewer', exact: true });
    const previewHeight = (await workspace.boundingBox())!.height;
    expect(previewHeight).toBeLessThanOrEqual(672);
    await expect(paper.locator('footer')).not.toBeInViewport();
    const previewContent = paper.locator('..').locator('..');
    expect(await previewContent.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto');
    await workspace.scrollIntoViewIfNeeded();
    const pageScroll = await page.locator('main.portal-main').evaluate((main) => main.scrollTop);
    await previewContent.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(paper.locator('footer')).toBeInViewport();
    expect(await previewContent.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    expect(await page.locator('main.portal-main').evaluate((main) => main.scrollTop)).toBe(pageScroll);
    const selectVersion = async (version: number) => {
      await page.getByRole('combobox', { name: 'Report version' }).click();
      await page.getByRole('option', { name: new RegExp(`^Version ${version} ·`) }).click();
    };
    await selectVersion(1);
    expect(await previewContent.evaluate((node) => node.scrollTop)).toBe(0);
    await expect(paper).toContainText('Version 1');
    await checkFit();
    expect((await workspace.boundingBox())!.height).toBe(previewHeight);
    await selectVersion(2);
    await page.getByRole('button', { name: 'Document pages', exact: true }).click();
    await page.getByRole('button', { name: 'Page 2', exact: true }).click();
    await expect
      .poll(async () => {
        const sheet = (await paper.locator('[data-document-page]').last().boundingBox())!;
        const canvas = (await previewContent.boundingBox())!;
        return Math.abs(sheet.y - canvas.y - 16);
      })
      .toBeLessThanOrEqual(2);
    await page.getByRole('button', { name: 'Previous page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    await page.getByRole('button', { name: 'Previous page' }).click();
    await page.getByRole('button', { name: 'Fit to page' }).click();
    await expect
      .poll(async () => {
        const sheet = (await paper.locator('[data-document-page]').first().boundingBox())!;
        const canvas = (await previewContent.boundingBox())!;
        return sheet.width <= canvas.width && sheet.height <= canvas.height;
      })
      .toBe(true);
    await page.getByRole('button', { name: 'Reset zoom to 100%' }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Fit to width' }).click();
    await page.getByRole('button', { name: 'Expand document' }).click();
    const fullView = page.getByRole('dialog', { name: /Nutrition report.*fullscreen/ });
    await expect(fullView).toBeVisible();
    const fullscreenBounds = (await fullView.boundingBox())!;
    expect(fullscreenBounds.x).toBe(0);
    expect(fullscreenBounds.y).toBe(0);
    expect(fullscreenBounds.width).toBe(width);
    expect(fullscreenBounds.height).toBe(808);
    await expect.poll(() => fullView.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('report-fullscreen.png') });
    await expect(page.getByRole('combobox', { name: 'Report version' })).toBeVisible();
    await selectVersion(1);
    await expect(paper).toContainText('Version 1');
    await paper.locator('footer').scrollIntoViewIfNeeded();
    await expect(paper.locator('footer')).toBeInViewport();
    await page.getByRole('combobox', { name: 'Report version' }).scrollIntoViewIfNeeded();
    await page.getByRole('combobox', { name: 'Report version' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(fullView).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fullView).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Report version' })).toContainText('Version 1');
    await expect(page.getByRole('button', { name: 'Expand document' })).toBeFocused();
    expect((await workspace.boundingBox())!.height).toBe(previewHeight);
    if (width < 768) {
      await page.locator('main.portal-main').evaluate((main) => {
        main.scrollTop = main.scrollHeight;
      });
      const bounds = (await workspace.boundingBox())!;
      const navigation = (await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox())!;
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(navigation.y);
    }
  });
}
for (const width of [320, 358, 390, 768, 1440]) {
  test(`plans controls preserve keyboard focus without click rings or heading overlap at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 808 });
    await setup(page);
    await page.goto('/membership');
    const viewPlans = page.getByRole('button', { name: 'View plans', exact: true }).first();
    await expect(viewPlans).toBeVisible();
    await viewPlans.hover();
    const buttonShadow = await viewPlans.evaluate((node) => getComputedStyle(node).boxShadow);
    await viewPlans.click();
    const plans = page.getByRole('dialog', { name: 'Membership plans' });
    await expect(plans).toBeVisible();
    const close = plans.getByRole('button', { name: 'Close', exact: true });
    await expect(close).toBeFocused();
    expect(await close.evaluate((node) => node.matches(':focus-visible'))).toBe(false);
    const closeShadow = await close.evaluate((node) => getComputedStyle(node).boxShadow);
    const title = plans.getByRole('heading', { name: "We've got a plan that's perfect for you" });
    const titleBounds = (await title.boundingBox())!;
    const closeBounds = (await close.boundingBox())!;
    expect(
      titleBounds.x < closeBounds.x + closeBounds.width &&
        titleBounds.x + titleBounds.width > closeBounds.x &&
        titleBounds.y < closeBounds.y + closeBounds.height &&
        titleBounds.y + titleBounds.height > closeBounds.y
    ).toBe(false);
    if (width < 640) expect(titleBounds.y).toBeGreaterThanOrEqual(closeBounds.y + closeBounds.height + 8);
    await expect.poll(() => plans.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('plans-header.png') });
    await close.click();
    await expect(plans).toHaveCount(0);
    await expect(viewPlans).toBeFocused();
    expect(await viewPlans.evaluate((node) => node.matches(':focus-visible'))).toBe(false);
    await expect.poll(() => viewPlans.evaluate((node) => getComputedStyle(node).boxShadow)).toBe(buttonShadow);

    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(viewPlans).toBeFocused();
    expect(await viewPlans.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
    await expect.poll(() => viewPlans.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe(buttonShadow);
    await page.keyboard.press('Enter');
    await expect(close).toBeFocused();
    expect(await close.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
    await expect.poll(() => close.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe(closeShadow);
    await page.keyboard.press('Escape');
    await expect(plans).toHaveCount(0);
    await expect(viewPlans).toBeFocused();
  });
}

for (const width of [320, 390, 1440]) {
  test(`Free, Lifestyle and Health remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto('/membership?tab=plans');
    await expect(page.getByText('Replans', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Lifestyle', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Health', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Membership plans' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Lifestyle' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Get Health' })).toBeEnabled();
    await expect
      .poll(async () => (await page.getByRole('article', { name: 'Health plan' }).ariaSnapshot()).replace(/\s/g, ''))
      .toContain('₱999/month');
    await page.getByRole('button', { name: /Yearly Billing/ }).click();
    await expect
      .poll(async () => (await page.getByRole('article', { name: 'Health plan' }).ariaSnapshot()).replace(/\s/g, ''))
      .toContain('₱9,590/year');
    await page.getByRole('button', { name: 'Monthly Billing' }).click();
    await expect(page.getByText('10 meal swaps per cycle', { exact: true })).toBeVisible();
    await expect(page.getByText('21 meal swaps per cycle', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('article', { name: 'Lifestyle plan' }).getByText('Recommended', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('article', { name: 'Health plan' }).getByText('Recommended', { exact: true })
    ).toHaveCount(0);
    await expect(page.getByText('10 AI estimates per week', { exact: true })).toBeVisible();
    await expect(page.getByText(/Your first 30 days include the Health plan/)).toBeVisible();
    await expect(page.getByText(/Weekly allowances reset every Monday at midnight/)).toBeVisible();
    await expect(page.getByText(/per Manila week|development payment sandbox|Demo checkout uses/)).toHaveCount(0);
    await expect(page.getByText(/optional replans/i)).toHaveCount(0);
    const lifestyleInfo = page.getByRole('button', { name: 'Lifestyle planning details' });
    if (width === 1440) await lifestyleInfo.hover();
    else await lifestyleInfo.click();
    await expect(page.getByRole('tooltip')).toContainText('Activity level, weight loss');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Membership plans' })).toBeVisible();
    await page.getByRole('button', { name: 'Health planning details' }).click();
    const hint = page.getByRole('tooltip');
    await expect(hint).toContainText('shellfish (including shrimp)');
    await expect(hint).toContainText('Individual assessment: kidney disease');
    await expect(hint).toBeVisible();
    const bounds = await hint.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
    await page.screenshot({ path: test.info().outputPath('health-info.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('meter')).toHaveCount(4);
    await page.locator('[aria-label="Allowances and usage statistics"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('membership.png'), fullPage: true });
    await expect(page.getByRole('status', { name: 'Profile planning status' })).toContainText('3 weeks ago');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Complete check-in' }).click();
    await expect(page.getByRole('button', { name: 'Confirm my saved updates' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Profile planning status' })).toBeVisible();
    await page.goto('/profile/nutrition-report');
    await page.getByRole('button', { name: 'Use this report for meal planning' }).click();
    await expect(page.getByRole('dialog', { name: 'Lifestyle membership needed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep my previous planning report' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
test('new health disclosures offer Health without an older-report bypass', async ({ page }) => {
  await setup(page, true);
  await page.goto('/profile/nutrition-report');
  await page.getByRole('button', { name: 'Expand document' }).click();
  await page.getByRole('button', { name: 'Use this report for meal planning' }).click();
  await expect(page.getByRole('dialog', { name: 'Health membership needed' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Nutrition report.*fullscreen/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Keep my previous planning report' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continue to my saved records' })).toHaveAttribute('href', '/export');
});

test('declared health needs recommend Health on the plan comparison', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await setup(page, true);
  await page.goto('/membership?tab=plans');
  await expect(
    page.getByRole('article', { name: 'Health plan' }).getByText('Recommended', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'Lifestyle plan' }).getByText('Recommended', { exact: true })
  ).toHaveCount(0);
  await expect(page.getByText(/Your first 30 days include the Health plan/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Health plan needed' })).toBeDisabled();
  await expect(page.getByText(/Your health details require RND review/)).toBeVisible();
});

test('Free weight-only report activation does not open a membership gate', async ({ page }) => {
  await setup(page, false, true);
  await page.goto('/profile/nutrition-report');
  await page.getByRole('button', { name: 'Use this report for meal planning' }).click();
  await expect(page.getByRole('dialog', { name: /membership needed/ })).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);
});
