import { test, describe, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert';

describe('Google Apps Script Resilient Proxy SRE Audit', () => {
  let app;
  let _getMembershipCache;
  let _setMembershipCache;
  let _clearMembershipCache;

  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  
  let fetchCallCount = 0;
  let fetchDelayMs = 0;
  let shouldFetchFail = false;
  let mockFetchResponses = { responses: [{ id: 1, name: 'Alice' }] };

  before(async () => {
    // 1. Configure environment variables synchronously before dynamically importing app
    process.env.ADMIN_USERNAME = 'admin_user';
    process.env.ADMIN_PASSWORD = 'AdminStrongPass123!';
    process.env.ADMIN_EVENT_PASSWORD = 'EventStrongPass123!';

    // 2. Dynamically import app to avoid hoisting order conflicts
    const module = await import('../index.js');
    app = module.default;
    _getMembershipCache = module._getMembershipCache;
    _setMembershipCache = module._setMembershipCache;
    _clearMembershipCache = module._clearMembershipCache;
  });

  beforeEach(() => {
    fetchCallCount = 0;
    fetchDelayMs = 0;
    shouldFetchFail = false;
    if (_clearMembershipCache) _clearMembershipCache();

    // Re-populate env vars for every test case
    process.env.MEMBERSHIP_SCRIPT_URL = 'https://script.google.com/macros/s/mock-script-id/exec';
    process.env.MEMBERSHIP_SECRET = 'mock-secret-token';
    process.env.MEMBERSHIP_CACHE_TTL_MS = '1000'; // Keep cache TTL low (1s) to allow expiration tests
    process.env.MEMBERSHIP_TIMEOUT_MS = '200'; // Keep timeout low (200ms) to allow timeout tests

    // Configure global fetch mock with high-fidelity AbortSignal support
    global.fetch = async (url, options) => {
      fetchCallCount++;
      const signal = options?.signal;

      if (fetchDelayMs > 0) {
        if (signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, fetchDelayMs);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        });
      }

      if (shouldFetchFail) {
        throw new Error('Network error / DNS resolution failed');
      }

      return {
        ok: true,
        status: 200,
        async json() {
          return mockFetchResponses;
        }
      };
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (_clearMembershipCache) _clearMembershipCache();
  });

  after(() => {
    global.fetch = originalFetch;
  });

  test('1. Graceful return of empty array if MEMBERSHIP_SCRIPT_URL or MEMBERSHIP_SECRET is missing', async (t) => {
    delete process.env.MEMBERSHIP_SCRIPT_URL;
    
    const req = { headers: {} };
    let responseData = null;
    const res = {
      json(data) {
        responseData = data;
        return this;
      },
      setHeader() {}
    };

    const route = app._router.stack.find(
      (layer) => layer.route && layer.route.path === '/api/admin/membership'
    );
    assert.ok(route);
    
    const handler = route.route.stack[route.route.stack.length - 1].handle;
    await handler(req, res);
    
    assert.deepStrictEqual(responseData, { responses: [] });
  });

  test('2. Successful outbound request updates in-memory cache and returns MISS on first run', async (t) => {
    const req = { headers: {} };
    let responseData = null;
    let cacheHeader = null;
    const res = {
      json(data) {
        responseData = data;
        return this;
      },
      setHeader(name, value) {
        if (name.toLowerCase() === 'x-cache') cacheHeader = value;
      }
    };

    const route = app._router.stack.find(
      (layer) => layer.route && layer.route.path === '/api/admin/membership'
    );
    const handler = route.route.stack[route.route.stack.length - 1].handle;
    
    await handler(req, res);

    assert.strictEqual(fetchCallCount, 1, 'Must trigger exactly 1 outbound fetch');
    assert.strictEqual(cacheHeader, 'MISS');
    assert.deepStrictEqual(responseData, { responses: [{ id: 1, name: 'Alice' }] });
    
    assert.deepStrictEqual(_getMembershipCache(), [{ id: 1, name: 'Alice' }]);
  });

  test('3. Cache HIT serves fresh cached data and bypasses external fetch', async (t) => {
    _setMembershipCache([{ id: 2, name: 'Bob' }]);

    const req = { headers: {} };
    let responseData = null;
    let cacheHeader = null;
    const res = {
      json(data) {
        responseData = data;
        return this;
      },
      setHeader(name, value) {
        if (name.toLowerCase() === 'x-cache') cacheHeader = value;
      }
    };

    const route = app._router.stack.find(
      (layer) => layer.route && layer.route.path === '/api/admin/membership'
    );
    const handler = route.route.stack[route.route.stack.length - 1].handle;
    
    await handler(req, res);

    assert.strictEqual(fetchCallCount, 0, 'Must NOT trigger any outbound fetch');
    assert.strictEqual(cacheHeader, 'HIT');
    assert.deepStrictEqual(responseData, { responses: [{ id: 2, name: 'Bob' }] });
  });

  test('4. Concurrent duplicate requests are collapsed into a single outbound fetch', async (t) => {
    fetchDelayMs = 50;

    const route = app._router.stack.find(
      (layer) => layer.route && layer.route.path === '/api/admin/membership'
    );
    const handler = route.route.stack[route.route.stack.length - 1].handle;

    const req = { headers: {} };
    let res1Data = null, res2Data = null;
    let res1Header = null, res2Header = null;

    const res1 = {
      json(data) { res1Data = data; return this; },
      setHeader(name, value) { if (name.toLowerCase() === 'x-cache') res1Header = value; }
    };
    const res2 = {
      json(data) { res2Data = data; return this; },
      setHeader(name, value) { if (name.toLowerCase() === 'x-cache') res2Header = value; }
    };

    await Promise.all([
      handler(req, res1),
      handler(req, res2)
    ]);

    assert.strictEqual(fetchCallCount, 1, 'Must collapse concurrent requests into exactly 1 outbound fetch');
    assert.strictEqual(res1Header, 'MISS', 'First concurrent request starts the fetch');
    assert.strictEqual(res2Header, 'COLLAPSED', 'Second concurrent request collapses into first fetch');
    assert.deepStrictEqual(res1Data, { responses: [{ id: 1, name: 'Alice' }] });
    assert.deepStrictEqual(res2Data, { responses: [{ id: 1, name: 'Alice' }] });
  });

  test('5. Stale Fallback successfully activates on external fetch failures', async (t) => {
    _setMembershipCache([{ id: 3, name: 'Charlie' }], Date.now() - 50000);
    shouldFetchFail = true;

    const req = { headers: {} };
    let responseData = null;
    let cacheHeader = null;
    const res = {
      json(data) {
        responseData = data;
        return this;
      },
      setHeader(name, value) {
        if (name.toLowerCase() === 'x-cache') cacheHeader = value;
      }
    };

    const route = app._router.stack.find(
      (layer) => layer.route && layer.route.path === '/api/admin/membership'
    );
    const handler = route.route.stack[route.route.stack.length - 1].handle;
    
    await handler(req, res);

    assert.strictEqual(fetchCallCount, 1, 'Must attempt outbound fetch');
    assert.strictEqual(cacheHeader, 'STALE', 'Must serve expired cache gracefully rather than throwing 500');
    assert.deepStrictEqual(responseData, { responses: [{ id: 3, name: 'Charlie' }] });
  });

  test('6. Slow external requests are terminated by AbortController and return stale cache fallback', async (t) => {
    _setMembershipCache([{ id: 4, name: 'Dave' }], Date.now() - 50000);
    fetchDelayMs = 400;

    const req = { headers: {} };
    let responseData = null;
    let cacheHeader = null;
    const res = {
      json(data) {
        responseData = data;
        return this;
      },
      setHeader(name, value) {
        if (name.toLowerCase() === 'x-cache') cacheHeader = value;
      }
    };

    const route = app._router.stack.find(
      (layer) => layer.route && layer.route.path === '/api/admin/membership'
    );
    const handler = route.route.stack[route.route.stack.length - 1].handle;
    
    await handler(req, res);

    assert.strictEqual(cacheHeader, 'STALE', 'Slow requests must trigger stale fallback gracefully');
    assert.deepStrictEqual(responseData, { responses: [{ id: 4, name: 'Dave' }] });
  });
});
