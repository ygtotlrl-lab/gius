// sw.js — service worker של האפליקציה
importScripts('./app.config.js');
// מכאן נגזרת גרסת האפליקציה שבבאנר.
var CACHE_NAME = self.APP.id + '-v268';

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
  './core/sync.js',
  './core/storage.js',
  './core/mirror.js',
  './core/backup.js',
  './core/boot-run.js',
  './core/ui.js',
  './core/chart.js',
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
  './app/main.js',
  './manifest.json',
  './icons/icon-192.e44ab5b9.png',
  './icons/icon-512.0ed0bb3c.png',
];

// גרסה נעוצה במדויק ולא major צף — שחרור של הספק שובר את האפליקציה בלי שינוי קוד.
var CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js'
];

importScripts('./core/sw.js');
