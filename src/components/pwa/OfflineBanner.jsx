/**
 * OfflineBanner — NexaSphere PWA
 * ================================
 * Displays a slide-down banner when the user goes offline.
 * Shows:
 *  - Offline state: "📡 You're offline — X actions queued"
 *  - Syncing state: spinner + "Syncing…"
 *  - Back-online flash: "✅ Back online — all synced!" (auto-hides after 3s)
 */

import { useState, useEffect, useRef } from 'react';
import { useOfflineSync } from '../../hooks/useOfflineSync.js';
import '../../styles/pwa.css';

export default function OfflineBanner() {
  const { isOnline, isSyncing, queuedCount, syncNow, syncStats } = useOfflineSync();

  // Whether the banner is currently visible
  const [visible, setVisible] = useState(false);
  // "online" means we just came back online (green variant)
  const [showOnline, setShowOnline] = useState(false);
  const onlineTimerRef = useRef(null);
  const prevOnlineRef  = useRef(navigator.onLine);

  useEffect(() => {
    if (!isOnline) {
      // Gone offline — show immediately
      setShowOnline(false);
      setVisible(true);
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
    } else {
      // Just came back online
      if (!prevOnlineRef.current) {
        // Show green "back online" variant for 3 seconds
        setShowOnline(true);
        setVisible(true);
        onlineTimerRef.current = setTimeout(() => {
          setVisible(false);
          setShowOnline(false);
        }, 3500);
      }
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  // Also hide after sync completes if we're online
  useEffect(() => {
    if (isOnline && !isSyncing && queuedCount === 0 && showOnline) {
      onlineTimerRef.current = setTimeout(() => {
        setVisible(false);
        setShowOnline(false);
      }, 2000);
    }
    return () => {
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
    };
  }, [isOnline, isSyncing, queuedCount, showOnline]);

  // Render nothing initially (banner is hidden via CSS transform)
  return (
    <div
      className={`pwa-offline-banner${visible ? ' pwa-banner--visible' : ''}${showOnline ? ' pwa-banner--online' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={
        showOnline
          ? 'Connection restored'
          : isOnline
          ? 'Network status'
          : 'You are offline'
      }
    >
      <div className="pwa-banner__left">
        <div className="pwa-banner__icon" aria-hidden="true">
          {showOnline ? '✅' : isSyncing ? '🔄' : '📡'}
        </div>
        <div className="pwa-banner__text">
          <span className="pwa-banner__title">
            {showOnline
              ? 'Back Online'
              : isSyncing
              ? 'Syncing…'
              : "You're Offline"}
          </span>
          <span className="pwa-banner__subtitle">
            {showOnline
              ? syncStats.failed > 0
                ? `${syncStats.synced} synced, ${syncStats.failed} failed — check your actions`
                : 'All changes have been synced successfully'
              : isSyncing
              ? `Syncing ${queuedCount} queued action${queuedCount !== 1 ? 's' : ''}…`
              : 'Changes will sync when you reconnect'}
          </span>
        </div>
      </div>

      <div className="pwa-banner__right">
        {isSyncing && (
          <span className="pwa-spinner" aria-hidden="true" />
        )}

        {!isOnline && queuedCount > 0 && (
          <span className="pwa-banner__badge" aria-label={`${queuedCount} actions queued`}>
            <span className="pwa-dot" aria-hidden="true" />
            {queuedCount} queued
          </span>
        )}

        {isOnline && !isSyncing && queuedCount > 0 && (
          <button
            className="pwa-banner__sync-btn"
            onClick={syncNow}
            aria-label="Sync queued changes now"
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
}
