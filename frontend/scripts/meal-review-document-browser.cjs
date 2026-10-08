// Exercise the actual document component, production CSS and local fonts without a web server or API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const buildRoot = path.join(root, '.next-production');
const output = path.join(root, 'test-results', 'meal-review-document');
const files = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
const styles = files(path.join(buildRoot, 'static', 'css'))
  .filter((file) => file.endsWith('.css'))
  .map((file) =>
    fs.readFileSync(file, 'utf8').replace(/url\(([^)]+)\)/g, (original, raw) => {
      const url = raw.replace(/^['"]|['"]$/g, '');
      const media = url.match(/(?:\.\.\/media\/|\/_next\/static\/media\/)([^/?]+)/);
      if (!media) return original;
      const local = path.join(buildRoot, 'static', 'media', media[1]);
      if (!fs.existsSync(local)) return original;
      const mime = local.endsWith('.ttf') ? 'font/ttf' : 'font/woff2';
      return `url(data:${mime};base64,${fs.readFileSync(local).toString('base64')})`;
    })
  )
  .join('\n');
const fontClasses = [...new Set([...styles.matchAll(/\.([\w-]+)\s*\{\s*--font-/g)].map((match) => match[1]))].join(' ');
const meal = {
  id: 'fixture-recipe',
  mealName: 'Measured vegetable soup',
  calories: 600,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
  sodiumMg: null,
  nutritionServingDescription: '300 g measured serving',
  description: 'Measure the edible ingredients, cook fully and portion the prepared soup.',
  ingredients: [{ ingredientName: 'Measured squash', quantity: 300, unit: 'g' }],
};
const report = {
  id: 'prior-concern',
  createdAt: '2026-10-08T00:00:00Z',
  actorSnapshot: { name: 'Synthetic flagger', role: 'RND' },
  notes: {
    category: 'NUTRITION',
    affectedFields: ['quantity', 'calories'],
    explanation: 'The serving amount needs an independent measured review.',
    reference: 'Recorded measured portion and food-composition evidence.',
    proposedCorrection: 'Reconcile the portion to 325 g and calculate the saved serving nutrition.',
  },
};
const decision = (id, action, snapshot) => ({
  id,
  action,
  snapshot: { meals: [snapshot] },
  version: id.padEnd(64, 'a'),
  createdAt: '2026-10-08T01:00:00Z',
  actorSnapshot: { name: 'Synthetic reviewer', role: 'RND' },
  rationale: 'Verified the measured edible quantities and the recorded food-composition values.',
});
const corrected = {
  ...meal,
  calories: 650,
  sodiumMg: 150,
  nutritionServingDescription: '325 g measured serving',
  ingredients: [{ ingredientName: 'Measured squash', quantity: 325, unit: 'g' }],
};
const history = [
  {
    id: 'first',
    number: 1,
    state: 'RELEASED',
    reports: [report],
    decisions: [decision('before', 'CORRECTION_BEFORE', meal), decision('after', 'CORRECTED', corrected)],
  },
  {
    id: 'second',
    number: 2,
    state: 'QUARANTINED',
    reports: [{ ...report, id: 'second-concern' }],
    decisions: [decision('latest', 'FLAGGED', corrected)],
  },
];

async function main() {
  const bundle = await esbuild.build({
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { '@': path.join(root, 'src') },
    stdin: {
      resolveDir: root,
      loader: 'jsx',
      contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import Timeline from './src/features/nutritionist-library/MealReviewTimeline';
      createRoot(document.getElementById('root')).render(<main className="p-4 sm:p-6"><Timeline history={${JSON.stringify(history)}} legacyHistoryUnknown={false}/></main>);
    `,
    },
  });
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440])
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/*', (route) => route.abort());
        await page.setContent(
          `<html class="${theme === 'dark' ? 'dark' : ''}"><head><style>${styles}</style></head><body class="${fontClasses}"><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`
        );
        const picker = page.getByRole('combobox', { name: 'Review change' });
        await expect(picker).toContainText('Incident 2 · Flag recorded');
        await picker.click();
        const menu = await page.getByRole('listbox').boundingBox();
        assert.ok(menu.x >= 0 && menu.x + menu.width <= width + 1);
        await page.getByRole('option', { name: /Incident 1 · Recipe corrected/ }).click();
        const table = page.getByRole('table', { name: 'Recorded correction comparison' });
        await expect(table.getByText('600 kcal')).toBeVisible();
        await expect(table.getByText('650 kcal')).toBeVisible();
        await expect(table.getByText('Not recorded')).toBeVisible();
        await page.getByText(/Synthetic flagger · nutrition/).click();
        await expect(page.getByText(report.notes.reference)).toBeVisible();
        await page.getByText('Recorded ingredients and serving').click();
        await expect(page.getByText('Measured squash · 300 g')).toBeVisible();
        await expect(page.getByText('Measured squash · 325 g')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(output, `review-${width}-${theme}.png`), fullPage: true });
        await picker.focus();
        await picker.press('Enter');
        await picker.press('ArrowDown');
        await picker.press('Enter');
        await expect(picker).toContainText('Before correction');
        await expect(page.getByText('600 kcal', { exact: true })).toBeVisible();
        assert.deepEqual(errors, []);
        console.log(
          `PASS offline review document: ${width}px ${theme}, keyboard selection, comparison, notes, no overflow or page exceptions`
        );
        await page.close();
      }
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
