// sw.js — service worker של האפליקציה
importScripts('./app.config.js');
// מכאן נגזרת גרסת האפליקציה שבבאנר.
var CACHE_NAME = self.APP.id + '-v334';

var CORE = [
  './',
  './index.html',
  './app.config.js',
  './core/boot.js',
  './core/sw.js',
  './core/ui.css',
  './core/chart.css',
  './app/style.css',
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
  './app/screens/tasks.js',
  './app/snap.js',
  './app/main.js',
  './manifest.json',
  './icons/icon-192.00adf1bf.png',
  './icons/icon-512.31ad20f4.png',
  './icons/icon-maskable-512.eac1c1f7.png',
];

// גרסה נעוצה במדויק ולא major צף — שחרור של הספק שובר את האפליקציה בלי שינוי קוד.
var CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

importScripts('./core/sw.js');
