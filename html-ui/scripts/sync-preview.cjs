// Maintenance only: every resulting HTML contains its own complete template.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(__dirname, 'templates/prototype.css'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'templates/prototype.js'), 'utf8');
let count = 0;
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  const filename = path.join(root, file);
  const before = fs.readFileSync(filename, 'utf8');
  if (!before.includes('data-embedded-preview-css')) continue;
  const html = before
    .replace(/<style data-embedded-preview-css(?:="")?>[\s\S]*?<\/style>/, () => `<style data-embedded-preview-css>${css}</style>`)
    .replace(/<script data-local-preview(?:="")?>[\s\S]*?<\/script>/, () => `<script data-local-preview>${script}</script>`);
  fs.writeFileSync(filename, html);
  count++;
}
console.log(`Embedded flat prototype adapters into ${count} standalone pages.`);
