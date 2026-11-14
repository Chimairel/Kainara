import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Optional public photo response captured from the real local API; never contains a session token.
const restoredImage = process.env.KAINARA_CLOUDINARY_IMAGE_FIXTURE
  ? JSON.parse(readFileSync(process.env.KAINARA_CLOUDINARY_IMAGE_FIXTURE, 'utf8')).image
  : null;

// The real localhost:3000 UI with intercepted synthetic API data. No database writes.
for (const theme of ['light', 'dark'])
  for (const width of [360, 390, 1440]) {
    test(`member layouts, meal images and checklist at ${width}px in ${theme}`, async ({ page }, testInfo) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 1100 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const profile = {
        id: 'image-preview',
        name: 'Meal preview',
        email: 'images@example.invalid',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        userProfile: { weightKg: 58, targetWeightKg: 65, dailyCalorieTarget: 2000, revision: 2, safetyRevision: 1 },
        healthConditions: [],
        allergies: [],
        safetyEntries: [],
      };
      const claims = Buffer.from(
        JSON.stringify({ userId: profile.id, email: profile.email, role: profile.role, iat: Math.floor(Date.now() / 1000), exp: 4102444800 })
      ).toString('base64url');
      await page
        .context()
        .addCookies([{ name: 'nutrimind_session', value: `fixture.${claims}.fixture`, url: 'http://localhost:3000' }]);
      const image = (url: string) => ({
        url,
        altText: 'Bam-I source photo',
        kind: 'EXACT',
        attribution: {
          creator: 'Panlasang Pinoy',
          sourcePageUrl: 'https://panlasangpinoy.com/bam-i-recipe/',
          licenseCode: null,
          licenseUrl: null,
          modifications: null,
        },
      });
      const meals = [
        {
          id: 'missing',
          mealName: 'How to Make French Toast - The Basic Recipe',
          mealType: 'BREAKFAST',
          image: restoredImage,
        },
        {
          id: 'failed',
          mealName: 'Adobong Dilaw Recipe (Yellow Adobo)',
          mealType: 'LUNCH',
          image: image('/deliberately-missing-meal.jpg'),
        },
        {
          id: 'photo',
          mealName: 'Bam-I Recipe',
          mealType: 'DINNER',
          image: image('https://panlasangpinoy.com/wp-content/uploads/2021/12/Pancit-Canton-at-Sotanghon-jpg.webp'),
        },
      ].map((meal) => ({
        ...meal,
        scheduledDate: `${today}T00:00:00+08:00`,
        calories: 500,
        proteinG: 20,
        carbsG: 60,
        fatG: 15,
        status: 'APPROVED',
        mealLogs: [],
        ingredients: [],
      }));
      const headers = {
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      };
      await page.route('**/deliberately-missing-meal.jpg', (route) => route.fulfill({ status: 404, body: '' }));
      await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
          return route.fulfill({ status: 204, headers });
        let data: unknown = [],
          meta: unknown;
        if (path.endsWith('/user/profile')) data = profile;
        else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
        else if (path.endsWith('/user/membership')) data = { enabled: false };
        else if (path.endsWith('/notifications'))
          data = {
            notifications: [
              {
                id: 'palette-preview',
                type: 'MEMBERSHIP_UPDATED',
                title: 'Membership updated',
                message: 'Synthetic preview notification.',
                isRead: true,
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 0,
          };
        else if (path.endsWith('/user/grocery/workspace'))
          data = {
            current: {
              scope: 'CURRENT',
              cycle: {
                id: 'grocery-preview',
                startDate: today,
                endDate: today,
                status: 'ACTIVE',
                deadlineOutcome: 'COMPLETE',
                incompleteAcknowledgedAt: null,
                shoppingStartedAt: null,
              },
              groceryList: {
                id: 'grocery-list-preview',
                weekLabel: 'Preview',
                generatedAt: new Date().toISOString(),
                groceryItems: [
                  {
                    id: 'water',
                    ingredientName: 'Water',
                    category: 'Beverages',
                    quantity: 1,
                    unit: 'L',
                    isChecked: false,
                    sourceMealCount: 1,
                    isPantryStaple: false,
                  },
                  {
                    id: 'rice',
                    ingredientName: 'Rice',
                    category: 'Other',
                    quantity: 1,
                    unit: 'kg',
                    isChecked: false,
                    sourceMealCount: 1,
                    isPantryStaple: false,
                  },
                ],
              },
              coverage: { clearedSlotCount: 3, expectedSlotCount: 3, unresolvedSlotCount: 0 },
              actionability: {
                canCheckItems: true,
                canExportPdf: true,
                isFinal: true,
                isIncomplete: false,
                quantitiesMayIncrease: false,
                requiresIncompleteAcknowledgment: false,
                message: 'Ready',
              },
            },
            upcoming: null,
          };
        else if (path.endsWith('/checkin/status')) data = { isDue: false, hasPendingChanges: false };
        else if (path.endsWith('/water/today')) data = { totalMl: 0 };
        else if (path.endsWith('/user/meals/cycles')) data = { upcoming: null };
        else if (path.endsWith('/user/meal-clarifications')) data = { enabled: false, forms: [] };
        else if (path.endsWith('/user/meals/history/count')) data = { total: 0 };
        else if (path.endsWith('/user/meals/verified-recipes/summary')) data = { total: 3, restrictedProfile: false };
        else if (path.endsWith('/user/meals/verified-recipes')) {
          data = {
            total: 3, page: 1, pageCount: 1, restrictedProfile: false,
            items: meals.map((meal) => ({
              id: meal.id, name: meal.mealName, mealTypes: [meal.mealType], calories: meal.calories,
              proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG, planningReady: true,
              imageUrl: meal.image?.url ?? null, sourceUrl: 'https://panlasangpinoy.com/bam-i-recipe/',
            })),
          };
        }
        else if (path.endsWith('/user/grocery/items/water/toggle') && route.request().method() === 'PATCH') {
          data = { id: 'water', ingredientName: 'Water', category: 'Beverages', quantity: 1, unit: 'L', isChecked: true, sourceMealCount: 1, isPantryStaple: false };
        }
        else if (path.endsWith('/user/meals/workspace')) {
          data = meals;
          meta = {
            generationStatus: { current: 'READY', upcoming: null },
            cycles: { current: { id: 'image-preview-cycle', startDate: today, endDate: today }, upcoming: null },
            awaitingGeneration: { current: 0, upcoming: 0 },
            pendingReview: null,
            retainedMealLogs: [],
          };
        } else if (path.endsWith('/user/meals/current')) {
          data = meals;
          meta = {
            generationStatus: 'READY',
            cycle: { id: 'image-preview-cycle', startDate: today, endDate: today },
            awaitingGenerationCount: 0,
            awaitingGenerationSlots: [],
            pendingReview: null,
            retainedMealLogs: [],
            planSnapshot: {
              dailyCalorieTarget: 2000,
              dailyMacroTargets: { [today]: { calories: 2000, proteinG: 120, carbsG: 250, fatG: 58 } },
            },
          };
        }
        return route.fulfill({ headers, json: { success: true, data, meta } });
      });
      await page.goto('/dashboard');
      await expect(page.getByText('French Toast', { exact: true })).toBeVisible();
      await expect(page.getByText('Adobong Dilaw (Yellow Adobo)', { exact: true })).toBeVisible();
      await expect(page.getByText('Bam-I', { exact: true })).toBeVisible();
      if (width < 640) {
        const rail = page.locator('.member-menu-rail');
        await expect(rail).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
        expect(await page.locator('.member-main').evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await rail.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
        await page.getByRole('button', { name: 'Mark Bam-I as eaten' }).scrollIntoViewIfNeeded();
        expect(await rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
        expect(await page.getByRole('button', { name: 'Add 250 mL of water' }).evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
      }
      await page.getByText('Adobong Dilaw (Yellow Adobo)', { exact: true }).scrollIntoViewIfNeeded();
      for (const name of restoredImage
        ? ['Adobong Dilaw (Yellow Adobo)']
        : ['French Toast', 'Adobong Dilaw (Yellow Adobo)']) {
        const fallback = page.getByLabel(`${name} (photo unavailable)`, { exact: true });
        await expect(fallback.getByRole('img', { name: 'Kainara logo' })).toBeVisible({ timeout: 15000 });
        await expect(fallback.getByRole('img')).toHaveJSProperty('naturalWidth', 450);
      }
      if (restoredImage) {
        const photo = page.getByRole('img', { name: restoredImage.altText });
        await photo.scrollIntoViewIfNeeded();
        await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
        await expect(page.getByLabel('French Toast (photo unavailable)', { exact: true })).toHaveCount(0);
      }
      await page.getByRole('img', { name: 'Bam-I source photo' }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('img', { name: 'Bam-I source photo' })).toHaveJSProperty('complete', true);
      await expect
        .poll(() =>
          page.getByRole('img', { name: 'Bam-I source photo' }).evaluate((img: HTMLImageElement) => img.naturalWidth)
        )
        .toBeGreaterThan(0);
      await page.getByRole('heading', { name: 'On your menu' }).scrollIntoViewIfNeeded();
      await page.locator('.member-menu-rail').evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }));
      await page.screenshot({
        path: testInfo.outputPath('dashboard.png'),
        fullPage: true,
        animations: 'disabled',
      });
      await page.goto('/meals');
      await expect(page.getByText('French Toast', { exact: true })).toBeVisible();
      if (restoredImage) {
        const photo = page.getByRole('img', { name: restoredImage.altText });
        await photo.scrollIntoViewIfNeeded();
        await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      } else {
        await expect(
          page
            .getByLabel('French Toast (photo unavailable)', { exact: true })
            .getByRole('img', { name: 'Kainara logo' })
        ).toBeVisible();
      }
      await page.getByText('Adobong Dilaw (Yellow Adobo)', { exact: true }).scrollIntoViewIfNeeded();
      await expect(
        page
          .getByLabel('Adobong Dilaw (Yellow Adobo) (photo unavailable)', { exact: true })
          .getByRole('img', { name: 'Kainara logo' })
      ).toBeVisible();
      await page.getByText('Bam-I', { exact: true }).scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          page.getByRole('img', { name: 'Bam-I source photo' }).evaluate((img: HTMLImageElement) => img.naturalWidth)
        )
        .toBeGreaterThan(0);
      await page.getByText('French Toast', { exact: true }).scrollIntoViewIfNeeded();
      expect(
        await page.locator('.solar[class*="-bold"], .solar[class*="-duotone"], .solar[class*="-outline"]').count()
      ).toBe(0);
      const navigation = page.locator(width < 768 ? 'nav[aria-label="Mobile navigation"]' : 'aside');
      const selected = navigation.locator('[aria-current="page"] .app-icon-linear').first();
      await expect(selected).toBeVisible();
      const paints = await selected.evaluate((svg) => {
        return {
          color: getComputedStyle(svg).color,
          inheritedColor: getComputedStyle(svg.parentElement!).color,
          stroke: Number.parseFloat(getComputedStyle(svg).strokeWidth),
        };
      });
      expect(paints.color).toBe(paints.inheritedColor);
      expect(paints.stroke).toBe(2.25);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath('meals.png'),
        fullPage: true,
        animations: 'disabled',
      });
      await page.goto('/meals?tab=library');
      const recipes = page.getByRole('region', { name: 'Meal library recipes' });
      await expect(recipes.getByRole('heading')).toHaveCount(3);
      const cards = await recipes.locator('article').evaluateAll((elements) => elements.map((el) => {
        const { x, y, width } = el.getBoundingClientRect();
        return { x, y, width };
      }));
      expect(cards[1].y).toBe(cards[0].y);
      expect(cards[1].x).toBeGreaterThan(cards[0].x);
      if (width < 640) expect(cards[2].y).toBeGreaterThan(cards[0].y);
      await expect(recipes.getByRole('link', { name: /view source recipe/i }).first()).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('library.png'), fullPage: true, animations: 'disabled' });
      await page.goto('/grocery');
      const department = page.getByRole('combobox', { name: 'Filter by department category' });
      await expect(department).toBeVisible();
      // The shared Select supplies the only disclosure arrow, including while open.
      await expect(department.locator('[data-app-icon="ChevronDown"]')).toHaveCount(1);
      await expect(department.locator('xpath=../..').locator('[data-app-icon="ChevronDown"]')).toHaveCount(1);
      await department.click();
      await expect(department).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('option', { name: 'Beverages (1)', exact: true }).click();
      if (width < 640) {
        const list = page.getByRole('region', { name: 'Grocery checklist' });
        await expect(list.getByText('Water', { exact: true })).toBeVisible();
        await expect(list.getByText('1 l', { exact: true })).toBeVisible();
        await expect(list.getByText('Rice', { exact: true })).toHaveCount(0);
        await list.getByRole('checkbox', { name: 'Mark as available: Water' }).click();
        await expect(list.getByRole('checkbox', { name: 'Mark as needed: Water' })).toBeChecked();
      } else {
        await expect(page.getByRole('cell', { name: 'Water', exact: true })).toBeVisible();
        await expect(page.getByRole('cell', { name: 'Rice', exact: true })).toHaveCount(0);
      }
      await page.screenshot({ path: testInfo.outputPath('groceries.png'), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'View notifications', exact: true }).click();
      const inbox = page.getByRole('dialog', { name: 'Notifications', exact: true });
      await expect(inbox.getByText('Membership updated', { exact: true })).toBeVisible();
      const notificationPaints = await inbox.locator('[data-notification-icon]').evaluate((wrapper) => {
        const svg = wrapper.querySelector('svg')!;
        return {
          border: getComputedStyle(wrapper).borderTopWidth,
          background: getComputedStyle(wrapper).backgroundColor,
          size: getComputedStyle(svg).width,
          color: getComputedStyle(svg).color,
          inheritedColor: getComputedStyle(wrapper).color,
          stroke: Number.parseFloat(getComputedStyle(svg).strokeWidth),
        };
      });
      expect(notificationPaints).toMatchObject({
        border: '0px',
        background: 'rgba(0, 0, 0, 0)',
        size: '24px',
        stroke: 2.25,
      });
      expect(notificationPaints.color).toBe(notificationPaints.inheritedColor);
      await page.screenshot({
        path: testInfo.outputPath('grocery-notifications.png'),
        fullPage: true,
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
      await page
        .locator(
          width < 768 ? 'nav[aria-label="Mobile navigation"] [aria-label="Profile"]' : 'aside [aria-haspopup="menu"]'
        )
        .click();
      const account = page.getByRole('menu', { name: 'Account menu' });
      await expect(account).toBeVisible();
      const accountPaint = await account
        .locator('[data-app-icon="Settings"]')
        .evaluate((svg) => ({
          stroke: Number.parseFloat(getComputedStyle(svg).strokeWidth),
          color: getComputedStyle(svg).color,
          className: svg.getAttribute('class'),
        }));
      expect(accountPaint.stroke).toBe(2.25);
      expect(accountPaint.className).toContain('solar-settings-linear');
      expect(accountPaint.color).not.toBe('rgb(0, 0, 0)');
    });
  }
