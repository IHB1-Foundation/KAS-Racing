/**
 * EVM Reward Service — Contract-first reward payouts
 *
 * Uses RewardVault contract for reward payouts.
 * Idempotency enforced at both DB level (session_id + seq) and
 * contract level (keccak256(sessionId, seq) mapping).
 *
 * Flow:
 *  1. Check DB for existing reward (reward_events_v3)
 *  2. Check contract isPaid() as secondary guard
 *  3. Build proof hash + payload
 *  4. Call payRewardOnchain()
 *  5. Record in reward_events_v3
 */

import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import {
  rewardEventsV3,
  sessions,
  type RewardEventV3,
  type NewRewardEventV3,
} from '../db/schema.js';
import {
  payRewardOnchain,
  isRewardPaid,
  toSessionId,
  buildProofHash,
} from '../tx/evmContracts.js';
import { getEvmEventsBySessionId } from './evmChainQueryService.js';
import { insertChainEvent, isE2EEnabled, nextMockTxHash } from '../utils/e2e.js';
import type {
  EvmTxStatus,
  V3RewardEventResponse,
  EvmChainEventInfo,
} from '../types/evm.js';
import type { Address } from 'viem';
import { toHex, toBytes } from 'viem';

// ── Reward Processing ──

export interface EvmRewardRequest {
  sessionId: string;
  seq: number;
  type?: string;
  rewardAmountWei: string; // wei as string
}

export interface EvmRewardResult {
  eventId: string;
  sessionId: string;
  seq: number;
  amountWei: string;
  txHash: string | null;
  txStatus: EvmTxStatus;
  isNew: boolean;
  error?: string;
}

/**
 * Process reward with dual idempotency (DB + contract).
 */
export async function processEvmReward(request: EvmRewardRequest): Promise<EvmRewardResult> {
  const { sessionId, seq, rewardAmountWei } = request;

  // 1. Check DB for existing reward
  const existing = await findRewardEventV3(sessionId, seq);
  if (existing) {
    console.log(`[evm-reward] Duplicate: session=${sessionId} seq=${seq}`);
    return {
      eventId: existing.id,
      sessionId: existing.sessionId,
      seq: existing.seq,
      amountWei: existing.amountWei,
      txHash: existing.txHash,
      txStatus: existing.txStatus as EvmTxStatus,
      isNew: false,
    };
  }

  // 2. Get session for recipient address
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = sessionRows[0];
  if (!session) {
    return errorResult(sessionId, seq, rewardAmountWei, 'Session not found');
  }
  if (session.status !== 'active') {
    return errorResult(sessionId, seq, rewardAmountWei, 'Session is not active');
  }

  // 3. Check contract idempotency (secondary guard)
  const sessionIdBytes32 = toSessionId(sessionId);
  try {
    const alreadyPaid = await isRewardPaid(sessionIdBytes32, BigInt(seq));
    if (alreadyPaid) {
      console.warn(`[evm-reward] Already paid on-chain: session=${sessionId} seq=${seq}`);
      return errorResult(sessionId, seq, rewardAmountWei, 'Already paid on-chain');
    }
  } catch (error) {
    // If contract check fails, proceed (DB check passed)
    console.warn(`[evm-reward] isPaid check failed, proceeding:`, error);
  }

  // 4. Create DB record in pending state
  const eventId = randomUUID();
  const network = (process.env.NETWORK ?? 'testnet').toLowerCase() === 'mainnet'
    ? 'mainnet'
    : 'testnet';

  const proofHash = buildProofHash({
    network,
    mode: session.mode,
    sessionId,
    event: 'checkpoint',
    seq,
  });

  const payloadText = `KASRACE1|${network}|${session.mode}|${sessionId}|checkpoint|${seq}`;
  const payloadHex = toHex(toBytes(payloadText));

  const newEvent: NewRewardEventV3 = {
    id: eventId,
    sessionId,
    seq,
    recipientAddress: session.userAddress,
    amountWei: rewardAmountWei,
    proofHash,
    txStatus: 'pending',
    createdAt: new Date(),
  };

  await db.insert(rewardEventsV3).values(newEvent);

  if (isE2EEnabled()) {
    const mockTxHash = nextMockTxHash();

    await db
      .update(rewardEventsV3)
      .set({
        txHash: mockTxHash,
        txStatus: 'submitted',
      })
      .where(eq(rewardEventsV3.id, eventId));

    const sessionIdBytes32 = toSessionId(sessionId);
    const createdAt = new Date();
    const { blockNumber } = await insertChainEvent({
      contract: 'RewardVault',
      eventName: 'RewardPaid',
      txHash: mockTxHash,
      createdAt,
      args: {
        sessionId: sessionIdBytes32,
        seq,
        recipient: session.userAddress,
        amount: rewardAmountWei,
      },
    });

    await insertChainEvent({
      contract: 'RewardVault',
      eventName: 'ProofRecorded',
      txHash: mockTxHash,
      blockNumber,
      createdAt: new Date(createdAt.getTime() + 5),
      args: {
        sessionId: sessionIdBytes32,
        seq,
        proofHash,
      },
    });

    return {
      eventId,
      sessionId,
      seq,
      amountWei: rewardAmountWei,
      txHash: mockTxHash,
      txStatus: 'submitted',
      isNew: true,
    };
  }

  // 5. Call contract
  try {
    const txResult = await payRewardOnchain({
      sessionId: sessionIdBytes32,
      seq: BigInt(seq),
      recipient: session.userAddress as Address,
      amountWei: BigInt(rewardAmountWei),
      proofHash: proofHash,
      payload: payloadHex,
    });

    // Update DB with tx hash
    await db
      .update(rewardEventsV3)
      .set({
        txHash: txResult.hash,
        txStatus: 'submitted',
      })
      .where(eq(rewardEventsV3.id, eventId));

    console.log(`[evm-reward] Reward tx submitted: ${txResult.hash}`);

    return {
      eventId,
      sessionId,
      seq,
      amountWei: rewardAmountWei,
      txHash: txResult.hash,
      txStatus: 'submitted',
      isNew: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[evm-reward] Reward tx failed: ${msg}`);

    await db
      .update(rewardEventsV3)
      .set({ txStatus: 'failed' })
      .where(eq(rewardEventsV3.id, eventId));

    return {
      eventId,
      sessionId,
      seq,
      amountWei: rewardAmountWei,
      txHash: null,
      txStatus: 'failed',
      isNew: true,
      error: msg,
    };
  }
}

// ── Query ──

/**
 * Get all reward events for a session, enriched with chain events.
 */
export async function getEvmSessionEvents(sessionId: string): Promise<V3RewardEventResponse[]> {
  const events = await db
    .select()
    .from(rewardEventsV3)
    .where(eq(rewardEventsV3.sessionId, sessionId))
    .orderBy(rewardEventsV3.seq);

  // Get chain events for this session
  const sessionIdBytes32 = toSessionId(sessionId);
  let chainEvents: EvmChainEventInfo[] = [];
  try {
    chainEvents = await getEvmEventsBySessionId(sessionIdBytes32);
  } catch {
    // Indexer may not be running
  }

  // Build chain event lookup by txHash
  const chainEventsByTx = new Map<string, EvmChainEventInfo[]>();
  for (const ce of chainEvents) {
    const list = chainEventsByTx.get(ce.txHash) ?? [];
    list.push(ce);
    chainEventsByTx.set(ce.txHash, list);
  }

  return events.map(event => {
    const evtChainEvents = event.txHash ? (chainEventsByTx.get(event.txHash) ?? []) : [];
    return {
      id: event.id,
      sessionId: event.sessionId,
      seq: event.seq,
      recipientAddress: event.recipientAddress,
      amountWei: event.amountWei,
      proofHash: event.proofHash,
      txHash: event.txHash,
      txStatus: event.txStatus as EvmTxStatus,
      blockNumber: event.blockNumber?.toString() ?? null,
      chainEvents: evtChainEvents,
      timestamps: {
        created: event.createdAt instanceof Date ? event.createdAt.getTime() : Number(event.createdAt),
        mined: event.minedAt instanceof Date ? event.minedAt.getTime() : null,
        confirmed: event.confirmedAt instanceof Date ? event.confirmedAt.getTime() : null,
      },
    };
  });
}

/**
 * Get proof data for a specific reward event.
 */
export async function getProofData(sessionId: string, seq: number): Promise<{
  sessionId: string;
  seq: number;
  proofHash: string | null;
  payload: string | null;
  txHash: string | null;
  blockNumber: string | null;
  verified: boolean;
  chainEvents: EvmChainEventInfo[];
}> {
  const event = await findRewardEventV3(sessionId, seq);
  if (!event) {
    return {
      sessionId,
      seq,
      proofHash: null,
      payload: null,
      txHash: null,
      blockNumber: null,
      verified: false,
      chainEvents: [],
    };
  }

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const session = sessionRows[0];
  const mode = session?.mode ?? 'free_run';
  const network = (process.env.NETWORK ?? 'testnet').toLowerCase() === 'mainnet'
    ? 'mainnet'
    : 'testnet';

  // Find ProofRecorded chain events
  let chainEvents: EvmChainEventInfo[] = [];
  if (event.txHash) {
    const { getEvmEventsByTxHash } = await import('./evmChainQueryService.js');
    chainEvents = await getEvmEventsByTxHash(event.txHash);
  }

  const hasProofEvent = chainEvents.some(e => e.eventName === 'ProofRecorded');

  return {
    sessionId,
    seq,
    proofHash: event.proofHash,
    payload: `KASRACE1|${network}|${mode}|${sessionId}|checkpoint|${seq}`,
    txHash: event.txHash,
    blockNumber: event.blockNumber?.toString() ?? null,
    verified: hasProofEvent,
    chainEvents,
  };
}

// ── Internal Helpers ──

async function findRewardEventV3(
  sessionId: string,
  seq: number,
): Promise<RewardEventV3 | null> {
  const rows = await db
    .select()
    .from(rewardEventsV3)
    .where(and(
      eq(rewardEventsV3.sessionId, sessionId),
      eq(rewardEventsV3.seq, seq),
    ))
    .limit(1);

  return rows[0] ?? null;
}

function errorResult(
  sessionId: string,
  seq: number,
  amountWei: string,
  error: string,
): EvmRewardResult {
  return {
    eventId: '',
    sessionId,
    seq,
    amountWei,
    txHash: null,
    txStatus: 'failed',
    isNew: false,
    error,
  };
}
