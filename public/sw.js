const CACHE_NAME = "llm-logger-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const request = event.request;

  if (
    request.method !== "GET" ||
    request.url.indexOf("/api/") !== -1 ||
    request.url.indexOf(self.location.origin) !== 0
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      return (
        cached ||
        fetch(request).then(function (response) {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, clone);
            });
          }
          return response;
        })
      );
    })
  );
});
