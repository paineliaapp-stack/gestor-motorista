// Service Worker — Painel.IA v6
const CACHE_NAME = 'painel-ia-v6';
const SPLASH_FILES = ['/static/splash.mp4', '/static/splash.mp3'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(SPLASH_FILES.map(f => cache.add(f).catch(() => {})))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pagina principal — SEMPRE busca da rede (never cache)
  // Isso impede o iOS de servir a pagina congelada do cache
  if(url.pathname === '/' || url.pathname === '/index.html'){
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() =>
        caches.match(e.request) // fallback offline
      )
    );
    return;
  }

  // Splash assets — cache first
  if(SPLASH_FILES.includes(url.pathname)){
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if(cached) return cached;
          return fetch(e.request).then(resp => {
            cache.put(e.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }
});

// Push Notifications
self.addEventListener('push', e => {
  let data = {
    title: 'Painel.IA',
    body: 'Você tem uma notificação',
    icon: '/static/icon-192.png',
    badge: '/static/icon-192.png',
    tag: 'painel-notif',
    url: '/'
  };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch(err) {
    if (e.data) data.body = e.data.text();
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/static/icon-192.png',
      badge: data.badge || '/static/icon-192.png',
      tag: data.tag || 'painel-notif',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
