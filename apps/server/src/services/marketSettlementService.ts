/**
 * Market Settlement Service — Lock, settle, and pay out market bets
 *
 * Flow:
 *  1. lockMarketForSettlement() — Transition market to LOCKED (called by oddsWorker or race end)
 *  2. settleMarket() — Determine winner, calculate payouts, create settlement record
 *  3. On-chain payout is handled by the existing match settlement bridge
 *
 * Rules (ADR-003):
 *  - Once LOCKED, no bets/cancels accepted
 *  - total_payouts ≤ total_pool invariant enforced before settlement
 *  - Individual payouts: stake × (10000 / oddsAtPlacement_bps)
 */

import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import {
  raceMarkets,
  betOrders,
  marketSettlements,
  type RaceMarket,
  type BetOrder,
  type NewMarketSettlement,
} from '../db/schema.js';
import { emitMarketSettled } from '../ws/index.js';
import { clearMarketState } from './oddsEngineService.js';

// ── Settlement ──

export interface SettlementResult {
  marketId: string;
  winnerSide: 'A' | 'B' | 'draw';
  totalPoolWei: string;
  totalPayoutWei: string;
  payouts: Array<{
    orderId: string;
    userId: string;
    side: string;
    stakeWei: string;
    payoutWei: string;
    status: 'won' | 'lost';
  }>;
}

/**
 * Settle a market after race result is confirmed.
 *
 * @param marketId - The market to settle
 * @param winnerSide - 'A', 'B', or 'draw'
 */
export async function settleMarket(
  marketId: string,
  winnerSide: 'A' | 'B' | 'draw',
): Promise<SettlementResult> {
  // 1. Get market
  const marketRows = await db
    .select()
    .from(raceMarkets)
    .where(eq(raceMarkets.id, marketId))
    .limit(1);
  const market = marketRows[0];

  if (!market) {
    throw new Error(`Market ${marketId} not found`);
  }

  if (market.state !== 'locked' && market.state !== 'open') {
    throw new Error(`Market ${marketId} is ${market.state}, cannot settle`);
  }

  // 2. If still open, lock it first
  if (market.state === 'open') {
    await db
      .update(raceMarkets)
      .set({ state: 'locked', lockedAt: new Date() })
      .where(eq(raceMarkets.id, marketId));
  }

  // 3. Get all pending bets
  const allBets = await db
    .select()
    .from(betOrders)
    .where(
      and(
        eq(betOrders.marketId, marketId),
        eq(betOrders.status, 'pending'),
      ),
    );

  // 4. Calculate payouts
  const payouts: SettlementResult['payouts'] = [];
  let totalPayoutWei = 0n;
  const totalPoolWei = BigInt(market.totalPoolWei);
  const now = new Date();

  for (const bet of allBets) {
    const isWinner = winnerSide === 'draw' || bet.side === winnerSide;

    if (isWinner) {
      // Payout = stake × (10000 / oddsAtPlacement_bps)
      // This gives the fair payout based on odds at time of placement
      let payoutWei: bigint;

      if (winnerSide === 'draw') {
        // Draw: return stake to everyone
        payoutWei = BigInt(bet.stakeWei);
      } else {
        // Winner: payout based on locked odds
        payoutWei = BigInt(bet.stakeWei) * 10000n / BigInt(bet.oddsAtPlacementBps);
      }

      // Ensure total payouts don't exceed pool
      if (totalPayoutWei + payoutWei > totalPoolWei) {
        // Cap at remaining pool
        payoutWei = totalPoolWei - totalPayoutWei;
      }

      totalPayoutWei += payoutWei;

      await db
        .update(betOrders)
        .set({
          status: 'won',
          payoutWei: payoutWei.toString(),
          settledAt: now,
        })
        .where(eq(betOrders.id, bet.id));

      payouts.push({
        orderId: bet.id,
        userId: bet.userId,
        side: bet.side,
        stakeWei: bet.stakeWei,
        payoutWei: payoutWei.toString(),
        status: 'won',
      });
    } else {
      // Loser: stake is lost
      await db
        .update(betOrders)
        .set({
          status: 'lost',
          payoutWei: '0',
          settledAt: now,
        })
        .where(eq(betOrders.id, bet.id));

      payouts.push({
        orderId: bet.id,
        userId: bet.userId,
        side: bet.side,
        stakeWei: bet.stakeWei,
        payoutWei: '0',
        status: 'lost',
      });
    }
  }

  // 5. Create settlement record
  const settlementId = randomUUID();
  const settlement: NewMarketSettlement = {
    id: settlementId,
    marketId,
    winnerSide,
    totalPoolWei: totalPoolWei.toString(),
    totalPayoutWei: totalPayoutWei.toString(),
    platformFeeWei: (totalPoolWei - totalPayoutWei).toString(),
    txHash: null, // Will be set when on-chain tx is sent
    txStatus: 'pending',
    createdAt: now,
    minedAt: null,
    confirmedAt: null,
  };

  await db.insert(marketSettlements).values(settlement);

  // 6. Update market state
  await db
    .update(raceMarkets)
    .set({ state: 'settled', settledAt: now })
    .where(eq(raceMarkets.id, marketId));

  // 7. Clean up in-memory odds state
  clearMarketState(marketId);

  // 8. WS broadcast
  emitMarketSettled(marketId, {
    marketId,
    winnerSide,
    totalPoolWei: totalPoolWei.toString(),
    totalPayoutWei: totalPayoutWei.toString(),
    txHash: null,
  });

  console.log(`[marketSettlement] Market ${marketId} settled: winner=${winnerSide}, pool=${totalPoolWei}, payout=${totalPayoutWei}, bets=${allBets.length}`);

  return {
    marketId,
    winnerSide,
    totalPoolWei: totalPoolWei.toString(),
    totalPayoutWei: totalPayoutWei.toString(),
    payouts,
  };
}

/**
 * Cancel a market — refund all pending bets.
 */
export async function cancelMarket(marketId: string): Promise<void> {
  const marketRows = await db
    .select()
    .from(raceMarkets)
    .where(eq(raceMarkets.id, marketId))
    .limit(1);
  const market = marketRows[0];

  if (!market) {
    throw new Error(`Market ${marketId} not found`);
  }

  if (market.state === 'settled' || market.state === 'cancelled') {
    throw new Error(`Market ${marketId} is already ${market.state}`);
  }

  const now = new Date();

  // Mark all pending bets as cancelled
  await db
    .update(betOrders)
    .set({ status: 'cancelled', settledAt: now })
    .where(
      and(
        eq(betOrders.marketId, marketId),
        eq(betOrders.status, 'pending'),
      ),
    );

  // Update market state
  await db
    .update(raceMarkets)
    .set({ state: 'cancelled', cancelledAt: now })
    .where(eq(raceMarkets.id, marketId));

  // Clean up
  clearMarketState(marketId);

  console.log(`[marketSettlement] Market ${marketId} cancelled`);
}
