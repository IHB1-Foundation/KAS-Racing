/**
 * EVM Event Bridge Worker
 *
 * Polls chain_events_evm for new indexed events from KASPLEX zkEVM.
 * Bridges them to:
 *  1. V3 DB tables (matches_v3, deposits_v3, settlements_v3, reward_events_v3)
 *  2. WebSocket subscribers (real-time UI updates)
 *  3. Latency metrics (submitted → mined → confirmed SLA)
 *
 * This is the "realtime pipeline" that connects the indexer to the frontend.
 */

import { gt, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chainEventsEvm, rewardEventsV3, matchesV3 } from '../db/schema.js';
import { syncMatchFromEvents, maybeAutoSettleMatch } from '../services/evmMatchService.js';
import { emitEvmChainEvent, emitEvmMatchUpdate, emitEvmRewardUpdate } from '../ws/index.js';
import { recordLatencyMetric, type LatencyMetric } from '../services/metricsService.js';
import type { EvmChainEventInfo } from '../types/evm.js';
import { eq } from 'drizzle-orm';

// Polling interval (default: 2 seconds)
const POLL_INTERVAL_MS = parseInt(process.env.EVM_BRIDGE_POLL_MS ?? '2000', 10);
const IDLE_POLL_INTERVAL_MS = parseInt(process.env.EVM_BRIDGE_IDLE_POLL_MS ?? '15000', 10);

let isRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let lastProcessedId = 0;

/**
 * Single poll iteration:
 * 1. Fetch new chain_events_evm since lastProcessedId
 * 2. Process each event (update v3 tables, emit WS, record metrics)
 */
async function poll(): Promise<void> {
  if (!isRunning) return;

  try {
    // Fetch new events since last processed
    const newEvents = await db
      .select()
      .from(chainEventsEvm)
      .where(gt(chainEventsEvm.id, lastProcessedId))
      .orderBy(chainEventsEvm.id)
      .limit(100);

    if (newEvents.length > 0) {
      console.log(`[evmBridge] Processing ${newEvents.length} new events (from id=${lastProcessedId + 1})`);

      for (const event of newEvents) {
        await processEvent(event);
        lastProcessedId = event.id;
      }
    }

    // Schedule next poll
    const nextInterval = newEvents.length > 0 ? POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
    pollTimer = setTimeout(() => { void poll(); }, nextInterval);

  } catch (error) {
    console.error('[evmBridge] Poll error:', error);
    pollTimer = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
  }
}

/**
 * Process a single indexed chain event.
 */
async function processEvent(event: {
  id: number;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
  contract: string;
  eventName: string;
  args: string;
  createdAt: Date;
}): Promise<void> {
  const args = parseArgs(event.args);
  const eventInfo: EvmChainEventInfo = {
    id: event.id,
    blockNumber: event.blockNumber.toString(),
    txHash: event.txHash,
    logIndex: event.logIndex,
    contract: event.contract,
    eventName: event.eventName,
    args,
    createdAt: event.createdAt instanceof Date ? event.createdAt.getTime() : Number(event.createdAt),
  };

  // Emit raw chain event to all subscribers
  emitEvmChainEvent(eventInfo);

  // Route to specific handler
  if (event.contract === 'MatchEscrow') {
    await processMatchEvent(event.eventName, args, eventInfo);
  } else if (event.contract === 'RewardVault') {
    await processRewardEvent(event.eventName, args, eventInfo);
  }
}

/**
 * Process MatchEscrow events → update matches_v3 + emit WS
 */
async function processMatchEvent(
  eventName: string,
  args: Record<string, unknown>,
  eventInfo: EvmChainEventInfo,
): Promise<void> {
  const matchIdOnchain = args.matchId as string | undefined;
  if (!matchIdOnchain) return;

  // Find match in DB
  const rows = await db
    .select()
    .from(matchesV3)
    .where(eq(matchesV3.matchIdOnchain, matchIdOnchain))
    .limit(1);

  const match = rows[0];
  if (!match) {
    console.log(`[evmBridge] Match not found for ${matchIdOnchain}, skipping event ${eventName}`);
    return;
  }

  // Sync match state from all events
  await syncMatchFromEvents(match.id);

  // Auto-settle immediately when funding is confirmed and both scores are already submitted
  if (eventName === 'MatchFunded') {
    try {
      const settled = await maybeAutoSettleMatch(match.id);
      if (settled) {
        console.log(`[evmBridge] Auto-settled funded match ${match.id}`);
      }
    } catch (error) {
      console.error(`[evmBridge] Auto-settlement failed for ${match.id}:`, error);
    }
  }

  // Record latency metrics for key events
  if (eventName === 'MatchFunded' || eventName === 'Settled' || eventName === 'Draw') {
    const metric: LatencyMetric = {
      entityType: 'match',
      entityId: match.id,
      event: eventName,
      txHash: eventInfo.txHash,
      blockNumber: eventInfo.blockNumber,
      minedAt: eventInfo.createdAt,
    };
    recordLatencyMetric(metric);
  }

  // Emit WS update
  emitEvmMatchUpdate(match.id, eventName, eventInfo);
}

/**
 * Process RewardVault events → update reward_events_v3 + emit WS
 */
async function processRewardEvent(
  eventName: string,
  args: Record<string, unknown>,
  eventInfo: EvmChainEventInfo,
): Promise<void> {
  if (eventName === 'RewardPaid' || eventName === 'ProofRecorded') {
    const sessionIdBytes = args.sessionId as string | undefined;
    const seq = args.seq as string | number | undefined;
    if (!sessionIdBytes || seq === undefined) return;

    // Update reward_events_v3 with mined status
    if (eventName === 'RewardPaid') {
      const seqNum = typeof seq === 'number' ? seq : parseInt(String(seq), 10);

      // Find reward event by txHash
      const rewardRows = await db
        .select()
        .from(rewardEventsV3)
        .where(eq(rewardEventsV3.txHash, eventInfo.txHash))
        .limit(1);

      if (rewardRows[0]) {
        await db
          .update(rewardEventsV3)
          .set({
            txStatus: 'mined',
            blockNumber: BigInt(eventInfo.blockNumber),
            minedAt: new Date(eventInfo.createdAt),
          })
          .where(eq(rewardEventsV3.id, rewardRows[0].id));
      }

      // Record latency metric
      const metric: LatencyMetric = {
        entityType: 'reward',
        entityId: `${sessionIdBytes}:${seqNum}`,
        event: eventName,
        txHash: eventInfo.txHash,
        blockNumber: eventInfo.blockNumber,
        minedAt: eventInfo.createdAt,
      };
      recordLatencyMetric(metric);
    }

    // Emit WS update with the session context
    emitEvmRewardUpdate(eventInfo.txHash, eventName, eventInfo);
  }
}

// ── Lifecycle ──

/**
 * Start the EVM event bridge worker.
 */
export async function startEvmEventBridge(): Promise<void> {
  if (isRunning) {
    console.warn('[evmBridge] Already running');
    return;
  }

  // Initialize cursor from DB (last event ID)
  try {
    const lastEvent = await db
      .select({ id: chainEventsEvm.id })
      .from(chainEventsEvm)
      .orderBy(desc(chainEventsEvm.id))
      .limit(1);

    lastProcessedId = lastEvent[0]?.id ?? 0;
  } catch {
    lastProcessedId = 0;
  }

  console.log(`[evmBridge] Starting (cursor=${lastProcessedId}, poll=${POLL_INTERVAL_MS}ms)`);
  isRunning = true;
  void poll();
}

/**
 * Stop the EVM event bridge worker.
 */
export function stopEvmEventBridge(): void {
  if (!isRunning) return;
  console.log('[evmBridge] Stopping');
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

export function isEvmEventBridgeRunning(): boolean {
  return isRunning;
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
