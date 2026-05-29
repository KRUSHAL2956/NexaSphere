/**
 * useOfflineSync — React hook for offline status and sync state
 * ==============================================================
 * Exposes:
 *   isOnline      boolean  — current network status
 *   isSyncing     boolean  — background sync is running
 *   queuedCount   number   — requests pending in offline queue
 *   syncNow       fn       — manually trigger a sync
 *   lastSyncAt    Date|null — timestamp of last successful sync
 *   syncStats     { synced, failed } — from last sync run
 */

import { useState, useEffect, useCallback } from 'react';
import { getQueueCount } from '../utils/offlineQueue.js';
import { triggerSync } from '../utils/syncManager.js';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncStats, setSyncStats] = useState({ synced: 0, failed: 0 });

  // ── Refresh queue count ──────────────────────────────────────────────────────
  const refreshCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setQueuedCount(count);
    } catch {
      // silently fail
    }
  }, []);

  // ── Event listeners ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Network status
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync lifecycle events
    const handleSyncStart    = () => setIsSyncing(true);
    const handleSyncComplete = (e) => {
      setIsSyncing(false);
      setLastSyncAt(new Date());
      setSyncStats(e.detail || { synced: 0, failed: 0 });
      refreshCount();
    };
    const handleSyncFailed   = () => setIsSyncing(false);

    window.addEventListener('nexasphere:sync-start',    handleSyncStart);
    window.addEventListener('nexasphere:sync-complete', handleSyncComplete);
    window.addEventListener('nexasphere:sync-failed',   handleSyncFailed);

    // Queue change events (enqueue / dequeue)
    window.addEventListener('nexasphere:queue-change', refreshCount);

    // Initial count
    refreshCount();

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('nexasphere:sync-start',    handleSyncStart);
      window.removeEventListener('nexasphere:sync-complete', handleSyncComplete);
      window.removeEventListener('nexasphere:sync-failed',   handleSyncFailed);
      window.removeEventListener('nexasphere:queue-change',  refreshCount);
    };
  }, [refreshCount]);

  // ── Manual sync trigger ───────────────────────────────────────────────────────
  const syncNow = useCallback(() => {
    triggerSync();
  }, []);

  return {
    isOnline,
    isSyncing,
    queuedCount,
    syncNow,
    lastSyncAt,
    syncStats,
  };
}
