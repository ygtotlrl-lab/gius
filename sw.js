// sw.js — service worker של האפליקציה
importScripts('./app.config.js');
// מכאן נגזרת גרסת האפליקציה שבבאנר.
var CACHE_NAME = self.APP.id + '-v209';

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
  './core/auth.js',
  './core/ui.js',
  './core/chart.js',
  './app/constants.js',
  './app/state.js',
  './app/domain.js',
  './app/screens/donors.js',
  './app/screens/home.js',
  './app/screens/login.js',
  './app/screens/pledges.js',
  './app/screens/settings.js',
  './app/screens/tasks.js',
  './app/main.js',
  './manifest.json',
  './icons/icon-192.4ea3ca99.png',
  './icons/icon-512.7894d413.png',
];

// גרסה נעוצה במדויק ולא major צף — שחרור של הספק שובר את האפליקציה בלי שינוי קוד.
var CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js'
];

importScripts('./core/sw.js');
