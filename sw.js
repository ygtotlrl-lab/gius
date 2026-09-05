/*  gius — service worker.
 *  ⚠️ מוסכמות משותפות (סבב 8): שם קבוע הגרסה הוא CACHE_NAME, מערך הליבה
 *  נקרא CORE ורשימת ה-CDN נקראת CDN_ASSETS, וסדר המאזינים הוא
 *  install → activate → fetch → message. ⛔ אין לשנות שם/סדר בפרויקט אחד.
 *  ⚠️ מסבב 42ג כל הלוגיקה יושבת במודול המשותף שלמטה — זהה בית-לבית
 *  בארבע האפליקציות. ⛔ מה שנבדל יושב ב-SW_CFG בלבד.
 */
const CACHE_NAME = 'gius-v72';

// קבצים מקומיים.
var CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ⚠️ גרסאות נעוצות במדויק — ⛔ לעולם לא major צף (כלל קריטי 2, סבב 6) —
// שחרור מצד הספק היה שובר את האפליקציה בלי שום שינוי קוד כאן.
var CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js'
];

var SW_OFFLINE_HTML = `<!doctype html>
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

/*  ⚠️ SW_CFG — הדבר היחיד שנבדל בין ארבע האפליקציות (סבב 42ג). כל ידית
 *  כאן היא התנהגות **שנמדדה** ברתמת קו-הבסיס, ⛔ ולא ברירת מחדל שנפלה
 *  מאליה: שינוי שלה מפיל את `tools/test_sw.mjs`, וזה הרצוי.
 *  ⚠️ ארבע הידיות שנבדלות כאן — `scoped` · `navFallback:'shell'` ·
 *  `subStrategy:'cache-first'` · `subMiss:'504'` · `offlineStatus:200` —
 *  הן ההתנהגות שנמדדה בסבב 40 ונשמרה בסבב 42ג. ⛔ אין ליישר אותן.
 *  ⚠️ ו-`skipWaiting: false` נעדר **בכוונה**: הדף מציג באנר «🔄 גרסה
 *  חדשה זמינה» והמשתמש מחליט מתי לעדכן. ⛔ אין ליישר בלי החלטת מנהל. */
var SW_CFG = {
  prefix: 'gius-',
  skipHosts: [],
  cdnHosts: ['cdn.jsdelivr.net'],
  scoped: true,
  navFallback: 'shell',
  navIgnoreSearch: false,
  subStrategy: 'cache-first',
  subMiss: '504',
  offlineStatus: 200,
  skipWaiting: false,
  cdnTimeoutMs: 10000
};

/* ═══ מודול ה-service worker — מודול משותף (סבב 42ג)
   ⛔ שינוי כאן (סבב 65) — ארבע האפליקציות **וארבעת עותקי השער**, באותו
      סבב: אחרת החתימה נשברת בריפו אחד, והשער מאשר את הסטייה בשלושה.
   ══════════════════════════════════════════════════════════════════════════ */

var SW_SCOPE = new URL('./', self.location);
var SW_ROOT = SW_SCOPE.href;
var SW_SHELL = new URL('./index.html', self.location).href;

/*  ⛔ שני הנתיבים היחידים שתשובתם רשאית להפוך לקליפה שבמטמון (סבב 42ג) —
 *  ר' הנימוק בכותרת המודול. */
var SW_SHELL_PATHS = [SW_SCOPE.pathname, SW_SCOPE.pathname + 'index.html'];

/*  ⚠️ שתי מפות חיפוש נפרדות, ⛔ ואין לאחד אותן (סבב 42ג): ignoreSearch
 *  מתעלם מה-query, וב-PostgREST כל הפילטרים יושבים דווקא שם. חיפוש כללי
 *  איתו גרם בהנהלה לכך שבקשת כניסה של משתמש אחד התאימה לתשובה שנשמרה
 *  עבור אחר — כניסה בזהות זרה. ניווט בלבד רשאי להשתמש ב-NAV_OPTS. */
var SW_NAV_OPTS = { ignoreVary: true, ignoreSearch: true };
var SW_SUB_OPTS = { ignoreVary: true };

function swSkip(url) {
  if (url.indexOf('http') !== 0) return true;
  if (url.indexOf('.supabase.co') !== -1) return true;
  for (var i = 0; i < SW_CFG.skipHosts.length; i++) {
    if (url.indexOf(SW_CFG.skipHosts[i]) !== -1) return true;
  }
  return false;
}

function swIsCdn(u) {
  return CDN_ASSETS.indexOf(u.href) !== -1 || SW_CFG.cdnHosts.indexOf(u.hostname) !== -1;
}

function swInScope(u) {
  return u.origin === SW_SCOPE.origin && u.pathname.indexOf(SW_SCOPE.pathname) === 0;
}

function swIsShellPath(u) {
  return SW_SHELL_PATHS.indexOf(u.pathname) !== -1;
}

/*  דף אופליין — HTML אמיתי עם Content-Type מפורש, ⛔ לא מחרוזת 'Offline'
 *  שנראית כמסך שחור עם טקסט זעיר בפינה (סבב 42ג). */
function swOfflinePage() {
  return new Response(SW_OFFLINE_HTML, {
    status: SW_CFG.offlineStatus,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/*  תת-משאב שאין לו עותק ואין רשת. ⛔ לעולם לא HTML (סבב 42ג) — ר' כותרת
 *  המודול. `Response.error()` הוא שגיאת הרשת האמיתית; 504 ריק הוא הווריאנט
 *  שנמדד ב-gius ונשמר כידית. */
function swSubMiss() {
  if (SW_CFG.subMiss === '504') return new Response('', { status: 504, statusText: 'Offline' });
  try { return Response.error(); }
  catch (e) { return new Response('', { status: 504, statusText: 'Offline' }); }
}

/*  ⛔ רק תשובה שאומתה נשמרת (סבב 42ג) — ר' כותרת המודול. */
function swStore(key, res) {
  if (!res || !res.ok || res.status !== 200 || res.type === 'opaque') return;
  var clone = res.clone();
  caches.open(CACHE_NAME).then(function (cache) {
    return cache.put(key, clone);
  }).catch(function () {});
}

/*  הקליפה שבמטמון — index.html, ובהיעדרו שורש ה-scope. */
function swShell() {
  return caches.match(SW_SHELL, SW_NAV_OPTS).then(function (hit) {
    return hit || caches.match(SW_ROOT, SW_NAV_OPTS);
  });
}

/*  ⚠️ בקשת CDN חייבת mode:'cors' (סבב 35) — תגובת no-cors היא opaque עם
 *  status 0, ו-cache.put דוחה אותה; כך הנכסים מעולם לא נשמרו.
 *  ⚠️ והפסק-זמן אינו קישוט (סבב 42ג): בקשת CDN שנתקעת משאירה את
 *  waitUntil של install תלוי לנצח, והעובד נשאר «installing» בלי אופליין. */
function swFetchCors(url) {
  var opts = { mode: 'cors', credentials: 'omit' };
  if (typeof AbortController !== 'function' || !SW_CFG.cdnTimeoutMs) {
    return fetch(new Request(url, opts));
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, SW_CFG.cdnTimeoutMs);
  opts.signal = ctrl.signal;
  return fetch(new Request(url, opts)).then(function (res) {
    clearTimeout(timer);
    return res;
  }, function (err) {
    clearTimeout(timer);
    throw err;
  });
}

function swFetchAsset(request, u) {
  return swIsCdn(u) ? swFetchCors(request.url) : fetch(request);
}

function swCachePut(cache, url, opts) {
  return fetch(url, opts).then(function (res) {
    if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : '?'));
    if (res.type === 'opaque') throw new Error('opaque response');
    return cache.put(url, res);
  });
}

/*  ריפוי עצמי של מטמון ה-CDN (סבב 9 בהנהלה, סבב 35 בשלוש) — סקריפט CDN
 *  שחסר במטמון לא היה מושלם לעולם: install אינו רץ שוב לאותו CACHE_NAME,
 *  ובזמן-ריצה הדף מבקש אותו כ-no-cors ⇒ opaque ⇒ לא נשמר. רץ ב-activate
 *  וגם פעם אחת בכל עליית SW, משלים רק את מה שחסר, וכשל בו שקט. */
function ensureCdnCached() {
  return caches.open(CACHE_NAME).then(function (cache) {
    return Promise.all(CDN_ASSETS.map(function (url) {
      return cache.match(url, SW_SUB_OPTS).then(function (hit) {
        if (hit) return;
        return swFetchCors(url).then(function (res) {
          if (res && res.ok && res.type !== 'opaque') return cache.put(url, res);
        });
      }).catch(function () {});
    }));
  }).catch(function () {});
}
ensureCdnCached(); // קוד עליון = רץ פעם אחת בכל עליית SW

/*  ניווט — רשת קודם. תשובה תקינה מנתיב הקליפה מרעננת את הקליפה; תשובה
 *  שאינה תקינה (404 של נתיב עמוק) מקבלת את הקליפה שבמטמון. */
function swNavigate(request, u) {
  return fetch(request).then(function (net) {
    if (net && net.ok) {
      if (swIsShellPath(u)) swStore(SW_SHELL, net);
      return net;
    }
    return swShell().then(function (shell) { return shell || net; });
  }).catch(function () {
    return swNavOffline(request);
  });
}

/*  ⚠️ `navFallback` — הידית שנמדדה: 'shell' פונה ישר לקליפה, 'request'
 *  מחפש קודם את הבקשה עצמה (ועם `navIgnoreSearch` גם '?apk=1' מוצא את
 *  './'). ⛔ שתיהן מסתיימות בדף האופליין ולעולם לא ב-undefined
 *  (סבב 42ג) — respondWith על Promise<undefined> זורק TypeError, כלומר
 *  כל בקשה שנכשלת ברשת ואינה במטמון נכשלת פעמיים. */
function swNavOffline(request) {
  var first = SW_CFG.navFallback === 'shell'
    ? swShell()
    : caches.match(request, SW_CFG.navIgnoreSearch ? SW_NAV_OPTS : SW_SUB_OPTS)
        .then(function (hit) { return hit || swShell(); });
  return first.then(function (hit) { return hit || swOfflinePage(); });
}

function swNetworkFirst(request) {
  return fetch(request).then(function (res) {
    swStore(request, res);
    return res;
  }).catch(function () {
    return caches.match(request, SW_SUB_OPTS).then(function (hit) {
      return hit || swSubMiss();
    });
  });
}

/*  ⚠️ מטמון-קודם + רענון ברקע — ידית שנמדדה ב-gius (סבב 40) ונשמרה
 *  (סבב 42ג). ⛔ אין להפוך אותה ל'network-first' «לשם אחידות»: זו
 *  התנהגות שנמדדה ברתמת קו-הבסיס, והיפוכה משנה מה המשתמש רואה. */
function swCacheFirst(request, u) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request, SW_SUB_OPTS).then(function (hit) {
      if (hit) { swRevalidate(request, u); return hit; }
      return swFetchAsset(request, u).then(function (res) {
        swStore(request, res);
        return res;
      }).catch(function () { return swSubMiss(); });
    });
  });
}

function swRevalidate(request, u) {
  swFetchAsset(request, u).then(function (res) {
    swStore(request, res);
  }).catch(function () {});
}

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    /*  ⚠️ כשל CDN בודד לא מפיל את ההתקנה — ensureCdnCached משלים אותו
     *  ב-activate ובעליית ה-SW הבאה. */
    var jobs = CORE.map(function (url) {
      return swCachePut(cache, url, { cache: 'reload' })
        .catch(function () { return swCachePut(cache, url, {}); })
        .catch(function () {});
    }).concat(CDN_ASSETS.map(function (url) {
      return swFetchCors(url).then(function (res) {
        if (res && res.ok && res.type !== 'opaque') return cache.put(url, res);
      }).catch(function () {});
    }));
    return Promise.all(jobs);
  }).catch(function () {}));
  /*  ⚠️ `skipWaiting` הוא ידית שנמדדה: ב-gius הוא נעדר **בכוונה** — הדף
   *  מציג באנר «🔄 גרסה חדשה זמינה» והמשתמש מחליט מתי לעדכן. ⛔ אין
   *  ליישר בלי החלטת מנהל (סבב 42ג) — זה משנה מתי גרסה חדשה נכנסת לתוקף. */
  if (SW_CFG.skipWaiting) self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(SW_SHELL, SW_NAV_OPTS);
    }).then(function (hit) {
      /*  ⛔ אין למחוק מטמון ישן לפני שאומת שהקליפה נכנסה לחדש (סבב 42ג) —
       *  ר' כותרת המודול. */
      if (!hit) return;
      return caches.keys().then(function (names) {
        return Promise.all(names.filter(function (name) {
          return name.indexOf(SW_CFG.prefix) === 0 && name !== CACHE_NAME;
        }).map(function (name) {
          return caches.delete(name);
        }));
      });
    }).catch(function () {})
      .then(function () { return ensureCdnCached(); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  if (swSkip(request.url)) return;

  var u;
  try { u = new URL(request.url); } catch (e) { return; }

  if (request.mode === 'navigate') {
    event.respondWith(swNavigate(request, u));
    return;
  }
  /*  ⚠️ `scoped` — ידית שנמדדה ב-gius: היא מטפלת אך ורק בנכסי ה-scope
   *  ובנכסי ה-CDN, וכל השאר עובר לדפדפן כפי שהוא. */
  if (SW_CFG.scoped && !swIsCdn(u) && !swInScope(u)) return;

  event.respondWith(SW_CFG.subStrategy === 'cache-first'
    ? swCacheFirst(request, u)
    : swNetworkFirst(request));
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
/* ═══════════════ סוף מודול ה-service worker */
