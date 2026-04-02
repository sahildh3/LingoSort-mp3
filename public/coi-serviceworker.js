/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzuidhof/coi-serviceworker */
const CACHE_NAME = 'lingosort-v1';
const ASSETS = [
    './',
    './index.html',
    './logo.svg',
    './maskable-logo.svg',
    './manifest.json',
    './coi-serviceworker.js'
];

if (typeof window === 'undefined') {
    self.addEventListener("install", (event) => {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
        );
        self.skipWaiting();
    });

    self.addEventListener("activate", (event) => {
        event.waitUntil(
            Promise.all([
                self.clients.claim(),
                caches.keys().then((keys) => {
                    return Promise.all(
                        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
                    );
                })
            ])
        );
    });

    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            caches.match(event.request).then((cached) => {
                const fetchPromise = fetch(event.request)
                    .then((response) => {
                        if (response.status === 0) {
                            return response;
                        }

                        const newHeaders = new Headers(response.headers);
                        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                        const newResponse = new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: newHeaders,
                        });

                        // Cache successful GET requests for non-model files
                        if (event.request.method === 'GET' && 
                            !event.request.url.includes('onnx') && 
                            !event.request.url.includes('bin')) {
                            const clone = newResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                        }

                        return newResponse;
                    })
                    .catch((e) => {
                        console.error(e);
                        return cached; // Fallback to cache if fetch fails
                    });

                return cached || fetchPromise;
            })
        );
    });
} else {
    (() => {
        const script = document.currentScript;
        const swUrl = script.src;
        
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register(swUrl).then((registration) => {
                console.log("COI Service Worker registered", registration.scope);

                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener("statechange", () => {
                        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                            location.reload();
                        }
                    });
                });

                if (registration.active && !navigator.serviceWorker.controller) {
                    location.reload();
                }
            });
        }
    })();
}
