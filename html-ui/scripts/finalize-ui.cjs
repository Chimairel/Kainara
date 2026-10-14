const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destinations = {
  '/admin/data': 'admin-data.html',
  '/nutritionist/outside-meals': 'nutritionist-outside-meals.html',
  '/docs': 'docs.html',
  '/help': 'help.html',
  '/sources': 'sources.html',
  '/admin/nutritionists':'admin-nutritionists.html',
  '/admin/analytics':'admin-analytics.html',
  '/admin/overview':'admin.html',
  '/admin/meals':'admin-meals.html',
  '/profile/clinical-evidence':'profile-clinical-evidence.html',
};
for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.html'))) {
  const filename = path.join(root, file);
  let html = fs.readFileSync(filename, 'utf8');
  // Generated styles/scripts can contain trailing whitespace from dependencies.
  // Normalize code blocks without touching rendered text or embedded image bytes.
  html=html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, block=>block.replace(/[\t ]+(?=\r?$)/gm,''));
  html=html.replace(/<[a-z][^>]*>/gi, tag=>tag.replace(/[\t ]+(?=\r?$)/gm,''));
  html=html.replace(/<link\b[^>]*>/gi,'');
  if(!html.includes('data-self-contained='))html=html.replace(/<html\b/, '<html data-source-directory="C:/Users/chima/Desktop/Nutrimind" data-self-contained="true"');
  const body = html.indexOf('<body');
  html = html.slice(0, body) + html.slice(body).replace(/<title>[^<]*<\/title>/g, '');
  html = html.replace(/<a\b[^>]*>/g, (tag) => {
    const route = tag.match(/data-source-route="([^"]+)"/)?.[1];
    return destinations[route] ? tag.replace(/href="[^"]*"/, `href="${destinations[route]}"`) : tag;
  });
  fs.writeFileSync(filename, html);
}
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.sourceIncludesWorkingTreeChanges = true;
manifest.pages=manifest.pages.map(page=>({...page,bytes:fs.statSync(path.join(root,page.file)).size,selfContained:true}));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Finalized static metadata and destination links.');
