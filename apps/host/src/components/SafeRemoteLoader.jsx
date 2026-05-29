import React from "react";

const DEFAULT_FALLBACK = (
  <main className="remote-state-shell" role="status" aria-live="polite">
    <div className="remote-state-card">
      <p className="remote-state-eyebrow">Loading</p>
      <h1>Preparing remote workspace</h1>
    </div>
  </main>
);

class RemoteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Remote module failed to render", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.errorFallback ?? (
          <main className="remote-state-shell" role="alert">
            <div className="remote-state-card remote-state-card--error">
              <p className="remote-state-eyebrow">Remote unavailable</p>
              <h1>Admin dashboard could not be loaded</h1>
              <p>
                Keep the admin remote running on port 5001, then refresh this
                route.
              </p>
            </div>
          </main>
        )
      );
    }

    return this.props.children;
  }
}

export default function SafeRemoteLoader({
  children,
  fallback = DEFAULT_FALLBACK,
  errorFallback,
}) {
  return (
    <RemoteErrorBoundary errorFallback={errorFallback}>
      <React.Suspense fallback={fallback}>{children}</React.Suspense>
    </RemoteErrorBoundary>
  );
}
