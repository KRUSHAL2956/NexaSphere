/**
 * Event Emitter Service
 * Manages real-time events for registration, waitlist, reminders, attendance
 * Resolves cascading SMTP/network integration failures by isolating execution phases.
 */

import EventEmitter from 'events';
import logger from '../utils/logger.js';
import { emitToRoom, getRoom } from '../config/socket.js';
import notificationsService from './notificationsService.js';
import {
  sendRegistrationConfirmationEmail,
  sendWaitlistPromotionEmail,
  sendEventReminderEmail,
  sendAttendanceConfirmationEmail,
} from './emailService.js';
import { sendPushNotification } from './pushNotificationService.js';

class RealTimeEventManager extends EventEmitter {
  constructor() {
    super();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Registration confirmed event
    this.on('registration-confirmed', this.handleRegistrationConfirmed.bind(this));

    // Waitlist promotion event
    this.on('waitlist-promotion', this.handleWaitlistPromotion.bind(this));

    // Event reminder event
    this.on('event-reminder', this.handleEventReminder.bind(this));

    // Attendance marked event
    this.on('attendance-marked', this.handleAttendanceMarked.bind(this));
  }

  /**
   * Handle registration confirmed event
   */
  async handleRegistrationConfirmed(data) {
    logger.info('Event: Registration confirmed processing started', { userId: data.userId, eventId: data.eventId });

    // 1. Send Email (Isolated)
    try {
      await sendRegistrationConfirmationEmail(data.userEmail, {
        name: data.userName,
        eventName: data.eventName,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        eventLocation: data.eventLocation,
      });
      logger.info('Registration confirmed event: Email delivery triggered successfully');
    } catch (error) {
      logger.error('Registration confirmed event: Email delivery failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 2. Send Push Notification (Isolated)
    try {
      if (data.pushToken) {
        await sendPushNotification(data.pushToken, {
          title: 'Registration Confirmed',
          body: `You're registered for ${data.eventName}`,
          data: {
            eventId: data.eventId,
            type: 'registration',
          },
          link: `/events/${data.eventId}`,
        });
        logger.info('Registration confirmed event: Push notification triggered successfully');
      }
    } catch (error) {
      logger.error('Registration confirmed event: Push notification failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 3. Broadcast to notifications room (WebSocket - Isolated)
    try {
      emitToRoom(getRoom('notifications'), 'registration-confirmed', {
        userId: data.userId,
        eventId: data.eventId,
        eventName: data.eventName,
        timestamp: new Date(),
      });
      logger.info('Registration confirmed event: WebSocket user broadcast sent');
    } catch (error) {
      logger.error('Registration confirmed event: WebSocket user broadcast failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 4. Persist notification (Isolated)
    try {
      notificationsService.addNotification(data.userId || 'global', {
        type: 'connection',
        title: 'Registration Confirmed',
        message: `You're registered for ${data.eventName}`,
        link: `/events/${data.eventId}`,
      });
      logger.info('Registration confirmed event: Notification persisted');
    } catch (error) {
      logger.warn('Registration confirmed event: Failed to persist notification', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 5. Notify admin dashboard (WebSocket - Isolated)
    try {
      emitToRoom(getRoom('admin'), 'admin:new-registration', {
        userId: data.userId,
        userName: data.userName,
        eventName: data.eventName,
        timestamp: new Date(),
      });
      logger.info('Registration confirmed event: WebSocket admin broadcast sent');
    } catch (error) {
      logger.error('Registration confirmed event: WebSocket admin broadcast failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }
  }

  /**
   * Handle waitlist promotion event
   */
  async handleWaitlistPromotion(data) {
    logger.info('Event: Waitlist promotion processing started', { userId: data.userId, eventId: data.eventId });

    // 1. Send Email (Isolated)
    try {
      await sendWaitlistPromotionEmail(data.userEmail, {
        name: data.userName,
        eventName: data.eventName,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        confirmationId: data.confirmationId,
        eventLink: `/events/${data.eventId}`,
      });
      logger.info('Waitlist promotion event: Email delivery triggered successfully');
    } catch (error) {
      logger.error('Waitlist promotion event: Email delivery failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 2. Send Push Notification (Isolated)
    try {
      if (data.pushToken) {
        await sendPushNotification(data.pushToken, {
          title: '🎉 Waitlist Promotion',
          body: `You've been promoted for ${data.eventName}!`,
          data: {
            eventId: data.eventId,
            type: 'promotion',
          },
          link: `/events/${data.eventId}`,
          tag: 'promotion',
        });
        logger.info('Waitlist promotion event: Push notification triggered successfully');
      }
    } catch (error) {
      logger.error('Waitlist promotion event: Push notification failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 3. Broadcast event (WebSocket - Isolated)
    try {
      emitToRoom(getRoom('notifications'), 'waitlist-promotion', {
        userId: data.userId,
        eventId: data.eventId,
        timestamp: new Date(),
      });
      logger.info('Waitlist promotion event: WebSocket user broadcast sent');
    } catch (error) {
      logger.error('Waitlist promotion event: WebSocket user broadcast failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 4. Persist notification (Isolated)
    try {
      notificationsService.addNotification(data.userId || 'global', {
        type: 'mention',
        title: 'Waitlist Promotion',
        message: `You've been promoted for ${data.eventName}`,
        link: `/events/${data.eventId}`,
      });
      logger.info('Waitlist promotion event: Notification persisted');
    } catch (error) {
      logger.warn('Waitlist promotion event: Failed to persist notification', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 5. Notify admin dashboard (WebSocket - Isolated)
    try {
      emitToRoom(getRoom('admin'), 'admin:waitlist-promotion', {
        userId: data.userId,
        userName: data.userName,
        eventName: data.eventName,
        timestamp: new Date(),
      });
      logger.info('Waitlist promotion event: WebSocket admin broadcast sent');
    } catch (error) {
      logger.error('Waitlist promotion event: WebSocket admin broadcast failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }
  }

  /**
   * Handle event reminder event
   */
  async handleEventReminder(data) {
    logger.info('Event: Reminder sent processing started', { userId: data.userId, eventId: data.eventId });

    // 1. Send Email (Isolated)
    try {
      await sendEventReminderEmail(data.userEmail, {
        name: data.userName,
        eventName: data.eventName,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        eventLocation: data.eventLocation,
        timeUntilEvent: data.timeUntilEvent || 'soon',
        eventLink: `/events/${data.eventId}`,
      });
      logger.info('Event reminder event: Email delivery triggered successfully');
    } catch (error) {
      logger.error('Event reminder event: Email delivery failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 2. Send Push Notification (Isolated)
    try {
      if (data.pushToken) {
        await sendPushNotification(data.pushToken, {
          title: `⏰ ${data.eventName} is coming up!`,
          body: `Don't forget: ${data.eventName} on ${data.eventDate}`,
          data: {
            eventId: data.eventId,
            type: 'reminder',
          },
          link: `/events/${data.eventId}`,
          tag: 'reminder',
        });
        logger.info('Event reminder event: Push notification triggered successfully');
      }
    } catch (error) {
      logger.error('Event reminder event: Push notification failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 3. Notify user via WebSocket (WebSocket - Isolated)
    try {
      emitToRoom(getRoom('notifications'), 'event-reminder', {
        userId: data.userId,
        eventId: data.eventId,
        eventName: data.eventName,
        timestamp: new Date(),
      });
      logger.info('Event reminder event: WebSocket user broadcast sent');
    } catch (error) {
      logger.error('Event reminder event: WebSocket user broadcast failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 4. Persist notification (Isolated)
    try {
      notificationsService.addNotification(data.userId || 'global', {
        type: 'system',
        title: `Reminder: ${data.eventName}`,
        message: `${data.eventName} is starting soon`,
        link: `/events/${data.eventId}`,
      });
      logger.info('Event reminder event: Notification persisted');
    } catch (error) {
      logger.warn('Event reminder event: Failed to persist notification', { 
        userId: data.userId, 
        error: error.message 
      });
    }
  }

  /**
   * Handle attendance marked event
   */
  async handleAttendanceMarked(data) {
    logger.info('Event: Attendance marked processing started', { userId: data.userId, eventId: data.eventId });

    // 1. Send Email (Isolated)
    try {
      await sendAttendanceConfirmationEmail(data.userEmail, {
        name: data.userName,
        eventName: data.eventName,
        eventDate: data.eventDate,
        points: data.points,
      });
      logger.info('Attendance marked event: Email delivery triggered successfully');
    } catch (error) {
      logger.error('Attendance marked event: Email delivery failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 2. Send Push Notification (Isolated)
    try {
      if (data.pushToken) {
        await sendPushNotification(data.pushToken, {
          title: 'Attendance Marked',
          body: `Your attendance for ${data.eventName} has been recorded`,
          data: {
            eventId: data.eventId,
            points: data.points,
            type: 'attendance',
          },
        });
        logger.info('Attendance marked event: Push notification triggered successfully');
      }
    } catch (error) {
      logger.error('Attendance marked event: Push notification failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 3. Broadcast event (WebSocket - Isolated)
    try {
      emitToRoom(getRoom('notifications'), 'attendance-marked', {
        userId: data.userId,
        eventId: data.eventId,
        points: data.points,
        timestamp: new Date(),
      });
      logger.info('Attendance marked event: WebSocket user broadcast sent');
    } catch (error) {
      logger.error('Attendance marked event: WebSocket user broadcast failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 4. Persist notification (Isolated)
    try {
      notificationsService.addNotification(data.userId || 'global', {
        type: 'system',
        title: 'Attendance Marked',
        message: `Attendance for ${data.eventName} recorded. You earned ${data.points || 0} points.`,
        link: `/events/${data.eventId}`,
      });
      logger.info('Attendance marked event: Notification persisted');
    } catch (error) {
      logger.warn('Attendance marked event: Failed to persist notification', { 
        userId: data.userId, 
        error: error.message 
      });
    }

    // 5. Notify admin dashboard (WebSocket - Isolated)
    try {
      emitToRoom(getRoom('admin'), 'admin:attendance-marked', {
        userId: data.userId,
        userName: data.userName,
        eventName: data.eventName,
        points: data.points,
        timestamp: new Date(),
      });
      logger.info('Attendance marked event: WebSocket admin broadcast sent');
    } catch (error) {
      logger.error('Attendance marked event: WebSocket admin broadcast failed', { 
        userId: data.userId, 
        error: error.message 
      });
    }
  }

  /**
   * Emit custom event
   */
  emitEvent(eventName, data) {
    this.emit(eventName, data);
    logger.debug('Custom event emitted', { event: eventName });
  }
}

// Create singleton instance
const eventManager = new RealTimeEventManager();

export default eventManager;
