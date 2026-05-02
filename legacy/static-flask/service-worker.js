self.addEventListener("install", event => {
    event.waitUntil(
        caches.open("receipt-cache").then(cache => {
            return cache.addAll([
                "/camera",
                "/static/camera.js"
            ]);
        })
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(resp => {
            return resp || fetch(event.request);
        })
    );
});
