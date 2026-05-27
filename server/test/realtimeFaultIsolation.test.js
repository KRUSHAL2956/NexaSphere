import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import eventManager from '../services/eventEmitterService.js';
import { setSendEmailOverride } from '../services/emailService.js';
import { setSendPushNotificationOverride } from '../services/pushNotificationService.js';
import { setEmitToRoomOverride } from '../config/socket.js';
import notificationsService from '../services/notificationsService.js';

describe('Real-Time Event Manager Fault Isolation', () => {
  let wsEmissions = [];
  let persistedNotifications = [];
  let emailCalled = false;
  let pushCalled = false;

  before(() => {
    // Clear notifications store before testing
    notificationsService.clearAll('user-123');
    notificationsService.clearAll('global');
  });

  beforeEach(() => {
    wsEmissions = [];
    persistedNotifications = [];
    emailCalled = false;
    pushCalled = false;

    // Spy on WebSocket room emissions using safe setter
    setEmitToRoomOverride((roomName, eventName, data) => {
      wsEmissions.push({ roomName, eventName, data });
    });

    // Mock SMTP to simulate complete provider outage / timeout using safe setter
    setSendEmailOverride(async (options) => {
      emailCalled = true;
      throw new Error('SMTP Outage: connection refused / auth expired');
    });

    // Mock Push Notification to simulate expired VAPID/credentials failure using safe setter
    setSendPushNotificationOverride(async (userToken, notification) => {
      pushCalled = true;
      throw new Error('FCM Service Outage: invalid credentials / token expired');
    });

    // Intercept/Spy on notification persistence
    const originalAdd = notificationsService.addNotification;
    notificationsService.addNotification = (userId, payload) => {
      const result = originalAdd(userId, payload);
      persistedNotifications.push({ userId, payload, id: result.id });
      return result;
    };
    notificationsService.addNotification.original = originalAdd;
  });

  afterEach(() => {
    // Clean up all overrides to prevent leak between tests
    setEmitToRoomOverride(null);
    setSendEmailOverride(null);
    setSendPushNotificationOverride(null);

    if (notificationsService.addNotification.original) {
      notificationsService.addNotification = notificationsService.addNotification.original;
    }
  });

  test('1. Registration Confirmed event survives SMTP & push notification outages', async (t) => {
    const payload = {
      userId: 'user-123',
      userEmail: 'alice@example.com',
      userName: 'Alice Smith',
      eventId: 'event-abc',
      eventName: 'NexaSphere Tech Summit',
      eventDate: 'June 15, 2026',
      eventTime: '10:00 AM',
      eventLocation: 'Silicon Valley Center',
      pushToken: 'mock-fcm-token',
    };

    // Emit event (event manager handles this asynchronously inside bounds)
    eventManager.emitEvent('registration-confirmed', payload);

    // Give asynchronous event loop microtasks time to execute fully
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assertions
    assert.strictEqual(emailCalled, true, 'Email service must have been triggered');
    assert.strictEqual(pushCalled, true, 'Push notification service must have been triggered');

    // Verify WebSocket room emissions executed successfully for both user room and admin dashboard
    const userWSEvent = wsEmissions.find((e) => e.eventName === 'registration-confirmed');
    assert.ok(userWSEvent, 'WebSocket user notification must have been sent');
    assert.strictEqual(userWSEvent.roomName, 'notifications-room', 'Should be sent to notifications room');
    assert.strictEqual(userWSEvent.data.userId, 'user-123');
    assert.strictEqual(userWSEvent.data.eventName, 'NexaSphere Tech Summit');

    const adminWSEvent = wsEmissions.find((e) => e.eventName === 'admin:new-registration');
    assert.ok(adminWSEvent, 'WebSocket admin notification must have been sent');
    assert.strictEqual(adminWSEvent.roomName, 'admin-room', 'Should be sent to admin room');
    assert.strictEqual(adminWSEvent.data.userName, 'Alice Smith');

    // Verify Notification was safely stored in local database/cache
    assert.strictEqual(persistedNotifications.length, 1, 'Exactly 1 notification should be persisted');
    assert.strictEqual(persistedNotifications[0].userId, 'user-123');
    assert.strictEqual(persistedNotifications[0].payload.title, 'Registration Confirmed');
  });

  test('2. Waitlist Promotion event survives SMTP & push notification outages', async (t) => {
    const payload = {
      userId: 'user-123',
      userEmail: 'alice@example.com',
      userName: 'Alice Smith',
      eventId: 'event-abc',
      eventName: 'NexaSphere Tech Summit',
      eventDate: 'June 15, 2026',
      eventTime: '10:00 AM',
      confirmationId: 'waitlist-promo-999',
      pushToken: 'mock-fcm-token',
    };

    eventManager.emitEvent('waitlist-promotion', payload);
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(emailCalled, true);
    assert.strictEqual(pushCalled, true);

    const userWSEvent = wsEmissions.find((e) => e.eventName === 'waitlist-promotion');
    assert.ok(userWSEvent);
    assert.strictEqual(userWSEvent.roomName, 'notifications-room');

    const adminWSEvent = wsEmissions.find((e) => e.eventName === 'admin:waitlist-promotion');
    assert.ok(adminWSEvent);
    assert.strictEqual(adminWSEvent.roomName, 'admin-room');

    assert.strictEqual(persistedNotifications.length, 1);
    assert.strictEqual(persistedNotifications[0].payload.title, 'Waitlist Promotion');
  });

  test('3. Event Reminder event survives SMTP & push notification outages', async (t) => {
    const payload = {
      userId: 'user-123',
      userEmail: 'alice@example.com',
      userName: 'Alice Smith',
      eventId: 'event-abc',
      eventName: 'NexaSphere Tech Summit',
      eventDate: 'June 15, 2026',
      eventTime: '10:00 AM',
      eventLocation: 'Silicon Valley Center',
      timeUntilEvent: 'tomorrow',
      pushToken: 'mock-fcm-token',
    };

    eventManager.emitEvent('event-reminder', payload);
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(emailCalled, true);
    assert.strictEqual(pushCalled, true);

    const userWSEvent = wsEmissions.find((e) => e.eventName === 'event-reminder');
    assert.ok(userWSEvent);
    assert.strictEqual(userWSEvent.roomName, 'notifications-room');

    assert.strictEqual(persistedNotifications.length, 1);
    assert.strictEqual(persistedNotifications[0].payload.title, 'Reminder: NexaSphere Tech Summit');
  });

  test('4. Attendance Marked event survives SMTP & push notification outages', async (t) => {
    const payload = {
      userId: 'user-123',
      userEmail: 'alice@example.com',
      userName: 'Alice Smith',
      eventId: 'event-abc',
      eventName: 'NexaSphere Tech Summit',
      eventDate: 'June 15, 2026',
      points: 100,
      pushToken: 'mock-fcm-token',
    };

    eventManager.emitEvent('attendance-marked', payload);
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(emailCalled, true);
    assert.strictEqual(pushCalled, true);

    const userWSEvent = wsEmissions.find((e) => e.eventName === 'attendance-marked');
    assert.ok(userWSEvent);
    assert.strictEqual(userWSEvent.roomName, 'notifications-room');
    assert.strictEqual(userWSEvent.data.points, 100);

    const adminWSEvent = wsEmissions.find((e) => e.eventName === 'admin:attendance-marked');
    assert.ok(adminWSEvent);
    assert.strictEqual(adminWSEvent.roomName, 'admin-room');
    assert.strictEqual(adminWSEvent.data.points, 100);

    assert.strictEqual(persistedNotifications.length, 1);
    assert.strictEqual(persistedNotifications[0].payload.title, 'Attendance Marked');
  });
});
