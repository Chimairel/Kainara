const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { pages } = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const reference=fs.readFileSync(path.join(root,'index.html'),'utf8');
const embeddedStyles=[...reference.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const bodyClasses=reference.match(/<body[^>]*class="([^"]*)"/)?.[1]||'';
const groups = [...new Set(pages.map((p) => p.group))];
const cards = groups
  .map(
    (group) =>
      `<section><h2>${group}</h2><div class="screen-list">${pages
        .filter((p) => p.group === group)
        .map(
          (p) =>
            `<a href="${p.file}"><span>${p.title}</span><small>${p.route}</small><span aria-hidden="true">→</span></a>`
        )
        .join('')}</div></section>`
  )
  .join('');
fs.writeFileSync(
  path.join(root, 'screens.html'),
  `<!doctype html><html lang="en" class="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KAINARA · Screen library</title><style>${embeddedStyles}</style><style>
body{margin:0;background:var(--brand-bg);color:var(--brand-text);font:14px/1.5 var(--font-dm-sans),sans-serif}.catalog{max-width:1120px;margin:auto;padding:56px 28px 80px}.catalog header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--brand-border);padding-bottom:24px}.catalog header a{color:var(--brand-green);font-weight:700}.catalog h1{font:700 clamp(32px,5vw,52px)/1.1 var(--font-outfit),sans-serif;margin:40px 0 16px;letter-spacing:-.03em}.catalog p{max-width:68ch;color:var(--brand-muted)}.catalog section{margin-top:36px}.catalog h2{font:600 22px var(--font-outfit),sans-serif;margin-bottom:12px}.screen-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.screen-list a{display:grid;grid-template-columns:1fr auto;padding:18px 20px;background:var(--brand-surface);border:1px solid var(--brand-border);border-radius:12px;text-decoration:none;color:var(--brand-text)}.screen-list a:hover{border-color:var(--brand-green);background:var(--brand-green-light)}.screen-list span:first-child{font-weight:700}.screen-list small{grid-row:2;color:var(--brand-muted);word-break:break-word}.screen-list span:last-child{grid-column:2;grid-row:1/3;align-self:center;color:var(--brand-green)}.import-note{padding:20px;border:1px solid var(--brand-border);border-radius:12px;margin-top:28px}.catalog code{font-size:13px;color:var(--brand-green)}@media(max-width:800px){.screen-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.screen-list{grid-template-columns:1fr}.catalog{padding:24px 18px 72px}}
</style></head><body class="${bodyClasses}"><main class="catalog"><header><strong>KAINARA / HTML UI</strong><a href="index.html">Open landing page →</a></header><h1>Your current system.<br>One HTML file per screen.</h1><p>${pages.length} editable screens recreated directly from C:\\Users\\chima\\Desktop\\Nutrimind. Every HTML embeds its own CSS, fonts, pictures and preview code. Copy any one page into an empty folder: it renders without network access or the rest of this folder.</p><div class="import-note"><strong>Importing into Figma</strong><p>Pass the individual HTML file to your conversion script. Use a 1440px desktop frame or a 390px mobile frame. Add <code>?figma=1</code> in a browser to reveal full workspace content; for a script that disables JavaScript, add the <code>figma-export</code> class to the root HTML element.</p><p>Press <code>Alt + S</code> to return here when browsing the folder. Data and review states are synthetic design fixtures; no backend actions are connected.</p></div>${cards}</main><script>document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='s')location.href='screens.html'})</script></body></html>`
);
console.log(`Built screen library: ${pages.length} screens.`);
