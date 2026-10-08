import { expect, test, type Page } from '@playwright/test';

const runId = process.env.CASE_FLOW_BROWSER_RUN_ID;
test.skip(!runId, 'Requires the disposable five-profile case-approval fixture.');

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel(/^Password$/).fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  if (email === 'nutritionist@gmail.com') {
    const recovery = page.getByRole('heading', { name: 'Your workspace took too long to open' });
    await Promise.race([
      page.waitForURL(/\/nutritionist\/reviews$/, { timeout: 25_000 }),
      recovery.waitFor({ state: 'visible', timeout: 25_000 }),
    ]);
    if (await recovery.isVisible()) await page.getByRole('button', { name: 'Try again' }).click();
  }
  await page.waitForURL(/\/(profile\/nutrition-report|dashboard|nutritionist\/reviews)$/, { timeout: 25_000 });
  if (page.url().includes('/profile/nutrition-report')) {
    const acknowledge = page.getByRole('button', { name: 'Acknowledge and Continue' });
    const failure = page.getByRole('heading', { name: 'Report Resolution Failed' });
    await Promise.race([
      acknowledge.waitFor({ state: 'visible', timeout: 25_000 }),
      failure.waitFor({ state: 'visible', timeout: 25_000 }),
    ]);
    if (await failure.isVisible()) await page.getByRole('button', { name: 'Try Again' }).click();
    await acknowledge.click();
    await page.goto('/dashboard');
  }
  await expect(page).toHaveURL(/\/(dashboard|nutritionist\/reviews)$/, { timeout: 25_000 });
}

test('five profiles and nutritionist case workspace show the recorded approval states', async ({ browser }) => {
  test.setTimeout(120_000);
  for (const [label, restricted] of [
    ['healthy-omni', false],
    ['healthy-vegetarian', false],
    ['hypertension', true],
    ['diabetes-eggs', true],
    ['eggs-only', true],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, `cf-${label}-${runId}@example.com`, 'CaseFlow123!');
    await page.goto('/meals');
    await expect(page.getByText('We could not load this page.')).toHaveCount(0);
    await expect(page.getByText('Clinically verified meal')).toHaveCount(0);
    if (restricted) {
      await expect(page.getByText(/Awaiting review/i).first()).toBeVisible();
      await expect(page.getByText(/In your plan|Approved for you/i)).toHaveCount(0);
    } else {
      await expect(page.getByText(/Verified|Ready/).first()).toBeVisible();
    }
    await context.close();
  }

  const pendingContext = await browser.newContext();
  const pendingPage = await pendingContext.newPage();
  await signIn(pendingPage, `cf-profile-ui-${runId}@example.com`, 'CaseFlow123!');
  await expect(pendingPage.getByText('An RND needs to review your declared health profile')).toBeVisible();
  await pendingContext.close();

  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  await signIn(page, 'nutritionist@gmail.com', 'Nutritionist123');
  await expect(page.getByRole('button', { name: /^Meal verification/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Case approval/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Profile queue/ })).toBeVisible();
  await page.getByRole('button', { name: /^Profile queue/ }).click();
  await expect(page.getByRole('heading', { name: 'People awaiting review' })).toBeVisible();
  const pendingProfile = page.getByRole('button').filter({ hasText: 'Case flow profile UI' }).first();
  await pendingProfile.click();
  await expect(page.getByText('EGGS', { exact: true }).first()).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Review notes' })
    .fill('Reviewed the fictional egg allergy declaration for planning.');
  await page.getByRole('button', { name: 'Confirm for planning' }).click();
  await expect(pendingProfile).toHaveCount(0);
  await page.getByRole('button', { name: /^Case approval/ }).click();
  const card = page.getByRole('button').filter({ hasText: 'Case flow eggs-only' }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByText('EGGS', { exact: true }).first()).toBeVisible();
  const claim = page.getByRole('button', { name: 'Claim review' });
  if (await claim.isVisible()) await claim.click();
  await expect(page.getByRole('button', { name: 'Release claim' })).toBeVisible();
  await page.getByRole('button', { name: 'Release claim' }).click();
  await context.close();
});
