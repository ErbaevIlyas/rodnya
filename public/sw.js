const CACHE_NAME = 'rodnya-v15.3';
const STATIC_CACHE = 'rodnya-static-v15.3';
const DYNAMIC_CACHE = 'rodnya-dynamic-v15.3';

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/ringtone.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2'
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker установлен');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Кешируем статические файлы');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker активирован');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('🗑️ Удаляем старый кеш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Для HTML - сначала сеть, потом кеш
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request) || caches.match('/index.html');
        })
    );
  }
  // Для API запросов - сеть с таймаутом, потом кеш
  else if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/upload') || url.pathname.startsWith('/ping')) {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])
        .then((response) => {
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
  // Для остального - кеш, потом сеть
  else {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              if (response.ok) {
                const clonedResponse = response.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => {
                  cache.put(request, clonedResponse);
                });
              }
              return response;
            });
        })
        .catch(() => {
          // Возвращаем заглушку для изображений
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#f0f0f0" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#999">Офлайн</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          return new Response('Офлайн', { status: 503 });
        })
    );
  }
});

// Push notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ Пропускаем ожидание, активируем новую версию');
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Новое сообщение',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">👥</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">👥</text></svg>',
      tag: data.tag || 'rodnya-notification',
      requireInteraction: data.requireInteraction || false,
      data: {
        url: data.url || '/',
        callId: data.callId,
        caller: data.caller,
        isCall: data.isCall || false,
        isMessage: data.isMessage || false
      }
    };
    
    // Для звонков требуем взаимодействие и добавляем действия
    if (data.isCall) {
      options.requireInteraction = true;
      options.actions = [
        {
          action: 'accept',
          title: 'Принять',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">✅</text></svg>'
        },
        {
          action: 'reject',
          title: 'Отклонить',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">❌</text></svg>'
        }
      ];
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Родня', options)
    );
  } catch (e) {
    console.error('Ошибка push:', e);
  }
});

// Клик на уведомление
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Обработка действий для звонков
  if (event.action === 'accept' || event.action === 'reject') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].url === '/' && 'focus' in clientList[i]) {
            clientList[i].focus();
            // Отправляем сообщение клиенту о действии
            clientList[i].postMessage({
              type: 'CALL_ACTION',
              action: event.action,
              callId: event.notification.data.callId,
              caller: event.notification.data.caller
            });
            return;
          }
        }
        // Если нет, открываем новое
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  } else {
    // Обычный клик на уведомление
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Если окно уже открыто, фокусируемся на нём
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].url === '/' && 'focus' in clientList[i]) {
            return clientList[i].focus();
          }
        }
        // Если нет, открываем новое
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});