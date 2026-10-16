// Flatten only the landing gallery's 3D/masked photo layer. The PNG bytes live
// inside the page; the headline, buttons and the rest of the UI stay as HTML.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function freezeMealGallery(page) {
  const gallery = page.locator('[data-meal-gallery]');
  if (!await gallery.count() || await gallery.locator('[data-static-meals]').count()) return;
  const viewport = gallery.locator(':scope > div').first();
  const originalSize = page.viewportSize();
  const frames = [];
  for (const [name, width] of [['desktop', 1440], ['tablet', 1024], ['mobile', 390]]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    });
    const isolation = await page.addStyleTag({ content: `
      html, body { background: transparent !important; }
      body * { visibility: hidden !important; }
      [data-meal-gallery] > div, [data-meal-gallery] > div * { visibility: visible !important; }
      [data-meal-gallery] * { animation: none !important; transition: none !important; }
    ` });
    const box = await viewport.boundingBox();
    if (!box || box.width < 1 || box.height < 1) throw Error('Missing meal gallery at ' + width);
    const png = await page.screenshot({
      omitBackground: true,
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    });
    frames.push({ name, src: 'data:image/png;base64,' + png.toString('base64') });
    await isolation.evaluate(element => element.remove());
  }
  await page.setViewportSize(originalSize);
  await viewport.evaluate((element, captures) => {
    const wrapper = document.createElement('div');
    wrapper.dataset.staticMeals = 'embedded';
    wrapper.style.cssText = 'position:relative;z-index:1;width:100%;height:430px;pointer-events:none';
    for (const capture of captures) {
      const image = document.createElement('img');
      image.src = capture.src;
      image.alt = 'Static diagonal display of Filipino meals';
      image.dataset.mealFrame = capture.name;
      image.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill';
      wrapper.appendChild(image);
    }
    element.replaceWith(wrapper);
    const style = document.createElement('style');
    style.dataset.staticMealStyles = 'true';
    style.textContent = `
      [data-meal-frame="mobile"], [data-meal-frame="tablet"] { display:none !important; }
      @media (min-width:1280px) { [data-static-meals] { height:600px !important; } }
      @media (max-width:1279px) {
        [data-static-meals] { height:100% !important; }
        [data-meal-frame="desktop"] { display:none !important; }
        [data-meal-frame="tablet"] { display:block !important; }
      }
      @media (max-width:639px) {
        [data-meal-frame="tablet"] { display:none !important; }
        [data-meal-frame="mobile"] { display:block !important; }
      }
    `;
    document.head.appendChild(style);
  }, frames);
}

module.exports = { freezeMealGallery };

async function flattenLandingMedia(page) {
  const preview = path.resolve(__dirname, '../verification/dashboard-1440.png');
  const src = 'data:image/png;base64,' + fs.readFileSync(preview).toString('base64');
  await page.evaluate(data => {
    document.querySelectorAll('video, img[data-frozen-video]').forEach(element => {
      const image = document.createElement('img');
      image.src = data;
      image.alt = 'Static KAINARA dashboard prototype preview';
      image.className = 'h-full w-full object-contain object-top';
      image.dataset.staticDashboardPreview = 'embedded';
      element.replaceWith(image);
    });
    document.querySelectorAll('button[aria-label*="promotional video"],button[aria-label*="video sound"]').forEach(button => button.remove());
  }, src);
}
module.exports.flattenLandingMedia = flattenLandingMedia;

if (require.main === module) {
  (async () => {
    const { chromium } = require('../../frontend/node_modules/@playwright/test');
    const root = path.resolve(__dirname, '..');
    const file = path.join(root, 'index.html');
    if (fs.readFileSync(file, 'utf8').includes('data-static-meals="embedded"')) {
      console.log('Landing gallery is already embedded as static images.');
      return;
    }
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, offline: true });
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      await freezeMealGallery(page);
      fs.writeFileSync(file, await page.content());
      const manifestPath = path.join(root, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.pages = manifest.pages.map(item => item.file === 'index.html'
        ? { ...item, bytes: fs.statSync(file).size, renderAdaptation: 'Embedded static diagonal meal-gallery images', adaptedAt: new Date().toISOString() }
        : item);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('Embedded static diagonal meal artwork in index.html at desktop, tablet and mobile sizes.');
    } finally {
      await browser.close();
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
