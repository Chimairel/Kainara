import { expect, test } from '@playwright/test';

const sceneAssets = [
  'bahay-kubo.svg',
  'capstone-team-window-right.png',
  'nara-tanod-directions.webp',
  'nara-tanod-reactions.webp',
];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('https://accounts.google.com/**', (route) => route.abort());
});

for (const lastAsset of sceneAssets) {
  test(`the whole scene waits for ${lastAsset}, with the form usable during loading`, async ({ page }) => {
    const requested = new Set<string>();
    const completed = new Set<string>();
    const release = new Map<string, () => void>();
    const held = new Map(
      sceneAssets.map((asset) => [asset, new Promise<void>((resolve) => release.set(asset, resolve))])
    );
    await page.route(
      (url) => sceneAssets.some((asset) => decodeURIComponent(url.href).includes(asset)),
      async (route) => {
        const asset = sceneAssets.find((value) => decodeURIComponent(route.request().url()).includes(value))!;
        requested.add(asset);
        await held.get(asset);
        const response = await route.fetch();
        await route.fulfill({ response });
        completed.add(asset);
      }
    );

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const stage = page.locator('[data-auth-kubo-stage]');
    await expect.poll(() => requested.size).toBe(4);
    await expect(stage).toHaveAttribute('data-auth-scene-ready', 'false');
    expect(await stage.evaluate((element) => (element as HTMLElement).style.opacity)).toBe('0');
    await expect(stage).toHaveAttribute('inert', '');
    await expect(stage).toBeHidden();
    await expect(stage.locator('[data-auth-bulb]')).toBeHidden();
    expect(await stage.evaluate((element) => getComputedStyle(element, '::after').visibility)).toBe('hidden');
    const email = page.getByLabel('Email address');
    await email.fill('scene-loading@example.invalid');
    const bounds = await stage.evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight }));

    for (const asset of sceneAssets) {
      if (asset !== lastAsset) release.get(asset)!();
    }
    await expect.poll(() => completed.size).toBe(3);
    await expect(stage).toBeHidden();
    release.get(lastAsset)!();
    await expect(stage).toHaveAttribute('data-auth-scene-ready', 'true');
    expect(await stage.evaluate((element) => (element as HTMLElement).style.opacity)).toBe('1');
    await expect(stage).not.toHaveAttribute('inert', '');
    await expect(stage.locator('[data-auth-bulb]')).toBeVisible();
    await expect(stage.locator('[data-auth-mascot]')).toBeVisible();
    await expect(stage.getByRole('img', { name: 'The KAINARA capstone team working together' })).toBeVisible();
    expect(await stage.evaluate((element) => getComputedStyle(element, '::after').visibility)).toBe('visible');
    expect(await stage.evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight }))).toEqual(
      bounds
    );
    await expect(email).toHaveValue('scene-loading@example.invalid');
  });
}

test('a failed reaction sheet cannot permanently hide the house or block the form', async ({ page }) => {
  await page.route('**/mascots/nara-tanod-reactions.webp', (route) => route.abort());
  await page.goto('/login');
  await expect(page.locator('[data-auth-kubo-stage]')).toHaveAttribute('data-auth-scene-ready', 'true');
  await expect(page.getByRole('button', { name: 'Boop the Nara' })).toBeVisible();
  await expect(page.locator('[data-auth-bulb]')).toBeVisible();
  await page.getByLabel('Email address').fill('fallback@example.invalid');
  await expect(page.getByLabel('Email address')).toHaveValue('fallback@example.invalid');
});

test('cached client navigation reveals the scene again with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.locator('[data-auth-kubo-stage]')).toHaveAttribute('data-auth-scene-ready', 'true');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator('[data-auth-kubo-stage]')).toHaveAttribute('data-auth-scene-ready', 'true');
  await expect(
    page.locator('[data-auth-kubo-stage]').getByRole('img', { name: 'Nara wearing her tanod costume' })
  ).toBeVisible();
});
