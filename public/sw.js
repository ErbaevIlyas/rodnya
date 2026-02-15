const CACHE_NAME = 'rodnya-v15.2';
const RUNTIME_CACHE = 'rodnya-runtime-v15.2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/ringtone.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker установлен');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Кешируем основные файлы');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker активирован');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
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
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
  } 
  // Для API запросов - сначала сеть
  else if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api')) {
    event.respondWith(fetch(request).catch(() => {
      // Если нет сети, возвращаем ошибку
      return new Response('Нет соединения с сервером', { status: 503 });
    }));
  }
  // Для остального - кеш, потом сеть
  else {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((response) => {
            // Кешируем успешные ответы
            if (response.ok) {
              const clonedResponse = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, clonedResponse);
              });
            }
            return response;
          });
        })
        .catch(() => {
          // Если нет кеша и нет сети, возвращаем заглушку
          if (request.destination === 'image') {
            return new Response('<svg></svg>', { headers: { 'Content-Type': 'image/svg+xml' } });
          }
          return new Response('Нет соединения', { status: 503 });
        })
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('📢 Push получен без данных');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('📢 Push получен:', data.title);
    
    const options = {
      body: data.body || 'Новое сообщение',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'rodnya-notification',
      requireInteraction: data.requireInteraction || false,
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
        callId: data.callId,
        caller: data.caller,
        isCall: data.isCall || false,
        isMessage: data.isMessage || false,
        timestamp: Date.now()
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
    console.error('❌ Ошибка обработки push:', e);
  }
});

// Клик на уведомление
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Клик на уведомление:', event.action);
  event.notification.close();
  
  // Обработка действий для звонков
  if (event.action === 'accept' || event.action === 'reject') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Ищем открытое окно
        for (let i = 0; i < clientList.length; i++) {
          if ('focus' in clientList[i]) {
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
        // Если нет открытого окна, открываем новое
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
    );
  } else {
    // Обычный клик на уведомление
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Если окно уже открыто, фокусируемся на нём
        for (let i = 0; i < clientList.length; i++) {
          if ('focus' in clientList[i]) {
            clientList[i].focus();
            return;
          }
        }
        // Если нет, открываем новое
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
    );
  }
});

// Обработка закрытия уведомления
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Уведомление закрыто');
});