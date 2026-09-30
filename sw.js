const CACHE_NAME = 'efrinflix-v2';

// الأصول الأساسية المراد تخزينها للعمل أوفلاين
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// 1. التثبيت والتخزين المبدئي
self.addEventListener('install', event => {
  self.skipWaiting(); // تفعيل السيرفس وركر الجديد فوراً دون انتظار إغلاق التبويبات
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => console.error('خطأ في التخزين المبدئي:', err))
  );
});

// 2. التفعيل وحذف الكاش القديم عند التحديث
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('حذف الكاش القديم:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // التحكم بالصفحات المفتوحة حالياً مباشرة
  );
});

// 3. معالجة الطلبات بالشبكة والكاش بحسب النوع
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // استثناء طلبات API وطلبات غير GET لتذهب للشبكة مباشرة
  if (url.origin.includes('api.themoviedb.org') || request.method !== 'GET') {
    return;
  }

  // استراتيجية Network-First لتصفح الصفحات (لضمان حصول المستخدم على أحدث تحديث للموقع)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  // استراتيجية Cache-First للأصول الثابتة (الملفات والرموز)
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
        }
        return networkResponse;
      });
    })
  );
});
