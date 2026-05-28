import assert from "node:assert/strict";
import test from "node:test";
import cacheService from "../services/cacheService.js";
import { eventsService } from "../services/eventsService.js";
import { coreTeamService } from "../services/coreTeamService.js";
import { activityEventsService } from "../services/activityEventsService.js";
import notificationsService from "../services/notificationsService.js";
import { setWithDbOverride } from "../repositories/db.js";

let dbQueries = [];
let mockClient;

test.before(() => {
  // Set up mock PostgreSQL client to intercept mutations and NOTIFY calls
  mockClient = {
    query: async (sql, params) => {
      dbQueries.push({ sql, params });

      // Stub responses for event/core team queries to keep tests isolated and fast
      if (sql.includes("select count(*)")) {
        return { rows: [{ total: 1 }] };
      }
      if (sql.includes("select * from events")) {
        return {
          rows: [{ id: "ev-1", name: "Original Event", status: "upcoming" }],
        };
      }
      if (sql.includes("insert into events") || sql.includes("update events")) {
        return {
          rows: [{ id: "ev-1", name: "Mutated Event", status: "upcoming" }],
        };
      }
      if (sql.includes("delete from events")) {
        return { rowCount: 1 };
      }
      if (sql.includes("select id, name, email")) {
        return { rows: [{ id: "mem-1", name: "Ayush Sharma" }] };
      }
      if (sql.includes("insert into core_team_members")) {
        return {
          rows: [
            {
              id: "mem-1",
              name: "Ayush Sharma",
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  setWithDbOverride(async (fn) => {
    return await fn(mockClient);
  });
});

test.after(() => {
  // Restore override
  setWithDbOverride(null);
  cacheService.closeCacheListener();
});

test.beforeEach(() => {
  dbQueries = [];
  cacheService.localEvict("events");
  cacheService.localEvict("core_team");
  cacheService.localEvict("activity_events");
});

test("Distributed Cache Invalidation - Flow Validation", async (t) => {
  await t.test(
    "1. Verify cache is populated on read and subsequent reads hit the cache",
    async () => {
      // First read: cache miss
      const res1 = await eventsService.listEvents({ page: 1, limit: 10 });
      assert.equal(res1.rows[0].name, "Original Event");

      // Check database was called
      const selectQueries = dbQueries.filter((q) =>
        q.sql.includes("select * from events")
      );
      assert.equal(selectQueries.length, 1);

      // Seed custom value in cache to prove subsequent reads hit the cache directly
      cacheService.set("events:list:1:10", {
        rows: [{ id: "ev-1", name: "Cached Event" }],
      });

      // Second read: cache hit
      const res2 = await eventsService.listEvents({ page: 1, limit: 10 });
      assert.equal(res2.rows[0].name, "Cached Event");

      // No new database queries should have run
      const selectQueries2 = dbQueries.filter((q) =>
        q.sql.includes("select * from events")
      );
      assert.equal(selectQueries2.length, 1);
    }
  );

  await t.test(
    "2. Verify database mutations invalidate the cache globally via NOTIFY",
    async () => {
      // Populate cache again
      await eventsService.listEvents({ page: 1, limit: 10 });

      // Execute a mutation
      dbQueries = [];
      const updated = await eventsService.updateEvent("ev-1", {
        name: "Mutated Event",
      });
      assert.ok(updated);

      // Verify a PostgreSQL NOTIFY call was sent to alert other instances
      const notifyQuery = dbQueries.find((q) =>
        q.sql.includes("NOTIFY cache_invalidation")
      );
      assert.ok(notifyQuery, "Must broadcast invalidation via LISTEN/NOTIFY");
      assert.ok(
        notifyQuery.sql.includes("events"),
        "Must invalidate the events channel"
      );

      // Subsequent read must be a cache miss and fetch from DB
      dbQueries = [];
      const res = await eventsService.listEvents({ page: 1, limit: 10 });
      assert.equal(res.rows[0].name, "Original Event"); // Back to original stub event

      const dbCall = dbQueries.find((q) =>
        q.sql.includes("select * from events")
      );
      assert.ok(
        dbCall,
        "Must fetch fresh data from database after invalidation"
      );
    }
  );

  await t.test(
    "3. Verify cache version increment matches invalidations",
    async () => {
      const v1 = cacheService.getChannelVersion("events");
      await cacheService.invalidateCache("events");
      const v2 = cacheService.getChannelVersion("events");
      assert.notEqual(
        v1,
        v2,
        "Cache channel version counter must increment on mutation"
      );
    }
  );
});

test("Distributed Notifications Synchronization - Multi-Instance Consistency", async (t) => {
  await t.test(
    "1. Verify adding notification broadcasts a sync event and invokes other instances correctly",
    async () => {
      dbQueries = [];

      // Reset global store for deterministic check
      notificationsService.clearAll("global");
      dbQueries = []; // clear clearAll broadcast query

      // Perform notification creation on Instance A
      const payload = {
        title: "New Event",
        message: "KSS is starting",
        type: "system",
      };
      const note = notificationsService.addNotification("global", payload);
      assert.ok(note.id);

      // Assert sync sync notification NOTIFY query was sent to Postgres
      const notifyQuery = dbQueries.find((q) =>
        q.sql.includes("NOTIFY notification_sync")
      );
      assert.ok(
        notifyQuery,
        "Instance A must broadcast notification sync events to all other instances"
      );
      assert.ok(
        notifyQuery.sql.includes("KSS is starting"),
        "Broadcast message must carry the notification payload"
      );
    }
  );

  await t.test(
    "2. Verify other instances consume sync notification payload into memory without duplicate loops",
    async () => {
      notificationsService.clearAll("global");

      const mockNotificationPayload = {
        id: "sync-id-999",
        title: "Synced from Instance B",
        message: "Hello World",
        type: "mention",
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      // Simulate standard incoming PostgreSQL notification_sync trigger message
      const listBefore = notificationsService.getNotifications("global");
      assert.equal(listBefore.filter((n) => n.id === "sync-id-999").length, 0);

      // Call local sync handlers mimicking pg listener trigger
      notificationsService._localAddNotification(
        "global",
        mockNotificationPayload
      );

      // Verify in-memory state converges across instances
      const listAfter = notificationsService.getNotifications("global");
      const synced = listAfter.find((n) => n.id === "sync-id-999");
      assert.ok(synced);
      assert.equal(synced.title, "Synced from Instance B");
    }
  );
});
