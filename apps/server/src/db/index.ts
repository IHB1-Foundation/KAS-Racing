import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL?.trim() ?? '';
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required. Set a Railway Postgres connection string before starting the server.'
  );
}

const useSsl = process.env.DATABASE_SSL?.toLowerCase() !== 'false';
const maxPoolSize = Number(process.env.DATABASE_POOL_MAX ?? '20');

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: Number.isFinite(maxPoolSize) ? maxPoolSize : 20,
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Ensure schema exists for fresh Railway environments.
// This keeps deploys zero-touch for first boot.
async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      user_address TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      reward_cooldown_ms INTEGER NOT NULL DEFAULT 2000,
      reward_max_per_session INTEGER NOT NULL DEFAULT 10,
      event_count INTEGER NOT NULL DEFAULT 0,
      last_event_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reward_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      seq INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'checkpoint',
      reward_amount DOUBLE PRECISION NOT NULL,
      txid TEXT,
      tx_status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL,
      broadcasted_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      included_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      join_code TEXT NOT NULL UNIQUE,
      player_a_id TEXT REFERENCES users(id),
      player_a_address TEXT,
      player_a_pubkey TEXT,
      player_a_session_id TEXT REFERENCES sessions(id),
      player_b_id TEXT REFERENCES users(id),
      player_b_address TEXT,
      player_b_pubkey TEXT,
      player_b_session_id TEXT REFERENCES sessions(id),
      bet_amount DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      player_a_deposit_txid TEXT,
      player_a_deposit_status TEXT,
      player_b_deposit_txid TEXT,
      player_b_deposit_status TEXT,
      escrow_address_a TEXT,
      escrow_address_b TEXT,
      escrow_mode TEXT DEFAULT 'fallback',
      escrow_script_a TEXT,
      escrow_script_b TEXT,
      refund_locktime_blocks INTEGER,
      oracle_public_key TEXT,
      winner_id TEXT,
      player_a_score INTEGER,
      player_b_score INTEGER,
      settle_txid TEXT,
      settle_status TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS reward_events_session_seq_idx
    ON reward_events (session_id, seq);
  `);
}

const shouldAutoMigrate = process.env.SKIP_DB_MIGRATIONS !== 'true';
if (shouldAutoMigrate) {
  await ensureSchema();
}

// Export schema for convenience
export * from './schema.js';

// Close database connection (for clean shutdown)
export async function closeDb(): Promise<void> {
  await pool.end();
}

