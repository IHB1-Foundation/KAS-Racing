import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 5,
    });
  }
  return pool;
}

/// Create indexer tables if not exist
export async function ensureTables(): Promise<void> {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS chain_events_evm (
      id              SERIAL PRIMARY KEY,
      block_number    BIGINT NOT NULL,
      tx_hash         TEXT NOT NULL,
      log_index       INTEGER NOT NULL,
      contract        TEXT NOT NULL,
      event_name      TEXT NOT NULL,
      args            JSONB NOT NULL DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tx_hash, log_index)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS indexer_cursor (
      id              INTEGER PRIMARY KEY DEFAULT 1,
      last_block      BIGINT NOT NULL DEFAULT 0,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Ensure cursor row exists
  await db.query(`
    INSERT INTO indexer_cursor (id, last_block)
    VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING;
  `);

  // Indexes for common queries
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_chain_events_evm_contract
    ON chain_events_evm(contract, event_name);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_chain_events_evm_block
    ON chain_events_evm(block_number);
  `);
}

/// Get the last indexed block
export async function getCursor(): Promise<bigint> {
  const db = getPool();
  const result = await db.query("SELECT last_block FROM indexer_cursor WHERE id = 1");
  return BigInt(result.rows[0]?.last_block || 0);
}

/// Update the last indexed block
export async function setCursor(blockNumber: bigint): Promise<void> {
  const db = getPool();
  await db.query(
    "UPDATE indexer_cursor SET last_block = $1, updated_at = NOW() WHERE id = 1",
    [blockNumber.toString()]
  );
}

/// Insert a chain event (idempotent via tx_hash + log_index)
export async function insertEvent(event: {
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
  contract: string;
  eventName: string;
  args: Record<string, unknown>;
}): Promise<boolean> {
  const db = getPool();
  try {
    await db.query(
      `INSERT INTO chain_events_evm (block_number, tx_hash, log_index, contract, event_name, args)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tx_hash, log_index) DO NOTHING`,
      [
        event.blockNumber.toString(),
        event.txHash,
        event.logIndex,
        event.contract,
        event.eventName,
        JSON.stringify(event.args),
      ]
    );
    return true;
  } catch (err) {
    console.error("[store] insert error:", err);
    return false;
  }
}

/// Handle reorg: delete events from blocks > safeBlock
export async function handleReorg(safeBlock: bigint): Promise<number> {
  const db = getPool();
  const result = await db.query(
    "DELETE FROM chain_events_evm WHERE block_number > $1",
    [safeBlock.toString()]
  );
  return result.rowCount || 0;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
