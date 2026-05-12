/**
 * Frontend Main Entry Point Integration Example
 * This is how to integrate error tracking into src/main.jsx
 */

// ===== BEFORE: Original main.jsx =====
/*
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
*/

// ===== AFTER: With Error Tracking Integration =====

import React from 'react'
import ReactDOM from 'react-dom/client'

// Import Sentry and error tracking
import { initializeSentry, setUserContext } from './utils/errorTracking'
import ErrorBoundary from './components/ErrorBoundary'

// Import your app
import App from './App.jsx'
import './index.css'

// Initialize Sentry before rendering (IMPORTANT: Must be first)
initializeSentry(process.env.NODE_ENV || 'development')

// Optional: Set user context when available
// This could be called from your auth/login service
const setupUserTracking = async () => {
  try {
    const user = await getCurrentUser() // Your auth logic here
    if (user) {
      setUserContext(user)
    }
  } catch (error) {
    console.error('Failed to set user context:', error)
  }
}

// Call after app initializes
setupUserTracking()

// Render app with error boundary
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  // Sentry will capture this through its integration
})
