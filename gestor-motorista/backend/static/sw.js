// Service Worker — Painel.IA
// ⚠️ NÃO remover o cache de splash-silent.mp4 e splash.mp3 — necessário para iOS
const CACHE_NAME = 'painel-ia-v5';
const SPLASH_FILES = ['/static/splash-silent.mp4', '/static/splash.mp3'];

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
  const path = new URL(e.request.url).pathname;
  if(SPLASH_FILES.includes(path)){
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if(cached) return cached;
          return fetch(e.request).then(resp => { cache.put(e.request, resp.clone()); return resp; });
        })
      )
    );
  }
});

self.addEventListener('push', e => {
  let data = { title:'Painel.IA', body:'Você tem uma notificação', icon:'/static/icon-192.png', badge:'/static/icon-192.png', tag:'painel-notif', url:'/' };
  try { if(e.data) data = { ...data, ...e.data.json() }; } catch(err) { if(e.data) data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title, {
    body:data.body, icon:data.icon, badge:data.badge, tag:data.tag,
    data:{ url:data.url }, vibrate:[200,100,200], requireInteraction:false
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for(const c of list){ if(c.url.includes(self.location.origin) && 'focus' in c) return c.focus(); }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
