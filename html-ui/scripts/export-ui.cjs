/* Export the actual rendered app into editable HTML, with no Next/React runtime.
 * Run from the Desktop repository root, with frontend dev on port 3200.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('../../frontend/node_modules/@playwright/test');
const fixture = require('./fixtures.cjs');
const { freezeMealGallery, flattenLandingMedia } = require('./freeze-meal-gallery.cjs');
const root = path.resolve(__dirname, '..');
const sharedRoot = 'C:/Users/chima/Desktop/Nutrimind';
if (path.resolve(root, '..').toLowerCase() !== path.resolve(sharedRoot).toLowerCase()) throw new Error('Run the exporter from the Desktop Nutrimind checkout.');
const source = process.env.HTML_UI_SOURCE || 'http://127.0.0.1:3200';
if (new URL(source).port === '3100') throw new Error('Port 3100 belongs to the older worktree and is not an allowed source.');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:sharedRoot,encoding:'utf8'}).trim();
const fingerprintPaths=['frontend/package.json','frontend/src/app/globals.css','frontend/src/app/layout.tsx','frontend/src/app/page.tsx','frontend/src/components/auth/AuthHeroPanel.tsx','frontend/src/features/dashboard/CockpitDashboard.tsx','frontend/src/features/nutritionist-reviews/ReviewCanvas.tsx'];
const pages = [
  ['index', '/', 'Public', 'Landing'],
  ['auth', '/login', 'Public', 'Sign in'],
  ['register', '/register', 'Public', 'Create account'],
  ['forgot-password', '/forgot-password', 'Public', 'Forgot password'],
  ['reset-password', '/reset-password', 'Public', 'Reset password'],
  ['verify-email', '/verify-email', 'Verification', 'Verify email'],
  ['onboarding', '/onboarding/stats', 'Onboarding', 'Body statistics'],
  ['onboarding-preferences', '/onboarding/preferences', 'Onboarding', 'Food preferences'],
  ['onboarding-conditions', '/onboarding/conditions', 'Onboarding', 'Health conditions'],
  ['onboarding-allergies', '/onboarding/allergies', 'Onboarding', 'Food restrictions'],
  ['onboarding-shopping', '/onboarding/shopping-day', 'Onboarding', 'Shopping day'],
  ['onboarding-terms', '/onboarding/tos', 'Onboarding', 'Terms & final review'],
  ['dashboard', '/dashboard', 'Member', 'Home'],
  ['meals', '/meals', 'Member', 'Meal plan'],
  ['meals-history', '/meals', 'Member', 'Meal history', 'History'],
  ['meals-library', '/meals', 'Member', 'Meal library', 'Library'],
  ['grocery', '/grocery', 'Member', 'Groceries'],
  ['progress', '/progress', 'Member', 'Progress'],
  ['progress-reports', '/progress/reports', 'Member', 'Progress reports'],
  ['profile', '/profile', 'Member', 'Profile overview'],
  ['profile-personal', '/profile/personal', 'Member', 'Personal details'],
  ['profile-health', '/profile/health', 'Member', 'Health & goals'],
  ['profile-planning', '/profile/planning', 'Member', 'Food & planning'],
  ['profile-security', '/profile/security', 'Member', 'Security & privacy'],
  ['profile-clinical-evidence', '/profile/clinical-evidence', 'Member', 'Health details'],
  ['nutrition-report', '/profile/nutrition-report', 'Member', 'Nutrition report'],
  ['export', '/export', 'Member', 'Data export'],
  ['nutritionist', '/nutritionist/reviews', 'Nutritionist', 'Review queue'],
  ['nutritionist-library', '/nutritionist/library', 'Nutritionist', 'Meal library'],
  ['nutritionist-approved', '/nutritionist/approved', 'Nutritionist', 'Approved reviews'],
  ['nutritionist-profile', '/nutritionist/profile', 'Nutritionist', 'Professional profile'],
  ['admin', '/admin/overview', 'Admin', 'Overview'],
  ['admin-users', '/admin/users', 'Admin', 'User accounts'],
  ['admin-nutritionists', '/admin/users', 'Admin', 'Nutritionist onboarding', 'RNDs'],
  ['admin-analytics', '/admin/overview', 'Admin', 'Analytics overview'],
  ['admin-data', '/admin/data', 'Admin', 'Nutrition data'],
  ['admin-foods', '/admin/data', 'Admin', 'FNRI catalogue', 'FNRI catalogue'],
  ['admin-meals', '/admin/meals', 'Admin', 'Meal library'],
  ['nutritionist-outside-meals', '/nutritionist/outside-meals', 'Nutritionist', 'Outside meal reviews'],
  ['help', '/docs', 'Public', 'Help'],
  ['docs', '/docs', 'Public', 'Documentation'],
  ['sources', '/docs#data-sources', 'Public', 'Evidence sources'],
  ['meal-details', '/meals?date=2026-10-14&mealId=meal-0-0', 'Member', 'Meal details'],
  ['log-food', '/dashboard', 'Member', 'Log food or snack', null, 'button:has-text("Log food or snack")'],
  ['log-weight', '/progress', 'Member', 'Log weight', null, 'button:has-text("Log today")'],
  [
    'nutritionist-review-detail',
    '/nutritionist/reviews',
    'Nutritionist',
    'Selected review',
    null,
    'button:has-text("Scrambled Egg")',
  ],
];
const routes = pages.filter(p=>!p[4]&&!p[5]).reduce((all,p)=>{if(!all[p[1]])all[p[1]]=p[0]+'.html';return all;},{});
Object.assign(routes, {
  '/login': 'auth.html',
  '/health-profile': 'profile-health.html',
  '/profile/nutrition-report': 'nutrition-report.html',
  '/nutrition-report': 'nutrition-report.html',
  '/membership': 'screens.html',
  '/nutritionist/audit': 'nutritionist.html',
  '/admin/more': 'screens.html',
  '/admin/nutritionists':'admin-nutritionists.html',
  '/admin/analytics':'admin-analytics.html',
});
const manifest = [];
const downloaded = new Map();
const unknown = new Set();
fs.mkdirSync(path.join(root, 'verification'), { recursive: true });
fs.writeFileSync(path.join(root,'verification/source-fingerprints.json'),JSON.stringify({sourceDirectory:sharedRoot,sourceCommit,sourceUrl:source,capturedAt:new Date().toISOString(),files:fingerprintPaths.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(sharedRoot,file))).digest('hex')}))},null,2));
// Every resource is embedded as a data URL; the HTML has no asset-folder dependency.
async function asset(url) {
  if (!url || url.startsWith('data:') || url.startsWith('#') || url.startsWith('%23')) return url;
  const absolute = new URL(url, source);
  // Keep Next's same-origin image response: it is exactly what the current UI
  // displays, including approved remote photography and its optimized format.
  if (absolute.origin !== source && !['panlasangpinoy.com','res.cloudinary.com'].includes(absolute.hostname)) throw new Error('Unexpected external resource: ' + url);
  if (downloaded.has(absolute.href)) return downloaded.get(absolute.href);
  const response = await fetch(absolute);
  if (!response.ok) return null;
  const mime = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  const embedded = `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
  downloaded.set(absolute.href, embedded);
  return embedded;
}
async function cssFor(page) {
  const list = await page.evaluate(() =>
    [...document.styleSheets].map((s) => ({
      href: s.href,
      text: (() => {
        try {
          return [...s.cssRules].map((r) => r.cssText).join('\n');
        } catch {
          return '';
        }
      })(),
    }))
  );
  let text = '';
  for (const sheet of list) {
    let css = sheet.text;
    // CSSOM serialization can discard var()-based gradient shorthands. Keep the
    // original linked CSS bytes rather than a browser's normalized rule text.
    if (sheet.href && sheet.href.startsWith(source)) css = await (await fetch(sheet.href)).text();
    const urls = [...new Set([...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g)].map((m) => (m[1] || m[2] || m[3] || '').trim()))];
    for (const url of urls) {
      if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('%23')) continue;
      const local = await asset(new URL(url, sheet.href || source).href);
      if (local) css = css.split(url).join(local);
      else throw new Error('Could not embed CSS resource: '+url);
    }
    text += css + '\n';
  }
  return text;
}
async function snapshot(page, item) {
  if (item[0] === 'index') {
    await freezeMealGallery(page);
    await flattenLandingMedia(page);
  }
  // Video is visual material, so preserve its current frame as an embedded still.
  // Surrounding headings, controls and vectors stay editable HTML/SVG.
  const videos=page.locator('video');
  for(let i=0;i<await videos.count();i++) {
    const video=videos.nth(i);
    if(!await video.isVisible())continue;
    const still='data:image/png;base64,'+(await video.screenshot({animations:'disabled'})).toString('base64');
    await video.evaluate((element,data)=>{const image=document.createElement('img');image.src=data;image.className=element.className;image.style.cssText=element.style.cssText;image.alt=element.getAttribute('aria-label')||'Video still from the current page';image.dataset.frozenVideo='true';element.replaceWith(image);},still);
  }
  await page.evaluate(() => {
    document
      .querySelectorAll('nextjs-portal,script,link[rel="preload"],link[rel="modulepreload"],meta[http-equiv],noscript')
      .forEach((el) => el.remove());
    // Freeze animated numeric web components as ordinary, editable text.
    document.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) {
        const text = el.shadowRoot.textContent;
        const value = el.getAttribute('data-value') || (text && text.replace(/\s+/g, ' ').trim());
        if (el.localName.includes('number')) {
          const replacement = document.createElement('span');
          replacement.className = el.className;
          replacement.textContent =
            el._data?.valueAsString || el.getAttribute('aria-label') || el.textContent || value || '';
          replacement.style.cssText = el.style.cssText;
          el.replaceWith(replacement);
        }
      }
    });
    document.querySelectorAll('input').forEach((e) => {
      e.setAttribute('value', e.value);
      if (e.checked) e.setAttribute('checked', '');
    });
    document.querySelectorAll('body title').forEach((e) => e.remove());
    document.querySelectorAll('textarea').forEach((e) => (e.textContent = e.value));
    document.querySelectorAll('option').forEach((e) => {
      if (e.selected) e.setAttribute('selected', '');
      else e.removeAttribute('selected');
    });
    document.querySelectorAll('canvas').forEach((e) => {
      try {
        const im = document.createElement('img');
        im.src = e.toDataURL();
        im.className = e.className;
        im.style.cssText = e.style.cssText;
        im.width = e.width;
        im.height = e.height;
        e.replaceWith(im);
      } catch {}
    });
  });
  const css = await cssFor(page);
  const sources = await page.evaluate(() => [...document.querySelectorAll('img,svg image,video[poster]')].map((e) => e.getAttribute('src') || e.getAttribute('href') || e.getAttribute('poster')));
  const replacements = {};
  for (const src of sources) if (src) replacements[src] = await asset(src);
  const inlineUrls=await page.evaluate(()=>[...document.querySelectorAll('[style]')].flatMap(e=>[...e.getAttribute('style').matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1])));
  for(const url of new Set(inlineUrls))replacements[url]=await asset(url);
  await page.evaluate(
    ({ replacements, routes, item }) => {
      document.querySelectorAll('img').forEach((e) => {
        const src = e.getAttribute('src');
        const local = replacements[src];
        if (local) e.src = local;
        else if (src && !src.startsWith('data:')) {
          e.removeAttribute('src');
          e.setAttribute('data-unavailable-image', src);
        }
        e.removeAttribute('srcset');
        e.removeAttribute('loading');
      });
      document.querySelectorAll('svg image').forEach(e=>{const href=e.getAttribute('href');if(replacements[href])e.setAttribute('href',replacements[href]);});
      document.querySelectorAll('[style]').forEach(e=>{let style=e.getAttribute('style');for(const [url,data] of Object.entries(replacements))if(data)style=style.split(url).join(data);e.setAttribute('style',style);});
      document.querySelectorAll('video').forEach(e=>{const poster=e.getAttribute('poster');if(poster&&replacements[poster]){const im=document.createElement('img');im.src=replacements[poster];im.className=e.className;im.style.cssText=e.style.cssText;im.alt='Captured video poster';e.replaceWith(im);}else e.remove();});
      document.querySelectorAll('audio,iframe,object,embed').forEach(e=>e.remove());
      document.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href');
        if (href.startsWith('/')) {
          const url = new URL(href, 'http://local');
          a.setAttribute('data-source-route', href);
          a.href = routes[url.pathname] || 'screens.html';
          if (url.pathname === '/meals' && url.searchParams.has('tab'))
            a.href = `meals-${url.searchParams.get('tab')}.html`;
        }
      });
      document.querySelectorAll('link[rel="stylesheet"],style').forEach((e) => e.remove());
      document.querySelectorAll('link').forEach((e) => e.remove());
      document.title = `${item[3]} | KAINARA HTML`;
      document.body.dataset.screen = item[0];
      document.body.dataset.prototype = 'synthetic';
      document.documentElement.setAttribute('data-source-route', item[1]);
      // Retain the source font variable classes but make their values independent of Next.
    },
    { replacements, routes, item }
  );
  let html = await page.content();
  html = html.replace(
    '</head>',
    `<style data-embedded-app-css>${css}</style><style data-embedded-preview-css>${fs.readFileSync(path.join(root,'scripts/templates/prototype.css'),'utf8')}</style></head>`
  );
  html=html.replace('</body>',`<script data-local-preview>${fs.readFileSync(path.join(root,'scripts/templates/prototype.js'),'utf8')}</script></body>`);
  html = html.replace(/<!--\$[!?]?-->|<!--\/\$-->/g, '');
  fs.writeFileSync(path.join(root, item[0] + '.html'), html);
  manifest.push({ file: item[0] + '.html', route: item[1], group: item[2], title: item[3], selfContained:true,bytes:Buffer.byteLength(html),sourceDirectory:sharedRoot,...(item[0]==='index'?{renderAdaptation:'Embedded static diagonal meal-gallery images'}:{}) });
  saveManifest();
}
function saveManifest(){fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),sourceCommit,sourceDirectory:sharedRoot,sourceUrl:source,sourceIncludesWorkingTreeChanges:true,selfContained:true,viewport:{width:1440,height:1000},syntheticData:true,pages:manifest},null,2));}
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const item of pages) {
      if (process.env.HTML_UI_ONLY && !process.env.HTML_UI_ONLY.split(',').includes(item[0])) {
        const file = path.join(root, item[0] + '.html');
        if (fs.existsSync(file))
          manifest.push({
            file: item[0] + '.html',
            route: item[1],
            group: item[2],
            title: item[3],
            selfContained: fs.readFileSync(file,'utf8').includes('data-embedded-app-css'),
            bytes:fs.statSync(file).size,sourceDirectory:sharedRoot,
          });
        continue;
      }
      const role = item[2] === 'Admin' ? 'ADMIN' : item[2] === 'Nutritionist' ? 'NUTRITIONIST' : 'USER';
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        locale: 'en-PH',
        timezoneId: 'Asia/Manila',
        colorScheme: 'light',
      });
      await context.addInitScript(() => {
        localStorage.setItem('nutrimind-theme', 'light');
        // Render the provider's static button without initiating authentication.
        window.google={accounts:{id:{initialize(){},renderButton(element){const b=document.createElement('button');b.type='button';b.textContent='Continue with Google';b.style.cssText='width:100%;height:40px;background:#fff;border:1px solid #dadce0;border-radius:4px;color:#3c4043;font:500 14px Arial,sans-serif';element.appendChild(b);}}}};
      });
      if (item[2] !== 'Public') {
        const token =
          'eyJhbGciOiJIUzI1NiJ9.' +
          Buffer.from(
            JSON.stringify({ userId: 'design-member', email: 'design@example.invalid', role, iat: 1791936000, exp: 2100000000 })
          ).toString('base64url') +
          '.design-only';
        await context.addCookies([{ name: 'nutrimind_session', value: token, url: source }]);
      }
      await context.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const endpoint = url.pathname.slice(4) + url.search;
        let data = fixture.response(endpoint, role);
        if (item[2] === 'Onboarding' && endpoint === '/user/profile') data = { ...data, onboardingDone: false,onboardingStatus:{...data.onboardingStatus,nextPath:'/onboarding/stats'} };
        if (item[2] === 'Verification' && endpoint === '/user/profile') data = { ...data, emailVerified: false };
        const meta =
          endpoint.split('?')[0] === '/user/meals/current'
            ? { planSnapshot: { dailyCalorieTarget: 1800, dailyMacroTargets: {'2026-10-14':{calories:1800,proteinG:90,carbsG:225,fatG:60}} }, cycle: fixture.cycle }
            : {};
        unknown.add(endpoint.split('?')[0]);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data, meta }),
        });
      });
      // Prevent the preview from sending requests to third-party identity or avatar services.
      await context.route(/https:\/\/(accounts\.google\.com|api\.dicebear\.com)\/.*/, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="20" fill="#dff6ed"/><text x="40" y="51" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#08705b">JC</text></svg>',
        })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(source + item[1], { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(2400);
      await page.waitForFunction(()=>document.body.innerText.trim().length>50,{},{timeout:30000});
      if (item[4]) {
        const tab = page.getByRole('tab', { name: item[4], exact: true });
        if (await tab.count()) await tab.click();
        else await page.getByRole('button', { name: new RegExp('^' + item[4]) }).click();
      }
      if (item[5]) {
        await page.screenshot({path:path.join(root,'verification',item[0]+'-before.png'),animations:'disabled'});
        if(item[0]==='nutritionist-review-detail')await page.getByRole('button').filter({hasText:/scrambled.*egg/i}).first().click();
        else await page.locator(item[5]).first().click();
      }
      await page.waitForTimeout(1800);
      if(item[0]==='index') {
        const height=await page.evaluate(()=>document.documentElement.scrollHeight);
        for(let y=0;y<height;y+=650){await page.evaluate(offset=>window.scrollTo(0,offset),y);await page.waitForTimeout(120);}
        await page.waitForTimeout(600);
        await page.evaluate(()=>window.scrollTo(0,0));
      }
      await page.evaluate(async () => {document.querySelectorAll('img').forEach(i=>i.loading='eager');await document.fonts.ready;await Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,15000))]);});
      await page.waitForTimeout(200);
      if (new URL(page.url()).pathname !== new URL(item[1],source).pathname) throw Error(`Redirected ${item[0]} to ${page.url()}`);
      if (errors.length) throw new Error('PAGE ERRORS ' + item[0] + ': ' + errors.join(' | '));
      const content = await page.locator('body').innerText();
      if (/We could not load this page|Error 404/.test(content))
        throw Error('Invalid rendered screen ' + item[0] + ': ' + errors.join(' | '));
      if(content.trim().length<50){await page.screenshot({path:path.join(root,'verification',item[0]+'-capture-error.png')});throw Error('Missing visible content for '+item[0]);}
      if (['index', 'auth', 'dashboard', 'grocery', 'nutritionist', 'admin'].includes(item[0]))
        await page.screenshot({
          path: path.join(root, 'verification', item[0] + '-source.png'),
          animations: 'disabled',
        });
      await snapshot(page, item);
      console.log('EXPORTED ' + item[0]);
      await context.close();
    }
    fs.writeFileSync(
      path.join(root, 'manifest.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          sourceCommit,
          sourceDirectory:sharedRoot,
          sourceUrl:source,
          sourceIncludesWorkingTreeChanges:true,
          selfContained:true,
          viewport: { width: 1440, height: 1000 },
          syntheticData: true,
          pages: manifest,
        },
        null,
        2
      )
    );
    console.log('ENDPOINTS ' + [...unknown].join(', '));
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
