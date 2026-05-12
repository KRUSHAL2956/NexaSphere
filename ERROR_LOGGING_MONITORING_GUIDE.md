# Production Error Logging & Monitoring Implementation Guide

## Overview

This implementation provides enterprise-grade error logging, monitoring, and alerting for NexaSphere using:
- **Sentry**: Error tracking and monitoring (frontend + backend)
- **Winston**: Structured logging with file rotation
- **Slack Integration**: Real-time alerts for critical errors
- **Performance Monitoring**: Response time tracking and error rate analysis

## Features Implemented

### ✅ Frontend Error Tracking
- **Sentry Integration** (`src/utils/errorTracking.js`)
  - Automatic error capture for unhandled exceptions
  - Session replay with media masking
  - Performance monitoring (10% sample rate in production)
  - User context tracking

- **Error Boundary Component** (`src/components/ErrorBoundary.jsx`)
  - Catches React component errors
  - User-friendly error UI
  - Automatic error logging to Sentry
  - Page refresh option for users

### ✅ Backend Error Tracking
- **Winston Logger** (`server/utils/logger.js`)
  - Console, file, and daily rotation transports
  - Automatic exception and rejection handlers
  - Structured logging with timestamps
  - Log levels: error, warn, info, http, debug

- **Sentry Backend Integration** (`server/utils/sentry.js`)
  - Middleware for request/response tracking
  - Exception capture with context
  - Breadcrumb tracking for debugging
  - Performance profiling

- **Error Handler Middleware** (`server/middleware/errorHandler.js`)
  - Centralized error handling
  - Request context logging (userId, IP, URL, method)
  - Automatic Slack alerts for critical errors
  - Sensitive data sanitization

### ✅ Performance Monitoring
- **Performance Monitor Middleware** (`server/middleware/performanceMonitor.js`)
  - Response time tracking per endpoint
  - Error rate calculation and thresholds
  - Slow request detection (>1000ms warning, >5000ms alert)
  - Real-time metrics collection

### ✅ Slack Alerts
- **Slack Integration** (`server/utils/slack.js`)
  - Automatic alerts for HTTP 500+ errors
  - Error rate threshold alerts (>5% by default)
  - Performance alerts for slow endpoints
  - Formatted messages with stack traces and context

### ✅ Monitoring API
- **Monitoring Routes** (`server/routes/monitoring.js`)
  - `/api/monitoring/health` - Health check
  - `/api/monitoring/metrics` - Current performance metrics
  - `/api/monitoring/errors/stats` - Error statistics
  - `/api/monitoring/errors/recent` - Recent errors
  - `/api/monitoring/errors/endpoint?url=...` - Endpoint-specific errors
  - `/api/monitoring/errors/user/:userId` - User-specific errors
  - `/api/monitoring/logs` - Log locations
  - `/api/monitoring/test-error` - Test error trigger (dev only)

### ✅ Error Tracking Service
- **Error Service** (`server/services/errorTrackingService.js`)
  - Centralized error logging and statistics
  - Endpoint and user-specific error tracking
  - Sensitive data redaction (passwords, tokens, etc.)
  - Time-based error analysis

## Setup Instructions

### 1. Environment Configuration

Create or update `.env` in the root directory with:

```bash
# Frontend Sentry DSN
VITE_SENTRY_DSN=https://your_key@your_project.ingest.sentry.io/your_project_id

# Backend Sentry DSN
SENTRY_DSN=https://your_key@your_project.ingest.sentry.io/your_project_id

# Slack Webhook URL
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional configurations
LOG_LEVEL=info
NODE_ENV=development
ERROR_RATE_THRESHOLD=5
```

### 2. Frontend Integration

Add to `src/main.jsx`:

```javascript
import { initializeSentry, setUserContext } from './utils/errorTracking';
import ErrorBoundary from './components/ErrorBoundary';

// Initialize Sentry before app renders
initializeSentry();

// Wrap app with error boundary
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Set user context when user logs in
const handleUserLogin = (user) => {
  setUserContext(user);
  // ... rest of login logic
};
```

### 3. Backend Integration

Update `server/index.js`:

```javascript
import express from 'express';
import { initializeSentry, addSentryErrorHandler } from './utils/sentry.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { performanceMonitor } from './middleware/performanceMonitor.js';
import monitoringRoutes from './routes/monitoring.js';

const app = express();

// Initialize Sentry (must be first middleware)
initializeSentry(app);

// Performance monitoring
app.use(performanceMonitor);

// Your other middleware and routes
app.use(express.json());
app.use(cors());

// Monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// Your API routes here...

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);
addSentryErrorHandler(app);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 4. API Error Handling

Wrap async route handlers:

```javascript
import { asyncHandler } from './middleware/errorHandler.js';
import { logError } from './services/errorTrackingService.js';

// In your route handlers:
app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  
  res.json(user);
}));
```

## Acceptance Criteria Status

| Criteria | Status | Details |
|----------|--------|---------|
| ✅ Sentry captures all unhandled exceptions | Complete | Frontend & backend integration |
| ✅ All errors logged with context | Complete | userId, path, stack trace, headers, IP |
| ✅ Dashboard shows error rate & slow endpoints | Complete | `/api/monitoring/metrics` & `/api/monitoring/errors/stats` |
| ✅ Alerts trigger on error rate > 5% | Complete | Automatic Slack alerts via threshold check |
| ✅ No sensitive data in logs | Complete | Automatic sanitization of passwords, tokens, etc. |

## Monitoring Dashboard API Examples

### Get Performance Metrics
```bash
curl http://localhost:3000/api/monitoring/metrics
```

Response:
```json
{
  "totalRequests": 1250,
  "totalErrors": 15,
  "errorRate": "1.20%",
  "endpoints": [
    {
      "endpoint": "GET /api/users",
      "avgTime": "45.23ms",
      "maxTime": "234ms",
      "minTime": "12ms",
      "errorCount": 2
    }
  ]
}
```

### Get Error Statistics
```bash
curl http://localhost:3000/api/monitoring/errors/stats
```

### Get Recent Errors
```bash
curl http://localhost:3000/api/monitoring/errors/recent?limit=10
```

### Get Endpoint-Specific Errors
```bash
curl http://localhost:3000/api/monitoring/errors/endpoint?url=/api/users
```

## Log Files

Logs are stored in `server/logs/`:
- `error.log` - Error level logs only
- `combined.log` - All logs combined
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections
- `application-YYYY-MM-DD.log` - Daily rotation logs

## Getting Sentry DSN

1. Go to [sentry.io](https://sentry.io)
2. Create or login to your account
3. Create a new project for "React" and "Node.js"
4. Copy the DSN from project settings
5. Add to `.env` files

## Getting Slack Webhook URL

1. Go to [Slack Apps](https://api.slack.com/apps)
2. Create a new app or select existing
3. Navigate to "Incoming Webhooks"
4. Click "Add New Webhook to Workspace"
5. Select channel for alerts
6. Copy the Webhook URL
7. Add to `.env` as `SLACK_WEBHOOK_URL`

## Testing Error Tracking

### Frontend Error Boundary Test
```javascript
// In React component
throw new Error('Test error to trigger error boundary');
```

### Backend Error Test
```bash
curl -X POST http://localhost:3000/api/monitoring/test-error
```

## Production Deployment Checklist

- [ ] Configure Sentry DSN for both frontend and backend
- [ ] Set up Slack webhook for alerts
- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_LEVEL=warn` or `error`
- [ ] Enable log rotation and archiving
- [ ] Set up external log aggregation (Datadog, ELK, etc.)
- [ ] Monitor error rate threshold regularly
- [ ] Review and adjust sampling rates
- [ ] Set up database-backed error storage
- [ ] Configure log retention policies
- [ ] Test error alerts and notifications
- [ ] Document on-call procedures for alerts

## Performance Considerations

### Log Storage
- **Development**: All logs retained in memory and files
- **Production**: Consider external log aggregation service
- **Recommended**: Log retention of 7-30 days depending on volume

### Sentry Sampling
- **Development**: 100% trace sample rate (all requests tracked)
- **Production**: 10% trace sample rate (1 in 10 requests)
- **Adjust** based on your traffic and quota

### Performance Impact
- Minimal overhead for error tracking (<5ms per request)
- Log file I/O is async and non-blocking
- Sentry events batched and sent asynchronously

## Troubleshooting

### Sentry not capturing errors
1. Verify DSN is correctly configured
2. Check that Sentry is initialized before app code
3. Ensure error is actually being thrown
4. Check Sentry project settings for filtering

### Slack alerts not working
1. Verify webhook URL is correct
2. Check Slack channel permissions
3. Test webhook with curl command
4. Verify error rate threshold (5% by default)

### Missing logs
1. Check `server/logs/` directory exists
2. Verify disk space available
3. Check file permissions (log directory must be writable)
4. Review `LOG_LEVEL` setting

## Next Steps

1. Install dependencies: `npm install && cd server && npm install`
2. Configure environment variables
3. Update application entry points
4. Deploy to staging environment
5. Test error tracking and alerts
6. Monitor error dashboard for issues
7. Adjust thresholds based on application behavior

## Support & Documentation

- Sentry Docs: https://docs.sentry.io/
- Winston Docs: https://github.com/winstonjs/winston
- Slack API: https://api.slack.com/
- Performance Monitoring: See API examples above
