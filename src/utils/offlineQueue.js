/**
 * Offline Request Queue for NexaSphere
 * ======================================
 * Intercepts mutating HTTP requests (POST/PUT/PATCH/DELETE) when the user is
 * offline, serializes them into IndexedDB, and exposes them for replay when
 * connection is restored.
 *
 * Queue entry schema:
 * {
 *   id:         string    — unique identifier (crypto.randomUUID or timestamp-based)
 *   url:        string    — request URL
 *   method:     string    — HTTP method (POST | PUT | PATCH | DELETE)
 *   body:       string    — JSON-serialized request body
 *   headers:    object    — request headers (auth headers stripped before storage)
 *   timestamp:  number    — Date.now() when queued
 *   retryCount: number    — how many times this has been retried
 *   hash:       string    — deduplication hash (url+method+body)
 * }
 */

import { queueSet, queueGet, queueGetAll, queueDel, queueClear } from './indexedDB.js';

// ── ID generation ─────────────────────────────────────────────────────────────

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Deduplication hash ────────────────────────────────────────────────────────

/**
 * Creates a lightweight hash for deduplication.
 * Same URL + method + body within DEDUP_WINDOW_MS = duplicate, skip.
 * @param {string} url
 * @param {string} method
 * @param {string} body
 * @returns {string}
 */
function makeHash(url, method, body = '') {
  return `${method}::${url}::${body.slice(0, 500)}`;
}

/** Time window for deduplication (30 seconds) */
const DEDUP_WINDOW_MS = 30 * 1000;

// ── Safe headers — strips sensitive auth headers before persisting ─────────────

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-auth-token', 'x-api-key'];

function sanitizeHeaders(headers = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!SENSITIVE_HEADERS.includes(k.toLowerCase())) {
      safe[k] = v;
    }
  }
  return safe;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Adds a mutating request to the offline sync queue.
 * Skips if a duplicate request (same hash) was queued within DEDUP_WINDOW_MS.
 *
 * @param {{ url: string, method: string, body?: any, headers?: object }} config
 * @returns {Promise<{ queued: boolean, id: string|null, reason?: string }>}
 */
export async function enqueueRequest(config) {
  const { url, method, body, headers = {} } = config;
  const serializedBody = body ? JSON.stringify(body) : '';
  const hash = makeHash(url, method.toUpperCase(), serializedBody);

  // ── Deduplication check ──
  try {
    const existing = await queueGetAll();
    const now = Date.now();
    const duplicate = existing.find(
      (entry) =>
        entry.hash === hash &&
        now - entry.timestamp < DEDUP_WINDOW_MS
    );
    if (duplicate) {
      console.log(`[OfflineQueue] Duplicate request skipped: ${method} ${url}`);
      return { queued: false, id: duplicate.id, reason: 'duplicate' };
    }
  } catch (err) {
    console.warn('[OfflineQueue] Deduplication check failed:', err);
  }

  // ── Build queue entry ──
  const id = generateId();
  const entry = {
    id,
    url,
    method:     method.toUpperCase(),
    body:       serializedBody,
    headers:    sanitizeHeaders(headers),
    timestamp:  Date.now(),
    retryCount: 0,
    hash,
  };

  await queueSet(id, entry);
  console.log(`[OfflineQueue] Queued: ${method.toUpperCase()} ${url} (id: ${id})`);

  // Notify any listeners about queue change
  dispatchQueueChange();

  return { queued: true, id };
}

/**
 * Returns all queued requests sorted oldest-first.
 * @returns {Promise<object[]>}
 */
export async function getQueue() {
  return queueGetAll();
}

/**
 * Returns the number of pending requests in the queue.
 * @returns {Promise<number>}
 */
export async function getQueueCount() {
  const all = await queueGetAll();
  return all.length;
}

/**
 * Removes a specific request from the queue (after successful replay).
 * @param {string} id
 */
export async function removeFromQueue(id) {
  await queueDel(id);
  dispatchQueueChange();
}

/**
 * Updates the retry count for a queued entry.
 * @param {string} id
 * @param {number} newRetryCount
 */
export async function updateRetryCount(id, newRetryCount) {
  try {
    const entry = await queueGet(id);
    if (entry) {
      await queueSet(id, { ...entry, retryCount: newRetryCount });
    }
  } catch (err) {
    console.warn(`[OfflineQueue] updateRetryCount failed for "${id}":`, err);
  }
}

/**
 * Clears the entire sync queue. Use with caution.
 */
export async function clearQueue() {
  await queueClear();
  dispatchQueueChange();
}

// ── Queue change event ────────────────────────────────────────────────────────

/**
 * Dispatches a custom DOM event so UI components can reactively
 * update the queued request count without polling.
 */
function dispatchQueueChange() {
  try {
    window.dispatchEvent(new CustomEvent('nexasphere:queue-change'));
  } catch {
    // Not in browser context
  }
}
