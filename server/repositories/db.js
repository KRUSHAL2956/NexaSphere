import pg from "pg";

let pool = null;
export let customPool = null;

export function setCustomPool(p) {
  customPool = p;
}

function getPool() {
  if (customPool) return customPool;
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  pool = new pg.Pool({ connectionString: databaseUrl });
  return pool;
}

export let withDbOverride = null;

export async function withDb(fn) {
  if (withDbOverride) {
    return await withDbOverride(fn);
  }
  const p = getPool();
  if (!p) throw new Error("PostgreSQL not configured. Missing DATABASE_URL.");

  const client = await p.connect();
  const startTime = Date.now();
  let completed = false;

  const WARN_THRESHOLD_MS = Number(process.env.DB_HOLD_WARN_MS) || 200;
  const TIMEOUT_MS = Number(process.env.DB_HOLD_TIMEOUT_MS) || 5000;

  const holdTimer = setTimeout(() => {
    if (!completed) {
      console.warn(
        `[DB WARNING] PostgreSQL connection checked out for > ${WARN_THRESHOLD_MS}ms! Possible connection pool starvation hazard detected.`
      );
    }
  }, WARN_THRESHOLD_MS);

  try {
    const executionPromise = fn(client);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        if (!completed) {
          reject(
            new Error(
              `Database transaction timed out. Connection held longer than ${TIMEOUT_MS}ms safety limit.`
            )
          );
        }
      }, TIMEOUT_MS);
    });

    const result = await Promise.race([executionPromise, timeoutPromise]);
    completed = true;
    return result;
  } finally {
    completed = true;
    clearTimeout(holdTimer);

    const duration = Date.now() - startTime;
    if (duration > WARN_THRESHOLD_MS) {
      console.warn(
        `[DB PERF] Connection held for ${duration}ms (Threshold: ${WARN_THRESHOLD_MS}ms)`
      );
    }

    client.release();
  }
}

export function setWithDbOverride(fn) {
  withDbOverride = fn;
}

export { pg };
