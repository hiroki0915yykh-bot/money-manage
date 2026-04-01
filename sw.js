const CACHE_NAME = 'budget-app-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon.svg',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  // 新しいService Workerをすぐにアクティブにする
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            // 古いキャッシュを削除
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network First, fallback to cache
// （常に最新のファイルがないかインターネットに確認する優先設定）
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // ネットワークにつながっていればキャッシュを更新して返す
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // オフラインの時のみ古い記憶（キャッシュ）を返す
        return caches.match(event.request);
      })
  );
});
