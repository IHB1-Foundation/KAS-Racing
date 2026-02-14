/**
 * Deposit and Settlement Tracking Service
 *
 * Tracks deposit and settlement transaction status for duel matches.
 * Updates match state when deposits are confirmed and settlements complete.
 */

import { eq, and, inArray, or, isNotNull } from 'drizzle-orm';
import { db, matches, deposits, type Match } from '../db/index.js';
import { fetchTxStatus } from './txStatusService.js';
import { emitMatchUpdated, emitChainStateChanged, emitMatchStateChanged } from '../ws/index.js';
import type { TxStatus } from '../types/index.js';

// Minimum status required for a deposit to be considered "confirmed enough"
// For MVP, we accept 'accepted' as sufficient (fast feedback)
const MIN_DEPOSIT_STATUS: TxStatus = 'accepted';

// Status progression order
const STATUS_ORDER: TxStatus[] = ['pending', 'broadcasted', 'accepted', 'included', 'confirmed'];

/**
 * Check if status A is >= status B in the progression
 */
function isStatusAtLeast(status: TxStatus, minStatus: TxStatus): boolean {
  const statusIdx = STATUS_ORDER.indexOf(status);
  const minIdx = STATUS_ORDER.indexOf(minStatus);
  return statusIdx >= minIdx;
}

/**
 * Determine new status based on API result
 */
function determineNewDepositStatus(
  currentStatus: string | null,
  apiResult: { accepted: boolean; included: boolean; confirmations?: number }
): TxStatus | null {
  const current = currentStatus ?? 'broadcasted';

  // If already at final state, no change
  if (current === 'confirmed' || current === 'failed') {
    return null;
  }

  // Determine target status based on API result
  if (apiResult.confirmations && apiResult.confirmations >= 10) {
    if (current !== 'confirmed') return 'confirmed';
    return null;
  }
  if (apiResult.included) {
    if (current !== 'included' && current !== 'confirmed') return 'included';
    return null;
  }
  if (apiResult.accepted) {
    if (current === 'broadcasted') return 'accepted';
    return null;
  }

  return null;
}

/**
 * Update deposit status for a specific player in a match
 */
export async function updateMatchDepositStatus(
  matchId: string,
  player: 'A' | 'B',
  txid: string
): Promise<{
  updated: boolean;
  oldStatus: string | null;
  newStatus: TxStatus;
  matchReadyChanged: boolean;
}> {
  // Fetch current match state
  const matchResults = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  const match = matchResults[0];
  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const oldStatus = player === 'A' ? match.playerADepositStatus : match.playerBDepositStatus;

  // Skip if already at final state
  if (oldStatus === 'confirmed' || oldStatus === 'failed') {
    return {
      updated: false,
      oldStatus,
      newStatus: oldStatus as TxStatus,
      matchReadyChanged: false,
    };
  }

  // Fetch current TX status
  const apiResult = await fetchTxStatus(txid);

  if (apiResult.error) {
    console.warn(`[depositTracking] API error for ${txid}: ${apiResult.error}`);
    return {
      updated: false,
      oldStatus,
      newStatus: (oldStatus ?? 'broadcasted') as TxStatus,
      matchReadyChanged: false,
    };
  }

  // Determine new status
  const newStatus = determineNewDepositStatus(oldStatus, apiResult);

  if (!newStatus) {
    return {
      updated: false,
      oldStatus,
      newStatus: (oldStatus ?? 'broadcasted') as TxStatus,
      matchReadyChanged: false,
    };
  }

  // Update deposit status in DB
  const updateData = player === 'A'
    ? { playerADepositStatus: newStatus }
    : { playerBDepositStatus: newStatus };

  await db
    .update(matches)
    .set(updateData)
    .where(eq(matches.id, matchId));

  console.log(`[depositTracking] Match ${matchId} player ${player} deposit: ${oldStatus} → ${newStatus}`);

  // Also update v2 deposits table if it has a row
  try {
    await db
      .update(deposits)
      .set({
        txStatus: newStatus,
        ...(newStatus === 'accepted' ? { acceptedAt: new Date() } : {}),
        ...(newStatus === 'included' ? { includedAt: new Date() } : {}),
        ...(newStatus === 'confirmed' ? { confirmedAt: new Date() } : {}),
      })
      .where(
        and(
          eq(deposits.matchId, matchId),
          eq(deposits.player, player)
        )
      );
  } catch {
    // v2 deposit row may not exist yet — that's fine
  }

  // Check if match should transition to 'ready'
  const matchReadyChanged = await checkAndUpdateMatchReady(matchId);

  // Emit WebSocket updates
  const updatedMatch = await getMatch(matchId);
  if (updatedMatch) {
    emitMatchUpdated(matchId, updatedMatch);

    // Emit standardized chain state event
    emitChainStateChanged({
      entityType: 'deposit',
      entityId: matchId,
      txid,
      oldStatus: (oldStatus ?? 'broadcasted') as TxStatus,
      newStatus,
      timestamps: {
        broadcasted: Date.now(),
      },
      confirmations: newStatus === 'confirmed' ? 10 : 0,
      source: 'db',
    });

    // If match state changed (ready), emit match state change
    if (matchReadyChanged) {
      emitMatchStateChanged({
        matchId,
        oldStatus: 'deposits_pending',
        newStatus: 'ready',
        deposits: {
          A: { txid: updatedMatch.playerADepositTxid, status: updatedMatch.playerADepositStatus },
          B: { txid: updatedMatch.playerBDepositTxid, status: updatedMatch.playerBDepositStatus },
        },
        settlement: null,
        winner: null,
        scores: { A: null, B: null },
      });
    }
  }

  return {
    updated: true,
    oldStatus,
    newStatus,
    matchReadyChanged,
  };
}

/**
 * Check if both deposits are confirmed enough and update match to 'ready'
 */
async function checkAndUpdateMatchReady(matchId: string): Promise<boolean> {
  const matchResults = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  const match = matchResults[0];
  if (!match) return false;

  // Only transition from 'deposits_pending' to 'ready'
  if (match.status !== 'deposits_pending') return false;

  // Check if both deposits have txids and are at least 'accepted'
  const aReady = match.playerADepositTxid &&
    match.playerADepositStatus &&
    isStatusAtLeast(match.playerADepositStatus as TxStatus, MIN_DEPOSIT_STATUS);

  const bReady = match.playerBDepositTxid &&
    match.playerBDepositStatus &&
    isStatusAtLeast(match.playerBDepositStatus as TxStatus, MIN_DEPOSIT_STATUS);

  if (aReady && bReady) {
    await db
      .update(matches)
      .set({ status: 'ready' })
      .where(eq(matches.id, matchId));

    console.log(`[depositTracking] Match ${matchId} is now ready (both deposits accepted)`);
    return true;
  }

  return false;
}

/**
 * Get a match by ID
 */
async function getMatch(matchId: string): Promise<Match | null> {
  const results = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get all matches with pending deposits that need tracking
 */
export async function getMatchesWithPendingDeposits(): Promise<Match[]> {
  // Find matches in 'deposits_pending' status with at least one deposit txid
  // that is not yet confirmed
  return db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.status, 'deposits_pending'),
        or(
          and(
            isNotNull(matches.playerADepositTxid),
            inArray(matches.playerADepositStatus, ['broadcasted', 'accepted', 'included'])
          ),
          and(
            isNotNull(matches.playerBDepositTxid),
            inArray(matches.playerBDepositStatus, ['broadcasted', 'accepted', 'included'])
          )
        )
      )
    );
}

/**
 * Update all pending deposits
 */
export async function updateAllPendingDeposits(): Promise<{
  matchesChecked: number;
  depositsUpdated: number;
  matchesReady: number;
}> {
  const pendingMatches = await getMatchesWithPendingDeposits();

  let depositsUpdated = 0;
  let matchesReady = 0;

  for (const match of pendingMatches) {
    // Update player A deposit if pending
    if (
      match.playerADepositTxid &&
      match.playerADepositStatus &&
      ['broadcasted', 'accepted', 'included'].includes(match.playerADepositStatus)
    ) {
      const result = await updateMatchDepositStatus(match.id, 'A', match.playerADepositTxid);
      if (result.updated) depositsUpdated++;
      if (result.matchReadyChanged) matchesReady++;
    }

    // Update player B deposit if pending
    if (
      match.playerBDepositTxid &&
      match.playerBDepositStatus &&
      ['broadcasted', 'accepted', 'included'].includes(match.playerBDepositStatus)
    ) {
      const result = await updateMatchDepositStatus(match.id, 'B', match.playerBDepositTxid);
      if (result.updated) depositsUpdated++;
      if (result.matchReadyChanged) matchesReady++;
    }
  }

  return {
    matchesChecked: pendingMatches.length,
    depositsUpdated,
    matchesReady,
  };
}

// ============================================================================
// Settlement Tracking
// ============================================================================

/**
 * Update settlement status for a match
 */
export async function updateMatchSettlementStatus(
  matchId: string,
  txid: string
): Promise<{
  updated: boolean;
  oldStatus: string | null;
  newStatus: TxStatus;
}> {
  // Fetch current match state
  const matchResults = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  const match = matchResults[0];
  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const oldStatus = match.settleStatus;

  // Skip if already at final state
  if (oldStatus === 'confirmed' || oldStatus === 'failed') {
    return {
      updated: false,
      oldStatus,
      newStatus: oldStatus as TxStatus,
    };
  }

  // Fetch current TX status
  const apiResult = await fetchTxStatus(txid);

  if (apiResult.error) {
    console.warn(`[settlementTracking] API error for ${txid}: ${apiResult.error}`);
    return {
      updated: false,
      oldStatus,
      newStatus: (oldStatus ?? 'broadcasted') as TxStatus,
    };
  }

  // Determine new status
  const newStatus = determineNewDepositStatus(oldStatus, apiResult);

  if (!newStatus) {
    return {
      updated: false,
      oldStatus,
      newStatus: (oldStatus ?? 'broadcasted') as TxStatus,
    };
  }

  // Update settlement status in DB
  await db
    .update(matches)
    .set({ settleStatus: newStatus })
    .where(eq(matches.id, matchId));

  console.log(`[settlementTracking] Match ${matchId} settle status: ${oldStatus} → ${newStatus}`);

  // Emit WebSocket updates
  const updatedMatch = await getMatch(matchId);
  if (updatedMatch) {
    emitMatchUpdated(matchId, updatedMatch);

    // Emit standardized chain state event
    emitChainStateChanged({
      entityType: 'settlement',
      entityId: matchId,
      txid,
      oldStatus: (oldStatus ?? 'broadcasted') as TxStatus,
      newStatus,
      timestamps: {
        broadcasted: Date.now(),
      },
      confirmations: newStatus === 'confirmed' ? 10 : 0,
      source: 'db',
    });
  }

  return {
    updated: true,
    oldStatus,
    newStatus,
  };
}

/**
 * Get all matches with pending settlements that need tracking
 */
export async function getMatchesWithPendingSettlements(): Promise<Match[]> {
  return db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.status, 'finished'),
        isNotNull(matches.settleTxid),
        inArray(matches.settleStatus, ['broadcasted', 'accepted', 'included'])
      )
    );
}

/**
 * Update all pending settlements
 */
export async function updateAllPendingSettlements(): Promise<{
  matchesChecked: number;
  settlementsUpdated: number;
}> {
  const pendingMatches = await getMatchesWithPendingSettlements();

  let settlementsUpdated = 0;

  for (const match of pendingMatches) {
    if (match.settleTxid) {
      const result = await updateMatchSettlementStatus(match.id, match.settleTxid);
      if (result.updated) settlementsUpdated++;
    }
  }

  return {
    matchesChecked: pendingMatches.length,
    settlementsUpdated,
  };
}
