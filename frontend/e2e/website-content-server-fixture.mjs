import http from 'node:http';
// Disposable public metadata for the dedicated SSR test server; no database/provider access.
let mode = 'automatic';
let reads = 0;
let hadPrivateHeaders = false;
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/__fixture' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 1024) {
        res.writeHead(400);
        res.end('{}');
        return;
      }
    }
    const value = JSON.parse(raw);
    if (!['automatic', 'custom', 'image', 'none', 'failure'].includes(value.mode)) {
      res.writeHead(400);
      res.end('{}');
      return;
    }
    mode = value.mode;
    reads = 0;
    hadPrivateHeaders = false;
    res.end('{}');
    return;
  }
  if (req.url === '/__fixture') {
    res.end(JSON.stringify({ reads, hadPrivateHeaders }));
    return;
  }
  if (req.url === '/api/public/landing-media') {
    reads++;
    hadPrivateHeaders ||= Boolean(req.headers.cookie || req.headers.authorization);
    if (mode === 'failure') {
      res.writeHead(503);
      res.end('{}');
      return;
    }
    const video = {
      kind: 'video',
      url: 'https://res.cloudinary.com/fixture/video/upload/promo.mp4',
      posterUrl:
        mode === 'custom'
          ? 'https://res.cloudinary.com/fixture/image/upload/custom.jpg'
          : 'https://res.cloudinary.com/fixture/video/upload/so_1/promo.jpg',
      altText: 'KAINARA promotion',
    };
    const data =
      mode === 'none'
        ? null
        : mode === 'image'
          ? {
              kind: 'image',
              url: 'https://res.cloudinary.com/fixture/image/upload/promo.jpg',
              posterUrl: null,
              altText: 'KAINARA still image',
            }
          : video;
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (req.url === '/health') {
    res.end('{"ready":true}');
    return;
  }
  res.writeHead(404);
  res.end('{}');
});
server.listen(3101, '127.0.0.1');
