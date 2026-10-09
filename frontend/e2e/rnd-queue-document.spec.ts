import { expect, test } from '@playwright/test';

for (const width of [400, 1024, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`RND document queues retain review actions at ${width}px in ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const user = {
        id: 'rnd-document-fixture',
        name: 'Preview RND',
        email: 'fixture@example.invalid',
        role: 'NUTRITIONIST',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        nutritionReport: null,
      };
      const claims = Buffer.from(
        JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: 4102444800 })
      ).toString('base64url');
      await page.context().addCookies([
        {
          name: 'nutrimind_session',
          value: `fixture.${claims}.fixture`,
          url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        },
      ]);
      let claimed = false,
        approved = false,
        verified = false,
        mealClaimed = false,
        failApproval = true;
      const mutations: Array<{ path: string; body: unknown }> = [];
      const date = new Date().toISOString();
      const claimStatus = () => ({
        claimedByMe: claimed,
        claimedByOther: false,
        claimedByName: null,
        claimExpiresAt: date,
      });
      const queueMeal = () => ({
        id: 'case-record',
        mealName: 'Recorded soup',
        mealType: 'LUNCH',
        calories: 500,
        proteinG: 25,
        carbsG: 60,
        fatG: 18,
        aiConfidenceFlag: 'CAUTION',
        scheduledDate: date,
        user: { id: 'member-fixture', name: 'Preview Member' },
        ingredients: [],
        claimStatus: claimStatus(),
        highRiskReviewRequired: true,
        reviewApprovalCount: 0,
        requiresIndependentSecondReview: false,
        intendedCycle: { id: 'cycle-fixture', startDate: date, endDate: date, status: 'ACTIVE' },
        shoppingDeadlineAt: date,
        cookDeadlineAt: date,
        assuranceTier: 'ENHANCED',
        reviewStage: 'PRIMARY',
        remainingReviewers: 1,
        deterministicFindings: { confidence: 'CAUTION', estimatedIngredientCount: 0 },
        sourceProvenance: 'RAW_RECIPE_CORPUS',
        fallbackAvailable: false,
        rankingReasonCodes: [],
        coalescedDependentCount: 0,
      });
      const detail = () => ({
        mealPlan: {
          ...queueMeal(),
          status: 'PENDING_REVIEW',
          planGroupId: 'cycle-fixture',
          userId: 'member-fixture',
          createdAt: date,
          planType: 'WEEKLY',
          description: 'Recorded measured soup.',
          requiresSafetyRevalidation: true,
        },
        user: {
          name: 'Preview Member',
          age: 35,
          sex: 'FEMALE',
          goal: 'MAINTAIN_WEIGHT',
          dailyCalorieTarget: 2000,
          dietaryPreference: 'OMNIVORE',
          ricePreference: 'FLEXIBLE',
          conditions: ['HEART_CONDITION'],
          allergies: ['NUTS'],
        },
        ingredients: [{ name: 'Carrot', source: 'FNRI', quantity: 80, unit: 'g' }],
        warnings: [{ severity: 'IMPORTANT', message: 'Recorded sodium evidence requires inspection.' }],
        claimStatus: claimStatus(),
        highRiskReviewRequired: true,
        reviewApprovalCount: 0,
        requiresIndependentSecondReview: false,
      });
      await page.route('**/api/**', async (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204 });
        let data: unknown = [];
        if (request.method() !== 'GET')
          mutations.push({ path, body: request.postData() ? request.postDataJSON() : null });
        if (path.endsWith('/user/profile')) data = user;
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/review-work-counts')) data = { case: 1, meal: 1, profile: 0 };
        else if (path.endsWith('/queue')) data = approved ? [] : [queueMeal()];
        else if (path.endsWith('/queue/case-record/swap-options'))
          data = {
            expectedVersion: 'a'.repeat(64),
            options: [
              {
                id: 'eligible-soup',
                mealName: 'Eligible squash soup',
                calories: 500,
                proteinG: 25,
                carbsG: 60,
                fatG: 18,
                recipeSignature: 'b'.repeat(64),
                evidenceRevision: 2,
                ingredients: [{ name: 'Squash', quantity: 200, unit: 'g', source: 'FNRI' }],
              },
            ],
          };
        else if (path.endsWith('/queue/case-record/swap')) {
          approved = true;
          data = { replaced: true, replacementPlanId: 'replacement-record' };
        } else if (path.endsWith('/queue/case-record/claim')) {
          claimed = true;
          data = detail();
        } else if (path.endsWith('/queue/case-record/release')) {
          claimed = false;
          data = { released: true };
        } else if (path.endsWith('/queue/case-record')) data = detail();
        else if (path.endsWith('/review/case-record')) {
          if (failApproval)
            return route.fulfill({
              status: 409,
              json: { success: false, error: 'Synthetic stale evidence. Refresh before approval.' },
            });
          approved = true;
          data = {};
        } else if (path.endsWith('/meal-verification'))
          data = verified
            ? []
            : [
                {
                  kind: 'RAW_RECIPE',
                  id: 'recipe-record',
                  revisionKey: 'saved-version',
                  name: 'Recorded base recipe',
                  mealType: 'DINNER',
                  description: 'Recorded base preparation.',
                  source: 'PANLASANG_PINOY',
                  status: 'PENDING',
                  calories: 400,
                  proteinG: 20,
                  carbsG: 40,
                  fatG: 18,
                  ingredients: ['Carrot', 'Broth'],
                  claimedByMe: mealClaimed,
                  claimedByOther: false,
                  authoredByMe: false,
                  riceRole: 'INCLUDES_RICE',
                },
              ];
        else if (path.endsWith('/recipe-record/claim')) {
          mealClaimed = true;
          data = {};
        } else if (path.endsWith('/recipe-record/release')) {
          mealClaimed = false;
          data = {};
        } else if (path.endsWith('/recipe-record/decision')) {
          verified = true;
          data = {};
        }
        await route.fulfill({ json: { success: true, data } });
      });

      await page.goto('/nutritionist/reviews');
      if (width < 1024) {
        await expect(page.getByRole('heading', { name: 'Use a desktop to review meals' })).toBeVisible();
        await expect(page.getByRole('region', { name: 'RND review canvas' })).toHaveCount(0);
        expect(mutations).toEqual([]);
        expect(errors).toEqual([]);
        return;
      }
      const selectCase = async () => page.getByRole('button', { name: /LUNCH Recorded soup/ }).click();
      await selectCase();
      const viewer = page.getByRole('region', { name: 'RND review canvas', exact: true });
      await expect(viewer).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Expand canvas' }).click();
      const fullscreen = page.getByRole('dialog', { name: /Case approval.*fullscreen/ });
      await expect(fullscreen).toBeVisible();
      const box = (await fullscreen.boundingBox())!;
      expect(box).toMatchObject({ x: 0, y: 0, width, height: 900 });
      await expect(fullscreen.locator('[data-canvas-sheet]')).toHaveCount(2);
      const handle = fullscreen.getByRole('button', { name: 'Move Meal evidence sheet' });
      await handle.focus();
      await page.keyboard.press('ArrowDown');
      await expect(fullscreen.locator('[data-canvas-sheet="1"]')).toHaveCSS('top', '20px');
      const sheetBefore = await fullscreen.locator('[data-canvas-sheet="1"]').getAttribute('style');
      const handleBox = (await handle.boundingBox())!;
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + handleBox.width / 2 + 40, handleBox.y + handleBox.height / 2 + 30);
      await page.mouse.up();
      expect(await fullscreen.locator('[data-canvas-sheet="1"]').getAttribute('style')).not.toBe(sheetBefore);
      await page.keyboard.press('h');
      await expect(fullscreen.getByRole('button', { name: 'Hand tool (H)' })).toHaveAttribute('aria-pressed', 'true');
      const viewport = fullscreen.getByRole('region', { name: 'Review canvas viewport' });
      const vp = (await viewport.boundingBox())!;
      const world = fullscreen.locator('[data-canvas-world]');
      const previousTransform = await world.getAttribute('style');
      await page.mouse.move(vp.x + 20, vp.y + 20);
      await page.mouse.down();
      await page.mouse.move(vp.x + 110, vp.y + 90);
      await page.mouse.up();
      expect(await world.getAttribute('style')).not.toBe(previousTransform);
      await page.keyboard.press('v');
      await expect(fullscreen.getByRole('button', { name: 'Select tool (V)' })).toHaveAttribute('aria-pressed', 'true');
      await fullscreen.getByRole('button', { name: 'Fit all sheets' }).click();
      await fullscreen.getByRole('button', { name: 'Claim review', exact: true }).click();
      const decision = page.getByRole('region', { name: 'Review decisions' });
      await decision.getByRole('textbox', { name: 'Member note (optional)' }).fill('Recorded member review note.');
      await page.keyboard.press('h');
      await expect(fullscreen.getByRole('button', { name: 'Select tool (V)' })).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Backspace');
      await decision.getByRole('textbox').fill('Recorded member review note.');
      await expect(fullscreen.getByRole('table', { name: 'Meal ingredients' })).toContainText('Carrot');
      await expect(fullscreen.getByRole('table', { name: 'Meal ingredients' })).toContainText('80');
      await expect(fullscreen.locator('[data-canvas-world] input')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('case-canvas.png') });
      await page.keyboard.press('Escape');
      await expect(fullscreen).toHaveCount(0);
      await expect(decision.getByRole('textbox')).toHaveValue('Recorded member review note.');
      await decision.getByRole('button', { name: 'Reject', exact: true }).click();
      await expect(decision.getByRole('button', { name: 'Confirm rejection' })).toBeDisabled();
      await decision.getByRole('button', { name: 'Cancel', exact: true }).click();
      await decision.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Synthetic stale evidence' })).toHaveCount(1);
      await expect(decision.getByRole('textbox')).toHaveValue('Recorded member review note.');
      await page.getByRole('button', { name: 'Expand canvas' }).click();
      await page.getByRole('button', { name: 'Release claim', exact: true }).click();
      await expect(fullscreen).toHaveCount(0);
      await expect(viewer).toHaveCount(0);
      await selectCase();
      await page.getByRole('button', { name: 'Back to queue', exact: true }).click();
      await expect(viewer).toHaveCount(0);
      await selectCase();
      await page.getByRole('button', { name: 'Claim review', exact: true }).click();
      failApproval = false;
      if (theme === 'dark') {
        await decision.getByRole('button', { name: 'Swap', exact: true }).click();
        await decision.getByLabel('Eligible replacement').selectOption('eligible-soup');
        await expect(viewer.locator('[data-canvas-sheet]')).toHaveCount(3);
        await expect(viewer.getByRole('article', { name: 'Replacement preview' })).toContainText('Squash');
        await expect(decision.getByRole('button', { name: 'Confirm swap' })).toBeDisabled();
        await decision.getByRole('textbox').fill('Reviewed a suitable replacement.');
        await page.getByRole('button', { name: 'Expand canvas' }).click();
        await expect(page.getByRole('textbox')).toHaveValue('Reviewed a suitable replacement.');
        await decision.getByRole('button', { name: 'Confirm swap' }).click();
        await expect(page.getByText('Queue clear', { exact: true })).toBeVisible();
        expect(mutations.at(-1)).toEqual({
          path: '/api/nutritionist/queue/case-record/swap',
          body: {
            libraryMealId: 'eligible-soup',
            expectedVersion: 'a'.repeat(64),
            expectedRecipeSignature: 'b'.repeat(64),
            expectedEvidenceRevision: 2,
            note: 'Reviewed a suitable replacement.',
          },
        });
      } else {
        await decision.getByRole('textbox').fill('Final recorded review note.');
        await decision.getByRole('button', { name: 'Approve', exact: true }).click();
        await expect(page.getByText('Queue clear', { exact: true })).toBeVisible();
        expect(mutations.at(-1)).toEqual({
          path: '/api/nutritionist/review/case-record',
          body: { action: 'approve', note: 'Final recorded review note.' },
        });
      }
      await page.getByRole('button', { name: /Meal verification/ }).click();
      await page.getByRole('button', { name: /DINNER.*Recorded base recipe/ }).click();
      await expect(viewer).toBeVisible();
      await page.getByRole('button', { name: 'Claim verification', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Verify base meal' })).toBeDisabled();
      await page.getByLabel('Review rationale').fill('Recorded base recipe rationale.');
      await page.getByRole('button', { name: 'Expand canvas' }).click();
      await expect(page.getByLabel('Review rationale')).toHaveValue('Recorded base recipe rationale.');
      await page.screenshot({ path: testInfo.outputPath('base-canvas.png') });
      const baseDecision = theme === 'dark' ? 'REJECTED' : 'VERIFIED';
      await page
        .getByRole('button', { name: baseDecision === 'VERIFIED' ? 'Verify base meal' : 'Reject', exact: true })
        .click();
      await expect(page.getByText('Queue clear', { exact: true })).toBeVisible();
      expect(mutations.at(-1)).toEqual({
        path: '/api/nutritionist/meal-verification/RAW_RECIPE/recipe-record/decision',
        body: { decision: baseDecision, rationale: 'Recorded base recipe rationale.' },
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
