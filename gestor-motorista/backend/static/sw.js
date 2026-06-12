// Service Worker — Painel.IA v7
// v7 CORRIGE O BUG DO VÍDEO NO iOS: a v6 fazia cache-first do splash.mp4,
// mas o Cache API não suporta Range requests — e o iOS EXIGE Range para vídeo.
// Resultado: 1ª abertura ok (rede), 2ª travava (cache sem Range).
// Regra nova: este SW NUNCA intercepta fetch. Mídia vai sempre direto à rede.
// Mantém apenas push notifications.

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Apaga TODOS os caches antigos (inclusive painel-ia-v6 com o vídeo quebrado)
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// SEM listener de fetch — nenhuma requisição é interceptada.
// Vídeo/áudio/página vão direto à rede com suporte completo a Range (206).

// ── Push notifications (mantido da v6) ──
self.addEventListener('push', e => {
  let data = { title: 'Painel.IA', body: '' };
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
