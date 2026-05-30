/**
 * IndexedDB Storage Utility for NexaSphere
 * ==========================================
 * A lightweight wrapper around idb-keyval with:
 *  - Named stores for logical data separation
 *  - TTL (time-to-live) envelope for expiring cached data
 *  - Graceful degradation when IDB is unavailable (private browsing, quota exceeded)
 *
 * Stores:
 *  - ns-cache       → API response cache (dashboard, notifications, etc.)
 *  - ns-sync-queue  → Offline mutation queue
 *  - ns-prefs       → User preferences & app settings
 */

import { createStore, get, set, del, keys, clear, getMany } from 'idb-keyval';

// ── Store definitions ─────────────────────────────────────────────────────────

/** API response / data cache */
const cacheStore = createStore('nexasphere-db', 'ns-cache');

/** Offline request queue */
const syncQueueStore = createStore('nexasphere-db', 'ns-sync-queue');

/** User preferences */
const prefsStore = createStore('nexasphere-db', 'ns-prefs');

// ── IDB availability check ────────────────────────────────────────────────────

let _idbAvailable = null;

/**
 * Checks whether IndexedDB is available in this context.
 * Returns false in private browsing when storage is blocked, or on IDB errors.
 * @returns {Promise<boolean>}
 */
export async function isIDBAvailable() {
  if (_idbAvailable !== null) return _idbAvailable;
  try {
    await set('__idb_test__', 1, cacheStore);
    await del('__idb_test__', cacheStore);
    _idbAvailable = true;
  } catch {
    _idbAvailable = false;
    console.warn('[NexaSphere IDB] IndexedDB unavailable — falling back to in-memory.');
  }
  return _idbAvailable;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

const memoryFallback = new Map();

// ── TTL envelope helpers ──────────────────────────────────────────────────────

/**
 * Wraps a value with a TTL expiry timestamp.
 * @param {*} value
 * @param {number} ttlSeconds — 0 means no expiry
 * @returns {{ data: *, expiresAt: number|null }}
 */
function wrapTTL(value, ttlSeconds = 0) {
  return {
    data: value,
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    cachedAt: Date.now(),
  };
}

/**
 * Unwraps a TTL envelope. Returns null if expired.
 * @param {{ data: *, expiresAt: number|null }|null} envelope
 * @returns {*|null}
 */
function unwrapTTL(envelope) {
  if (!envelope) return null;
  if (envelope.expiresAt !== null && Date.now() > envelope.expiresAt) return null;
  return envelope.data;
}

// ── Cache Store API ───────────────────────────────────────────────────────────

/**
 * Saves a value to the cache store with optional TTL.
 * @param {string} key
 * @param {*} value
 * @param {number} [ttlSeconds=0] — 0 = no expiry
 */
export async function cacheSet(key, value, ttlSeconds = 0) {
  const envelope = wrapTTL(value, ttlSeconds);
  try {
    if (await isIDBAvailable()) {
      await set(key, envelope, cacheStore);
    } else {
      memoryFallback.set(`cache:${key}`, envelope);
    }
  } catch (err) {
    console.warn(`[NexaSphere IDB] cacheSet failed for "${key}":`, err);
    memoryFallback.set(`cache:${key}`, envelope);
  }
}

/**
 * Retrieves a value from the cache store. Returns null if expired or missing.
 * @param {string} key
 * @returns {Promise<*|null>}
 */
export async function cacheGet(key) {
  try {
    if (await isIDBAvailable()) {
      const envelope = await get(key, cacheStore);
      return unwrapTTL(envelope);
    } else {
      return unwrapTTL(memoryFallback.get(`cache:${key}`) ?? null);
    }
  } catch (err) {
    console.warn(`[NexaSphere IDB] cacheGet failed for "${key}":`, err);
    return unwrapTTL(memoryFallback.get(`cache:${key}`) ?? null);
  }
}

/**
 * Deletes a key from the cache store.
 * @param {string} key
 */
export async function cacheDel(key) {
  try {
    if (await isIDBAvailable()) {
      await del(key, cacheStore);
    }
    memoryFallback.delete(`cache:${key}`);
  } catch (err) {
    console.warn(`[NexaSphere IDB] cacheDel failed for "${key}":`, err);
  }
}

/**
 * Lists all keys in the cache store.
 * @returns {Promise<string[]>}
 */
export async function cacheKeys() {
  try {
    if (await isIDBAvailable()) {
      return await keys(cacheStore);
    }
  } catch (err) {
    console.warn('[NexaSphere IDB] cacheKeys failed:', err);
  }
  return [];
}

/**
 * Clears ALL entries from the cache store.
 */
export async function cacheClear() {
  try {
    if (await isIDBAvailable()) {
      await clear(cacheStore);
    }
    for (const k of memoryFallback.keys()) {
      if (k.startsWith('cache:')) memoryFallback.delete(k);
    }
  } catch (err) {
    console.warn('[NexaSphere IDB] cacheClear failed:', err);
  }
}

// ── Sync Queue Store API ──────────────────────────────────────────────────────

/**
 * Saves a request entry to the sync queue store.
 * @param {string} id — unique request ID
 * @param {object} entry
 */
export async function queueSet(id, entry) {
  try {
    if (await isIDBAvailable()) {
      await set(id, entry, syncQueueStore);
    } else {
      memoryFallback.set(`queue:${id}`, entry);
    }
  } catch (err) {
    console.warn(`[NexaSphere IDB] queueSet failed for "${id}":`, err);
    memoryFallback.set(`queue:${id}`, entry);
  }
}

/**
 * Retrieves a specific entry from the sync queue.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function queueGet(id) {
  try {
    if (await isIDBAvailable()) {
      return await get(id, syncQueueStore);
    }
  } catch (err) {
    console.warn(`[NexaSphere IDB] queueGet failed for "${id}":`, err);
  }
  return memoryFallback.get(`queue:${id}`) ?? null;
}

/**
 * Returns ALL entries in the sync queue, sorted by timestamp (oldest first).
 * @returns {Promise<object[]>}
 */
export async function queueGetAll() {
  try {
    if (await isIDBAvailable()) {
      const allKeys = await keys(syncQueueStore);
      if (allKeys.length === 0) return [];
      const allValues = await getMany(allKeys, syncQueueStore);
      return allValues.filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
    }
  } catch (err) {
    console.warn('[NexaSphere IDB] queueGetAll failed:', err);
  }
  return Array.from(memoryFallback.entries())
    .filter(([k]) => k.startsWith('queue:'))
    .map(([, v]) => v)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Removes a specific entry from the sync queue.
 * @param {string} id
 */
export async function queueDel(id) {
  try {
    if (await isIDBAvailable()) {
      await del(id, syncQueueStore);
    }
    memoryFallback.delete(`queue:${id}`);
  } catch (err) {
    console.warn(`[NexaSphere IDB] queueDel failed for "${id}":`, err);
  }
}

/**
 * Clears ALL entries from the sync queue.
 */
export async function queueClear() {
  try {
    if (await isIDBAvailable()) {
      await clear(syncQueueStore);
    }
    for (const k of memoryFallback.keys()) {
      if (k.startsWith('queue:')) memoryFallback.delete(k);
    }
  } catch (err) {
    console.warn('[NexaSphere IDB] queueClear failed:', err);
  }
}

// ── Prefs Store API ───────────────────────────────────────────────────────────

/**
 * Gets a user preference.
 * @param {string} key
 * @param {*} [defaultValue=null]
 * @returns {Promise<*>}
 */
export async function prefsGet(key, defaultValue = null) {
  try {
    if (await isIDBAvailable()) {
      const val = await get(key, prefsStore);
      return val !== undefined ? val : defaultValue;
    }
  } catch (err) {
    console.warn(`[NexaSphere IDB] prefsGet failed for "${key}":`, err);
  }
  return memoryFallback.get(`prefs:${key}`) ?? defaultValue;
}

/**
 * Sets a user preference.
 * @param {string} key
 * @param {*} value
 */
export async function prefsSet(key, value) {
  try {
    if (await isIDBAvailable()) {
      await set(key, value, prefsStore);
    } else {
      memoryFallback.set(`prefs:${key}`, value);
    }
  } catch (err) {
    console.warn(`[NexaSphere IDB] prefsSet failed for "${key}":`, err);
    memoryFallback.set(`prefs:${key}`, value);
  }
}

/**
 * Deletes a user preference.
 * @param {string} key
 */
export async function prefsDel(key) {
  try {
    if (await isIDBAvailable()) {
      await del(key, prefsStore);
    }
    memoryFallback.delete(`prefs:${key}`);
  } catch (err) {
    console.warn(`[NexaSphere IDB] prefsDel failed for "${key}":`, err);
  }
}

// ── Well-known cache keys ─────────────────────────────────────────────────────

export const CACHE_KEYS = {
  DASHBOARD: 'dashboard-data',
  ANALYTICS: 'analytics-data',
  NOTIFICATIONS: 'notifications',
  USER_PROFILE: 'user-profile',
  RECENTLY_VIEWED: 'recently-viewed',
  EVENTS: 'events-list',
};

export const PREF_KEYS = {
  THEME: 'theme',
  NOTIFICATIONS_SEEN: 'notifications-seen',
  INSTALL_DISMISSED: 'install-prompt-dismissed',
  INSTALL_COUNT: 'app-open-count',
};

// Default TTL values (seconds)
export const TTL = {
  DASHBOARD: 5 * 60, // 5 minutes
  ANALYTICS: 10 * 60, // 10 minutes
  NOTIFICATIONS: 2 * 60, // 2 minutes
  USER_PROFILE: 15 * 60, // 15 minutes
  EVENTS: 5 * 60, // 5 minutes
  RECENTLY_VIEWED: 60 * 60 * 24, // 24 hours
};
