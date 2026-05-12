/**
 * Error Tracking Service
 * Manages error logging, tracking, and analysis
 */

const logger = require("../utils/logger");
const { captureException, captureMessage, addBreadcrumb } = require("../utils/sentry");

// In-memory error store (consider using database in production)
const errorStore = {
  errors: [],
  errorsByStatus: {},
  errorsByEndpoint: {},
};

/**
 * Log error with full context
 * @param {Error} error - Error object
 * @param {Object} context - Request context
 */
async function logError(error, context = {}) {
  const errorData = {
    timestamp: new Date(),
    message: error.message,
    status: context.status || 500,
    stack: error.stack,
    url: context.url,
    method: context.method,
    userId: context.userId,
    userEmail: context.userEmail,
    ipAddress: context.ipAddress,
    requestBody: sanitizeData(context.requestBody),
    queryParams: context.queryParams,
    headers: sanitizeHeaders(context.headers),
  };

  // Store error
  errorStore.errors.push(errorData);

  // Limit stored errors to last 1000
  if (errorStore.errors.length > 1000) {
    errorStore.errors.shift();
  }

  // Update status code stats
  if (!errorStore.errorsByStatus[errorData.status]) {
    errorStore.errorsByStatus[errorData.status] = 0;
  }
  errorStore.errorsByStatus[errorData.status]++;

  // Update endpoint stats
  const endpoint = `${errorData.method} ${errorData.url}`;
  if (!errorStore.errorsByEndpoint[endpoint]) {
    errorStore.errorsByEndpoint[endpoint] = 0;
  }
  errorStore.errorsByEndpoint[endpoint]++;

  // Log to Winston
  logger.error("Error logged", errorData);

  // Send to Sentry
  captureException(error, {
    userId: context.userId,
    requestPath: context.url,
    method: context.method,
    tags: { status: errorData.status, endpoint },
    extra: { context },
  });

  // Add breadcrumb
  addBreadcrumb({
    category: "error",
    message: error.message,
    level: "error",
    data: { status: errorData.status, url: errorData.url },
  });

  return errorData;
}

/**
 * Get error statistics
 */
function getErrorStats() {
  const total = errorStore.errors.length;
  const lastHour = errorStore.errors.filter(
    (e) => new Date() - e.timestamp < 3600000
  ).length;
  const last24Hours = errorStore.errors.filter(
    (e) => new Date() - e.timestamp < 86400000
  ).length;

  const errorsByStatus = Object.entries(errorStore.errorsByStatus).map(([status, count]) => ({
    status: parseInt(status),
    count,
    percentage: ((count / total) * 100).toFixed(2),
  }));

  const topEndpoints = Object.entries(errorStore.errorsByEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([endpoint, count]) => ({
      endpoint,
      errorCount: count,
    }));

  return {
    total,
    lastHour,
    last24Hours,
    errorsByStatus,
    topEndpoints,
  };
}

/**
 * Get recent errors
 * @param {number} limit - Number of errors to return
 */
function getRecentErrors(limit = 50) {
  return errorStore.errors
    .slice(-limit)
    .reverse()
    .map((err) => ({
      ...err,
      timeSince: getTimeSince(err.timestamp),
    }));
}

/**
 * Get errors for specific endpoint
 * @param {string} endpoint - Endpoint path
 * @param {number} limit - Number of errors to return
 */
function getEndpointErrors(endpoint, limit = 20) {
  return errorStore.errors
    .filter((e) => e.url === endpoint)
    .slice(-limit)
    .reverse();
}

/**
 * Get errors for specific user
 * @param {string} userId - User ID
 * @param {number} limit - Number of errors to return
 */
function getUserErrors(userId, limit = 20) {
  return errorStore.errors
    .filter((e) => e.userId === userId)
    .slice(-limit)
    .reverse();
}

/**
 * Sanitize sensitive data from request body
 * @param {Object} data - Request data
 */
function sanitizeData(data) {
  if (!data) return null;

  const sanitized = { ...data };
  const sensitiveFields = ["password", "token", "secret", "apiKey", "credit_card"];

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = "***REDACTED***";
    }
  });

  return sanitized;
}

/**
 * Sanitize headers
 * @param {Object} headers - Request headers
 */
function sanitizeHeaders(headers) {
  if (!headers) return null;

  const sanitized = { ...headers };
  const sensitiveHeaders = ["authorization", "cookie", "x-api-key"];

  sensitiveHeaders.forEach((header) => {
    if (sanitized[header.toLowerCase()]) {
      sanitized[header.toLowerCase()] = "***REDACTED***";
    }
  });

  return sanitized;
}

/**
 * Get time since error occurred
 * @param {Date} timestamp - Error timestamp
 */
function getTimeSince(timestamp) {
  const seconds = Math.floor((new Date() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Clear error store
 */
function clearErrors() {
  errorStore.errors = [];
  errorStore.errorsByStatus = {};
  errorStore.errorsByEndpoint = {};
}

module.exports = {
  logError,
  getErrorStats,
  getRecentErrors,
  getEndpointErrors,
  getUserErrors,
  clearErrors,
};
