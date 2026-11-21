/* eslint-env serviceworker */
// ScratchPro: service worker for the play page (play.html) only. Registered with scope "play", so
// the editor and home page are not affected. Lets an installed game start and run offline.
//
// - The page itself: network first, falling back to the cached copy when offline.
// - Hashed script files (js/...): cache first, since their names change when their content does.
// - Other files on this site: served from the cache straight away and refreshed in the background.
// - Other sites (eg. Scratch project downloads) are not cached.

// Change the version when a cached file that is not content-hashed (eg. extensions/sptouch.js)
// changes in a way the game depends on, so installed games do not run with an old copy.
const CACHE = 'sp-play-v2';
const PRECACHE = [
    'play.html',
    'play.webmanifest',
    'images/192.png',
    'images/512.png',
    'images/apple-touch-icon.png',
    'extensions/sptouch.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key.startsWith('sp-play-') && key !== CACHE).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

const isHashedScript = url => /\/js\/.+\.[0-9a-f]{8,}\.js$/.test(url.pathname);

const stripHash = url => url.split('#')[0];

// The page sends the files it loaded, so the first visit is cached as well. Old script files that
// the current page no longer uses are removed, so the cache does not grow with every deploy.
self.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.type !== 'cache-urls' || !Array.isArray(data.urls)) return;
    const urls = data.urls
        .map(stripHash)
        .filter(url => new URL(url).origin === self.location.origin);
    const wanted = new Set(urls);
    event.waitUntil(caches.open(CACHE).then(cache => Promise.all(
        urls.map(url => cache.match(url).then(hit => hit || cache.add(url).catch(() => {})))
    )
        .then(() => cache.keys())
        .then(requests => Promise.all(requests
            .filter(request => isHashedScript(new URL(request.url)) && !wanted.has(request.url))
            .map(request => cache.delete(request))
        ))));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE).then(cache => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request, {ignoreSearch: true})
                    .then(hit => hit || caches.match('play.html')))
        );
        return;
    }

    event.respondWith(caches.open(CACHE).then(cache => cache.match(request).then(hit => {
        const fromNetwork = fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        });
        if (hit) {
            if (!isHashedScript(url)) {
                // refresh in the background; ignore failures when offline
                event.waitUntil(fromNetwork.catch(() => {}));
            }
            return hit;
        }
        return fromNetwork;
    })));
});
