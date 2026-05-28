/**
 * Server-Sent Events (SSE) Service
 * Provides real-time event stream to admin dashboard
 */

import logger from '../utils/logger.js';
import { getAdminSession } from '../repositories/adminSessionsRepository.js';

const adminClients = new Set();
const SSE_VALIDATION_INTERVAL_MS = 5000;
let sseValidationTimer = null;

/**
 * Start periodic verification of active SSE clients against the database
 */
export function startSSEValidation() {
  if (sseValidationTimer) return sseValidationTimer;

  sseValidationTimer = setInterval(async () => {
    const clients = Array.from(adminClients);
    for (const client of clients) {
      const token = client.adminSessionToken;
      if (!token) {
        logger.warn('SSE client missing token, force terminating');
        client.end();
        adminClients.delete(client);
        if (client._heartbeat) clearInterval(client._heartbeat);
        continue;
      }
      try {
        const session = await getAdminSession(token);
        if (!session) {
          logger.warn('Revoked or expired admin SSE session detected. Force terminating connection.', { token: token.slice(0, 8) });
          try {
            client.write(`event: admin:revoked\ndata: ${JSON.stringify({ error: 'Session has been revoked or expired' })}\n\n`);
          } catch (e) {
            // Client might already be closed
          }
          client.end();
          adminClients.delete(client);
          if (client._heartbeat) clearInterval(client._heartbeat);
        }
      } catch (error) {
        logger.error('Failed to validate active SSE client session', { error: error.message });
      }
    }
  }, SSE_VALIDATION_INTERVAL_MS);

  if (sseValidationTimer && typeof sseValidationTimer.unref === 'function') {
    sseValidationTimer.unref();
  }
  return sseValidationTimer;
}

/**
 * Stop periodic verification of active SSE clients
 */
export function stopSSEValidation() {
  if (sseValidationTimer) {
    clearInterval(sseValidationTimer);
    sseValidationTimer = null;
  }
}

// Start validation automatically at the module level
startSSEValidation();

/**
 * Add SSE client
 */
export function addSSEClient(res) {
  adminClients.add(res);
  logger.info('SSE client connected', { totalClients: adminClients.size });

  res.on('close', () => {
    adminClients.delete(res);
    if (res._heartbeat) clearInterval(res._heartbeat);
    logger.info('SSE client disconnected', { totalClients: adminClients.size });
  });

  res.on('error', (error) => {
    adminClients.delete(res);
    if (res._heartbeat) clearInterval(res._heartbeat)
    logger.error('SSE client error', { error: error.message });
  });
}

/**
 * Send SSE event to all connected clients
 */
export function broadcastSSEEvent(eventName, data) {
  const eventData = JSON.stringify({
    type: eventName,
    data,
    timestamp: new Date().toISOString(),
  });

  const dead = [];
  adminClients.forEach((client) => {
    try {
      client.write(`event: ${eventName}\n`);
      client.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error('Failed to send SSE event', { error: error.message });
      dead.push(client);
    }
  });

  dead.forEach((c) => {
    adminClients.delete(c);
    clearInterval(c._heartbeat);
  });

  logger.debug('SSE event broadcast', { event: eventName, clientCount: adminClients.size });
}

/**
 * Get connected SSE clients count
 */
export function getConnectedSSEClientsCount() {
  return adminClients.size;
}

/**
 * SSE middleware setup
 */
export function setupSSEHeaders(req, res, next) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // The app-level cors() middleware already selected the correct origin.
  // Do not overwrite it here, or multi-origin deployments break.

  // Send initial connection message
  res.write(': SSE connection established\n\n');

  // Send heartbeat every 30 seconds to keep connection alive
  res._heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      clearInterval(res._heartbeat);
    }
  }, 30000);

  res.on('close', () => {
    clearInterval(res._heartbeat);
  });

  next();
}

export default {
  addSSEClient,
  broadcastSSEEvent,
  getConnectedSSEClientsCount,
  setupSSEHeaders,
  startSSEValidation,
  stopSSEValidation,
};
