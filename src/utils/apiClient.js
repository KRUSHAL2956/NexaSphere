import * as Sentry from "@sentry/react";

/**
 * Standardized API Error class
 */
export class ApiError extends Error {
  constructor(message, status, code, originalError = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Centralized async API wrapper for fetch
 * Standardizes errors, handles timeouts, and reports to Sentry
 */
export const apiClient = async (url, options = {}) => {
  const { timeout = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(id);

    if (response.type === "opaque") {
      return null;
    }

    if (!response.ok) {
      let errorDetail = null;
      try {
        errorDetail = await response.json();
      } catch (e) {
        // Not JSON
      }

      const message =
        errorDetail?.message || response.statusText || "API Request Failed";
      const code = errorDetail?.code || "API_ERROR";

      throw new ApiError(message, response.status, code);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch (e) {
        throw new ApiError("Malformed JSON response", 500, "MALFORMED_JSON", e);
      }
    }

    return await response.text();
  } catch (error) {
    clearTimeout(id);

    let standardError;
    if (error instanceof ApiError) {
      standardError = error;
    } else if (error.name === "AbortError") {
      standardError = new ApiError("Request timed out", 408, "TIMEOUT", error);
    } else {
      standardError = new ApiError(
        error.message || "Network failure",
        0,
        "NETWORK_ERROR",
        error
      );
    }

    Sentry.captureException(standardError, {
      tags: {
        api_url: url,
        api_method: fetchOptions.method || "GET",
      },
    });

    throw standardError;
  }
};

export default apiClient;
