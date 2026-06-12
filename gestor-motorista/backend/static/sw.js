// Service Worker — Painel.IA v3
const CACHE_NAME = 'painel-ia-v3';
const SPLASH_VIDEO = '/static/splash.mp4';

self.addEventListener('install', e => {
  self.skipWaiting();
  // Faz cache do vídeo no install — da segunda abertura em diante é instantâneo
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.add(SPLASH_VIDEO).catch(() => {}) // falha silenciosa se offline
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

// Intercepta requisição do vídeo — serve do cache se disponível
self.addEventListener('fetch', e => {
  if(e.request.url === SPLASH_VIDEO){
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

// Clique na notificação
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
