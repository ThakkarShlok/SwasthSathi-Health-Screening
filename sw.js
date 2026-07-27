/**
 * ============================================
 * SwasthSathi Service Worker (PWA, Phase 4)
 *
 * SAFETY-CRITICAL CACHING POLICY — this is a health app.
 * Serving a stale API response or a cached health result is a correctness
 * defect. Therefore:
 *
 *   CACHE-FIRST  : static shell only — HTML shells, CSS, JS, logo SVGs,
 *                  icon PNGs, fonts. Content that never contains user data.
 *   NETWORK-ONLY : ALL dynamic/data requests — anything to supabase.co, any
 *                  /functions/v1/ Edge Function (guideline-chat, recommendations,
 *                  ocr-extract, doctor-search), any auth endpoint, and any POST.
 *                  These are NEVER cached and NEVER served from cache. If the
 *                  network fails, we return an explicit offline error — never
 *                  a stale value.
 *
 * Update safety: the cache name is versioned. Bump CACHE_VERSION on any shell
 * change; old caches are deleted on activate so users never get stuck on stale
 * assets.
 * ============================================
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `swasth-static-${CACHE_VERSION}`;

// Precached app shell. Every entry is verified to exist — addAll() is atomic,
// so one missing URL would fail the whole install. Keep this list minimal:
// enough to load the shell and run the offline-capable screening + calculator.
const PRECACHE_URLS = [
    './',
    './index.html',
    './screening.html',
    './offline.html',
    './manifest.json',

    // Styles (shell + screening)
    './assets/styles/base.css',
    './assets/styles/style.css',
    './assets/styles/language-modal.css',
    './assets/styles/screening.css',

    // Shared scripts (shell chrome + i18n + client)
    './assets/scripts/data/language-data.js',
    './assets/scripts/shared/i18n.js',
    './assets/scripts/shared/language-modal.js',
    './assets/scripts/shared/supabase-client.js',
    './assets/scripts/shared/inflight-tracker.js',
    './assets/scripts/shared/navbar.js',
    './assets/scripts/shared/footer.js',
    './assets/scripts/shared/nav-auth.js',
    './assets/scripts/shared/main.js',

    // Screening + the client-side risk calculator (runs fully offline)
    './assets/scripts/modules/risk-calculator.js',
    './assets/scripts/modules/factor-explanations.js',
    './assets/scripts/modules/medical-validator.js',
    './assets/scripts/modules/form-suggester.js',
    './assets/scripts/pages/screening.js',

    // Brand + key icons for the shell
    './assets/logo/swasthsathi-logo-horizontal.svg',
    './assets/logo/swasthsathi-icon.svg',
    './assets/icons/icon-192.png',
    './assets/icons/favicon-32.png',
    './assets/icons/apple-touch-icon.png',
];

// Same-origin static file extensions that are safe to cache-first at runtime.
const STATIC_EXT = /\.(?:css|js|mjs|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$/i;

// Trusted cross-origin hosts for static libraries (Bootstrap, icons) — static,
// cache-first is safe. NOTE: the EmailJS SDK host is intentionally NOT here; we
// never want a stale mailer SDK, so it stays network-only.
const STATIC_CDN_HOSTS = ['cdn.jsdelivr.net'];

// Any request whose URL matches these is DYNAMIC — network-only, never cached.
function isDynamic(url) {
    return (
        url.hostname.endsWith('supabase.co') ||   // DB, auth, storage, realtime
        url.pathname.includes('/functions/v1/') || // Edge Functions
        url.pathname.includes('/auth/') ||          // auth endpoints
        url.pathname.includes('/rest/v1/') ||       // PostgREST data
        url.hostname.includes('emailjs') ||         // mailer API (api.emailjs.com)
        url.pathname.includes('emailjs')            // mailer SDK (jsdelivr /npm/@emailjs/…)
    );
}

// ---------------------------------------------------------------- install

self.addEventListener('install', (event) => {
    // NOTE: we intentionally do NOT call skipWaiting() here. On an update the
    // new worker stays in "waiting" so the page can show its refresh prompt;
    // it only activates when the user clicks Refresh (SKIP_WAITING below).
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
    );
});

// The page's update toast posts this when the user chooses to refresh.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ---------------------------------------------------------------- activate

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((n) => n.startsWith('swasth-static-') && n !== STATIC_CACHE)
                    .map((n) => caches.delete(n)), // purge every old version
            ))
            .then(() => self.clients.claim()),
    );
});

// ---------------------------------------------------------------- fetch

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 1. Never touch non-GET (POST/PUT/PATCH/DELETE). Let it hit the network
    //    untouched — covers all Edge Function POSTs and auth writes.
    if (req.method !== 'GET') return;

    // 2. Dynamic/data requests → network-only, NO cache fallback ever.
    if (isDynamic(url)) {
        event.respondWith(
            fetch(req).catch(() => offlineDataResponse()),
        );
        return;
    }

    // 3. Navigation (page loads) → network-first so online users always get the
    //    freshest shell; fall back to the cached shell, then offline.html.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((resp) => {
                    // Cache the fresh shell copy for offline use.
                    const copy = resp.clone();
                    caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
                    return resp;
                })
                .catch(async () => {
                    const cached = await caches.match(req);
                    return cached || caches.match('./offline.html');
                }),
        );
        return;
    }

    // 4. Static assets (same-origin by extension, or trusted CDN) → cache-first.
    const sameOriginStatic = url.origin === self.location.origin && STATIC_EXT.test(url.pathname);
    const cdnStatic = STATIC_CDN_HOSTS.includes(url.hostname);
    if (sameOriginStatic || cdnStatic) {
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) return cached;
                return fetch(req).then((resp) => {
                    // Only cache successful, cacheable responses. Opaque cross-
                    // origin responses (status 0) are stored as-is for CDN libs.
                    if (resp && (resp.ok || resp.type === 'opaque')) {
                        const copy = resp.clone();
                        caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
                    }
                    return resp;
                }).catch(() => cached); // nothing to serve — let it fail
            }),
        );
        return;
    }

    // 5. Anything else → straight to network, no caching.
});

// Explicit offline signal for data requests. JSON so callers can detect it;
// 503 so it is never mistaken for real data.
function offlineDataResponse() {
    return new Response(
        JSON.stringify({ offline: true, error: 'You are offline. This feature needs an internet connection.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
}
