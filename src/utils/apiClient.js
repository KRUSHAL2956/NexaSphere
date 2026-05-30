import * as Sentry from '@sentry/react';
import { cacheGet, CACHE_KEYS } from './indexedDB.js';
import { enqueueRequest } from './offlineQueue.js';

/**
 * Standardized API Error class
 */
export class ApiError extends Error {
  constructor(message, status, code, originalError = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Maps a URL pathname to its IndexedDB cache key (if any).
 * Used to hydrate GET requests from IDB when offline.
 */
function getIDBCacheKey(url) {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    if (pathname.includes('/dashboard')) return CACHE_KEYS.DASHBOARD;
    if (pathname.includes('/analytics')) return CACHE_KEYS.ANALYTICS;
    if (pathname.includes('/notifications')) return CACHE_KEYS.NOTIFICATIONS;
    if (pathname.includes('/profile') || pathname.includes('/user/me')) return CACHE_KEYS.USER_PROFILE;
    if (pathname.includes('/events')) return CACHE_KEYS.EVENTS;
  } catch {
    // URL parse failed — no IDB key
  }
  return null;
}

/**
 * Mutating HTTP methods that should be queued when offline.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Centralized async API wrapper for fetch
 * =========================================
 * - Standardizes errors and timeouts
 * - When OFFLINE + GET: attempts IndexedDB hydration
 * - When OFFLINE + mutation: routes to offline sync queue
 * - Reports errors to Sentry
 */
export const apiClient = async (url, options = {}) => {
  const { timeout = 10000, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();

  // ── Offline handling ───────────────────────────────────────────────────────

  if (!navigator.onLine) {
    if (method === 'GET') {
      // Try to serve from IndexedDB cache
      const cacheKey = getIDBCacheKey(url);
      if (cacheKey) {
        try {
          const cached = await cacheGet(cacheKey);
          if (cached !== null) {
            console.log(`[apiClient] Offline — serving "${cacheKey}" from IndexedDB.`);
            return cached;
          }
        } catch (err) {
          console.warn('[apiClient] IDB hydration failed:', err);
        }
      }
      // No cached data available
      throw new ApiError(
        'You are offline and no cached data is available for this request.',
        0,
        'OFFLINE_NO_CACHE'
      );
    }

    if (MUTATING_METHODS.has(method)) {
      // Queue the mutation for later replay
      let body;
      try {
        body = fetchOptions.body
          ? JSON.parse(fetchOptions.body)
          : undefined;
      } catch {
        body = fetchOptions.body;
      }

      const { queued, id, reason } = await enqueueRequest({
        url,
        method,
        body,
        headers: fetchOptions.headers || {},
      });

      if (queued) {
        return {
          queued: true,
          id,
          offline: true,
          message: 'You are offline. Your changes have been saved and will sync when you reconnect.',
        };
      } else if (reason === 'duplicate') {
        return {
          queued: false,
          id,
          offline: true,
          message: 'This action is already queued and will sync when you reconnect.',
        };
      }
    }
  }

  // ── Normal online fetch ────────────────────────────────────────────────────

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(id);

    if (response.type === 'opaque') {
      return null;
    }

    if (!response.ok) {
      let errorDetail = null;
      try {
        errorDetail = await response.json();
      } catch {
        // Not JSON
      }
      
      const message = errorDetail?.message || response.statusText || 'API Request Failed';
      const code = errorDetail?.code || 'API_ERROR';
      
      throw new ApiError(message, response.status, code);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch (e) {
        throw new ApiError('Malformed JSON response', 500, 'MALFORMED_JSON', e);
      }
    }
    
    return await response.text();
  } catch (error) {
    clearTimeout(id);
    
    let standardError;
    if (error instanceof ApiError) {
      standardError = error;
    } else if (error.name === 'AbortError') {
      standardError = new ApiError('Request timed out', 408, 'TIMEOUT', error);
    } else if (!navigator.onLine) {
      // Went offline mid-request — don't report to Sentry
      standardError = new ApiError('Network connection lost', 0, 'NETWORK_ERROR', error);
    } else {
      standardError = new ApiError(error.message || 'Network failure', 0, 'NETWORK_ERROR', error);
    }
    
    // Only report genuine errors to Sentry (not offline / timeout)
    if (!['OFFLINE_NO_CACHE', 'NETWORK_ERROR', 'TIMEOUT'].includes(standardError.code)) {
      Sentry.captureException(standardError, {
        tags: {
          api_url: url,
          api_method: method
        }
      });
    }
    
    throw standardError;
  }
};

export default apiClient;
