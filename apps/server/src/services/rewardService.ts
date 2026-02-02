/**
 * Reward Service
 *
 * Handles reward event processing with idempotency.
 * Manages the state machine: pending → broadcasted → accepted → included → confirmed
 *
 * Key guarantees:
 * - Each (sessionId, seq) pair can only have one reward event
 * - Duplicate requests return existing event without creating new tx
 * - State transitions are recorded with timestamps
 */

import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { rewardEvents, sessions, type RewardEvent, type NewRewardEvent } from '../db/schema.js';
import { sendRewardPayout, kasToSompi } from '../tx/index.js';
import { getConfig } from '../config/index.js';
import { generatePayload, isPayloadValid, type PayloadNetwork, type PayloadMode } from '../payload/index.js';

// TX Status enum matching schema
export type TxStatus = 'pending' | 'broadcasted' | 'accepted' | 'included' | 'confirmed' | 'failed';

// Result of processing a reward request
export interface RewardResult {
  eventId: string;
  sessionId: string;
  seq: number;
  rewardAmount: number; // in KAS
  txid: string | null;
  txStatus: TxStatus;
  isNew: boolean; // true if this is a new event, false if duplicate
  error?: string;
}

// Request to process a reward
export interface RewardRequest {
  sessionId: string;
  seq: number;
  type?: string;
  rewardAmountKas: number;
}

/**
 * Find existing reward event by sessionId and seq
 */
export async function findRewardEvent(
  sessionId: string,
  seq: number
): Promise<RewardEvent | null> {
  const results = await db
    .select()
    .from(rewardEvents)
    .where(and(
      eq(rewardEvents.sessionId, sessionId),
      eq(rewardEvents.seq, seq)
    ))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get reward event by ID
 */
export async function getRewardEventById(eventId: string): Promise<RewardEvent | null> {
  const results = await db
    .select()
    .from(rewardEvents)
    .where(eq(rewardEvents.id, eventId))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Process a reward request with idempotency
 *
 * If an event already exists for (sessionId, seq):
 * - Returns the existing event without modification
 * - isNew will be false
 *
 * If this is a new event:
 * - Creates the event in 'pending' state
 * - Attempts to broadcast the transaction
 * - Updates to 'broadcasted' or 'failed' state
 * - isNew will be true
 */
export async function processRewardRequest(
  request: RewardRequest
): Promise<RewardResult> {
  const { sessionId, seq, type = 'checkpoint', rewardAmountKas } = request;

  // Check for existing event (idempotency)
  const existing = await findRewardEvent(sessionId, seq);
  if (existing) {
    console.log(`[reward] Duplicate request for session=${sessionId} seq=${seq}, returning existing`);
    return {
      eventId: existing.id,
      sessionId: existing.sessionId,
      seq: existing.seq,
      rewardAmount: existing.rewardAmount,
      txid: existing.txid,
      txStatus: existing.txStatus as TxStatus,
      isNew: false,
    };
  }

  // Get session to find user address
  const sessionResults = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = sessionResults[0];
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.status !== 'active') {
    throw new Error(`Session is not active: ${sessionId}`);
  }

  // Create new reward event in pending state
  const eventId = randomUUID();
  const now = Date.now();

  const newEvent: NewRewardEvent = {
    id: eventId,
    sessionId,
    seq,
    type,
    rewardAmount: rewardAmountKas,
    txStatus: 'pending',
    createdAt: new Date(now),
  };

  await db.insert(rewardEvents).values(newEvent);
  console.log(`[reward] Created event ${eventId} for session=${sessionId} seq=${seq}`);

  // Update session event count
  await db
    .update(sessions)
    .set({
      eventCount: session.eventCount + 1,
      lastEventAt: new Date(now),
    })
    .where(eq(sessions.id, sessionId));

  // Attempt to broadcast transaction
  const config = getConfig();
  const amountSompi = kasToSompi(rewardAmountKas);

  // Validate minimum amount
  if (amountSompi < config.minRewardSompi) {
    console.log(`[reward] Amount ${amountSompi} below minimum ${config.minRewardSompi}`);
    await updateRewardEventStatus(eventId, 'failed');
    return {
      eventId,
      sessionId,
      seq,
      rewardAmount: rewardAmountKas,
      txid: null,
      txStatus: 'failed',
      isNew: true,
      error: `Amount below minimum: ${rewardAmountKas} KAS`,
    };
  }

  try {
    // Generate payload for Proof-of-Action
    const network = config.network as PayloadNetwork;
    const mode = session.mode as PayloadMode;

    const payload = generatePayload({
      network,
      mode,
      sessionId,
      event: 'checkpoint',
      seq,
    });

    // Validate payload size (check once, use the result)
    const payloadValid = isPayloadValid(payload);
    if (!payloadValid) {
      console.warn(`[reward] Payload too large (${payload.length} chars), sending without payload`);
    }

    console.log(`[reward] Generated payload: ${payload}`);

    // Broadcast transaction
    console.log(`[reward] Broadcasting tx for event ${eventId}...`);
    const result = await sendRewardPayout({
      toAddress: session.userAddress,
      amountSompi,
      payload: payloadValid ? payload : undefined,
    });

    // Update event with txid and broadcasted status
    await db
      .update(rewardEvents)
      .set({
        txid: result.txid,
        txStatus: 'broadcasted',
        broadcastedAt: new Date(),
      })
      .where(eq(rewardEvents.id, eventId));

    console.log(`[reward] Event ${eventId} broadcasted: ${result.txid}`);

    return {
      eventId,
      sessionId,
      seq,
      rewardAmount: rewardAmountKas,
      txid: result.txid,
      txStatus: 'broadcasted',
      isNew: true,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[reward] Failed to broadcast event ${eventId}:`, errorMsg);

    // Update to failed status
    await updateRewardEventStatus(eventId, 'failed');

    return {
      eventId,
      sessionId,
      seq,
      rewardAmount: rewardAmountKas,
      txid: null,
      txStatus: 'failed',
      isNew: true,
      error: errorMsg,
    };
  }
}

/**
 * Update reward event status
 */
export async function updateRewardEventStatus(
  eventId: string,
  status: TxStatus,
  txid?: string
): Promise<void> {
  const now = new Date();
  const updateData: Partial<RewardEvent> = { txStatus: status };

  if (txid) {
    updateData.txid = txid;
  }

  // Set timestamp based on status
  switch (status) {
    case 'broadcasted':
      updateData.broadcastedAt = now;
      break;
    case 'accepted':
      updateData.acceptedAt = now;
      break;
    case 'included':
      updateData.includedAt = now;
      break;
    case 'confirmed':
      updateData.confirmedAt = now;
      break;
  }

  await db
    .update(rewardEvents)
    .set(updateData)
    .where(eq(rewardEvents.id, eventId));
}

/**
 * Get all pending/broadcasted events that need status tracking
 */
export async function getPendingEvents(): Promise<RewardEvent[]> {
  return db
    .select()
    .from(rewardEvents)
    .where(eq(rewardEvents.txStatus, 'broadcasted'));
}

/**
 * Get events for a session
 */
export async function getSessionEvents(sessionId: string): Promise<RewardEvent[]> {
  return db
    .select()
    .from(rewardEvents)
    .where(eq(rewardEvents.sessionId, sessionId))
    .orderBy(rewardEvents.seq);
}
