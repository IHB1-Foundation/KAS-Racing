/**
 * TX Status Service
 *
 * Tracks transaction status using Kaspa REST API.
 * Updates DB and emits WebSocket events on status changes.
 */

import { eq, inArray } from 'drizzle-orm';
import { db, rewardEvents, type RewardEvent } from '../db/index.js';
import { getKaspaRestClient } from '../tx/kaspaRestClient.js';
import { getConfig } from '../config/index.js';
import { emitTxStatusUpdated } from '../ws/index.js';
import type { TxStatus } from '../types/index.js';

// Minimum confirmations to consider a tx fully confirmed
const CONFIRMATIONS_THRESHOLD = 10;

/**
 * Get transaction status from REST API
 */
export async function fetchTxStatus(txid: string): Promise<{
  accepted: boolean;
  included: boolean;
  confirmations?: number;
  acceptingBlockHash?: string;
  error?: string;
}> {
  try {
    const config = getConfig();
    const client = getKaspaRestClient(config.network);

    // Get acceptance status
    const acceptanceResults = await client.getTransactionAcceptance([txid]);
    const acceptance = acceptanceResults[0];

    if (!acceptance) {
      return { accepted: false, included: false };
    }

    // If accepted with a block hash, it's included in a block
    const included = !!(acceptance.accepted && acceptance.acceptingBlockHash);

    // Estimate confirmations based on blue score if available
    let confirmations: number | undefined;
    if (included && acceptance.acceptingBlueScore) {
      // We could compare with current blue score, but for now just mark as confirmed
      // In a real implementation, you'd query current blue score and calculate difference
      confirmations = 1; // At least 1 confirmation if included
    }

    return {
      accepted: acceptance.accepted,
      included,
      confirmations,
      acceptingBlockHash: acceptance.acceptingBlockHash,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[txStatus] Failed to fetch status for ${txid}:`, errorMsg);
    return { accepted: false, included: false, error: errorMsg };
  }
}

/**
 * Determine new status based on current status and API response
 */
function determineNewStatus(
  currentStatus: TxStatus,
  apiResult: { accepted: boolean; included: boolean; confirmations?: number }
): TxStatus | null {
  // Status transitions: broadcasted → accepted → included → confirmed
  switch (currentStatus) {
    case 'broadcasted':
      if (apiResult.included) {
        return apiResult.confirmations && apiResult.confirmations >= CONFIRMATIONS_THRESHOLD
          ? 'confirmed'
          : 'included';
      }
      if (apiResult.accepted) {
        return 'accepted';
      }
      return null;

    case 'accepted':
      if (apiResult.included) {
        return apiResult.confirmations && apiResult.confirmations >= CONFIRMATIONS_THRESHOLD
          ? 'confirmed'
          : 'included';
      }
      return null;

    case 'included':
      if (apiResult.confirmations && apiResult.confirmations >= CONFIRMATIONS_THRESHOLD) {
        return 'confirmed';
      }
      return null;

    default:
      return null;
  }
}

/**
 * Update a single transaction status
 */
export async function updateTxStatus(event: RewardEvent): Promise<{
  updated: boolean;
  oldStatus: TxStatus;
  newStatus: TxStatus;
}> {
  if (!event.txid) {
    return { updated: false, oldStatus: event.txStatus as TxStatus, newStatus: event.txStatus as TxStatus };
  }

  const oldStatus = event.txStatus as TxStatus;

  // Skip if already confirmed or failed
  if (oldStatus === 'confirmed' || oldStatus === 'failed' || oldStatus === 'pending') {
    return { updated: false, oldStatus, newStatus: oldStatus };
  }

  // Fetch current status from API
  const apiResult = await fetchTxStatus(event.txid);

  if (apiResult.error) {
    console.warn(`[txStatus] API error for ${event.txid}: ${apiResult.error}`);
    return { updated: false, oldStatus, newStatus: oldStatus };
  }

  // Determine if status should change
  const newStatus = determineNewStatus(oldStatus, apiResult);

  if (!newStatus || newStatus === oldStatus) {
    return { updated: false, oldStatus, newStatus: oldStatus };
  }

  // Update in database
  const now = new Date();
  const updateData: Partial<RewardEvent> = { txStatus: newStatus };

  switch (newStatus) {
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
    .where(eq(rewardEvents.id, event.id));

  console.log(`[txStatus] Updated ${event.txid}: ${oldStatus} → ${newStatus}`);

  // Emit WebSocket event
  emitTxStatusUpdated(event.sessionId, {
    txid: event.txid,
    status: newStatus,
    broadcastedAt: event.broadcastedAt?.getTime(),
    acceptedAt: updateData.acceptedAt?.getTime() ?? event.acceptedAt?.getTime(),
    includedAt: updateData.includedAt?.getTime() ?? event.includedAt?.getTime(),
    confirmedAt: updateData.confirmedAt?.getTime() ?? event.confirmedAt?.getTime(),
    confirmations: newStatus === 'confirmed' ? 10 : 0,
  });

  return { updated: true, oldStatus, newStatus };
}

/**
 * Get all pending/broadcasted/accepted/included events that need tracking
 */
export async function getTrackableEvents(): Promise<RewardEvent[]> {
  return db
    .select()
    .from(rewardEvents)
    .where(
      inArray(rewardEvents.txStatus, ['broadcasted', 'accepted', 'included'])
    );
}

/**
 * Update all trackable events
 */
export async function updateAllTrackableEvents(): Promise<{
  total: number;
  updated: number;
}> {
  const events = await getTrackableEvents();

  let updated = 0;
  for (const event of events) {
    const result = await updateTxStatus(event);
    if (result.updated) {
      updated++;
    }
  }

  return { total: events.length, updated };
}

/**
 * Get tx status from database
 */
export async function getTxStatusFromDb(txid: string): Promise<RewardEvent | null> {
  const results = await db
    .select()
    .from(rewardEvents)
    .where(eq(rewardEvents.txid, txid))
    .limit(1);

  return results[0] ?? null;
}
