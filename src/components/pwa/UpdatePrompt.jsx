/**
 * UpdatePrompt — NexaSphere PWA
 * ================================
 * Displays a toast when a new Service Worker version is available,
 * triggered by vite-plugin-pwa's updateSW callback.
 *
 * Props:
 *  updateSW  fn   — call this to activate the new SW and reload
 */

import { useState } from 'react';
import '../../styles/pwa.css';

export default function UpdatePrompt({ updateSW }) {
  const [visible, setVisible]   = useState(true);
  const [loading, setLoading]   = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateSW(true); // true = reload after SW activation
    } catch {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="pwa-update-toast pwa-update--visible"
      role="status"
      aria-live="polite"
      aria-label="App update available"
    >
      <span className="pwa-update__icon" aria-hidden="true">🎉</span>
      <span className="pwa-update__text">
        <strong>New version</strong> of NexaSphere is ready
      </span>
      <button
        id="pwa-update-btn"
        className="pwa-btn-update"
        onClick={handleUpdate}
        disabled={loading}
        aria-label="Reload to apply the new version"
      >
        {loading ? 'Updating…' : 'Update'}
      </button>
      <button
        id="pwa-update-dismiss-btn"
        className="pwa-btn-close"
        onClick={handleDismiss}
        aria-label="Dismiss update notification"
      >
        ✕
      </button>
    </div>
  );
}
