import pg from 'pg';

// ---------------------------------------------------------------------------
// Pool configuration
//
// All values are environment-variable-backed so operators can tune them for
// their specific deployment without changing code. Sensible, documented
// defaults are used when the variable is absent.
//
// PG_POOL_MAX            — max simultaneous client checkouts (default 20).
//                          Raise for high-concurrency deployments; lower for
//                          hosting plans with a tight connection limit.
// PG_CONNECTION_TIMEOUT_MS — ms to wait for a free client before throwing
//                          (default 5000). Prevents withDb callers from
//                          hanging forever when every slot is occupied.
// PG_IDLE_TIMEOUT_MS     — ms an idle client stays open before being closed
//                          (default 30000). Keeps Supabase / managed-PG
//                          connection limits from being exhausted by dormant
//                          slots between request bursts.
// PG_STATEMENT_TIMEOUT_MS — per-query execution ceiling sent to the server
//                          (default 10000). Stops long-running queries from
//                          holding a client indefinitely and causing cascading
//                          stalls on other requests.
// ---------------------------------------------------------------------------

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getPoolConfig() {
  return {
    max: parsePositiveInt(process.env.PG_POOL_MAX, 20),
    connectionTimeoutMillis: parsePositiveInt(
      process.env.PG_CONNECTION_TIMEOUT_MS,
      5_000,
    ),
    idleTimeoutMillis: parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30_000),
    // statement_timeout is a Postgres session-level parameter. Passing it via
    // the connection string's options query parameter means every client
    // checked out of this pool enforces it automatically.
    options: `--statement_timeout=${parsePositiveInt(process.env.PG_STATEMENT_TIMEOUT_MS, 10_000)}`,
  };
}

let pool = null;

function getPool() {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  pool = new pg.Pool({
    connectionString: databaseUrl,
    ...getPoolConfig(),
  });

  // Surface unexpected errors on idle clients so they do not silently crash
  // the process or swallow stack traces. The pool itself stays alive — pg
  // will remove the broken client and replace it on the next checkout.
  pool.on('error', (err) => {
    console.error('[pg.Pool] Unexpected error on idle client:', err.message);
  });

  return pool;
}

export let withDbOverride = null;

export async function withDb(fn) {
  if (withDbOverride) {
    return await withDbOverride(fn);
  }
  const p = getPool();
  if (!p) throw new Error('PostgreSQL not configured. Missing DATABASE_URL.');
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Returns a snapshot of live pool metrics useful for health checks and
 * performance monitoring. Returns null when the pool has not been initialised
 * (DATABASE_URL not set).
 */
export function getPoolStats() {
  if (!pool) return null;
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
export function setWithDbOverride(fn) {
  withDbOverride = fn;
}

export { pg };

