import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './i18n';
import { registerSW } from 'virtual:pwa-register';
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx';
import { ThemeProvider } from './context/theme/ThemeProvider.tsx';
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
let _updateSW = null;

_updateSW = registerSW({
  onNeedRefresh() {
    console.log('[PWA] New service worker available — notifying UI.');
    window.dispatchEvent(
      new CustomEvent('nexasphere:sw-update', { detail: { updateSW: _updateSW } })
    );
  },

  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.');
    window.dispatchEvent(new CustomEvent('nexasphere:sw-offline-ready'));
  },

  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
    Sentry.captureException(error, { tags: { type: 'sw-register-error' } });
  },
});

initSyncManager();

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
