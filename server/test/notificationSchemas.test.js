import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSubscription, pushSubscriptionSchema } from '../validators/notificationSchemas.js';

const validSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  expirationTime: null,
  keys: {
    p256dh: 'BIOa2b3c4d5e6f7g8h9i0j',
    auth: 'a1b2c3d4e5f6g7h8i9j0',
  },
};

test('accepts a valid push subscription', () => {
  const result = normalizeSubscription({ subscription: validSubscription });
  assert.equal(result.endpoint, validSubscription.endpoint);
  assert.equal(result.keys.p256dh, validSubscription.keys.p256dh);
  assert.equal(result.keys.auth, validSubscription.keys.auth);
});

test('accepts subscription with numeric expirationTime', () => {
  const input = {
    ...validSubscription,
    expirationTime: 9999999999,
  };
  const result = normalizeSubscription({ subscription: input });
  assert.equal(result.expirationTime, 9999999999);
});

test('rejects missing subscription field', () => {
  assert.throws(
    () => normalizeSubscription({}),
    /Missing subscription field/
  );
});

test('rejects invalid endpoint', () => {
  assert.throws(
    () => normalizeSubscription({ subscription: { ...validSubscription, endpoint: 'not-a-url' } }),
    /endpoint must be a valid URL/
  );
});

test('rejects missing keys', () => {
  const { keys, ...noKeys } = validSubscription;
  assert.throws(
    () => normalizeSubscription({ subscription: noKeys }),
    /Invalid input/
  );
});

test('rejects empty p256dh key', () => {
  assert.throws(
    () => normalizeSubscription({
      subscription: {
        ...validSubscription,
        keys: { p256dh: '', auth: 'abc123' },
      },
    }),
    /p256dh key is required/
  );
});

test('rejects null body', () => {
  assert.throws(
    () => normalizeSubscription(null),
    /Invalid subscription payload/
  );
});

test('strips unknown fields from subscription', () => {
  const result = normalizeSubscription({
    subscription: { ...validSubscription, extraField: 'should be stripped' },
  });
  assert.equal(result.extraField, undefined);
});

test('accepts subscription with missing expirationTime', () => {
  const { expirationTime, ...withoutExpiry } = validSubscription;
  const result = normalizeSubscription({ subscription: withoutExpiry });
  assert.equal(result.expirationTime, undefined);
});
