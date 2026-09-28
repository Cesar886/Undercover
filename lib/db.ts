import { Pool, PoolClient } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _pgPoolConnectionTimeoutMillis: number | undefined;
  // eslint-disable-next-line no-var
  var _pgUnavailableUntil: number | undefined;
}

const connectionTimeoutMillis = Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 2500);

if (
  process.env.NODE_ENV !== 'production' &&
  global._pgPool &&
  global._pgPoolConnectionTimeoutMillis !== connectionTimeoutMillis
) {
  void global._pgPool.end().catch(() => {});
  global._pgPool = undefined;
}

const pool =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis,
    idleTimeoutMillis: 20000,
    max: 5,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool;
  global._pgPoolConnectionTimeoutMillis = connectionTimeoutMillis;
}

export async function query(text: string, params?: unknown[]) {
  const unavailableUntil = global._pgUnavailableUntil ?? 0;
  if (unavailableUntil > Date.now()) {
    throw new Error('Database temporarily unavailable');
  }
  try {
    return await pool.query(text, params);
  } catch (error) {
    if (isConnectionFailure(error)) {
      global._pgUnavailableUntil = Date.now() + 15000;
    }
    throw error;
  }
}

function isConnectionFailure(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'EHOSTUNREACH' ||
    /timeout|terminated|connect/i.test(err.message ?? '')
  );
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
