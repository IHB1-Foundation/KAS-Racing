/**
 * Odds Engine Service — Real-time probability calculation for live race markets
 *
 * Computes win probabilities for each player based on race telemetry,
 * stores odds ticks with monotonic sequence numbers, and emits WS events.
 *
 * Rules (from ADR-003):
 *  - Probabilities stored as integer basis points (0–10000), always sum to 10000
 *  - Ticks only emitted when change ≥ ODDS_CHANGE_THRESHOLD_BPS
 *  - On LOCKED transition, one final tick is emitted with frozen odds
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  raceMarkets,
  oddsTicks,
  type RaceMarket,
  type NewOddsTick,
} from '../db/schema.js';
import { emitMarketTick, emitMarketLocked } from '../ws/index.js';

// ── Configuration ──

export const ODDS_TICK_INTERVAL_MS = parseInt(
  process.env.ODDS_TICK_INTERVAL_MS ?? '300',
  10,
);
export const ODDS_CHANGE_THRESHOLD_BPS = parseInt(
  process.env.ODDS_CHANGE_THRESHOLD_BPS ?? '200',
  10,
); // 200 bps = 2%
export const ODDS_LOCK_BEFORE_END_MS = parseInt(
  process.env.ODDS_LOCK_BEFORE_END_MS ?? '3000',
  10,
);

// ── Telemetry Input Type ──

export interface RaceTelemetry {
  player1Distance: number; // meters
  player1Speed: number;    // km/h
  player2Distance: number;
  player2Speed: number;
  elapsedMs: number;       // ms since race start
  totalDurationMs: number; // total race duration (e.g. 30000)
}

export interface OddsResult {
  probABps: number; // 0–10000
  probBBps: number; // 0–10000
}

export interface TickResult {
  emitted: boolean;
  seq: number;
  probABps: number;
  probBBps: number;
  reason: 'threshold_met' | 'below_threshold' | 'market_not_open';
}

// ── In-memory state per active market ──

interface MarketOddsState {
  lastProbABps: number;
  lastEmittedAt: number; // Date.now()
  nextSeq: number;
}

const marketStates = new Map<string, MarketOddsState>();

// ── Core: Compute Odds ──

/**
 * Compute win probabilities from race telemetry.
 *
 * Model: weighted combination of distance ratio and speed ratio,
 * adjusted by time remaining. As time runs out, distance matters more.
 *
 * Deterministic for same inputs.
 */
export function computeOdds(telemetry: RaceTelemetry): OddsResult {
  const {
    player1Distance,
    player1Speed,
    player2Distance,
    player2Speed,
    elapsedMs,
    totalDurationMs,
  } = telemetry;

  // Avoid division by zero at race start
  const totalDistance = player1Distance + player2Distance;
  if (totalDistance <= 0) {
    return { probABps: 5000, probBBps: 5000 };
  }

  // Time progress (0 = start, 1 = end)
  const timeProgress = Math.min(elapsedMs / totalDurationMs, 1);

  // Distance ratio (who has traveled further)
  const distRatio = player1Distance / totalDistance; // 0–1

  // Speed ratio (who is currently faster, for momentum)
  const totalSpeed = player1Speed + player2Speed;
  const speedRatio = totalSpeed > 0 ? player1Speed / totalSpeed : 0.5;

  // As time progresses, distance matters more, speed matters less
  // Early race: 60% distance, 40% speed
  // Late race:  90% distance, 10% speed
  const distWeight = 0.6 + 0.3 * timeProgress;
  const speedWeight = 1 - distWeight;

  const rawProbA = distRatio * distWeight + speedRatio * speedWeight;

  // Clamp to [0.05, 0.95] to avoid extreme odds
  const clampedProbA = Math.max(0.05, Math.min(0.95, rawProbA));

  // Convert to basis points, ensure they sum to 10000
  const probABps = Math.round(clampedProbA * 10000);
  const probBBps = 10000 - probABps;

  return { probABps, probBBps };
}

// ── Tick Publishing ──

/**
 * Attempt to publish an odds tick for a market.
 * Only emits if the change exceeds the threshold.
 */
export async function publishOddsTick(
  marketId: string,
  odds: OddsResult,
): Promise<TickResult> {
  // Get or initialize market state
  let state = marketStates.get(marketId);
  if (!state) {
    // Load last tick from DB to bootstrap
    const lastTick = await getLastTick(marketId);
    state = {
      lastProbABps: lastTick?.probABps ?? 5000,
      lastEmittedAt: 0,
      nextSeq: lastTick ? lastTick.seq + 1 : 0,
    };
    marketStates.set(marketId, state);
  }

  // Check if market is still open
  const market = await getMarket(marketId);
  if (!market || market.state !== 'open') {
    return {
      emitted: false,
      seq: state.nextSeq,
      probABps: odds.probABps,
      probBBps: odds.probBBps,
      reason: 'market_not_open',
    };
  }

  // Check threshold
  const change = Math.abs(odds.probABps - state.lastProbABps);
  if (change < ODDS_CHANGE_THRESHOLD_BPS) {
    return {
      emitted: false,
      seq: state.nextSeq,
      probABps: odds.probABps,
      probBBps: odds.probBBps,
      reason: 'below_threshold',
    };
  }

  // Emit tick
  const now = new Date();
  const seq = state.nextSeq;

  const tick: NewOddsTick = {
    marketId,
    seq,
    probABps: odds.probABps,
    probBBps: odds.probBBps,
    createdAt: now,
  };

  await db.insert(oddsTicks).values(tick);

  // Update in-memory state
  state.lastProbABps = odds.probABps;
  state.lastEmittedAt = Date.now();
  state.nextSeq = seq + 1;

  // WS broadcast
  emitMarketTick(marketId, {
    marketId,
    seq,
    probABps: odds.probABps,
    probBBps: odds.probBBps,
    timestamp: now.getTime(),
  });

  return {
    emitted: true,
    seq,
    probABps: odds.probABps,
    probBBps: odds.probBBps,
    reason: 'threshold_met',
  };
}

// ── Market Lock ──

/**
 * Lock a market — freeze odds, emit final tick, transition state.
 */
export async function lockMarket(marketId: string): Promise<void> {
  const market = await getMarket(marketId);
  if (!market || market.state !== 'open') {
    console.warn(`[oddsEngine] Cannot lock market ${marketId}: state=${market?.state}`);
    return;
  }

  const now = new Date();

  // Get last odds for final tick
  const state = marketStates.get(marketId);
  const finalProbABps = state?.lastProbABps ?? 5000;
  const finalProbBBps = 10000 - finalProbABps;
  const seq = state?.nextSeq ?? 0;

  // Insert final tick
  await db.insert(oddsTicks).values({
    marketId,
    seq,
    probABps: finalProbABps,
    probBBps: finalProbBBps,
    createdAt: now,
  });

  // Update market state
  await db
    .update(raceMarkets)
    .set({ state: 'locked', lockedAt: now })
    .where(eq(raceMarkets.id, marketId));

  // Broadcast
  emitMarketLocked(marketId, {
    marketId,
    finalProbABps,
    finalProbBBps,
    lockedAt: now.getTime(),
  });

  // Update in-memory
  if (state) {
    state.nextSeq = seq + 1;
  }

  console.log(`[oddsEngine] Market ${marketId} locked at seq=${seq}`);
}

// ── Cleanup ──

/**
 * Remove in-memory state for a market (call after settlement/cancellation).
 */
export function clearMarketState(marketId: string): void {
  marketStates.delete(marketId);
}

// ── Helpers ──

async function getMarket(marketId: string): Promise<RaceMarket | null> {
  const rows = await db
    .select()
    .from(raceMarkets)
    .where(eq(raceMarkets.id, marketId))
    .limit(1);
  return rows[0] ?? null;
}

async function getLastTick(marketId: string) {
  const rows = await db
    .select()
    .from(oddsTicks)
    .where(eq(oddsTicks.marketId, marketId))
    .orderBy(desc(oddsTicks.seq))
    .limit(1);
  return rows[0] ?? null;
}
