import assert from "node:assert/strict";
import test from "node:test";
import notificationsService from "../services/notificationsService.js";
import eventEmitterService from "../services/eventEmitterService.js";
import { setEmitToRoomOverride } from "../config/socket.js";

test("Realtime Event Emission Consistency & Persistence-Before-Broadcast Audit", async (t) => {
  let emittedEvents = [];
  let persistenceOrder = [];

  t.beforeEach(() => {
    emittedEvents = [];
    persistenceOrder = [];

    // Set up a mock for emitToRoom to track call order and arguments
    setEmitToRoomOverride((roomName, eventName, data) => {
      emittedEvents.push({
        roomName,
        eventName,
        data,
        timestamp: Date.now(),
      });
      persistenceOrder.push("broadcast");
    });
  });

  t.afterEach(() => {
    // Clear override after each subtest
    setEmitToRoomOverride(null);
  });

  await t.test(
    "Case 1: Successful notification persistence triggers broadcast sequentially",
    async () => {
      // Intercept notificationsService.addNotification to track order
      const originalAddNotification = notificationsService.addNotification;
      notificationsService.addNotification = (userId, payload) => {
        persistenceOrder.push("persist");
        return originalAddNotification(userId, payload);
      };

      const eventPayload = {
        userId: "user-123",
        eventId: "evt-456",
        userEmail: "user@example.com",
        userName: "Test User",
        eventName: "NexaSphere Workshop",
        eventDate: "2026-05-28",
        eventTime: "10:00 AM",
        eventLocation: "Auditorium",
      };

      // Emit the event to eventManager
      await eventEmitterService.handleRegistrationConfirmed(eventPayload);

      // Assert that both persistence and broadcasts happened (1 persist, 2 broadcasts: user and admin rooms)
      assert.equal(persistenceOrder.length, 3);
      // CRITICAL: Persistence MUST occur BEFORE broadcast
      assert.deepEqual(
        persistenceOrder,
        ["persist", "broadcast", "broadcast"],
        "Order violation: broadcast occurred before/during persistence!"
      );

      // Restore original method
      notificationsService.addNotification = originalAddNotification;
    }
  );

  await t.test("Case 2: Failed persistence NEVER emits event", async () => {
    // Simulate database/persistence failure by throwing an error
    const originalAddNotification = notificationsService.addNotification;
    notificationsService.addNotification = () => {
      persistenceOrder.push("persist-failed");
      throw new Error("Durable persistence database write failed!");
    };

    const eventPayload = {
      userId: "user-123",
      eventId: "evt-456",
      userEmail: "user@example.com",
      userName: "Test User",
      eventName: "NexaSphere Workshop",
      eventDate: "2026-05-28",
      eventTime: "10:00 AM",
      eventLocation: "Auditorium",
    };

    // Trigger the event
    await eventEmitterService.handleRegistrationConfirmed(eventPayload);

    // Verify persistence failed and NO broadcast occurred
    assert.deepEqual(persistenceOrder, ["persist-failed"]);
    assert.equal(
      emittedEvents.length,
      0,
      "Phantom emission occurred despite database write failure!"
    );

    // Restore original method
    notificationsService.addNotification = originalAddNotification;
  });

  await t.test(
    "Case 3: Attendance Marked successful persistence triggers broadcast sequentially",
    async () => {
      const originalAddNotification = notificationsService.addNotification;
      notificationsService.addNotification = (userId, payload) => {
        persistenceOrder.push("persist");
        return originalAddNotification(userId, payload);
      };

      const eventPayload = {
        userId: "user-123",
        eventId: "evt-456",
        userEmail: "user@example.com",
        userName: "Test User",
        eventName: "NexaSphere Workshop",
        eventDate: "2026-05-28",
        points: 15,
      };

      await eventEmitterService.handleAttendanceMarked(eventPayload);

      // 1 persist, 2 broadcasts (user notifications and admin dashboard notifications)
      assert.equal(persistenceOrder.length, 3);
      assert.deepEqual(
        persistenceOrder,
        ["persist", "broadcast", "broadcast"],
        "Order violation in attendance marking event!"
      );

      notificationsService.addNotification = originalAddNotification;
    }
  );

  await t.test(
    "Case 4: Attendance Marked failed persistence NEVER emits",
    async () => {
      const originalAddNotification = notificationsService.addNotification;
      notificationsService.addNotification = () => {
        persistenceOrder.push("persist-failed");
        throw new Error("Attendance persistence database write failed!");
      };

      const eventPayload = {
        userId: "user-123",
        eventId: "evt-456",
        userEmail: "user@example.com",
        userName: "Test User",
        eventName: "NexaSphere Workshop",
        eventDate: "2026-05-28",
        points: 15,
      };

      await eventEmitterService.handleAttendanceMarked(eventPayload);

      assert.deepEqual(persistenceOrder, ["persist-failed"]);
      assert.equal(
        emittedEvents.length,
        0,
        "Phantom emission occurred in attendance marking!"
      );

      notificationsService.addNotification = originalAddNotification;
    }
  );

  await t.test(
    "Case 5: Waitlist promotion and event reminder consistency check",
    async () => {
      const originalAddNotification = notificationsService.addNotification;
      notificationsService.addNotification = (userId, payload) => {
        persistenceOrder.push("persist");
        return originalAddNotification(userId, payload);
      };

      // Waitlist promotion (1 persist, 2 broadcasts)
      persistenceOrder = [];
      await eventEmitterService.handleWaitlistPromotion({
        userId: "user-123",
        eventId: "evt-456",
        userEmail: "user@example.com",
        userName: "Test User",
        eventName: "NexaSphere Workshop",
        eventDate: "2026-05-28",
        eventTime: "10:00 AM",
        confirmationId: "conf-123",
      });
      assert.deepEqual(persistenceOrder, ["persist", "broadcast", "broadcast"]);

      // Event reminder (1 persist, 1 broadcast)
      persistenceOrder = [];
      await eventEmitterService.handleEventReminder({
        userId: "user-123",
        eventId: "evt-456",
        userEmail: "user@example.com",
        userName: "Test User",
        eventName: "NexaSphere Workshop",
        eventDate: "2026-05-28",
        eventTime: "10:00 AM",
      });
      assert.deepEqual(persistenceOrder, ["persist", "broadcast"]);

      notificationsService.addNotification = originalAddNotification;
    }
  );
});
