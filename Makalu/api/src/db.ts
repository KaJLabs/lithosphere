import { Pool } from 'pg';
import { logger } from './lib/logger.js';

let _pool: Pool | null = null;
const DATABASE_QUERY_TIMEOUT_MS = 15_000;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      query_timeout: DATABASE_QUERY_TIMEOUT_MS,
      statement_timeout: DATABASE_QUERY_TIMEOUT_MS,
      ssl: process.env.DATABASE_URL?.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
    });
    _pool.on('error', (err) => {
      logger.error({ err: err.message }, 'PostgreSQL pool error');
    });
  }
  return _pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

// Dedicated pool for heavy analytics aggregates (homepage counts over multi-million
// row tables) whose runtime grows with the chain and has crept past the main pool's
// 15s statement_timeout. Without this, a cache-miss recompute throws "Query read
// timeout" and 500s the whole /stats/summary endpoint (which the deploy health gate
// checks). These queries are always cached, so the higher timeout only bites on the
// occasional recompute. Kept separate so it can never starve the main request pool.
let _slowPool: Pool | null = null;
const SLOW_QUERY_TIMEOUT_MS = 60_000;

function getSlowPool(): Pool {
  if (!_slowPool) {
    _slowPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      query_timeout: SLOW_QUERY_TIMEOUT_MS,
      statement_timeout: SLOW_QUERY_TIMEOUT_MS,
      ssl: process.env.DATABASE_URL?.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
    });
    _slowPool.on('error', (err) => {
      logger.error({ err: err.message }, 'PostgreSQL slow-pool error');
    });
  }
  return _slowPool;
}

export async function slowQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getSlowPool();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}
