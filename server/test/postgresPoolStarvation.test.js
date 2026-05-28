import { test, describe, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { withDb, setCustomPool } from "../repositories/db.js";

describe("PostgreSQL Connection Pool Starvation Hardening & Lifecycle Safety", () => {
  const originalEnv = { ...process.env };
  let originalWarn;
  let warnLogs = [];

  before(() => {
    originalWarn = console.warn;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    warnLogs = [];
    console.warn = (...args) => {
      warnLogs.push(args.join(" "));
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    console.warn = originalWarn;
    setCustomPool(null);
  });

  test("1. Normal execution completes successfully within timeout without warning", async () => {
    // High safety limits
    process.env.DB_HOLD_WARN_MS = "100";
    process.env.DB_HOLD_TIMEOUT_MS = "500";

    let releasedCount = 0;
    const mockClient = {
      query: async () => ({ rows: [1] }),
      release: () => {
        releasedCount++;
      },
    };

    const mockPool = {
      connect: async () => mockClient,
    };

    setCustomPool(mockPool);

    const res = await withDb(async (client) => {
      const q = await client.query();
      return q.rows[0];
    });

    assert.strictEqual(res, 1);
    assert.strictEqual(
      releasedCount,
      1,
      "Client must be released exactly once"
    );
    assert.strictEqual(
      warnLogs.length,
      0,
      "No warning should be logged for fast operations"
    );
  });

  test("2. Slow execution triggers warning but completes successfully", async () => {
    // Low warning threshold to trigger warning
    process.env.DB_HOLD_WARN_MS = "10";
    process.env.DB_HOLD_TIMEOUT_MS = "500";

    let releasedCount = 0;
    const mockClient = {
      release: () => {
        releasedCount++;
      },
    };

    const mockPool = {
      connect: async () => mockClient,
    };

    setCustomPool(mockPool);

    await withDb(async (client) => {
      // Simulate external delay longer than warning threshold (10ms) but shorter than timeout (500ms)
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    assert.strictEqual(releasedCount, 1, "Client must still be released");
    const warningLogged = warnLogs.some((log) =>
      log.includes("Possible connection pool starvation hazard")
    );
    const perfLogged = warnLogs.some((log) => log.includes("[DB PERF]"));
    assert.ok(warningLogged, "Starvation hazard warning must be logged");
    assert.ok(perfLogged, "Performance hold time metric must be logged");
  });

  test("3. Hanging database callback triggers timeout and releases connection", async () => {
    // Hard warning and low timeout thresholds
    process.env.DB_HOLD_WARN_MS = "10";
    process.env.DB_HOLD_TIMEOUT_MS = "50";

    let releasedCount = 0;
    const mockClient = {
      release: () => {
        releasedCount++;
      },
    };

    const mockPool = {
      connect: async () => mockClient,
    };

    setCustomPool(mockPool);

    await assert.rejects(async () => {
      await withDb(async (client) => {
        // Simulate hanging operation (e.g., waiting for SMTP server or API call)
        await new Promise((resolve) => setTimeout(resolve, 200));
      });
    }, /Database transaction timed out/);

    assert.strictEqual(
      releasedCount,
      1,
      "Client must be guaranteed to release even on hard timeouts"
    );
    const perfLogged = warnLogs.some((log) => log.includes("[DB PERF]"));
    assert.ok(
      perfLogged,
      "Performance hold time must still be logged in finally block"
    );
  });
});
