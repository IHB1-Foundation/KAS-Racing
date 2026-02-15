/**
 * EVM Chain Query Service
 *
 * Queries chain_events_evm table (populated by indexer-evm) and
 * falls back to RPC for tx receipt when indexer hasn't caught up.
 *
 * Source-of-truth priority: indexed events > RPC receipt > pending DB state
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chainEventsEvm } from '../db/schema.js';
import type { EvmTxStatus, EvmTxStatusInfo, EvmChainEventInfo } from '../types/evm.js';

// ── Indexed Event Queries ──

/** Get all indexed events for a given tx hash */
export async function getEvmEventsByTxHash(txHash: string): Promise<EvmChainEventInfo[]> {
  const rows = await db
    .select()
    .from(chainEventsEvm)
    .where(eq(chainEventsEvm.txHash, txHash))
    .orderBy(chainEventsEvm.logIndex);

  return rows.map(toEventInfo);
}

/** Get all indexed events for a match (by matchId in args) */
export async function getEvmEventsByContract(
  contract: string,
  eventName?: string,
): Promise<EvmChainEventInfo[]> {
  const conditions = [eq(chainEventsEvm.contract, contract)];
  if (eventName) {
    conditions.push(eq(chainEventsEvm.eventName, eventName));
  }

  const rows = await db
    .select()
    .from(chainEventsEvm)
    .where(and(...conditions))
    .orderBy(desc(chainEventsEvm.blockNumber));

  return rows.map(toEventInfo);
}

/** Get all indexed events matching a contract + event name */
export async function getEvmEventsByContractEvent(
  contract: string,
  eventName: string,
): Promise<EvmChainEventInfo[]> {
  const rows = await db
    .select()
    .from(chainEventsEvm)
    .where(and(
      eq(chainEventsEvm.contract, contract),
      eq(chainEventsEvm.eventName, eventName),
    ))
    .orderBy(desc(chainEventsEvm.blockNumber));

  return rows.map(toEventInfo);
}

/**
 * Search chain events for a specific matchId in args.
 * Checks the JSON args field for the matchId value.
 */
export async function getEvmEventsByMatchId(matchIdOnchain: string): Promise<EvmChainEventInfo[]> {
  // Get all MatchEscrow events and filter by matchId in args
  const rows = await db
    .select()
    .from(chainEventsEvm)
    .where(eq(chainEventsEvm.contract, 'MatchEscrow'))
    .orderBy(desc(chainEventsEvm.blockNumber));

  return rows
    .filter(row => {
      const args = parseArgs(row.args);
      return args.matchId === matchIdOnchain;
    })
    .map(toEventInfo);
}

/**
 * Search chain events for a specific sessionId in args (RewardVault events).
 */
export async function getEvmEventsBySessionId(sessionIdOnchain: string): Promise<EvmChainEventInfo[]> {
  const rows = await db
    .select()
    .from(chainEventsEvm)
    .where(eq(chainEventsEvm.contract, 'RewardVault'))
    .orderBy(desc(chainEventsEvm.blockNumber));

  return rows
    .filter(row => {
      const args = parseArgs(row.args);
      return args.sessionId === sessionIdOnchain;
    })
    .map(toEventInfo);
}

// ── Tx Status ──

/**
 * Get EVM transaction status.
 * Strategy: chain_events_evm first, then RPC receipt fallback.
 */
export async function getEvmTxStatus(txHash: string): Promise<EvmTxStatusInfo> {
  const events = await getEvmEventsByTxHash(txHash);

  if (events.length > 0) {
    const blockNumber = events[0]!.blockNumber;
    const minedAt = events[0]!.createdAt;

    // If events are indexed, the tx is at least mined
    let status: EvmTxStatus = 'mined';
    let confirmations = 0;

    // Try to get current block for confirmation count
    try {
      const { getPublicClient } = await import('../tx/evmClient.js');
      const client = getPublicClient();
      const currentBlock = await client.getBlockNumber();
      const txBlock = BigInt(blockNumber);
      confirmations = Number(currentBlock - txBlock);
      if (confirmations >= 10) {
        status = 'confirmed';
      }
    } catch {
      // If RPC fails, still report as mined
    }

    return {
      txHash,
      status,
      blockNumber,
      confirmations,
      events,
      timestamps: {
        mined: minedAt,
        confirmed: status === 'confirmed' ? minedAt : undefined,
      },
    };
  }

  // Fallback: check RPC for tx receipt
  try {
    const { getPublicClient } = await import('../tx/evmClient.js');
    const client = getPublicClient();
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (receipt) {
      const currentBlock = await client.getBlockNumber();
      const confirmations = Number(currentBlock - receipt.blockNumber);
      const status: EvmTxStatus = confirmations >= 10 ? 'confirmed' : 'mined';

      return {
        txHash,
        status,
        blockNumber: receipt.blockNumber.toString(),
        confirmations,
        events: [],
        timestamps: {
          mined: Date.now(),
          confirmed: status === 'confirmed' ? Date.now() : undefined,
        },
      };
    }
  } catch {
    // Tx not found or RPC error
  }

  // Not found anywhere — may be pending or non-existent
  return {
    txHash,
    status: 'pending',
    blockNumber: null,
    confirmations: 0,
    events: [],
    timestamps: {},
  };
}

// ── Helpers ──

function parseArgs(argsRaw: string): Record<string, unknown> {
  try {
    if (typeof argsRaw === 'string') {
      const parsed: unknown = JSON.parse(argsRaw);
      return (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {};
    }
    return argsRaw as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toEventInfo(row: {
  id: number;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
  contract: string;
  eventName: string;
  args: string;
  createdAt: Date;
}): EvmChainEventInfo {
  return {
    id: row.id,
    blockNumber: row.blockNumber.toString(),
    txHash: row.txHash,
    logIndex: row.logIndex,
    contract: row.contract,
    eventName: row.eventName,
    args: parseArgs(row.args),
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
  };
}
