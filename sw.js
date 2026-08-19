/* gius — service worker
 *
 * Constraints this file exists to satisfy (see CLAUDE.md):
 *   - CACHE_NAME is 'gius-vN'. Bump the number on every release.
 *   - CDN scripts are fetched with mode:'cors' so the cached response is a real
 *     readable response and never an opaque one.
 *   - Requests to *.supabase.co are skipped entirely — never cached, never
 *     intercepted.
 *   - Offline page is Hebrew and is served with an explicit
 *     Content-Type: text/html; charset=utf-8.
 *   - Every navigation falls back to the app shell, including when the network
 *     answered 404 — GitHub Pages returns 404 for any deep path under /gius/.
 *   - activate deletes only caches whose key starts with 'gius-'. This origin
 *     (ygtotlrl-lab.github.io) is shared with the organisation's other apps; a
 *     blanket caches.keys() sweep would wipe their caches too.
 *   - ONLY a response that came from a shell path may refresh index.html in the
 *     cache. Caching a deep-path response would poison the shell with a 404
 *     body and brick the app offline.
 */

const CACHE_NAME = 'gius-v24';
const CACHE_PREFIX = 'gius-';

const SCOPE_URL = new URL('./', self.location);
const SHELL_URL = new URL('./index.html', self.location).href;

// The only paths whose network response is allowed to become the cached shell.
const SHELL_PATHS = new Set([SCOPE_URL.pathname, SCOPE_URL.pathname + 'index.html']);

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-64.png',
];

// Exact, pinned versions. Never a floating major.
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js',
];

const OFFLINE_HTML = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>אין חיבור — גיוס</title>
<style>
  html,body{height:100%;margin:0}
  body{display:grid;place-items:center;padding:24px;box-sizing:border-box;
       background:#f4f6f9;color:#12202e;
       font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Hebrew",Arial,sans-serif}
  .box{max-width:420px;text-align:center;background:#fff;border:1px solid #e2e8f0;
       border-radius:16px;padding:32px 24px;box-shadow:0 8px 24px rgba(16,32,48,.06)}
  .mark{width:64px;height:64px;margin:0 auto 16px}
  h1{font-size:20px;margin:0 0 8px}
  p{margin:0 0 20px;color:#6b7c90;line-height:1.6;font-size:15px}
  button{font:inherit;font-weight:600;background:#0f766e;color:#fff;border:0;
         border-radius:10px;padding:12px 24px;cursor:pointer}
  @media (prefers-color-scheme:dark){
    body{background:#0d151d;color:#e8eef5}
    .box{background:#131e29;border-color:#24333f;box-shadow:none}
    p{color:#93a5b8}
  }
</style>
</head>
<body>
  <div class="box">
    <svg class="mark" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="34" fill="none" stroke="#0f766e" stroke-width="10"/>
      <circle cx="50" cy="50" r="11" fill="#0f766e"/>
    </svg>
    <h1>אין חיבור לאינטרנט</h1>
    <p>לא הצלחנו לטעון את האפליקציה. בדקו את החיבור ונסו שוב.</p>
    <button onclick="location.reload()">נסו שוב</button>
  </div>
</body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function cachedShell() {
  return (await caches.match(SHELL_URL)) || (await caches.match(SCOPE_URL.href));
}

// A hung CDN request would keep install's waitUntil pending forever, leaving
// the worker stuck in "installing" and the app permanently without offline
// support. Always bound it.
const CDN_TIMEOUT_MS = 10000;

async function fetchCors(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(new Request(url, { mode: 'cors', credentials: 'omit', signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------ CDN self-healing
// ⭐ Round 37 — the same self-healing the three sisters have had since
//    round 35 (and hanhala since round 9). Until now gius only pre-cached the
//    CDN list at install time: an asset that failed to download during install
//    — a hiccup, a captive portal, a slow phone — stayed missing **forever**,
//    because install never runs again for that CACHE_NAME. The app then broke
//    offline with no sign that anything was wrong.
// ⛔ mode:'cors' is required (round 35) — an opaque response has status 0 and
//    cache.put rejects it, so the asset would silently never be stored.
function ensureCdnCached() {
  return caches.open(CACHE_NAME).then((cache) => Promise.all(
    CDN_ASSETS.map((url) => cache.match(url, { ignoreVary: true })
      .then((hit) => {
        if (hit) return;
        return fetchCors(url, CDN_TIMEOUT_MS).then((res) => {
          if (res && res.ok && res.type !== 'opaque') {
            console.log('[SW] healed CDN asset:', url);
            return cache.put(url, res);
          }
        });
      })
      .catch(() => {}))
  )).catch(() => {});
}
ensureCdnCached(); // top-level = runs once every time the SW wakes up

// --------------------------------------------------------------------- install
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    // CDN assets are best-effort: a hiccup must not fail or stall the install.
    // Whatever is missing gets fetched and cached on first use instead.
    await Promise.all(CDN_ASSETS.map(async (url) => {
      try {
        const res = await fetchCors(url, CDN_TIMEOUT_MS);
        if (res.ok) await cache.put(url, res);
      } catch (_) { /* ignore */ }
    }));
  })());
  // No skipWaiting() here on purpose — the page shows the "גרסה חדשה זמינה"
  // banner and the user decides when to activate.
});

// -------------------------------------------------------------------- activate
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      // Scoped sweep only. Other apps on this origin keep their caches.
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) return caches.delete(key);
      return Promise.resolve(false);
    }));
    await self.clients.claim();
    // Heal anything the install pass failed to fetch.
    await ensureCdnCached();
  })());
});

// ----------------------------------------------------------------------- fetch
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (_) { return; }

  // Supabase traffic is never touched by the service worker.
  if (url.hostname.endsWith('supabase.co')) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request, url));
    return;
  }

  const isCdn = CDN_ASSETS.includes(url.href) || url.hostname === 'cdn.jsdelivr.net';
  if (isCdn) {
    event.respondWith(cacheFirst(request, { cors: true }));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith(SCOPE_URL.pathname)) {
    event.respondWith(cacheFirst(request, { cors: false }));
  }
});

async function handleNavigate(request, url) {
  try {
    const net = await fetch(request);

    // Only a response that actually came from the shell path may refresh the
    // cached shell. GitHub Pages answers deep paths with a 404 page; caching
    // that under index.html would poison the shell.
    if (net.ok && SHELL_PATHS.has(url.pathname)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(SHELL_URL, net.clone());
      return net;
    }
    if (net.ok) return net;

    // 404 / 5xx on a deep path -> hand back the app shell so client routing works.
    return (await cachedShell()) || net;
  } catch (_) {
    return (await cachedShell()) || offlineResponse();
  }
}

async function cacheFirst(request, { cors }) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) {
    // Refresh in the background; failures are irrelevant, we already answered.
    revalidate(cache, request, cors);
    return hit;
  }
  try {
    const res = cors ? await fetchCors(request.url, CDN_TIMEOUT_MS) : await fetch(request);
    if (res.ok && res.type !== 'opaque') cache.put(request, res.clone());
    return res;
  } catch (_) {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

function revalidate(cache, request, cors) {
  (cors ? fetchCors(request.url, CDN_TIMEOUT_MS) : fetch(request))
    .then((res) => { if (res.ok && res.type !== 'opaque') cache.put(request, res.clone()); })
    .catch(() => { /* offline — the cached copy stands */ });
}

// --------------------------------------------------------------------- message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
