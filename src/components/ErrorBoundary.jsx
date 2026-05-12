/**
 * Global Error Boundary Component
 * Catches React errors and logs them to Sentry
 */

import React from "react";
import * as Sentry from "@sentry/react";
import { captureHandledException } from "../utils/errorTracking";

const ErrorBoundaryFallback = ({ error, resetError }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#f5f5f5",
      fontFamily: "Arial, sans-serif",
      color: "#333",
    }}
  >
    <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Oops! Something went wrong</h1>
    <p style={{ fontSize: "1rem", marginBottom: "2rem", maxWidth: "500px", textAlign: "center" }}>
      We've been notified of the issue and are working to fix it. Please try refreshing the page.
    </p>
    <details
      style={{
        whiteSpace: "pre-wrap",
        backgroundColor: "#fff",
        padding: "1rem",
        borderRadius: "4px",
        maxWidth: "600px",
        marginBottom: "2rem",
        fontSize: "0.85rem",
        fontFamily: "monospace",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: "bold", marginBottom: "1rem" }}>
        Error Details
      </summary>
      <p>{error?.toString()}</p>
      <p>{error?.stack}</p>
    </details>
    <button
      onClick={resetError}
      style={{
        padding: "0.75rem 1.5rem",
        fontSize: "1rem",
        backgroundColor: "#007bff",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        marginRight: "1rem",
      }}
    >
      Refresh Page
    </button>
    <a
      href="/"
      style={{
        padding: "0.75rem 1.5rem",
        fontSize: "1rem",
        backgroundColor: "#6c757d",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        textDecoration: "none",
        display: "inline-block",
      }}
    >
      Go Home
    </a>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to Sentry
    captureHandledException(error, `React Error Boundary: ${errorInfo.componentStack}`);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error caught by boundary:", error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
    // Optional: reload the page
    // window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

// Sentry wrapper for better error tracking
export default Sentry.withErrorBoundary(ErrorBoundary, {
  fallback: <ErrorBoundaryFallback />,
  showDialog: false,
});
