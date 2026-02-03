/**
 * Settlement Service (T-073)
 *
 * Handles settlement payouts for duel matches.
 *
 * Covenant Mode (Testnet):
 * - Spend escrow UTXOs directly to winner
 * - Uses oracle signature for covenant script
 *
 * Fallback Mode (Mainnet):
 * - Server holds deposits in treasury
 * - Settlement pays winner from treasury balance
 */

import { eq } from 'drizzle-orm';
import { db, matches, type Match } from '../db/index.js';
import { sendRewardPayout, kasToSompi } from '../tx/rewardPayout.js';
import { emitMatchUpdated } from '../ws/index.js';
import type { TxStatus } from '../types/index.js';
import {
  buildCovenantSettlementTx,
  canUseCovenantSettlement,
  getEscrowUtxo,
} from '../escrow/settlementTxBuilder.js';
import type { SettlementType, SettlementRequest } from '../escrow/types.js';

export interface SettlementResult {
  success: boolean;
  matchId: string;
  winnerId: string | null;
  winnerAddress: string | null;
  settleTxid: string | null;
  error?: string;
}

/**
 * Process settlement for a finished match
 *
 * Called when both players have submitted scores and winner is determined.
 * Pays the winner from treasury.
 */
export async function processSettlement(matchId: string): Promise<SettlementResult> {
  // Fetch match
  const matchResults = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  const match = matchResults[0];
  if (!match) {
    return {
      success: false,
      matchId,
      winnerId: null,
      winnerAddress: null,
      settleTxid: null,
      error: 'Match not found',
    };
  }

  // Check if already settled
  if (match.settleTxid) {
    console.log(`[settlement] Match ${matchId} already settled: ${match.settleTxid}`);
    return {
      success: true,
      matchId,
      winnerId: match.winnerId,
      winnerAddress: getWinnerAddress(match),
      settleTxid: match.settleTxid,
    };
  }

  // Check match status
  if (match.status !== 'finished') {
    return {
      success: false,
      matchId,
      winnerId: null,
      winnerAddress: null,
      settleTxid: null,
      error: `Match not finished (status: ${match.status})`,
    };
  }

  // Check winner
  if (!match.winnerId) {
    return {
      success: false,
      matchId,
      winnerId: null,
      winnerAddress: null,
      settleTxid: null,
      error: 'No winner determined',
    };
  }

  // Handle draw - no payout needed (return deposits in future implementation)
  if (match.winnerId === 'draw') {
    console.log(`[settlement] Match ${matchId} is a draw. No settlement payout.`);

    // Mark as settled with no txid
    await db
      .update(matches)
      .set({
        settleStatus: 'confirmed', // Draw is immediately confirmed
      })
      .where(eq(matches.id, matchId));

    return {
      success: true,
      matchId,
      winnerId: 'draw',
      winnerAddress: null,
      settleTxid: null,
    };
  }

  // Get winner address
  const winnerAddress = getWinnerAddress(match);
  if (!winnerAddress) {
    return {
      success: false,
      matchId,
      winnerId: match.winnerId,
      winnerAddress: null,
      settleTxid: null,
      error: `Winner address not found for player ${match.winnerId}`,
    };
  }

  // Check if we can use covenant settlement
  if (canUseCovenantSettlement(match)) {
    return processCovenantSettlement(match, matchId, winnerAddress);
  }

  // Fallback mode: pay from treasury
  return processFallbackSettlement(match, matchId, winnerAddress);
}

/**
 * Process settlement using covenant escrow (Testnet)
 */
async function processCovenantSettlement(
  match: Match,
  matchId: string,
  winnerAddress: string
): Promise<SettlementResult> {
  console.log(`[settlement] Using covenant mode for match ${matchId}`);

  try {
    // Mark as pending
    await db
      .update(matches)
      .set({ settleStatus: 'pending' })
      .where(eq(matches.id, matchId));

    // Fetch escrow UTXOs
    const escrowUtxoA = await getEscrowUtxo(
      match.playerADepositTxid!,
      match.escrowAddressA!
    );
    const escrowUtxoB = await getEscrowUtxo(
      match.playerBDepositTxid!,
      match.escrowAddressB!
    );

    if (!escrowUtxoA || !escrowUtxoB) {
      throw new Error('Failed to fetch escrow UTXOs');
    }

    // Determine settlement type
    const settlementType: SettlementType =
      match.winnerId === 'A' ? 'winner_A' :
      match.winnerId === 'B' ? 'winner_B' : 'draw';

    // Build and broadcast covenant settlement TX
    const request: SettlementRequest = {
      matchId,
      type: settlementType,
      depositA: escrowUtxoA,
      depositB: escrowUtxoB,
    };

    const result = buildCovenantSettlementTx(
      request,
      match.escrowScriptA!,
      match.escrowScriptB!,
      match.playerAAddress!,
      match.playerBAddress!
    );

    // Update match
    await db
      .update(matches)
      .set({
        settleTxid: result.txid,
        settleStatus: 'broadcasted',
      })
      .where(eq(matches.id, matchId));

    console.log(`[settlement] Covenant settlement for ${matchId}: ${result.txid}`);

    // Emit WebSocket update
    const updatedMatch = await getMatch(matchId);
    if (updatedMatch) {
      emitMatchUpdated(matchId, updatedMatch);
    }

    return {
      success: true,
      matchId,
      winnerId: match.winnerId,
      winnerAddress,
      settleTxid: result.txid,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[settlement] Covenant settlement failed for ${matchId}:`, errorMsg);

    // Fallback to treasury payout
    console.log(`[settlement] Falling back to treasury payout for ${matchId}`);
    return processFallbackSettlement(match, matchId, winnerAddress);
  }
}

/**
 * Process settlement using treasury payout (Mainnet fallback)
 */
async function processFallbackSettlement(
  match: Match,
  matchId: string,
  winnerAddress: string
): Promise<SettlementResult> {
  console.log(`[settlement] Using fallback mode for match ${matchId}`);

  // Calculate payout amount (bet amount * 2 - fee)
  // In fallback mode, winner gets both deposits minus a small platform fee
  const totalPot = match.betAmount * 2;
  const platformFeePercent = 0; // 0% fee for MVP demo
  const payoutAmount = totalPot * (1 - platformFeePercent);
  const payoutSompi = kasToSompi(payoutAmount);

  console.log(`[settlement] Match ${matchId}: paying ${payoutAmount} KAS to ${winnerAddress}`);

  try {
    // Mark as pending before broadcast
    await db
      .update(matches)
      .set({ settleStatus: 'pending' })
      .where(eq(matches.id, matchId));

    // Send settlement payout
    const result = await sendRewardPayout({
      toAddress: winnerAddress,
      amountSompi: payoutSompi,
      payload: `KASRACE|settle|${matchId}`,
    });

    // Update match with settlement txid
    await db
      .update(matches)
      .set({
        settleTxid: result.txid,
        settleStatus: 'broadcasted',
      })
      .where(eq(matches.id, matchId));

    console.log(`[settlement] Match ${matchId} settled: ${result.txid}`);

    // Emit WebSocket update
    const updatedMatch = await getMatch(matchId);
    if (updatedMatch) {
      emitMatchUpdated(matchId, updatedMatch);
    }

    return {
      success: true,
      matchId,
      winnerId: match.winnerId,
      winnerAddress,
      settleTxid: result.txid,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[settlement] Failed to settle match ${matchId}:`, errorMsg);

    // Mark as failed
    await db
      .update(matches)
      .set({ settleStatus: 'failed' })
      .where(eq(matches.id, matchId));

    // Emit WebSocket update
    const updatedMatch = await getMatch(matchId);
    if (updatedMatch) {
      emitMatchUpdated(matchId, updatedMatch);
    }

    return {
      success: false,
      matchId,
      winnerId: match.winnerId,
      winnerAddress,
      settleTxid: null,
      error: errorMsg,
    };
  }
}

/**
 * Get winner's address from match
 */
function getWinnerAddress(match: Match): string | null {
  if (match.winnerId === 'A') {
    return match.playerAAddress;
  }
  if (match.winnerId === 'B') {
    return match.playerBAddress;
  }
  return null;
}

/**
 * Get match by ID
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
 * Update settlement status
 */
export async function updateSettlementStatus(
  matchId: string,
  newStatus: TxStatus
): Promise<void> {
  await db
    .update(matches)
    .set({ settleStatus: newStatus })
    .where(eq(matches.id, matchId));

  console.log(`[settlement] Match ${matchId} settle status: ${newStatus}`);

  // Emit WebSocket update
  const updatedMatch = await getMatch(matchId);
  if (updatedMatch) {
    emitMatchUpdated(matchId, updatedMatch);
  }
}
