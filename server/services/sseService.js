/**
 * Server-Sent Events (SSE) Service
 * Provides real-time event stream to admin dashboard
 */

import logger from '../utils/logger.js';
import { getPublicAppUrl } from '../utils/publicAppUrl.js';

const adminClients = new Set();

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
  const allowedOrigin = getPublicAppUrl();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

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
};
