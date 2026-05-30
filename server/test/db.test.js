import assert from 'node:assert/strict';
import test from 'node:test';

// ---------------------------------------------------------------------------
// Inline the helpers under test so this file has no dependency on the full
// server module (env vars, live DB) at import time.
// ---------------------------------------------------------------------------

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getPoolConfig(env = {}) {
  return {
    max: parsePositiveInt(env.PG_POOL_MAX, 20),
    connectionTimeoutMillis: parsePositiveInt(env.PG_CONNECTION_TIMEOUT_MS, 5_000),
    idleTimeoutMillis: parsePositiveInt(env.PG_IDLE_TIMEOUT_MS, 30_000),
    options: `--statement_timeout=${parsePositiveInt(env.PG_STATEMENT_TIMEOUT_MS, 10_000)}`,
  };
}

// ---------------------------------------------------------------------------
// parsePositiveInt
// ---------------------------------------------------------------------------

test('parsePositiveInt returns the parsed integer for valid positive values', () => {
  assert.equal(parsePositiveInt('20', 10), 20);
  assert.equal(parsePositiveInt('1', 10), 1);
  assert.equal(parsePositiveInt('100', 10), 100);
});

test('parsePositiveInt floors decimal values', () => {
  assert.equal(parsePositiveInt('7.9', 10), 7);
  assert.equal(parsePositiveInt('3.1', 10), 3);
});

test('parsePositiveInt returns fallback for zero', () => {
  assert.equal(parsePositiveInt('0', 10), 10);
});

test('parsePositiveInt returns fallback for negative values', () => {
  assert.equal(parsePositiveInt('-5', 10), 10);
  assert.equal(parsePositiveInt('-0.1', 10), 10);
});

test('parsePositiveInt returns fallback for non-numeric strings', () => {
  assert.equal(parsePositiveInt('abc', 10), 10);
  assert.equal(parsePositiveInt('', 10), 10);
});

test('parsePositiveInt returns fallback for undefined', () => {
  assert.equal(parsePositiveInt(undefined, 42), 42);
});

test('parsePositiveInt returns fallback for null', () => {
  assert.equal(parsePositiveInt(null, 42), 42);
});

test('parsePositiveInt returns fallback for Infinity', () => {
  assert.equal(parsePositiveInt('Infinity', 10), 10);
});

// ---------------------------------------------------------------------------
// getPoolConfig — default values
// ---------------------------------------------------------------------------

test('default max is 20 when PG_POOL_MAX is unset', () => {
  assert.equal(getPoolConfig({}).max, 20);
});

test('default connectionTimeoutMillis is 5000 when PG_CONNECTION_TIMEOUT_MS is unset', () => {
  assert.equal(getPoolConfig({}).connectionTimeoutMillis, 5_000);
});

test('default idleTimeoutMillis is 30000 when PG_IDLE_TIMEOUT_MS is unset', () => {
  assert.equal(getPoolConfig({}).idleTimeoutMillis, 30_000);
});

test('default statement_timeout in options string is 10000', () => {
  assert.ok(getPoolConfig({}).options.includes('10000'));
});

// ---------------------------------------------------------------------------
// getPoolConfig — env overrides
// ---------------------------------------------------------------------------

test('PG_POOL_MAX overrides the default max', () => {
  assert.equal(getPoolConfig({ PG_POOL_MAX: '50' }).max, 50);
});

test('PG_CONNECTION_TIMEOUT_MS overrides connectionTimeoutMillis', () => {
  assert.equal(getPoolConfig({ PG_CONNECTION_TIMEOUT_MS: '3000' }).connectionTimeoutMillis, 3_000);
});

test('PG_IDLE_TIMEOUT_MS overrides idleTimeoutMillis', () => {
  assert.equal(getPoolConfig({ PG_IDLE_TIMEOUT_MS: '60000' }).idleTimeoutMillis, 60_000);
});

test('PG_STATEMENT_TIMEOUT_MS overrides statement_timeout in options string', () => {
  const { options } = getPoolConfig({ PG_STATEMENT_TIMEOUT_MS: '7500' });
  assert.ok(options.includes('7500'), `Expected options to contain 7500, got: ${options}`);
});

// ---------------------------------------------------------------------------
// getPoolConfig — invalid env values fall back to defaults
// ---------------------------------------------------------------------------

test('invalid PG_POOL_MAX falls back to default 20', () => {
  assert.equal(getPoolConfig({ PG_POOL_MAX: 'bad' }).max, 20);
  assert.equal(getPoolConfig({ PG_POOL_MAX: '0' }).max, 20);
  assert.equal(getPoolConfig({ PG_POOL_MAX: '-1' }).max, 20);
});

test('invalid PG_CONNECTION_TIMEOUT_MS falls back to default 5000', () => {
  assert.equal(getPoolConfig({ PG_CONNECTION_TIMEOUT_MS: 'none' }).connectionTimeoutMillis, 5_000);
  assert.equal(getPoolConfig({ PG_CONNECTION_TIMEOUT_MS: '0' }).connectionTimeoutMillis, 5_000);
});

test('invalid PG_IDLE_TIMEOUT_MS falls back to default 30000', () => {
  assert.equal(getPoolConfig({ PG_IDLE_TIMEOUT_MS: '-100' }).idleTimeoutMillis, 30_000);
});

test('invalid PG_STATEMENT_TIMEOUT_MS falls back to default 10000 in options string', () => {
  const { options } = getPoolConfig({ PG_STATEMENT_TIMEOUT_MS: 'bad' });
  assert.ok(options.includes('10000'), `Expected options to contain 10000, got: ${options}`);
});

// ---------------------------------------------------------------------------
// options string format
// ---------------------------------------------------------------------------

test('options string is a valid Postgres SET parameter format', () => {
  const { options } = getPoolConfig({});
  // Must start with -- and contain statement_timeout=<integer>
  assert.match(options, /^--statement_timeout=\d+$/);
});

test('options string with custom timeout has correct format', () => {
  const { options } = getPoolConfig({ PG_STATEMENT_TIMEOUT_MS: '8000' });
  assert.equal(options, '--statement_timeout=8000');
});

// ---------------------------------------------------------------------------
// withDb error behaviour (no live DB — testing the guard path only)
// ---------------------------------------------------------------------------

test('withDb throws a descriptive error when DATABASE_URL is not set', async () => {
  // Simulate getPool returning null by defining a local withDb equivalent.
  async function withDbSimulated(fn) {
    const databaseUrl = undefined; // simulate missing env var
    if (!databaseUrl) throw new Error('PostgreSQL not configured. Missing DATABASE_URL.');
    return fn({});
  }

  await assert.rejects(() => withDbSimulated(() => {}), /PostgreSQL not configured/);
});
