import assert from "node:assert/strict";
import test from "node:test";

// Setup environment variables in execution order before dotenv loads in the module
process.env.ADMIN_EVENT_PASSWORD = "StrongPassword123!@#";
process.env.ADMIN_PASSWORD = "StrongPassword123!@#";
process.env.SUPABASE_URL = "https://mock-supabase.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-key";

// Intercept and mock global fetch
const originalFetch = globalThis.fetch;
let fetchCalls = [];
let fetchMockResponse = () => ({ ok: true, text: async () => "[]" });

globalThis.fetch = async (url, options) => {
  fetchCalls.push({ url, options });
  return fetchMockResponse(url, options);
};

// Use dynamic ESM import to ensure it executes after env variables are configured
const indexModule = await import("../index.js");
const {
  supabaseRequest,
  isSupabaseDuplicateKeyError,
  createEventStore,
} = indexModule;

test.beforeEach(() => {
  fetchCalls = [];
});

test("isSupabaseDuplicateKeyError correctly identifies unique key violations", () => {
  // Test case 1: HTTP 409
  const err409 = new Error("Supabase error (409)");
  err409.status = 409;
  assert.equal(isSupabaseDuplicateKeyError(err409), true);

  // Test case 2: PostgREST error body code 23505
  const errCode = new Error("Unique constraint violation");
  errCode.body = { code: "23505", message: "duplicate key" };
  assert.equal(isSupabaseDuplicateKeyError(errCode), true);

  // Test case 3: String message fallback
  const errText = new Error("duplicate key value violates unique constraint");
  assert.equal(isSupabaseDuplicateKeyError(errText), true);

  // Test case 4: Non-duplicate errors are rejected
  const err500 = new Error("Supabase error (500)");
  err500.status = 500;
  assert.equal(isSupabaseDuplicateKeyError(err500), false);

  const err429 = new Error("Supabase error (429)");
  err429.status = 429;
  assert.equal(isSupabaseDuplicateKeyError(err429), false);
});

test("createEventStore inserts event successfully on first try when no collisions occur", async () => {
  const mockRow = {
    id: "kss-154",
    name: "Mock Event",
    short_name: "Mock",
    date_text: "2026-05-27",
    description: "Successful mock insert",
    status: "upcoming",
    icon: "Calendar",
    tags: ["test"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  fetchMockResponse = async () => ({
    ok: true,
    text: async () => JSON.stringify([mockRow]),
  });

  const event = {
    id: "kss-154",
    name: "Mock Event",
    shortName: "Mock",
    date: "2026-05-27",
    description: "Successful mock insert",
    status: "upcoming",
    icon: "Calendar",
    tags: ["test"],
  };

  const result = await createEventStore(event);

  assert.equal(result.id, "kss-154");
  assert.equal(result.name, "Mock Event");
  assert.equal(fetchCalls.length, 1);
});

test("createEventStore retries exactly once and succeeds when first request fails with duplicate key error", async () => {
  const mockRow = {
    id: "kss-154-suffix",
    name: "Mock Event",
    short_name: "Mock",
    date_text: "2026-05-27",
    description: "Retry success",
    status: "upcoming",
    icon: "Calendar",
    tags: ["test"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let tryCount = 0;
  fetchMockResponse = async () => {
    tryCount++;
    if (tryCount === 1) {
      return {
        ok: false,
        status: 409,
        text: async () => JSON.stringify({ code: "23505", message: "duplicate key exists" }),
      };
    }
    return {
      ok: true,
      text: async () => JSON.stringify([mockRow]),
    };
  };

  const event = {
    id: "kss-154",
    name: "Mock Event",
    shortName: "Mock",
    date: "2026-05-27",
    description: "Retry success",
    status: "upcoming",
    icon: "Calendar",
    tags: ["test"],
  };

  const result = await createEventStore(event);

  assert.equal(result.id, "kss-154-suffix");
  assert.equal(fetchCalls.length, 2);
  assert.ok(fetchCalls[1].options.body.includes("-")); // Should contain the suffix
});

test("createEventStore immediately rejects and does NOT retry on a 500 outage error", async () => {
  fetchMockResponse = async () => ({
    ok: false,
    status: 500,
    text: async () => "Internal Server Error",
  });

  const event = {
    id: "kss-154",
    name: "Mock Event",
    shortName: "Mock",
    date: "2026-05-27",
    description: "Outage fail",
    status: "upcoming",
    icon: "Calendar",
    tags: ["test"],
  };

  await assert.rejects(async () => {
    await createEventStore(event);
  }, /Supabase error \(500\)/);

  assert.equal(fetchCalls.length, 1, "Should immediately fail without triggering any retry storm");
});

test("createEventStore immediately rejects and does NOT retry on a 429 rate limit error", async () => {
  fetchMockResponse = async () => ({
    ok: false,
    status: 429,
    text: async () => "Too Many Requests",
  });

  const event = {
    id: "kss-154",
    name: "Mock Event",
    shortName: "Mock",
    date: "2026-05-27",
    description: "Rate limit fail",
    status: "upcoming",
    icon: "Calendar",
    tags: ["test"],
  };

  await assert.rejects(async () => {
    await createEventStore(event);
  }, /Supabase error \(429\)/);

  assert.equal(fetchCalls.length, 1, "Should immediately fail without triggering any retry storm");
});

test("createEventStore immediately rejects and does NOT retry on network timeout/connection failures", async () => {
  fetchMockResponse = async () => {
    throw new TypeError("fetch failed");
  };

  const event = {
    id: "kss-154",
    name: "Mock Event",
    shortName: "Mock",
    date: "2026-05-27",
    description: "Connection fail",
    status: "upcoming",
    icon: "Calendar",
    tags: ["test"],
  };

  await assert.rejects(async () => {
    await createEventStore(event);
  }, /fetch failed/);

  assert.equal(fetchCalls.length, 1, "Should immediately fail without triggering any retry storm");
});
