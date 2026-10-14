// Each HTML is copied alone into a temporary directory. Network is disabled.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../../frontend/node_modules/@playwright/test');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const files = [...manifest.pages.map(p=>p.file), 'screens.html'];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kainara-html-isolated-'));
const selected=new Set(['index','auth','dashboard','meals','meals-library','grocery','progress','nutritionist','nutritionist-review-detail','admin','admin-users','profile','onboarding']);
(async()=>{
  const browser=await chromium.launch({headless:true});
  const results=[];
  try {
    for(const width of [1440,390]) {
      const context=await browser.newContext({offline:true,viewport:{width,height:1000}});
      const page=await context.newPage();
      for(const file of files) {
        const copied=path.join(temp,'screen.html');
        fs.copyFileSync(path.join(root,file),copied);
        const url=pathToFileURL(copied).href;
        const requests=[];const errors=[];
        const onRequest=req=>{if(![url,'data:','blob:'].some(prefix=>req.url().startsWith(prefix)))requests.push(req.url().slice(0,150));};
        const onError=e=>errors.push(e.message);
        page.on('request',onRequest);page.on('pageerror',onError);
        await page.route('**/*',route=>route.request().url()===url?route.continue():route.abort());
        await page.goto(url,{waitUntil:'load',timeout:60000});
        await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
        const metrics=await page.evaluate(()=>{
          const extraResources=[...document.querySelectorAll('script[src],link[href],img[src],iframe[src],video[src],audio[src],source[src],object[data],embed[src],svg image')]
            .map(e=>e.getAttribute('src')||e.getAttribute('href')||e.getAttribute('data')||e.getAttribute('xlink:href')||'')
            .filter(url=>url&&!url.startsWith('data:')&&!url.startsWith('#')).map(url=>url.slice(0,120));
          const styles=[...document.querySelectorAll('style,[style]')].map(e=>e.localName==='style'?e.textContent:e.getAttribute('style')).join('\n');
          const externalCss=[...styles.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g)]
            .map(m=>(m[1]||m[2]||m[3]||'').trim()).filter(url=>!url.startsWith('data:')&&!url.startsWith('#')&&!url.startsWith('%23')).map(url=>url.slice(0,100));
          return {
            overflow:document.documentElement.scrollWidth>innerWidth+1,
            brokenImages:[...document.images].filter(i=>i.getAttribute('src')&&i.naturalWidth===0).map(i=>i.alt),
            externalResources:extraResources,externalCss,hasExternalImports:/@import\s/.test(styles),
            errorPage:/We could not load this page|Error 404|Professional access needs attention|Failed to load analytics/.test(document.body.innerText),
            textLength:document.body.innerText.length,heading:document.querySelector('h1,h2')?.textContent||'',
            editableText:document.querySelectorAll('h1,h2,h3,p,span,label').length,
            embeddedFontRules:(styles.match(/@font-face/g)||[]).length,
            sourceRoute:document.documentElement.dataset.sourceRoute||null
          };
        });
        const failures=[...errors];
        const contentCheck=await page.evaluate(()=>({partialLoadError:/Some meal counts could not load|Retry counts/.test(document.body.innerText),hiddenLandingContent:document.body.dataset.screen==='index'?[...document.querySelectorAll('main [style]')].filter(e=>e.style.opacity==='0'&&e.textContent.trim().length>20).map(e=>e.textContent.trim().slice(0,70)):[]}));
        if(contentCheck.partialLoadError)failures.push('Meal-count fixture did not load');
        if(contentCheck.hiddenLandingContent.length)failures.push('Landing content retained invisible reveal state');
        if(requests.length)failures.push('Extra resource requests: '+requests.join(', '));
        if(metrics.externalResources.length||metrics.externalCss.length||metrics.hasExternalImports)failures.push('Has an external rendering dependency');
        if(metrics.brokenImages.length)failures.push('Broken images: '+metrics.brokenImages.join(', '));
        if(metrics.overflow)failures.push('Horizontal document overflow');
        if(metrics.errorPage)failures.push('Invalid exported page state');
        if(metrics.textLength<50)failures.push('Missing visible page content');
        if(selected.has(file.replace('.html','')))await page.screenshot({path:path.join(root,'verification',file.replace('.html','')+`-${width}.png`),fullPage:true,animations:'disabled'});
        results.push({file,width,isolated:true,offline:true,...metrics,...contentCheck,attemptedRequests:requests,failures});
        page.off('request',onRequest);page.off('pageerror',onError);await page.unroute('**/*');
      }
      await context.close();
    }
    const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},javaScriptEnabled:false});
    const page=await context.newPage();
    const isolated=path.join(temp,'dashboard.html');fs.copyFileSync(path.join(root,'dashboard.html'),isolated);
    await page.goto(pathToFileURL(isolated).href);
    results.push({check:'Content renders without JavaScript or network',pass:(await page.locator('body').innerText()).includes('Mabuhay, Jamie.')});
    await page.evaluate(()=>document.documentElement.classList.add('figma-export'));
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
    const importMode=await page.evaluate(()=>({height:document.documentElement.scrollHeight,overflow:getComputedStyle(document.querySelector('main')).overflowY}));
    results.push({check:'Figma full-content mode',...importMode,pass:importMode.height>1000&&importMode.overflow==='visible'});
    await page.screenshot({path:path.join(root,'verification','dashboard-figma-1440.png'),fullPage:true});
    await context.close();
    const failures=results.filter(r=>r.failures?.length||r.pass===false);
    fs.writeFileSync(path.join(root,'verification','report.json'),JSON.stringify({checkedAt:new Date().toISOString(),sourceDirectory:manifest.sourceDirectory,sourceCommit:manifest.sourceCommit,mode:'Single HTML copied in isolation; network disabled; no supporting folders',results},null,2));
    console.log(JSON.stringify({screens:manifest.pages.length,index:true,viewports:[1440,390],offline:true,failures:failures.map(r=>({file:r.file,width:r.width,failures:r.failures,check:r.check,pass:r.pass}))},null,2));
    if(failures.length)process.exitCode=1;
  } finally {
    await browser.close();
    const checkedTemp=path.resolve(temp);
    if(!checkedTemp.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(checkedTemp).startsWith('kainara-html-isolated-'))throw Error('Unexpected verification temp directory');
    fs.rmSync(checkedTemp,{recursive:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1});
