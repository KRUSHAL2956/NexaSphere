/**
 * NexaSphere Service Worker
 * ==========================
 * Production-grade Workbox service worker with:
 *  - Precaching of all build assets (manifest injected by vite-plugin-pwa)
 *  - Advanced runtime caching strategies per resource type
 *  - Offline fallback to /offline.html
 *  - Background sync relay to app clients
 *  - Push notification handling
 */

/* eslint-disable no-undef */
// Service Worker global scope — self, clients, caches are valid SW globals

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import {
  StaleWhileRevalidate,
  CacheFirst,
  NetworkFirst,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// ── Core Workbox setup ────────────────────────────────────────────────────────

// Skip waiting allows new SW to activate immediately
self.skipWaiting();

// Claim all clients immediately upon activation
clientsClaim();

// Clean up old precache assets from previous SW versions
cleanupOutdatedCaches();

// ── Precaching ────────────────────────────────────────────────────────────────
// The __WB_MANIFEST placeholder is replaced by Workbox with the actual
// precache manifest (list of hashed build assets) during the build.
precacheAndRoute(self.__WB_MANIFEST);

// ── SPA Navigation Fallback ───────────────────────────────────────────────────
// For all navigation requests not matched by precache, serve index.html.
// This enables client-side routing to work offline.
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [
    /^\/api\//,       // API routes — never serve index.html
    /^\/socket\.io/,  // WebSocket
    /^\/_/,           // Internal paths
    /\/offline\.html$/, // The offline page itself
  ],
});
registerRoute(navigationRoute);

// ── Runtime Caching Strategies ────────────────────────────────────────────────

// 1. Google Fonts — stylesheets (StaleWhileRevalidate)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// 2. Google Fonts — webfonts (CacheFirst, very long-lived)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// 3. Images (CacheFirst — static content, rarely changes)
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
  new CacheFirst({
    cacheName: 'nexasphere-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// 4. JS & CSS chunks (StaleWhileRevalidate — fast load, background refresh)
registerRoute(
  /\.(?:js|css)$/i,
  new StaleWhileRevalidate({
    cacheName: 'nexasphere-static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  })
);

// 5. API GET requests — StaleWhileRevalidate
// Auth/token endpoints are explicitly EXCLUDED (never cached)
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    request.method === 'GET' &&
    !url.pathname.includes('/auth/') &&
    !url.pathname.includes('/token') &&
    !url.pathname.includes('/login') &&
    !url.pathname.includes('/logout'),
  new StaleWhileRevalidate({
    cacheName: 'nexasphere-api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 5, // 5 minutes
      }),
    ],
  })
);

// 6. Dashboard, analytics, notifications — slightly longer SWR window
registerRoute(
  ({ url }) => /\/api\/(dashboard|analytics|notifications|profile)/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'nexasphere-dashboard-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 10, // 10 minutes
      }),
    ],
  })
);

// 7. Auth / session — NetworkFirst with short cache, 3s timeout
registerRoute(
  ({ url }) => /\/api\/(auth|session|user\/me)/i.test(url.pathname),
  new NetworkFirst({
    cacheName: 'nexasphere-auth-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60, // 1 minute max
      }),
    ],
  })
);

// ── Background Sync ───────────────────────────────────────────────────────────

/**
 * SW Background Sync event — triggered by browser when connectivity returns.
 * Relays to all active app clients so the app-side queue manager can process it.
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'ns-bg-sync') {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: false })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'NS_TRIGGER_SYNC' });
          });
          console.log(`[SW] Background sync triggered — notified ${clients.length} client(s).`);
        })
    );
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'NexaSphere',
    body: 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'nexasphere-notification',
    requireInteraction: false,
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        title: data.notification?.title || notificationData.title,
        body: data.notification?.body || notificationData.body,
        icon: data.notification?.icon || notificationData.icon,
        data: data.data || {},
      };
    } catch {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
    })
  );
});

// ── Notification Interactions ─────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', () => {
  // Analytics hook point — no-op for now
});

// ── Message handler ───────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  // Allows client to force immediate SW activation
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
