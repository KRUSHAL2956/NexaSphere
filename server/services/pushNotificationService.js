/**
 * Firebase Cloud Messaging Service
 * Handles push notifications for mobile and web
 */

import admin from 'firebase-admin';
import logger from '../utils/logger.js';

let messaging = null;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase() {
  try {
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }

    messaging = admin.messaging();
    logger.info('Firebase Cloud Messaging initialized');
    return messaging;
  } catch (error) {
    logger.warn('Firebase not configured - push notifications disabled', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get messaging instance
 */
export function getMessaging() {
  return messaging;
}

export let sendPushNotificationOverride = null;

/**
 * Send push notification to user
 */
export async function sendPushNotification(userToken, notification) {
  if (sendPushNotificationOverride) {
    return await sendPushNotificationOverride(userToken, notification);
  }
  if (!messaging) {
    logger.warn('Push notifications not available');
    return null;
  }

  try {
    const message = {
      token: userToken,
      notification: {
        title: notification.title || 'NexaSphere',
        body: notification.body || '',
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: notification.clickAction || '',
        },
      },
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: notification.tag || 'notification',
          data: notification.data,
        },
        fcmOptions: {
          link: notification.link || '/',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            'content-available': 1,
          },
        },
      },
    };

    const response = await messaging.send(message);
    logger.info('Push notification sent', { response, title: notification.title });
    return response;
  } catch (error) {
    logger.error('Failed to send push notification', {
      error: error.message,
      token: userToken,
    });
    return null;
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendMulticastNotification(userTokens, notification) {
  if (!messaging || !userTokens.length) return null;

  try {
    const message = {
      notification: {
        title: notification.title || 'NexaSphere',
        body: notification.body || '',
      },
      data: notification.data || {},
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: '/pwa-192x192.png',
        },
      },
    };

    const response = await messaging.sendMulticast({
      tokens: userTokens,
      ...message,
    });

    logger.info('Multicast notification sent', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    return response;
  } catch (error) {
    logger.error('Multicast notification failed', { error: error.message });
    return null;
  }
}

/**
 * Subscribe user to topic
 */
export async function subscribeToTopic(tokens, topic) {
  if (!messaging) return null;

  try {
    await messaging.subscribeToTopic(tokens, topic);
    logger.info('Users subscribed to topic', { topic, count: tokens.length });
    return true;
  } catch (error) {
    logger.error('Topic subscription failed', { error: error.message, topic });
    return false;
  }
}

/**
 * Send notification to topic
 */
export async function sendToTopic(topic, notification) {
  if (!messaging) return null;

  try {
    const message = {
      topic,
      notification: {
        title: notification.title || 'NexaSphere',
        body: notification.body || '',
      },
      data: notification.data || {},
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: '/pwa-192x192.png',
        },
      },
    };

    const response = await messaging.send(message);
    logger.info('Topic notification sent', { topic, response });
    return response;
  } catch (error) {
    logger.error('Topic notification failed', { error: error.message, topic });
    return null;
  }
}

export function setSendPushNotificationOverride(fn) {
  sendPushNotificationOverride = fn;
}

export default {
  initializeFirebase,
  getMessaging,
  sendPushNotification,
  sendMulticastNotification,
  subscribeToTopic,
  sendToTopic,
  setSendPushNotificationOverride,
};
