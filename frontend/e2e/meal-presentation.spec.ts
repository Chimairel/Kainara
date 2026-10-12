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
      await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'OPTIONS' || path.includes('/live/'))
          return route.fulfill({ status: 204, headers });
        let data: unknown = [],
          meta: unknown;
        if (path.endsWith('/user/profile')) data = profile;
        else if (path.endsWith('/clinical-profile-review/status')) data = { required: false, approved: true };
        else if (path.endsWith('/user/membership')) data = { enabled: false };
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
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
      const navigation = page.locator(width < 768 ? 'nav[aria-label="Mobile navigation"]' : 'aside');
      const selected = navigation.locator('[aria-current="page"] .app-icon-duotone').first();
      await expect(selected).toBeVisible();
      const paints = await selected.evaluate((svg) => {
        const accent = svg.querySelector('[style*="--solar-secondary-color"]')!;
        return {
          primary: getComputedStyle(svg).color,
          secondary: getComputedStyle(accent).color,
          opacity: getComputedStyle(accent).opacity,
        };
      });
      expect(paints).toEqual({ primary: 'rgb(13, 40, 32)', secondary: 'rgb(250, 248, 245)', opacity: '0.85' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({
        path: `../backend/.local/meal-presentation-audit/${restoredImage ? 'cloudinary-' : ''}meals-${width}-${theme}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
