import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';

// Create a mock socket resembling Socket.IO Socket
const createMockSocket = (id = 'test-socket-123') => {
  const socket = new EventEmitter();
  socket.id = id;
  socket.adminAuthenticated = false;
  socket.join = () => {};
  socket.leave = () => {};
  socket.disconnect = () => {
    socket.disconnected = true;
    socket.emit('disconnect');
  };
  socket.disconnected = false;
  return socket;
};

test('Security Audit & Validation: Socket Identification Hardening', async (t) => {
  const { _onConnection, getConnectedUsersCount, getConnectedUsers, _clearConnectedUsers } = await import('../config/socket.js');

  await t.test('Scenario 1: Valid user identifies and disconnects cleanly', () => {
    _clearConnectedUsers();
    const socket = createMockSocket('socket-1');

    // Register handlers using real production callback
    _onConnection(socket);

    // Identify user
    socket.emit('user:identify', { userId: 'user-99', email: 'user@example.com' });

    assert.equal(getConnectedUsersCount(), 1);
    const users = getConnectedUsers();
    assert.equal(users[0].id, 'user-99');
    assert.equal(users[0].email, 'user@example.com');
    assert.equal(users[0].socketId, 'socket-1');

    // Disconnect
    socket.disconnect();
    assert.equal(getConnectedUsersCount(), 0);
  });

  await t.test('Scenario 2: Oversized payloads are safely rejected', () => {
    _clearConnectedUsers();
    const socket = createMockSocket('socket-2');

    _onConnection(socket);

    // Massive userId payload
    socket.emit('user:identify', { userId: 'A'.repeat(500), email: 'user@example.com' });
    assert.equal(getConnectedUsersCount(), 0);

    // Massive email payload
    socket.emit('user:identify', { userId: 'user-1', email: 'B'.repeat(1000) });
    assert.equal(getConnectedUsersCount(), 0);
  });

  await t.test('Scenario 3: Non-string and nested payloads are rejected', () => {
    _clearConnectedUsers();
    const socket = createMockSocket('socket-3');

    _onConnection(socket);

    // Nested object
    socket.emit('user:identify', { userId: { nested: 'obj' }, email: 'user@example.com' });
    assert.equal(getConnectedUsersCount(), 0);

    // Array
    socket.emit('user:identify', { userId: ['array'], email: 'user@example.com' });
    assert.equal(getConnectedUsersCount(), 0);
  });

  await t.test('Scenario 4: Per-socket identification rate limiting forces disconnect', () => {
    _clearConnectedUsers();
    const socket = createMockSocket('socket-4');

    _onConnection(socket);

    // Send identify events rapidly
    socket.emit('user:identify', { userId: 'user-1', email: 'u1@example.com' }); // 1
    socket.emit('user:identify', { userId: 'user-1', email: 'u1@example.com' }); // 2
    socket.emit('user:identify', { userId: 'user-1', email: 'u1@example.com' }); // 3
    
    assert.equal(socket.disconnected, false);

    // 4th call triggers disconnect rate limit
    socket.emit('user:identify', { userId: 'user-1', email: 'u1@example.com' }); // 4

    assert.equal(socket.disconnected, true);
  });
});
