/**
 * Frontend Error Tracking & Sentry Integration
 * Handles all frontend error logging and monitoring
 */

import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for frontend error tracking
 * @param {string} environment - Environment (development, staging, production)
 */
export const initializeSentry = (environment = process.env.NODE_ENV) => {
  const isDevelopment = environment === "development";

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN,
    environment: environment,
    tracesSampleRate: isDevelopment ? 1.0 : 0.1, // 100% in dev, 10% in prod
    profilesSampleRate: isDevelopment ? 1.0 : 0.1,
    integrations: [
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
      new Sentry.BrowserTracing(),
    ],
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      // Third-party analytics
      /google-analytics/i,
    ],
    enabled: !isDevelopment, // Only enable in production
  });
};

/**
 * Capture and log API errors
 * @param {Error} error - The error object
 * @param {Object} context - Additional context (url, method, userId, etc)
 */
export const captureApiError = (error, context = {}) => {
  Sentry.captureException(error, {
    tags: {
      type: "api_error",
      ...context,
    },
    level: context.severity || "error",
  });

  // Also log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("API Error:", error, context);
  }
};

/**
 * Capture user actions for performance monitoring
 * @param {string} action - Action name (e.g., "page_navigation", "form_submission")
 * @param {number} duration - Duration in milliseconds
 * @param {Object} metadata - Additional metadata
 */
export const capturePerformanceMetric = (action, duration, metadata = {}) => {
  const transaction = Sentry.startTransaction({
    name: action,
    op: action,
  });

  setTimeout(() => {
    transaction.setTag("duration", duration);
    transaction.setData("metadata", metadata);
    transaction.finish();
  }, duration);
};

/**
 * Set user context for error tracking
 * @param {Object} user - User object with id, email, name
 */
export const setUserContext = (user) => {
  if (user && user.id) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
};

/**
 * Add breadcrumb for tracking user actions
 * @param {string} message - Breadcrumb message
 * @param {string} category - Category (e.g., "navigation", "action")
 * @param {string} level - Level (info, warning, error)
 */
export const addBreadcrumb = (message, category = "user-action", level = "info") => {
  Sentry.captureMessage(message, level);
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Capture handled exceptions
 * @param {Error} error - The error to capture
 * @param {string} context - Context information
 */
export const captureHandledException = (error, context = "") => {
  Sentry.captureException(error, {
    tags: {
      handled: true,
      context,
    },
    level: "warning",
  });
};

export default Sentry;
