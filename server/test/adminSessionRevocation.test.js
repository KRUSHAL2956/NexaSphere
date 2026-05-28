import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setWithDbOverride } from '../repositories/db.js';
import { createAdminSession, getAdminSession, revokeAdminSession } from '../repositories/adminSessionsRepository.js';
import { startSocketValidation, stopSocketValidation, initializeSocketIO } from '../config/socket.js';
import { addSSEClient, broadcastSSEEvent, startSSEValidation, stopSSEValidation } from '../services/sseService.js';
import { Server } from 'http';

describe('Distributed Session Revocation Validation', () => {
  let mockSessions = [];
  let server = null;
  let io = null;

  before(() => {
    // 1. Inject a high-fidelity mock client database client
    setWithDbOverride(async (fn) => {
      const mockClient = {
        async query(sql, params = []) {
          const cleanedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

          // ensureReady schema
          if (cleanedSql.includes('create table') || cleanedSql.includes('create index')) {
            return { rows: [], rowCount: 0 };
          }

          // insert admin session
          if (cleanedSql.includes('insert into admin_sessions')) {
            const [token_hash, username, metadata, expires_at] = params;
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

          // select admin session
          if (cleanedSql.includes('select token_hash') && cleanedSql.includes('where token_hash = $1')) {
            const tokenHash = params[0];
            const now = new Date();
            const matching = mockSessions.filter(
              s => s.token_hash === tokenHash && s.revoked_at === null && s.expires_at > now
            );
            return { rows: matching, rowCount: matching.length };
          }

          // revoke admin session
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

          return { rows: [], rowCount: 0 };
        }
      };
      return await fn(mockClient);
    });
  });

  beforeEach(() => {
    mockSessions = [];
    server = new Server();
    io = initializeSocketIO(server);
    startSSEValidation();
  });

  afterEach(() => {
    stopSocketValidation();
    stopSSEValidation();
    if (io) io.close();
  });

  test('1. Valid admin WebSockets and SSE clients remain connected', async (t) => {
    const session = await createAdminSession({ username: 'admin' });
    
    // Create a mock local socket connection
    let disconnected = false;
    let emittedEvent = null;
    
    const mockSocket = {
      id: 'ws-active-1',
      adminAuthenticated: true,
      adminSessionToken: session.token,
      emit(event, data) {
        emittedEvent = { event, data };
      },
      disconnect(val) {
        disconnected = val;
      }
    };

    // Register our mock socket on the local io server map
    io.sockets.sockets.set(mockSocket.id, mockSocket);

    // Trigger validation loop once by calling startSocketValidation and waiting
    const timer = startSocketValidation();
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.strictEqual(disconnected, false, 'Valid admin WebSocket must not be disconnected');
    assert.strictEqual(emittedEvent, null, 'No revocation events should have been emitted');

    // Create a mock SSE client
    let sseEnded = false;
    let sseWritten = null;

    const mockSSEClient = {
      adminSessionToken: session.token,
      on(event, cb) {
        // mock event registration
      },
      write(msg) {
        sseWritten = msg;
      },
      end() {
        sseEnded = true;
      }
    };

    addSSEClient(mockSSEClient);

    // Wait and verify
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.strictEqual(sseEnded, false, 'Valid SSE client must not be ended');
    assert.strictEqual(sseWritten, null, 'No revocation events should be written to active client');
  });

  test('2. Revoking admin session force-disconnects active WebSockets and SSE streams', async (t) => {
    const session = await createAdminSession({ username: 'admin' });

    // Mock WebSocket client
    let wsDisconnected = false;
    let wsEmitted = null;

    const mockSocket = {
      id: 'ws-to-revoke',
      adminAuthenticated: true,
      adminSessionToken: session.token,
      emit(event, data) {
        wsEmitted = { event, data };
      },
      disconnect(val) {
        wsDisconnected = val;
      }
    };

    io.sockets.sockets.set(mockSocket.id, mockSocket);

    // Mock SSE client
    let sseEnded = false;
    let sseWritten = null;

    const mockSSEClient = {
      adminSessionToken: session.token,
      on(event, cb) {
        // mock event registration
      },
      write(msg) {
        sseWritten = msg;
      },
      end() {
        sseEnded = true;
      }
    };

    addSSEClient(mockSSEClient);

    // Assert initially healthy
    assert.strictEqual(wsDisconnected, false);
    assert.strictEqual(sseEnded, false);

    // Revoke the session in the database
    await revokeAdminSession(session.token);

    // Start background re-verification and wait past the interval
    startSocketValidation();
    startSSEValidation();

    // Since our test uses a setInterval interval of 5000ms, let's fast-forward or wait.
    // Wait for the validator loop to tick
    await new Promise(resolve => setTimeout(resolve, 5500));

    // WebSocket assertions
    assert.strictEqual(wsDisconnected, true, 'WebSocket must be force-disconnected after revocation');
    assert.ok(wsEmitted, 'WebSocket should receive revocation message');
    assert.strictEqual(wsEmitted.event, 'admin:revoked');

    // SSE assertions
    assert.strictEqual(sseEnded, true, 'SSE connection must be terminated after revocation');
    assert.ok(sseWritten, 'SSE client should receive a revocation event packet');
    assert.match(sseWritten, /admin:revoked/);
  });
});
