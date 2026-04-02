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
        const { request } = event;
        if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached && !navigator.onLine) {
                    return cached;
                }

                return fetch(request)
                    .then((response) => {
                        if (!response || response.status === 0 || response.type === 'opaque') {
                            return response;
                        }

                        // Add COOP/COEP headers
                        const newHeaders = new Headers(response.headers);
                        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                        const newResponse = new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: newHeaders,
                        });

                        // Cache successful GET requests for non-model files
                        if (request.method === 'GET' && 
                            response.ok &&
                            !request.url.includes('onnx') && 
                            !request.url.includes('bin')) {
                            const clone = newResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        }

                        return newResponse;
                    })
                    .catch((e) => {
                        return cached || Response.error();
                    });
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
                    // Only reload if we are not in an iframe to avoid loops in some environments
                    if (window.self === window.top) {
                        console.log("Reloading to activate COI Service Worker...");
                        location.reload();
                    } else {
                        console.warn("COI Service Worker active but not controlling. Skipping reload in iframe.");
                    }
                }
            });
        }
    })();
}
