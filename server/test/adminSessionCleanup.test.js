import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setWithDbOverride } from '../repositories/db.js';
import {
  createAdminSession,
  getAdminSession,
  revokeAdminSession,
  cleanupExpiredAdminSessions,
  startAdminSessionCleanup,
  triggerLazyCleanup,
} from '../repositories/adminSessionsRepository.js';

describe('Admin Session Cleanup Serverless Resilience', () => {
  const originalEnv = { ...process.env };
  
  // In-memory mock database of sessions
  let mockSessions = [];
  let queryCount = 0;

  before(() => {
    // Intercept withDb using safe setter to inject our high-fidelity mock client
    setWithDbOverride(async (fn) => {
      const mockClient = {
        async query(sql, params = []) {
          queryCount++;
          const cleanedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

          // 1. Handle ensureSchema / ensureReady
          if (cleanedSql.includes('create table') || cleanedSql.includes('create index')) {
            return { rows: [], rowCount: 0 };
          }

          // 2. Handle insert session (createAdminSession)
          if (cleanedSql.includes('insert into admin_sessions')) {
            const [token_hash, username, metadata, expires_at] = params;
            // Evict if exists on conflict
            mockSessions = mockSessions.filter(s => s.token_hash !== token_hash);
            const newSession = {
              token_hash,
              username,
              metadata: typeof metadata === 'string' ? JSON.parse(metadata || '{}') : (metadata || {}),
              created_at: new Date(),
              last_seen_at: new Date(),
              expires_at: new Date(expires_at),
              revoked_at: null,
            };
            mockSessions.push(newSession);
            return { rows: [newSession], rowCount: 1 };
          }

          // 3. Handle select session (getAdminSession)
          if (cleanedSql.includes('select token_hash') && cleanedSql.includes('where token_hash = $1')) {
            const tokenHash = params[0];
            const now = new Date();
            const matching = mockSessions.filter(
              s => s.token_hash === tokenHash && s.revoked_at === null && s.expires_at > now
            );
            return { rows: matching, rowCount: matching.length };
          }

          // 4. Handle specific delete (expired session on failure in getAdminSession)
          if (cleanedSql.includes('delete from admin_sessions where token_hash = $1')) {
            const tokenHash = params[0];
            const originalLength = mockSessions.length;
            mockSessions = mockSessions.filter(s => s.token_hash !== tokenHash);
            return { rows: [], rowCount: originalLength - mockSessions.length };
          }

          // 5. Handle update last seen
          if (cleanedSql.includes('update admin_sessions set last_seen_at = now()')) {
            const tokenHash = params[0];
            mockSessions.forEach(s => {
              if (s.token_hash === tokenHash) s.last_seen_at = new Date();
            });
            return { rows: [], rowCount: 1 };
          }

          // 6. Handle revoke session (revokeAdminSession)
          if (cleanedSql.includes('update admin_sessions set revoked_at = now()')) {
            const tokenHash = params[0];
            let affected = 0;
            mockSessions.forEach(s => {
              if (s.token_hash === tokenHash && s.revoked_at === null) {
                s.revoked_at = new Date();
                affected++;
              }
            });
            return { rows: [], rowCount: affected };
          }

          // 7. Handle global cleanup (cleanupExpiredAdminSessions)
          if (cleanedSql.includes('delete from admin_sessions where expires_at <= now()')) {
            const now = new Date();
            const originalLength = mockSessions.length;
            mockSessions = mockSessions.filter(
              s => s.expires_at > now && s.revoked_at === null
            );
            return { rows: [], rowCount: originalLength - mockSessions.length };
          }

          return { rows: [], rowCount: 0 };
        }
      };

      return await fn(mockClient);
    });
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockSessions = [];
    queryCount = 0;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('1. Serverless Environment detection skips background timers correctly', (t) => {
    process.env.VERCEL = '1';
    const timer = startAdminSessionCleanup();
    assert.strictEqual(timer, null, 'Background setInterval timer must be skipped in serverless environment');
  });

  test('2. Stateful environment successfully starts background cleanup timers', (t) => {
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.LAMBDA_TASK_ROOT;
    delete process.env.NETLIFY;
    
    const timer = startAdminSessionCleanup();
    assert.ok(timer, 'Interval timer must be initialized in long-running stateful environments');
    clearInterval(timer);
  });

  test('3. Request-driven lazy cleanup successfully sweeps expired/revoked sessions', async (t) => {
    // Manually seed mock database
    const now = new Date();
    
    // Expired session
    mockSessions.push({
      token_hash: 'expired_hash',
      username: 'admin',
      expires_at: new Date(now.getTime() - 10000), // Expired 10s ago
      revoked_at: null
    });

    // Revoked session
    mockSessions.push({
      token_hash: 'revoked_hash',
      username: 'admin',
      expires_at: new Date(now.getTime() + 50000), // Valid expiration
      revoked_at: new Date()
    });

    // Active session
    mockSessions.push({
      token_hash: 'active_hash',
      username: 'admin',
      expires_at: new Date(now.getTime() + 100000), // Valid expiration
      revoked_at: null
    });

    assert.strictEqual(mockSessions.length, 3);

    // Bypass throttle guard with short interval env
    process.env.ADMIN_SESSION_CLEANUP_INTERVAL_MS = '1';
    
    // Force and await a lazy cleanup
    await triggerLazyCleanup(true);

    // Assert that expired and revoked sessions were swept
    assert.strictEqual(mockSessions.length, 1, 'Only active session should remain');
    assert.strictEqual(mockSessions[0].token_hash, 'active_hash');
  });

  test('4. Lazy cleanup triggers throttle to prevent query storms', async (t) => {
    // Force first execution of the cleanup by setting interval to 1ms
    // This wipes any previous modules-level 'lastCleanupTime' state
    process.env.ADMIN_SESSION_CLEANUP_INTERVAL_MS = '1';

    // Seed database with one expired session
    mockSessions.push({
      token_hash: 'expired_hash',
      username: 'admin',
      expires_at: new Date(Date.now() - 10000),
      revoked_at: null
    });

    // First lazy cleanup executes (since lastCleanupTime = 0 or interval is 1ms)
    await triggerLazyCleanup(true);
    assert.strictEqual(mockSessions.length, 0, 'First sweep must succeed');

    // Configure cleanup interval to 5 seconds to test throttling
    process.env.ADMIN_SESSION_CLEANUP_INTERVAL_MS = '5000';

    // Seed another expired session
    mockSessions.push({
      token_hash: 'expired_hash_2',
      username: 'admin',
      expires_at: new Date(Date.now() - 10000),
      revoked_at: null
    });

    // Second trigger immediately after should be throttled and NOT execute
    await triggerLazyCleanup(true);
    assert.strictEqual(mockSessions.length, 1, 'Second sweep must be throttled');

    // Create a new session which triggers force-awaited cleanup
    // But since it is still inside the 5 seconds throttle window, it will NOT run!
    const session = await createAdminSession({ username: 'admin' });
    assert.ok(session.token);
    assert.strictEqual(mockSessions.length, 2, 'New session added, but cleanup remains throttled');
  });
});
