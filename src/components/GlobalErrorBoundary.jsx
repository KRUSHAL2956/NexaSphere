import React from 'react';
import * as Sentry from '@sentry/react';
import './GlobalErrorBoundary.css';

const FallbackUI = () => {
  return (
    <div className="global-error-boundary" role="alert">
      <div className="global-error-content">
        <h1>Something went wrong. Please reload the page.</h1>
        <button 
          onClick={() => window.location.reload()}
          aria-label="Reload the page"
          className="retry-button"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};

const GlobalErrorBoundary = ({ children }) => {
  return (
    <Sentry.ErrorBoundary fallback={FallbackUI}>
      {children}
    </Sentry.ErrorBoundary>
  );
};

export default GlobalErrorBoundary;
