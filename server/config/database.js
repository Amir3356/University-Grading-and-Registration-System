import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const { Pool } = pkg;

/**
 * Connection pool configuration
 * Supports both DATABASE_URL connection string and individual parameter options
 */
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'university_grading',
    };

export const pool = new Pool({
  ...poolConfig,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Maximum number of clients in pool
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '10000', 10), // Close idle connections promptly
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT || '5000', 10), // 5s timeout to acquire connection
  allowExitOnIdle: true, // Do not keep event loop alive for idle connections
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

/**
 * Pool event handlers for monitoring connection health and lifecycle
 */
pool.on('connect', () => {
  // Client connected to pool
});

pool.on('error', (err) => {
  console.error('[Database Pool] Unexpected error on idle PostgreSQL client:', err);
});

pool.on('remove', () => {
  // Connection closed and removed from pool
});

/**
 * Execute a parameterized SQL query using an automatically managed client from the pool
 * @param {string} text - SQL query string
 * @param {Array<any>} [params] - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === 'development' && duration > 250) {
    console.warn(`[Database Pool] Slow query (${duration}ms):`, text.substring(0, 100));
  }

  return res;
}

/**
 * Check out a dedicated client from the pool with idempotent release guard
 * @returns {Promise<import('pg').PoolClient>}
 */
export async function getClient() {
  const client = await pool.connect();
  const originalRelease = client.release.bind(client);
  let released = false;

  client.release = () => {
    if (released) return;
    released = true;
    originalRelease();
  };

  return client;
}

/**
 * Execute operations within a database transaction managed through the connection pool
 * Automatically begins, commits, or rolls back and releases the client.
 * @param {Function} callback - Callback receiving the transaction client
 * @returns {Promise<any>}
 */
export async function withTransaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get current connection pool saturation metrics
 * @returns {{ totalCount: number, idleCount: number, waitingCount: number }}
 */
export function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

/**
 * Validate connectivity through the connection pool
 * @returns {Promise<{ ok: boolean, database: string, user: string, version: string, latencyMs: number }>}
 */
export async function testConnection() {
  const start = Date.now();
  const res = await pool.query('SELECT current_database() AS db, current_user AS user, version() AS version, NOW() AS now');
  const latencyMs = Date.now() - start;
  const row = res.rows[0];

  return {
    ok: true,
    database: row.db,
    user: row.user,
    version: row.version,
    latencyMs,
  };
}

/**
 * Gracefully close and drain all connections in the pool
 * @returns {Promise<void>}
 */
export async function closePool() {
  try {
    await pool.end();
  } catch (err) {
    console.error('[Database Pool] Error while closing pool:', err);
  }
}

export default pool;
