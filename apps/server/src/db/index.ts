import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL?.trim() ?? '';
const maxPoolSize = Number(process.env.DATABASE_POOL_MAX ?? '20');
const connectTimeoutMs = Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? '10000');
const schemaInitTimeoutMs = Number(process.env.DATABASE_SCHEMA_INIT_TIMEOUT_MS ?? '30000');
const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  process.env.VITEST === '1';

function shouldUseSsl(connectionString: string): boolean {
  if (process.env.DATABASE_SSL) {
    return process.env.DATABASE_SSL.toLowerCase() !== 'false';
  }
  return !(
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1')
  );
}

async function createPool(): Promise<Pool> {
  if (DATABASE_URL) {
    const useSsl = shouldUseSsl(DATABASE_URL);
    return new Pool({
      connectionString: DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: Number.isFinite(maxPoolSize) ? maxPoolSize : 20,
      connectionTimeoutMillis: Number.isFinite(connectTimeoutMs) ? connectTimeoutMs : 10000,
    });
  }

  if (isTestEnv) {
    const { newDb } = await import('pg-mem');
    const memDb = newDb({ autoCreateForeignKeyIndices: true });
    const adapter = memDb.adapters.createPg();
    const MemPool = adapter.Pool as {
      prototype: {
        query?: (...args: unknown[]) => unknown;
        adaptResults?: (query: unknown, res: unknown) => unknown;
        adaptQuery?: (query: unknown, values?: unknown[]) => unknown;
      };
      new (): unknown;
    };

    const originalQuery = MemPool.prototype.query;
    if (typeof originalQuery === 'function') {
      MemPool.prototype.query = function queryWithoutPgOptions(...args: unknown[]) {
        const [firstArg, ...restArgs] = args;
        if (firstArg && typeof firstArg === 'object') {
          const sanitized = { ...(firstArg as Record<string, unknown>) };
          delete sanitized.types;
          return originalQuery.call(this, sanitized, ...restArgs);
        }
        return originalQuery.call(this, ...args);
      };
    }

    const originalAdaptResults = MemPool.prototype.adaptResults;
    if (typeof originalAdaptResults === 'function') {
      MemPool.prototype.adaptResults = function adaptResultsWithRowMode(
        query: unknown,
        res: unknown
      ) {
        const rowMode = (
          query &&
          typeof query === 'object' &&
          'rowMode' in (query as Record<string, unknown>)
            ? (query as Record<string, unknown>).rowMode
            : undefined
        );

        const queryWithoutRowMode =
          query && typeof query === 'object'
            ? { ...(query as Record<string, unknown>), rowMode: undefined }
            : query;

        const baseResult = originalAdaptResults.call(this, queryWithoutRowMode, res) as {
          rows?: Array<Record<string, unknown>>;
          [key: string]: unknown;
        };

        if (rowMode !== 'array' || !Array.isArray(baseResult.rows)) {
          return baseResult;
        }

        return {
          ...baseResult,
          rows: baseResult.rows.map((row) => Object.keys(row).map((key) => row[key])),
        };
      };
    }

    const originalAdaptQuery = MemPool.prototype.adaptQuery;
    if (typeof originalAdaptQuery === 'function') {
      MemPool.prototype.adaptQuery = function adaptQueryWithoutTypes(
        query: unknown,
        values?: unknown[]
      ) {
        if (query && typeof query === 'object') {
          const sanitized = { ...(query as Record<string, unknown>) };
          delete sanitized.types;
          return originalAdaptQuery.call(this, sanitized, values);
        }
        return originalAdaptQuery.call(this, query, values);
      };
    }

    return new MemPool() as unknown as Pool;
  }

  throw new Error(
    'DATABASE_URL is required. Set a Railway Postgres connection string before starting the server.'
  );
}

export const pool = await createPool();

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

  // v3 EVM tables (KASPLEX zkEVM)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chain_events_evm (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      block_number BIGINT NOT NULL,
      tx_hash TEXT NOT NULL,
      log_index INTEGER NOT NULL,
      contract TEXT NOT NULL,
      event_name TEXT NOT NULL,
      args TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tx_hash, log_index)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches_v3 (
      id TEXT PRIMARY KEY,
      join_code TEXT UNIQUE,
      match_id_onchain TEXT UNIQUE,
      player1_address TEXT NOT NULL,
      player2_address TEXT,
      deposit_amount_wei TEXT NOT NULL,
      timeout_block BIGINT,
      state TEXT NOT NULL DEFAULT 'lobby',
      player1_deposited INTEGER NOT NULL DEFAULT 0,
      player2_deposited INTEGER NOT NULL DEFAULT 0,
      winner_address TEXT,
      settle_tx_hash TEXT,
      create_tx_hash TEXT,
      player1_score INTEGER,
      player2_score INTEGER,
      created_at TIMESTAMPTZ NOT NULL,
      funded_at TIMESTAMPTZ,
      settled_at TIMESTAMPTZ
    );
  `);

  // v3 schema migrations for existing tables
  const safeAlter = async (sql: string) => {
    try { await pool.query(sql); } catch { /* column/constraint already exists or incompatible */ }
  };
  await safeAlter(`ALTER TABLE matches_v3 ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE`);
  await safeAlter(`ALTER TABLE matches_v3 ADD COLUMN IF NOT EXISTS create_tx_hash TEXT`);
  await safeAlter(`ALTER TABLE matches_v3 ALTER COLUMN player2_address DROP NOT NULL`);
  await safeAlter(`ALTER TABLE matches_v3 ALTER COLUMN match_id_onchain DROP NOT NULL`);
  await safeAlter(`ALTER TABLE matches_v3 ALTER COLUMN timeout_block DROP NOT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deposits_v3 (
      id TEXT PRIMARY KEY,
      match_id_onchain TEXT NOT NULL,
      player_address TEXT NOT NULL,
      amount_wei TEXT NOT NULL,
      tx_hash TEXT,
      tx_status TEXT NOT NULL DEFAULT 'pending',
      block_number BIGINT,
      created_at TIMESTAMPTZ NOT NULL,
      mined_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settlements_v3 (
      id TEXT PRIMARY KEY,
      match_id_onchain TEXT NOT NULL UNIQUE,
      settlement_type TEXT NOT NULL,
      winner_address TEXT,
      payout_wei TEXT NOT NULL,
      tx_hash TEXT,
      tx_status TEXT NOT NULL DEFAULT 'pending',
      block_number BIGINT,
      created_at TIMESTAMPTZ NOT NULL,
      mined_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reward_events_v3 (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      seq INTEGER NOT NULL,
      recipient_address TEXT NOT NULL,
      amount_wei TEXT NOT NULL,
      proof_hash TEXT,
      tx_hash TEXT,
      tx_status TEXT NOT NULL DEFAULT 'pending',
      block_number BIGINT,
      created_at TIMESTAMPTZ NOT NULL,
      mined_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ
    );
  `);

  // v3 indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS chain_events_evm_contract_event_idx ON chain_events_evm(contract, event_name);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS chain_events_evm_block_idx ON chain_events_evm(block_number);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS matches_v3_state_idx ON matches_v3(state);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS matches_v3_player1_idx ON matches_v3(player1_address);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS matches_v3_player2_idx ON matches_v3(player2_address);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS deposits_v3_match_player_idx ON deposits_v3(match_id_onchain, player_address);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS deposits_v3_tx_status_idx ON deposits_v3(tx_status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS settlements_v3_tx_status_idx ON settlements_v3(tx_status);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS reward_events_v3_session_seq_idx ON reward_events_v3(session_id, seq);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS reward_events_v3_tx_status_idx ON reward_events_v3(tx_status);`);
}

const shouldAutoMigrate = process.env.SKIP_DB_MIGRATIONS !== 'true';
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export const dbInitPromise = shouldAutoMigrate
  ? withTimeout(ensureSchema(), schemaInitTimeoutMs, 'Database schema initialization')
  : Promise.resolve();

void dbInitPromise
  .then(() => {
    if (shouldAutoMigrate) {
      console.log('[db] Schema ensured');
    }
  })
  .catch((error) => {
    console.error('[db] Schema initialization failed:', error);
  });

// Export schema for convenience
export * from './schema.js';

// Close database connection (for clean shutdown)
export async function closeDb(): Promise<void> {
  await pool.end();
}
