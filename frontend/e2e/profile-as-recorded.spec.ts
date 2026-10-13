import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark'])
  for (const mobile of [false, true]) {
    test(`unchanged profile confirmation ${theme} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, info) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      const user = {
        id: 'synthetic-rnd',
        name: 'Synthetic RND',
        email: 'fixture@example.invalid',
        role: 'NUTRITIONIST',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
      };
      const jwt = Buffer.from(
        JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      await page
        .context()
        .addCookies([{ name: 'nutrimind_session', value: `fixture.${jwt}.fixture`, url: 'http://localhost:3000' }]);
      await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
      const review = {
        profileRevision: 1,
        scopeKey: 'saved-scope',
        claim: { active: true, mine: true },
        needsClarification: true,
        clarificationEntryIds: ['named'],
        clarificationEntries: [
          { id: 'named', domain: 'CONDITION', displayName: 'Named condition', canReviewAsRecorded: true },
        ],
        conditionReviewEntries: [],
        requirements: [{ area: 'OTHER', state: 'READY', message: 'Details available for RND review.' }],
        availableAreas: ['OTHER'],
        healthDetails: [
          {
            area: 'OTHER',
            responses: {
              conditionDetails: 'Recorded condition and treatment details.',
              medications: 'Recorded medications.',
              dietaryAdvice: 'Recorded dietary advice.',
              recentSymptoms: 'No new symptoms.',
            },
          },
        ],
        profileProposals: { enabled: true, proposals: [], currentEntries: [] },
        clarifications: { enabled: true, forms: [] },
        previousReview: null,
      };
      const member = {
        userId: 'member',
        name: 'Synthetic member',
        conditions: ['Named condition'],
        allergies: [],
        profileStatus: 'PENDING',
        documentCount: 0,
        currentProfile: {
          revision: 1,
          age: 28,
          goal: 'MAINTAIN',
          dailyCalorieTarget: 2000,
          conditions: ['Named condition'],
          allergies: [],
        },
        reports: [],
        documents: [],
        requirements: review.requirements,
        availableAreas: ['OTHER'],
        profileReview: review,
      };
      const mutations: Array<{ path: string; body: unknown }> = [],
        errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/**', async (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname;
        const headers = {
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        };
        if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
        let data: unknown = [];
        if (request.method() !== 'GET') {
          mutations.push({ path, body: request.postDataJSON() });
          data = {};
        } else if (path.endsWith('/user/profile')) data = user;
        else if (path.endsWith('/credential-status')) data = { eligible: true, expiryDate: '2099-01-01' };
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/review-work-counts')) data = { profile: 1, meal: 0, case: 0, audit: 0 };
        else if (path.endsWith('/profile-work')) data = [member];
        else if (path.endsWith('/profile-work/member')) data = member;
        return route.fulfill({ status: 200, headers, json: { data, success: true } });
      });
      await page.goto('/nutritionist/reviews');
      if (mobile) {
        await expect(page.getByRole('heading', { name: 'Use a desktop to review meals' })).toBeVisible();
        await page.screenshot({ path: info.outputPath(`profile-${theme}-mobile-gate.png`) });
        expect(mutations).toEqual([]);
        expect(errors).toEqual([]);
        return;
      }
      await page
        .getByRole('button', { name: /Member queue/ })
        .first()
        .click();
      await page.getByText('Synthetic member', { exact: true }).first().click();
      await page.getByRole('button', { name: 'Profile decision', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Record profile decision' });
      await dialog
        .getByRole('textbox', { name: 'Review notes' })
        .fill('Reviewed the complete saved details. Restrictions are retained.');
      await expect(dialog.getByRole('button', { name: 'Confirm for planning' })).toBeDisabled();
      await dialog.getByRole('checkbox', { name: /Reviewed as recorded/ }).check();
      await expect(dialog.getByRole('button', { name: 'Confirm for planning' })).toBeEnabled();
      await page.screenshot({ path: info.outputPath(`profile-${theme}-${mobile ? 'mobile' : 'desktop'}.png`) });
      await dialog.getByRole('button', { name: 'Confirm for planning' }).click();
      await expect.poll(() => mutations.length).toBe(1);
      expect(mutations[0]).toEqual({
        path: '/api/nutritionist/profile-reviews/member/decision',
        body: {
          decision: 'APPROVED',
          notes: 'Reviewed the complete saved details. Restrictions are retained.',
          profileRevision: 1,
          scopeKey: 'saved-scope',
          reviewedDeclarationIds: ['named'],
        },
      });
      expect(errors).toEqual([]);
    });
  }
