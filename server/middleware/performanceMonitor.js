/**
 * Performance Monitoring Middleware
 * Tracks response times, error rates, and other metrics
 */

const logger = require("./logger");
const { captureMessage, addBreadcrumb } = require("./sentry");

// Store metrics in memory (consider using Redis in production)
const metrics = {
  endpoints: {},
  errorRate: 0,
  totalRequests: 0,
  totalErrors: 0,
};

/**
 * Performance monitoring middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  // Override send to capture response
  res.send = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const endpoint = `${req.method} ${req.baseUrl}${req.path}`;

    // Update metrics
    metrics.totalRequests++;
    if (statusCode >= 400) {
      metrics.totalErrors++;
    }

    // Update endpoint-specific metrics
    if (!metrics.endpoints[endpoint]) {
      metrics.endpoints[endpoint] = {
        count: 0,
        totalTime: 0,
        errors: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
      };
    }

    const endpointMetrics = metrics.endpoints[endpoint];
    endpointMetrics.count++;
    endpointMetrics.totalTime += duration;
    endpointMetrics.avgTime = endpointMetrics.totalTime / endpointMetrics.count;
    endpointMetrics.maxTime = Math.max(endpointMetrics.maxTime, duration);
    endpointMetrics.minTime = Math.min(endpointMetrics.minTime, duration);

    if (statusCode >= 400) {
      endpointMetrics.errors++;
    }

    // Calculate error rate
    metrics.errorRate = (metrics.totalErrors / metrics.totalRequests) * 100;

    // Log slow requests
    if (duration > 1000) {
      logger.warn("Slow Request Detected", {
        endpoint,
        duration,
        status: statusCode,
      });

      addBreadcrumb({
        category: "performance",
        message: `Slow request: ${endpoint} took ${duration}ms`,
        level: "warning",
        data: { duration, endpoint, status: statusCode },
      });

      // Alert if request took more than 5 seconds
      if (duration > 5000) {
        captureMessage(`Critical slow request: ${endpoint} took ${duration}ms`, "warning", {
          tags: { type: "performance", endpoint },
          extra: { duration, statusCode },
        });
      }
    }

    // Log response
    logger.http("HTTP Response", {
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    });

    // Add breadcrumb for Sentry
    addBreadcrumb({
      category: "http",
      message: `${req.method} ${req.path} - ${statusCode}`,
      level: statusCode >= 400 ? "error" : "info",
      data: { duration, statusCode, method: req.method, path: req.path },
    });

    // Call original send
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Get current metrics
 */
const getMetrics = () => {
  return {
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    errorRate: metrics.errorRate.toFixed(2) + "%",
    endpoints: Object.entries(metrics.endpoints).map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      avgTime: data.avgTime.toFixed(2) + "ms",
      maxTime: data.maxTime + "ms",
      minTime: data.minTime === Infinity ? 0 : data.minTime + "ms",
      errorCount: data.errors,
      errorRate: ((data.errors / data.count) * 100).toFixed(2) + "%",
    })),
  };
};

/**
 * Reset metrics
 */
const resetMetrics = () => {
  metrics.endpoints = {};
  metrics.errorRate = 0;
  metrics.totalRequests = 0;
  metrics.totalErrors = 0;
};

/**
 * Alert if error rate exceeds threshold
 */
const checkErrorRateThreshold = (threshold = 5) => {
  if (metrics.errorRate > threshold) {
    captureMessage(`Alert: Error rate exceeded ${threshold}%! Current: ${metrics.errorRate.toFixed(2)}%`, "error", {
      tags: { type: "performance", alert: "error_rate" },
      extra: { errorRate: metrics.errorRate, totalRequests: metrics.totalRequests },
    });

    logger.error("Error Rate Threshold Exceeded", {
      threshold,
      current: metrics.errorRate,
      totalRequests: metrics.totalRequests,
      totalErrors: metrics.totalErrors,
    });

    return true;
  }
  return false;
};

module.exports = {
  performanceMonitor,
  getMetrics,
  resetMetrics,
  checkErrorRateThreshold,
  metrics,
};
