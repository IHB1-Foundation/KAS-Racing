/**
 * Indexer Store (Postgres)
 *
 * Manages chain_events and indexer_state tables.
 * Uses raw pg for minimal dependencies — no ORM.
 */

import pg from 'pg';
import type { ChainEvent, IndexerState } from './types.js';

const { Pool } = pg;

export class IndexerStore {
  private pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    });
  }

  /**
   * Ensure indexer tables exist (idempotent).
   */
  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chain_events (
        id TEXT PRIMARY KEY,
        txid TEXT NOT NULL,
        event_type TEXT NOT NULL,
        match_id TEXT,
        session_id TEXT,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount_sompi BIGINT NOT NULL,
        daa_score BIGINT,
        accepted_at TIMESTAMPTZ,
        included_at TIMESTAMPTZ,
        confirmed_at TIMESTAMPTZ,
        confirmations INTEGER DEFAULT 0,
        payload TEXT,
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(txid, to_address)
      );

      CREATE INDEX IF NOT EXISTS chain_events_txid_idx ON chain_events(txid);
      CREATE INDEX IF NOT EXISTS chain_events_match_id_idx ON chain_events(match_id) WHERE match_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS chain_events_session_id_idx ON chain_events(session_id) WHERE session_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS chain_events_event_type_idx ON chain_events(event_type);
      CREATE INDEX IF NOT EXISTS chain_events_daa_score_idx ON chain_events(daa_score);

      CREATE TABLE IF NOT EXISTS indexer_state (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        last_processed_daa_score BIGINT NOT NULL DEFAULT 0,
        last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        watched_addresses TEXT[] NOT NULL DEFAULT '{}',
        events_processed INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO indexer_state (id) VALUES ('singleton')
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  /**
   * Get current indexer state.
   */
  async getState(): Promise<IndexerState> {
    const result = await this.pool.query(
      `SELECT * FROM indexer_state WHERE id = 'singleton'`
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      return {
        lastProcessedDaaScore: 0,
        lastRunAt: new Date(),
        watchedAddresses: [],
        eventsProcessed: 0,
      };
    }
    return {
      lastProcessedDaaScore: Number(row['last_processed_daa_score']),
      lastRunAt: new Date(row['last_run_at'] as string),
      watchedAddresses: row['watched_addresses'] as string[],
      eventsProcessed: Number(row['events_processed']),
    };
  }

  /**
   * Update indexer state.
   */
  async updateState(updates: Partial<IndexerState>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.lastProcessedDaaScore !== undefined) {
      sets.push(`last_processed_daa_score = $${idx++}`);
      values.push(updates.lastProcessedDaaScore);
    }
    if (updates.lastRunAt !== undefined) {
      sets.push(`last_run_at = $${idx++}`);
      values.push(updates.lastRunAt);
    }
    if (updates.watchedAddresses !== undefined) {
      sets.push(`watched_addresses = $${idx++}`);
      values.push(updates.watchedAddresses);
    }
    if (updates.eventsProcessed !== undefined) {
      sets.push(`events_processed = $${idx++}`);
      values.push(updates.eventsProcessed);
    }

    if (sets.length === 0) return;

    await this.pool.query(
      `UPDATE indexer_state SET ${sets.join(', ')} WHERE id = 'singleton'`,
      values
    );
  }

  /**
   * Insert a chain event (idempotent via UNIQUE constraint).
   * Returns true if inserted, false if already exists.
   */
  async insertEvent(event: ChainEvent): Promise<boolean> {
    try {
      await this.pool.query(
        `INSERT INTO chain_events (
          id, txid, event_type, match_id, session_id,
          from_address, to_address, amount_sompi,
          daa_score, accepted_at, included_at, confirmed_at,
          confirmations, payload, indexed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (txid, to_address) DO NOTHING`,
        [
          event.id, event.txid, event.eventType,
          event.matchId, event.sessionId,
          event.fromAddress, event.toAddress, event.amountSompi.toString(),
          event.daaScore, event.acceptedAt, event.includedAt, event.confirmedAt,
          event.confirmations, event.payload, event.indexedAt,
        ]
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update chain event status.
   */
  async updateEventStatus(
    txid: string,
    toAddress: string,
    updates: {
      daaScore?: number;
      acceptedAt?: Date;
      includedAt?: Date;
      confirmedAt?: Date;
      confirmations?: number;
    }
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.daaScore !== undefined) {
      sets.push(`daa_score = $${idx++}`);
      values.push(updates.daaScore);
    }
    if (updates.acceptedAt !== undefined) {
      sets.push(`accepted_at = $${idx++}`);
      values.push(updates.acceptedAt);
    }
    if (updates.includedAt !== undefined) {
      sets.push(`included_at = $${idx++}`);
      values.push(updates.includedAt);
    }
    if (updates.confirmedAt !== undefined) {
      sets.push(`confirmed_at = $${idx++}`);
      values.push(updates.confirmedAt);
    }
    if (updates.confirmations !== undefined) {
      sets.push(`confirmations = $${idx++}`);
      values.push(updates.confirmations);
    }

    if (sets.length === 0) return;

    values.push(txid, toAddress);
    await this.pool.query(
      `UPDATE chain_events SET ${sets.join(', ')} WHERE txid = $${idx++} AND to_address = $${idx}`,
      values
    );
  }

  /**
   * Get events by match ID.
   */
  async getEventsByMatch(matchId: string): Promise<ChainEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM chain_events WHERE match_id = $1 ORDER BY indexed_at`,
      [matchId]
    );
    return result.rows.map(mapRowToEvent);
  }

  /**
   * Get events by txid.
   */
  async getEventsByTxid(txid: string): Promise<ChainEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM chain_events WHERE txid = $1`,
      [txid]
    );
    return result.rows.map(mapRowToEvent);
  }

  /**
   * Get unconfirmed events for status tracking.
   */
  async getUnconfirmedEvents(): Promise<ChainEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM chain_events WHERE confirmed_at IS NULL ORDER BY indexed_at`
    );
    return result.rows.map(mapRowToEvent);
  }

  /**
   * Get total event count.
   */
  async getEventCount(): Promise<number> {
    const result = await this.pool.query(`SELECT COUNT(*) as count FROM chain_events`);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return Number(row?.['count'] ?? 0);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function mapRowToEvent(row: Record<string, unknown>): ChainEvent {
  return {
    id: row.id as string,
    txid: row.txid as string,
    eventType: row.event_type as ChainEvent['eventType'],
    matchId: row.match_id as string | null,
    sessionId: row.session_id as string | null,
    fromAddress: row.from_address as string,
    toAddress: row.to_address as string,
    amountSompi: BigInt(row.amount_sompi as string),
    daaScore: row.daa_score ? Number(row.daa_score) : null,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : null,
    includedAt: row.included_at ? new Date(row.included_at as string) : null,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at as string) : null,
    confirmations: Number(row.confirmations ?? 0),
    payload: row.payload as string | null,
    indexedAt: new Date(row.indexed_at as string),
  };
}
