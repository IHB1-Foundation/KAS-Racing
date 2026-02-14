/**
 * Chain Query Service
 *
 * Provides a unified interface for querying on-chain data.
 * Strategy: indexer (chain_events table) first, REST API fallback.
 *
 * This ensures the frontend gets consistent data even when the
 * indexer hasn't caught up with the latest blocks.
 */

import { eq, desc } from 'drizzle-orm';
import { db, chainEvents } from '../db/index.js';
import { fetchTxStatus } from './txStatusService.js';
import type { ChainEvent } from '../db/schema.js';
import type { TxStatus } from '../types/index.js';

export interface ChainTxInfo {
  txid: string;
  status: TxStatus;
  source: 'indexer' | 'api' | 'db';
  daaScore?: bigint;
  confirmations: number;
  fromAddress?: string;
  toAddress?: string;
  amountSompi?: bigint;
  eventType?: string;
  payload?: string | null;
  indexedAt?: Date;
}

/**
 * Query chain events by txid from the indexer table.
 */
export async function getChainEventsByTxid(txid: string): Promise<ChainEvent[]> {
  return db
    .select()
    .from(chainEvents)
    .where(eq(chainEvents.txid, txid))
    .orderBy(desc(chainEvents.indexedAt));
}

/**
 * Query chain events by match ID.
 */
export async function getChainEventsByMatchId(matchId: string): Promise<ChainEvent[]> {
  return db
    .select()
    .from(chainEvents)
    .where(eq(chainEvents.matchId, matchId))
    .orderBy(desc(chainEvents.indexedAt));
}

/**
 * Query chain events by session ID.
 */
export async function getChainEventsBySessionId(sessionId: string): Promise<ChainEvent[]> {
  return db
    .select()
    .from(chainEvents)
    .where(eq(chainEvents.sessionId, sessionId))
    .orderBy(desc(chainEvents.indexedAt));
}

/**
 * Get transaction info with indexer-first, API-fallback strategy.
 *
 * 1. Check chain_events table (indexer data)
 * 2. If not found, query REST API directly
 */
export async function getChainTxInfo(txid: string): Promise<ChainTxInfo | null> {
  // Step 1: Check indexer data
  const indexerEvents = await getChainEventsByTxid(txid);

  if (indexerEvents.length > 0) {
    const event = indexerEvents[0]!;
    // Determine status from confirmations
    let status: TxStatus = 'included';
    if (event.confirmations >= 10) {
      status = 'confirmed';
    }

    return {
      txid: event.txid,
      status,
      source: 'indexer',
      daaScore: event.daaScore ?? undefined,
      confirmations: event.confirmations,
      fromAddress: event.fromAddress,
      toAddress: event.toAddress,
      amountSompi: event.amountSompi,
      eventType: event.eventType,
      payload: event.payload,
      indexedAt: event.indexedAt,
    };
  }

  // Step 2: Fallback to REST API
  const apiResult = await fetchTxStatus(txid);

  if (apiResult.error && !apiResult.accepted) {
    return null;
  }

  let status: TxStatus = 'broadcasted';
  if (apiResult.confirmations && apiResult.confirmations >= 10) {
    status = 'confirmed';
  } else if (apiResult.included) {
    status = 'included';
  } else if (apiResult.accepted) {
    status = 'accepted';
  }

  return {
    txid,
    status,
    source: 'api',
    confirmations: apiResult.confirmations ?? 0,
  };
}

/**
 * Get chain events for a match, enriching with API fallback if needed.
 * Returns deposit and settlement events from the indexer.
 */
export async function getMatchChainEvents(matchId: string): Promise<ChainEvent[]> {
  return getChainEventsByMatchId(matchId);
}
