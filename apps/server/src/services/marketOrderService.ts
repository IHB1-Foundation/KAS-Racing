/**
 * Market Order Service — Bet placement and cancellation
 *
 * Handles bet/cancel validation, idempotency, exposure limits,
 * and DB persistence for live race markets.
 *
 * Rules (from ADR-003):
 *  - Bets accepted only when market state = OPEN
 *  - Cancel allowed only when market state = OPEN and by bet owner
 *  - Idempotency via unique idempotency_key per bet order
 *  - Exposure limits per user per market
 */

import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import {
  raceMarkets,
  betOrders,
  betCancels,
  oddsTicks,
  type RaceMarket,
  type BetOrder,
  type NewBetOrder,
  type NewRaceMarket,
} from '../db/schema.js';
import { emitBetAccepted, emitBetCancelled } from '../ws/index.js';

// ── Configuration ──

const MAX_BET_WEI = BigInt(process.env.MAX_BET_WEI ?? '1000000000000000000'); // 1 KAS
const MIN_BET_WEI = BigInt(process.env.MIN_BET_WEI ?? '10000000000000000');   // 0.01 KAS
const MAX_EXPOSURE_WEI = BigInt(process.env.MAX_EXPOSURE_WEI ?? '5000000000000000000'); // 5 KAS
const MAX_POOL_WEI = BigInt(process.env.MAX_POOL_WEI ?? '50000000000000000000'); // 50 KAS

// ── Error Types ──

export class MarketOrderError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'MarketOrderError';
  }
}

// ── Market Creation ──

/**
 * Create a market for a funded match. Called when match enters 'funded' state.
 */
export async function createMarket(
  matchId: string,
  player1Address: string,
  player2Address: string,
): Promise<RaceMarket> {
  const id = randomUUID();
  const now = new Date();

  const market: NewRaceMarket = {
    id,
    matchId,
    state: 'open',
    player1Address,
    player2Address,
    totalPoolWei: '0',
    oddsTicks: 0,
    lockBeforeEndMs: 3000,
    createdAt: now,
  };

  await db.insert(raceMarkets).values(market);

  console.log(`[marketOrder] Market created: ${id} for match ${matchId}`);
  return { ...market, lockedAt: null, settledAt: null, cancelledAt: null } as RaceMarket;
}

// ── Bet Placement ──

export interface PlaceBetRequest {
  marketId: string;
  userId: string;
  side: 'A' | 'B';
  stakeWei: string;
  idempotencyKey: string;
}

export interface PlaceBetResult {
  orderId: string;
  side: 'A' | 'B';
  stakeWei: string;
  oddsAtPlacementBps: number;
  status: string;
}

/**
 * Place a bet on a market outcome.
 */
export async function placeBet(req: PlaceBetRequest): Promise<PlaceBetResult> {
  // 1. Idempotency check — return existing if duplicate
  const existing = await findByIdempotencyKey(req.idempotencyKey);
  if (existing) {
    const side = existing.side === 'A' || existing.side === 'B' ? existing.side : 'A';
    return {
      orderId: existing.id,
      side,
      stakeWei: existing.stakeWei,
      oddsAtPlacementBps: existing.oddsAtPlacementBps,
      status: existing.status,
    };
  }

  // 2. Validate market state
  const market = await getMarket(req.marketId);
  if (!market) {
    throw new MarketOrderError('Market not found', 'MARKET_NOT_FOUND', 404);
  }
  if (market.state !== 'open') {
    throw new MarketOrderError(
      `Market is ${market.state}, bets not accepted`,
      'MARKET_NOT_OPEN',
    );
  }

  // 3. Validate side
  if (req.side !== 'A' && req.side !== 'B') {
    throw new MarketOrderError('Side must be A or B', 'INVALID_SIDE');
  }

  // 4. Validate stake amount
  const stakeWei = BigInt(req.stakeWei);
  if (stakeWei < MIN_BET_WEI) {
    throw new MarketOrderError(
      `Minimum bet is ${MIN_BET_WEI.toString()} wei`,
      'BELOW_MIN_BET',
    );
  }
  if (stakeWei > MAX_BET_WEI) {
    throw new MarketOrderError(
      `Maximum bet is ${MAX_BET_WEI.toString()} wei`,
      'ABOVE_MAX_BET',
    );
  }

  // 5. Check exposure limit
  const currentExposure = await getUserExposure(req.userId, req.marketId);
  if (currentExposure + stakeWei > MAX_EXPOSURE_WEI) {
    throw new MarketOrderError(
      `Exposure limit exceeded (max ${MAX_EXPOSURE_WEI.toString()} wei)`,
      'EXPOSURE_LIMIT',
    );
  }

  // 6. Check pool limit
  const currentPool = BigInt(market.totalPoolWei);
  if (currentPool + stakeWei > MAX_POOL_WEI) {
    throw new MarketOrderError(
      `Market pool limit exceeded`,
      'POOL_LIMIT',
    );
  }

  // 7. Get current odds at placement
  const latestOdds = await getLatestOdds(req.marketId);
  const oddsForSide = req.side === 'A'
    ? (latestOdds?.probABps ?? 5000)
    : (latestOdds?.probBBps ?? 5000);

  // 8. Insert bet order
  const orderId = randomUUID();
  const now = new Date();

  const order: NewBetOrder = {
    id: orderId,
    marketId: req.marketId,
    userId: req.userId,
    side: req.side,
    stakeWei: req.stakeWei,
    oddsAtPlacementBps: oddsForSide,
    status: 'pending',
    payoutWei: null,
    idempotencyKey: req.idempotencyKey,
    createdAt: now,
    settledAt: null,
  };

  await db.insert(betOrders).values(order);

  // 9. Update market pool
  const newPool = (currentPool + stakeWei).toString();
  await db
    .update(raceMarkets)
    .set({ totalPoolWei: newPool })
    .where(eq(raceMarkets.id, req.marketId));

  // 10. WS broadcast
  emitBetAccepted(req.marketId, {
    marketId: req.marketId,
    orderId,
    side: req.side,
    stakeWei: req.stakeWei,
    oddsAtPlacementBps: oddsForSide,
  });

  console.log(`[marketOrder] Bet placed: ${orderId} on market ${req.marketId} side=${req.side} stake=${req.stakeWei}`);

  return {
    orderId,
    side: req.side,
    stakeWei: req.stakeWei,
    oddsAtPlacementBps: oddsForSide,
    status: 'pending',
  };
}

// ── Bet Cancellation ──

export interface CancelBetRequest {
  orderId: string;
  userId: string;
}

export interface CancelBetResult {
  orderId: string;
  cancelled: boolean;
}

/**
 * Cancel a pending bet order.
 */
export async function cancelBet(req: CancelBetRequest): Promise<CancelBetResult> {
  // 1. Find order
  const order = await getOrder(req.orderId);
  if (!order) {
    throw new MarketOrderError('Order not found', 'ORDER_NOT_FOUND', 404);
  }

  // 2. Check ownership
  if (order.userId !== req.userId) {
    throw new MarketOrderError('Not the order owner', 'NOT_OWNER', 403);
  }

  // 3. Check order is still pending
  if (order.status !== 'pending') {
    throw new MarketOrderError(
      `Order is ${order.status}, cannot cancel`,
      'ORDER_NOT_PENDING',
    );
  }

  // 4. Check market state
  const market = await getMarket(order.marketId);
  if (!market || market.state !== 'open') {
    throw new MarketOrderError(
      `Market is ${market?.state ?? 'unknown'}, cancellation not allowed`,
      'MARKET_LOCKED',
    );
  }

  // 5. Mark order as cancelled
  await db
    .update(betOrders)
    .set({ status: 'cancelled' })
    .where(eq(betOrders.id, req.orderId));

  // 6. Insert cancel record
  await db.insert(betCancels).values({
    orderId: req.orderId,
    reason: 'user_requested',
    cancelledAt: new Date(),
  });

  // 7. Reduce market pool
  const stakeWei = BigInt(order.stakeWei);
  const newPool = (BigInt(market.totalPoolWei) - stakeWei).toString();
  await db
    .update(raceMarkets)
    .set({ totalPoolWei: newPool })
    .where(eq(raceMarkets.id, order.marketId));

  // 8. WS broadcast
  emitBetCancelled(order.marketId, {
    marketId: order.marketId,
    orderId: req.orderId,
  });

  console.log(`[marketOrder] Bet cancelled: ${req.orderId}`);

  return { orderId: req.orderId, cancelled: true };
}

// ── Query Helpers ──

export async function getMarket(marketId: string): Promise<RaceMarket | null> {
  const rows = await db
    .select()
    .from(raceMarkets)
    .where(eq(raceMarkets.id, marketId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMarketByMatchId(matchId: string): Promise<RaceMarket | null> {
  const rows = await db
    .select()
    .from(raceMarkets)
    .where(eq(raceMarkets.matchId, matchId))
    .limit(1);
  return rows[0] ?? null;
}

async function getOrder(orderId: string): Promise<BetOrder | null> {
  const rows = await db
    .select()
    .from(betOrders)
    .where(eq(betOrders.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

async function findByIdempotencyKey(key: string): Promise<BetOrder | null> {
  const rows = await db
    .select()
    .from(betOrders)
    .where(eq(betOrders.idempotencyKey, key))
    .limit(1);
  return rows[0] ?? null;
}

async function getUserExposure(userId: string, marketId: string): Promise<bigint> {
  const rows = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${betOrders.stakeWei} AS BIGINT)), 0)`,
    })
    .from(betOrders)
    .where(
      and(
        eq(betOrders.userId, userId),
        eq(betOrders.marketId, marketId),
        eq(betOrders.status, 'pending'),
      ),
    );
  return BigInt(rows[0]?.total ?? '0');
}

async function getLatestOdds(marketId: string) {
  const rows = await db
    .select()
    .from(oddsTicks)
    .where(eq(oddsTicks.marketId, marketId))
    .orderBy(sql`${oddsTicks.seq} DESC`)
    .limit(1);
  return rows[0] ?? null;
}
