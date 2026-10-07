import { expect, test } from '@playwright/test';

test('scheduled confirmation unlocks without reloading; live updates preserve rejection drafts', async ({ page }) => {
  const user = {
    id: 'live-admin-fixture',
    name: 'Synthetic admin',
    email: 'admin@example.test',
    role: 'ADMIN',
    emailVerified: true,
  };
  const claims = Buffer.from(
    JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'nutrimind_session',
      value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`,
      url: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin,
    },
  ]);
  const stage = 'CALL_SCHEDULED';
  let verifiedAt: string | null = null;
  let scheduledAt: string | undefined;
  let streams = 0;
  let notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
  }> = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/live/events')) {
      streams++;
      return route.fulfill({ contentType: 'text/event-stream', body: 'event: refresh\ndata: {}\n\n' });
    }
    let data: unknown = [];
    if (path.endsWith('/user/profile')) data = user;
    else if (path.endsWith('/notifications')) data = { notifications, unreadCount: notifications.length };
    else if (path.endsWith('/admin/nutritionist-applications')) {
      scheduledAt ??= new Date(Date.now() + 3000).toISOString();
      data = [
        {
          id: 'live-application-fixture',
          referenceCode: 'NM-LIVEFIXTURE',
          status: stage,
          fullName: 'Synthetic applicant',
          email: 'applicant@example.test',
          phoneNumber: '+639175550123',
          prcLicenseNumber: 'FIXTURE-PRC',
          prcLicenseExpiry: '2030-12-31T00:00:00Z',
          specialization: 'Nutrition',
          yearsOfExperience: 1,
          university: 'Synthetic university',
          professionalBio: 'Synthetic verification fixture.',
          availableCallSlots: [],
          scheduledCallAt: scheduledAt,
          meetingUrl: 'https://meet.example.test/fixture',
          callVerifiedAt: verifiedAt,
          createdAt: '2026-10-01T00:00:00Z',
        },
      ];
    }
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/admin/users?tab=nutritionists');
  const confirm = page.getByRole('button', { name: 'Confirm call completed and photo matched' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Rejection reason').fill('Keep this unsaved draft.');
  await expect(confirm).toBeEnabled({ timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Approve verified applicant' })).toBeDisabled();
  verifiedAt = new Date().toISOString();
  notifications = [
    {
      id: 'notification-fixture',
      title: 'New application received',
      message: 'An application is ready for credential review.',
      type: 'NUTRITIONIST_APPLICATION',
      isRead: false,
      createdAt: new Date().toISOString(),
    },
  ];
  await expect(page.getByRole('button', { name: 'Approve verified applicant' })).toBeEnabled({ timeout: 10000 });
  await expect(page.getByLabel('Rejection reason')).toHaveValue('Keep this unsaved draft.');
  await expect(page.getByText('Philippine time (UTC+8)', { exact: false }).first()).toBeVisible();
  expect(streams).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('applicants see updated decisions without refreshing and can start a fresh rejected application', async ({
  page,
}) => {
  let status = 'CALL_SCHEDULED';
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          referenceCode: 'NM-TRACKFIXTURE',
          email: 'applicant@example.test',
          fullName: 'Synthetic applicant',
          status,
          scheduledCallAt: '2026-10-01T15:54:00Z',
          meetingUrl: 'https://meet.example.test/fixture',
          createdAt: '2026-10-01T00:00:00Z',
          decisionReason: status === 'REJECTED' ? 'Please provide current credentials.' : null,
        },
      },
    })
  );
  await page.goto('/nutritionist-apply#track');
  await page.locator('#tracking-reference').fill('NM-TRACKFIXTURE');
  await page.locator('#tracking-email').fill('applicant@example.test');
  await page.getByRole('button', { name: 'Check Application Status' }).click();
  await expect(page.getByRole('heading', { name: 'Verification call scheduled', exact: true })).toBeVisible();
  await expect(page.getByText(/11:54 PM/)).toBeVisible();
  status = 'REJECTED';
  await expect(page.getByText('Please provide current credentials.')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Apply again' }).click();
  await expect(page.locator('#applicationEmail')).toHaveValue('applicant@example.test');
  await expect(page.getByRole('heading', { name: 'Your professional identity' })).toBeVisible();
});

test('a duplicate PRC number is reported while typing, before submission', async ({ page }) => {
  await page.route('**/api/nutritionist-applications/email/*', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    return route.fulfill({
      headers,
      json: {
        success: true,
        data: route.request().url().endsWith('/send') ? { resendAfterSeconds: 60 } : { proof: 'x'.repeat(43) },
      },
    });
  });
  await page.route('**/api/nutritionist-applications/license-availability', async (route) => {
    const { prcLicenseNumber } = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, data: { available: prcLicenseNumber !== 'TAKEN-PRC' } } });
  });
  await page.goto('/nutritionist-apply');
  await page.locator('#fullName').fill('Synthetic applicant');
  await page.locator('#applicationEmail').fill('applicant@example.test');
  await page.locator('#phoneNumber').fill('+63 917 555 0123');
  await page.locator('#official-headshot').setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=',
      'base64'
    ),
  });
  await expect(page.getByAltText('Uploaded headshot preview')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^Continue to/ }).click();
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByText('Email verified', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Credentials' }).click();
  await page.locator('#prcLicenseNumber').fill('TAKEN-PRC');
  await page.locator('#prcLicenseExpiry').fill('2030-12-31');
  await page.locator('#specialization').fill('Clinical nutrition');
  await expect(page.getByText(/This PRC number already has/)).toBeVisible();
  await page.getByRole('button', { name: /^Continue to/ }).click();
  await expect(page.getByRole('heading', { name: 'PRC credentials and licensure' })).toBeVisible();
  await page.locator('#prcLicenseNumber').fill('FRESH-PRC');
  await expect(page.getByText(/No active application found/)).toBeVisible();
  await expect(page.getByText(/This PRC number already has/)).toHaveCount(0);
});
