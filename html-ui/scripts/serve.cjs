const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3101);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};
http
  .createServer((req, res) => {
    let relative;
    try {
      relative = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const filename = path.resolve(root, '.' + (relative === '/' ? '/screens.html' : relative));
    if (!filename.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.stat(filename, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filename).pipe(res);
    });
  })
  .listen(port, '127.0.0.1', () => console.log(`KAINARA HTML: http://127.0.0.1:${port}/screens.html`));
