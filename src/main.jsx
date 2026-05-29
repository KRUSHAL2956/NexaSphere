import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './i18n';
import { registerSW } from 'virtual:pwa-register';
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx';
import { ThemeProvider } from './context/theme/ThemeProvider.tsx';
import { registerSW } from 'virtual:pwa-register';
import { initializeSentry } from './utils/errorTracking.js';
import * as Sentry from '@sentry/react';
import { HelmetProvider } from 'react-helmet-async';
import { initSyncManager } from './utils/syncManager.js';

// ── Sentry error tracking ─────────────────────────────────────────────────────
initializeSentry();

window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason, { tags: { type: 'unhandledrejection' } });
});

window.addEventListener('error', (event) => {
  Sentry.captureException(event.error, { tags: { type: 'uncaughterror' } });
});

// ── PWA Service Worker Registration ──────────────────────────────────────────
// updateSW is stored globally so UpdatePrompt can call it when user clicks "Update"
let _updateSW = null;

_updateSW = registerSW({
  /**
   * Called when a new SW is available.
   * We dispatch a custom event so the UpdatePrompt component can react.
   */
  onNeedRefresh() {
    console.log('[PWA] New service worker available — notifying UI.');
    window.dispatchEvent(
      new CustomEvent('nexasphere:sw-update', { detail: { updateSW: _updateSW } })
    );
  },

  /**
   * Called when the SW has taken control (first install or update applied).
   */
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.');
    window.dispatchEvent(new CustomEvent('nexasphere:sw-offline-ready'));
  },

  /**
   * Called on registration error.
   */
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
    Sentry.captureException(error, { tags: { type: 'sw-register-error' } });
  },
});

// ── Background Sync Manager ───────────────────────────────────────────────────
// Initialize after SW registration so SW sync API is available
initSyncManager();

// ── Render ────────────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <GlobalErrorBoundary>
          <App />
        </GlobalErrorBoundary>
      </ThemeProvider>
    </HelmetProvider>
  </StrictMode>
);
