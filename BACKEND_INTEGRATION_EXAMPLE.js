/**
 * Backend Server Integration Example
 * This is how to integrate error tracking and monitoring into server/index.js
 */

// ===== IMPORTS =====
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Error tracking and monitoring imports
import { initializeSentry, addSentryErrorHandler } from './utils/sentry.js'
import logger from './utils/logger.js'
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js'
import { performanceMonitor } from './middleware/performanceMonitor.js'
import monitoringRoutes from './routes/monitoring.js'

// Your existing imports
import apiRoutes from './routes/api.js'

// ===== CONFIGURATION =====
dotenv.config()
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'

// ===== CREATE EXPRESS APP =====
const app = express()

// ===== SENTRY INITIALIZATION (MUST BE FIRST) =====
initializeSentry(app)

// ===== LOGGING =====
logger.info(`Starting server in ${NODE_ENV} environment`)

// ===== MIDDLEWARE SETUP =====

// 1. CORS Middleware
app.use(cors())

// 2. Body Parsing Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// 3. Performance Monitoring Middleware (BEFORE routes)
app.use(performanceMonitor)

// ===== ROUTES =====

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    environment: NODE_ENV,
  })
})

// Monitoring API routes
app.use('/api/monitoring', monitoringRoutes)

// Your existing API routes
app.use('/api', apiRoutes)

// ===== ERROR HANDLING (MUST BE LAST) =====

// 404 handler for undefined routes
app.use(notFoundHandler)

// Global error handler middleware
app.use(errorHandler)

// Sentry error handler (MUST be after app.use(errorHandler))
addSentryErrorHandler(app)

// ===== SERVER STARTUP =====
app.listen(PORT, () => {
  logger.info(`✓ Server running on http://localhost:${PORT}`)
  logger.info(`✓ Monitoring dashboard: http://localhost:${PORT}/api/monitoring/metrics`)
  logger.info(`✓ Error tracking: ${process.env.SENTRY_DSN ? '✓ Enabled' : '✗ Disabled'}`)
  logger.info(`✓ Slack alerts: ${process.env.SLACK_WEBHOOK_URL ? '✓ Enabled' : '✗ Disabled'}`)
})

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server')
  process.exit(0)
})

// ===== EXAMPLE API ROUTE WITH ERROR HANDLING =====
/*
import { asyncHandler } from './middleware/errorHandler.js'

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const userId = req.params.id

  // Error tracking context
  const context = {
    userId,
    requestPath: req.originalUrl,
    method: req.method,
  }

  try {
    const user = await getUserById(userId)

    if (!user) {
      const error = new Error('User not found')
      error.statusCode = 404
      throw error
    }

    res.status(200).json({
      success: true,
      data: user,
    })
  } catch (error) {
    // Error will be caught by asyncHandler and passed to error middleware
    throw error
  }
}))
*/

export default app
