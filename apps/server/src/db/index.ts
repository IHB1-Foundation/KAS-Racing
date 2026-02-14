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

// Ensure schema exists for fresh environments.
// Uses CREATE TABLE IF NOT EXISTS for idempotent schema creation.
async function ensureSchema(): Promise<void> {
  // v1 tables
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

  // v1 indexes
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS reward_events_session_seq_idx
    ON reward_events (session_id, seq);
  `);

  // v2 tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL REFERENCES matches(id),
      player TEXT NOT NULL,
      player_address TEXT NOT NULL,
      escrow_address TEXT NOT NULL,
      amount_sompi BIGINT NOT NULL,
      txid TEXT,
      tx_status TEXT NOT NULL DEFAULT 'pending',
      daa_score BIGINT,
      created_at TIMESTAMPTZ NOT NULL,
      broadcasted_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      included_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL REFERENCES matches(id) UNIQUE,
      settlement_type TEXT NOT NULL,
      txid TEXT,
      tx_status TEXT NOT NULL DEFAULT 'pending',
      winner_address TEXT,
      total_amount_sompi BIGINT NOT NULL,
      fee_sompi BIGINT NOT NULL,
      daa_score BIGINT,
      created_at TIMESTAMPTZ NOT NULL,
      broadcasted_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      included_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chain_events (
      id TEXT PRIMARY KEY,
      txid TEXT NOT NULL,
      event_type TEXT NOT NULL,
      match_id TEXT REFERENCES matches(id),
      session_id TEXT REFERENCES sessions(id),
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount_sompi BIGINT NOT NULL,
      daa_score BIGINT,
      confirmations INTEGER NOT NULL DEFAULT 0,
      payload TEXT,
      indexed_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      txid TEXT,
      result TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  // v2 indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS reward_events_tx_status_idx ON reward_events(tx_status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS deposits_match_player_idx ON deposits(match_id, player);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS deposits_tx_status_idx ON deposits(tx_status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS settlements_tx_status_idx ON settlements(tx_status);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS chain_events_txid_to_addr_idx ON chain_events(txid, to_address);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS chain_events_event_type_idx ON chain_events(event_type);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS chain_events_match_id_idx ON chain_events(match_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS chain_events_daa_score_idx ON chain_events(daa_score);`);
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
