const assert = require('node:assert/strict'),
  test = require('node:test'),
  fs = require('node:fs'),
  vm = require('node:vm');
test('push-only worker displays current alerts and confines clicks to the application', async () => {
  const handlers = {},
    shown = [],
    reports = [],
    opened = [];
  const self = {
    location: { origin: 'https://example.invalid' },
    addEventListener: (type, handler) => {
      handlers[type] = handler;
    },
    registration: {
      showNotification: async (title, options) => {
        shown.push({ title, options });
      },
    },
    clients: {
      matchAll: async () => [{ postMessage: (message) => reports.push(message) }],
      openWindow: async (url) => {
        opened.push(url);
      },
    },
  };
  const code = fs.readFileSync(require('node:path').join(__dirname, '../public/kainara-notifications-sw.js'), 'utf8');
  vm.runInNewContext(code, { self, URL, Date, Number });
  assert.equal(handlers.fetch, undefined, 'Do not cache private pages or API calls.');
  const dispatch = async (data) => {
    let work;
    handlers.push({
      data: { json: () => data },
      waitUntil: (promise) => {
        work = promise;
      },
    });
    await work;
  };
  await dispatch({ title: 'Expired', body: 'Old', expiresAt: new Date(0).toISOString() });
  await dispatch({ title: 'Invalid', body: 'Old', expiresAt: 'not-a-date' });
  assert.equal(shown.length, 0);
  await dispatch({
    title: 'Time to prepare breakfast',
    body: 'Open KAINARA.',
    tag: 'meal-event',
    path: '/meals?date=2026-10-07',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].options.tag, 'meal-event');
  assert.equal(reports.at(-1).status, 'DISPLAY_REQUESTED');
  assert.deepEqual(Object.keys(reports.at(-1)).sort(), ['receivedAt', 'status', 'type']);
  self.registration.showNotification = async () => {
    throw new Error('Synthetic permission failure');
  };
  await dispatch({ title: 'Current', body: 'Open KAINARA.', expiresAt: new Date(Date.now() + 60000).toISOString() });
  assert.equal(reports.at(-1).status, 'DISPLAY_FAILED');
  self.clients.matchAll = async () => [];
  let work;
  handlers.notificationclick({
    notification: { close: () => {}, data: { path: 'https://evil.invalid/steal' } },
    waitUntil: (promise) => {
      work = promise;
    },
  });
  await work;
  assert.equal(opened[0], 'https://example.invalid/dashboard');
  handlers.notificationclick({
    notification: { close: () => {}, data: { path: '/meals?date=2026-10-07' } },
    waitUntil: (promise) => {
      work = promise;
    },
  });
  await work;
  assert.equal(opened[1], 'https://example.invalid/meals?date=2026-10-07');
});
