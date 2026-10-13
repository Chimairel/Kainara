import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Optional public photo response captured from the real local API; never contains a session token.
const restoredImage = process.env.KAINARA_CLOUDINARY_IMAGE_FIXTURE
  ? JSON.parse(readFileSync(process.env.KAINARA_CLOUDINARY_IMAGE_FIXTURE, 'utf8')).image
  : null;

// The real localhost:3000 UI with intercepted synthetic API data. No database writes.
for (const theme of ['light', 'dark'])
  for (const width of [390, 1440]) {
    test(`clean meal names and logo fallbacks at ${width}px in ${theme}`, async ({ page }) => {
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
        JSON.stringify({ userId: profile.id, email: profile.email, role: profile.role, exp: 4102444800 })
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
            planSnapshot: { dailyCalorieTarget: 2000, dailyMacroTargets: {} },
          };
        }
        return route.fulfill({ headers, json: { success: true, data, meta } });
      });
      await page.goto('/dashboard');
      await expect(page.getByText('French Toast', { exact: true })).toBeVisible();
      await expect(page.getByText('Adobong Dilaw (Yellow Adobo)', { exact: true })).toBeVisible();
      await expect(page.getByText('Bam-I', { exact: true })).toBeVisible();
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
      await page.screenshot({
        path: `../backend/.local/meal-presentation-audit/${restoredImage ? 'cloudinary-' : ''}dashboard-${width}-${theme}.png`,
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
        path: `../backend/.local/meal-presentation-audit/${restoredImage ? 'cloudinary-' : ''}meals-${width}-${theme}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.goto('/grocery');
      const department = page.getByRole('combobox', { name: 'Filter by department category' });
      await expect(department).toBeVisible();
      // The shared Select supplies the only disclosure arrow, including while open.
      await expect(department.locator('[data-app-icon="ChevronDown"]')).toHaveCount(1);
      await expect(department.locator('xpath=../..').locator('[data-app-icon="ChevronDown"]')).toHaveCount(1);
      await department.click();
      await expect(department).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('option', { name: 'Beverages (1)', exact: true }).click();
      await expect(page.getByRole('cell', { name: 'Water', exact: true })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Rice', exact: true })).toHaveCount(0);
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
        path: `../backend/.local/meal-presentation-audit/grocery-notifications-${width}-${theme}.png`,
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
