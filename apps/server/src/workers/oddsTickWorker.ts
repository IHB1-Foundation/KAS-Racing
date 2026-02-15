/**
 * Odds Tick Worker
 *
 * Polls active markets and processes telemetry updates to compute odds.
 * Emits odds ticks via the Odds Engine Service when thresholds are met.
 *
 * Telemetry is received via submitTelemetry() from the match routes
 * (client sends telemetry snapshots during the race).
 * The worker processes the telemetry queue at a fixed interval.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { raceMarkets } from '../db/schema.js';
import {
  computeOdds,
  publishOddsTick,
  lockMarket,
  ODDS_TICK_INTERVAL_MS,
  ODDS_LOCK_BEFORE_END_MS,
  type RaceTelemetry,
} from '../services/oddsEngineService.js';

// ── Telemetry Queue ──
// Market routes push telemetry here; the worker consumes it.

const telemetryQueue = new Map<string, RaceTelemetry>(); // marketId → latest telemetry

/**
 * Submit telemetry for a market. Called by the match/market routes.
 * Only the latest snapshot per market is kept (newest wins).
 */
export function submitTelemetry(marketId: string, telemetry: RaceTelemetry): void {
  telemetryQueue.set(marketId, telemetry);
}

// ── Worker Loop ──

let isRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

const IDLE_POLL_INTERVAL_MS = 5000;

async function poll(): Promise<void> {
  if (!isRunning) return;

  try {
    // Get all OPEN markets
    const openMarkets = await db
      .select()
      .from(raceMarkets)
      .where(eq(raceMarkets.state, 'open'));

    if (openMarkets.length === 0) {
      // No active markets — idle
      pollTimer = setTimeout(() => { void poll(); }, IDLE_POLL_INTERVAL_MS);
      return;
    }

    let ticksEmitted = 0;

    for (const market of openMarkets) {
      const telemetry = telemetryQueue.get(market.id);
      if (!telemetry) continue;

      // Check if we should lock the market
      const timeRemaining = telemetry.totalDurationMs - telemetry.elapsedMs;
      if (timeRemaining <= ODDS_LOCK_BEFORE_END_MS) {
        await lockMarket(market.id);
        telemetryQueue.delete(market.id);
        continue;
      }

      // Compute and maybe publish
      const odds = computeOdds(telemetry);
      const result = await publishOddsTick(market.id, odds);

      if (result.emitted) {
        ticksEmitted++;
      }

      // Clear consumed telemetry
      telemetryQueue.delete(market.id);
    }

    if (ticksEmitted > 0) {
      console.log(`[oddsWorker] ${ticksEmitted} tick(s) emitted for ${openMarkets.length} market(s)`);
    }

    // Schedule next poll
    pollTimer = setTimeout(() => { void poll(); }, ODDS_TICK_INTERVAL_MS);

  } catch (error) {
    console.error('[oddsWorker] Poll error:', error);
    pollTimer = setTimeout(() => { void poll(); }, ODDS_TICK_INTERVAL_MS);
  }
}

/**
 * Start the odds tick worker.
 */
export function startOddsTickWorker(): void {
  if (isRunning) {
    console.warn('[oddsWorker] Already running');
    return;
  }

  console.log(`[oddsWorker] Starting (tick interval: ${ODDS_TICK_INTERVAL_MS}ms, lock threshold: ${ODDS_LOCK_BEFORE_END_MS}ms)`);
  isRunning = true;
  void poll();
}

/**
 * Stop the odds tick worker.
 */
export function stopOddsTickWorker(): void {
  if (!isRunning) return;

  console.log('[oddsWorker] Stopping');
  isRunning = false;

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

/**
 * Check if worker is running.
 */
export function isOddsTickWorkerRunning(): boolean {
  return isRunning;
}
