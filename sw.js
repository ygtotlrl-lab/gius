// sw.js — service worker של האפליקציה
importScripts('./app.config.js');
// מכאן נגזרת גרסת האפליקציה שבבאנר.
var CACHE_NAME = self.APP.id + '-v440';

var CORE = [
  './',
  './index.html',
  './app.config.js',
  './core/boot.js',
  './core/sw.js',
  './core/ui.css',
  './core/fonts/heebo-hebrew.woff2',
  './core/fonts/heebo-latin.woff2',
  './core/fonts/frank-ruhl-libre-hebrew.woff2',
  './core/fonts/frank-ruhl-libre-latin.woff2',
  './core/datepair.js',
  './core/hebrew.js',
  './core/gauth.js',
  './core/push.js',
  './core/chart.css',
  './app/style.css',
  './app/style.screens.css',
  './core/util.js',
  './core/icons.js',
  './core/sync.js',
  './core/storage.js',
  './core/mirror.js',
  './core/backup.js',
  './core/boot-run.js',
  './core/ui.js',
  './core/chart.js',
  './core/share.js',
  './app/constants.js',
  './app/state.js',
  './app/domain.js',
  './app/icons.js',
  './app/screens/budget.js',
  './app/screens/cards.js',
  './app/screens/dash.js',
  './app/screens/loans.js',
  './app/screens/notes.js',
  './app/screens/plan.js',
  './app/screens/settings.js',
  './app/screens/shtarot.js',
  './app/screens/tasks.js',
  './core/snap.js',
  './app/main.js',
  './manifest.json',
  './icons/icon-192.edb680d1.png',
  './icons/icon-512.7f9e73d9.png',
  './icons/icon-maskable-512.cd017e05.png',
];

// גרסה נעוצה במדויק ולא major צף — שחרור של הספק שובר את האפליקציה בלי שינוי קוד.
var CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

importScripts('./core/sw.js');
