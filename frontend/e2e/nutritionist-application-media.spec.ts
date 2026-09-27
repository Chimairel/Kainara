import { expect, test } from '@playwright/test';

test('applicant uploads a recent photo without camera or signature controls', async ({ page }) => {
  await page.goto('/nutritionist-apply');
  await page.locator('#fullName').fill('Photo Applicant');
  await page.locator('#applicationEmail').fill(`photo-${Date.now()}@example.test`);
  await page.locator('#phoneNumber').fill('+63 917 555 0123');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Upload a recent photo.')).toBeVisible();
  await page.locator('#official-headshot').setInputFiles({
    name: 'recent.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByAltText('Uploaded identity photo preview')).toBeVisible();
  await page.getByLabel(/I confirm this photo was taken within the past 30 days/).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Professional credentials' })).toBeVisible();
  await expect(page.getByText(/signature/i)).toHaveCount(0);
});
