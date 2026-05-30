/**
 * NexaSphere Custom Service Worker Additions
 * ============================================
 * This file is NOT the main service worker — Workbox (via vite-plugin-pwa)
 * auto-generates the main sw. This file handles:
 *
 *  - Push notifications
 *  - Notification click / close handling
 *  - Background sync tag 'ns-bg-sync' — triggers app-side sync queue processing
 *
 * NOTE: The main Workbox SW handles all caching strategies (configured in vite.config.js).
 * The old hand-rolled cache logic has been replaced by Workbox's production-grade caching.
 */

// ── Background Sync ───────────────────────────────────────────────────────────

/**
 * Background Sync event — triggered when connectivity is restored.
 * Sends a message to all controlled clients to trigger the app-side sync queue.
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'ns-bg-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: false }).then((clients) => {
        if (clients.length === 0) {
          console.log('[SW] No active clients to notify for sync.');
          return;
        }
        clients.forEach((client) => {
          client.postMessage({ type: 'NS_TRIGGER_SYNC' });
        });
        console.log(`[SW] Background sync triggered — notified ${clients.length} client(s).`);
      })
    );
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────

/**
 * Handle push notifications
 */
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

/**
 * Handle notification click — navigate to the relevant page
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open on that URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

/**
 * Handle notification close
 */
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// ── Message handler ───────────────────────────────────────────────────────────

/**
 * Respond to messages from the app
 */
self.addEventListener('message', (event) => {
  // Skip waiting — allows new SW to activate immediately when client requests it
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
