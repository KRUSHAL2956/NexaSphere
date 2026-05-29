import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Inline the helpers under test so this file has no runtime dependency on the
// full server/index.js module (which requires env vars and DB at import time).
// ---------------------------------------------------------------------------

function timingSafeStringEqual(a, b) {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  if (!sa.length || !sb.length) return sa === sb;
  const ba = Buffer.from(sa, 'utf8');
  const bb = Buffer.from(sb, 'utf8');
  if (ba.length !== bb.length) {
    const maxLen = Math.max(ba.length, bb.length);
    const paddedA = Buffer.alloc(maxLen);
    const paddedB = Buffer.alloc(maxLen);
    ba.copy(paddedA);
    bb.copy(paddedB);
    crypto.timingSafeEqual(paddedA, paddedB);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

const ACTIVITY_AUTH_MAX_ATTEMPTS = 5;
const ACTIVITY_AUTH_LOCKOUT_MS = 15 * 60 * 1000;

function makeActivityAuthStore() {
  const map = new Map();

  function checkLockout(ip) {
    const entry = map.get(ip);
    if (!entry) return null;
    if (Date.now() > entry.lockoutUntil) {
      map.delete(ip);
      return null;
    }
    return entry;
  }

  function recordFailed(ip) {
    const entry = map.get(ip) || { count: 0, lockoutUntil: 0 };
    entry.count += 1;
    if (entry.count >= ACTIVITY_AUTH_MAX_ATTEMPTS) {
      entry.lockoutUntil = Date.now() + ACTIVITY_AUTH_LOCKOUT_MS;
      entry.count = 0;
    }
    map.set(ip, entry);
    return entry;
  }

  function clear(ip) {
    map.delete(ip);
  }

  return { checkLockout, recordFailed, clear, _map: map };
}

// ---------------------------------------------------------------------------
// timingSafeStringEqual
// ---------------------------------------------------------------------------

test('timingSafeStringEqual returns true for identical strings', () => {
  assert.equal(timingSafeStringEqual('correct-horse-battery-Staple1!', 'correct-horse-battery-Staple1!'), true);
});

test('timingSafeStringEqual returns false for strings differing in last character', () => {
  assert.equal(timingSafeStringEqual('correct-horse-battery-Staple1!', 'correct-horse-battery-Staple1@'), false);
});

test('timingSafeStringEqual returns false for strings differing in first character', () => {
  assert.equal(timingSafeStringEqual('Acorrect', 'Bcorrect'), false);
});

test('timingSafeStringEqual returns false when lengths differ', () => {
  assert.equal(timingSafeStringEqual('short', 'short-and-longer'), false);
});

test('timingSafeStringEqual returns false for empty vs non-empty', () => {
  assert.equal(timingSafeStringEqual('', 'nonempty'), false);
});

test('timingSafeStringEqual returns true for two empty strings', () => {
  assert.equal(timingSafeStringEqual('', ''), true);
});

test('timingSafeStringEqual handles null/undefined operands without throwing', () => {
  assert.equal(timingSafeStringEqual(null, null), true);
  assert.equal(timingSafeStringEqual(undefined, 'value'), false);
  assert.equal(timingSafeStringEqual('value', undefined), false);
});

test('timingSafeStringEqual handles multi-byte UTF-8 characters', () => {
  const unicode = '正確パスワード1!A';
  assert.equal(timingSafeStringEqual(unicode, unicode), true);
  assert.equal(timingSafeStringEqual(unicode, unicode + 'x'), false);
});

// ---------------------------------------------------------------------------
// Per-IP lockout tracker
// ---------------------------------------------------------------------------

test('no lockout before any failed attempts', () => {
  const store = makeActivityAuthStore();
  assert.equal(store.checkLockout('1.2.3.4'), null);
});

test('lockout does not trigger before reaching the threshold', () => {
  const store = makeActivityAuthStore();
  const ip = '1.2.3.4';
  for (let i = 0; i < ACTIVITY_AUTH_MAX_ATTEMPTS - 1; i++) {
    store.recordFailed(ip);
    assert.equal(store.checkLockout(ip), null);
  }
});

test('lockout is set after reaching the failure threshold', () => {
  const store = makeActivityAuthStore();
  const ip = '10.0.0.1';
  for (let i = 0; i < ACTIVITY_AUTH_MAX_ATTEMPTS; i++) {
    store.recordFailed(ip);
  }
  const lockout = store.checkLockout(ip);
  assert.notEqual(lockout, null);
  assert.ok(lockout.lockoutUntil > Date.now());
});

test('clearing attempts removes the lockout', () => {
  const store = makeActivityAuthStore();
  const ip = '10.0.0.2';
  for (let i = 0; i < ACTIVITY_AUTH_MAX_ATTEMPTS; i++) {
    store.recordFailed(ip);
  }
  store.clear(ip);
  assert.equal(store.checkLockout(ip), null);
});

test('different IPs have independent lockout state', () => {
  const store = makeActivityAuthStore();
  const ipA = '192.168.1.1';
  const ipB = '192.168.1.2';
  for (let i = 0; i < ACTIVITY_AUTH_MAX_ATTEMPTS; i++) {
    store.recordFailed(ipA);
  }
  assert.notEqual(store.checkLockout(ipA), null);
  assert.equal(store.checkLockout(ipB), null);
});

test('stale lockout is evicted on next check', () => {
  const store = makeActivityAuthStore();
  const ip = '172.16.0.1';
  // Manually insert an already-expired lockout entry.
  store._map.set(ip, { count: 0, lockoutUntil: Date.now() - 1 });
  assert.equal(store.checkLockout(ip), null);
  assert.equal(store._map.has(ip), false);
});
