/* Push-only worker. Private pages and API responses are never cached. */
self.addEventListener('push', event => {
  let data;
  try { data = event.data.json(); } catch { return; }
  if (!data || typeof data.title !== 'string' || typeof data.body !== 'string' ||
      !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) return;
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: data.tag, renotify: false, data: { path: data.path },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  let target = new URL('/dashboard', self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.path || '/dashboard', self.location.origin);
    if (candidate.origin === self.location.origin && /^\/(dashboard|meals|profile|nutritionist|admin)(\/|\?|$)/.test(candidate.pathname + candidate.search)) target = candidate;
  } catch { /* Open the default workspace. */ }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target.href); await existing.focus(); }
    else await self.clients.openWindow(target.href);
  })());
});
