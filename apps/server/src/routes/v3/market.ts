/**
 * V3 Market Routes — Live Race Market Betting
 *
 * Endpoints:
 *  POST /api/v3/market/:id/bet     — Place a bet
 *  POST /api/v3/market/:id/cancel  — Cancel a bet
 *  GET  /api/v3/market/:id         — Get market state + odds
 *  GET  /api/v3/market/match/:matchId — Get market by match ID
 *  POST /api/v3/market/:id/telemetry — Submit race telemetry (from client)
 */

import { Router, type Request, type Response, type RequestHandler } from 'express';
import {
  placeBet,
  cancelBet,
  getMarket,
  getMarketByMatchId,
  MarketOrderError,
} from '../../services/marketOrderService.js';
import {
  settleMarket,
  cancelMarket,
} from '../../services/marketSettlementService.js';
import {
  checkRateLimit,
  logAdminCancel,
} from '../../services/marketRiskService.js';
import { submitTelemetry } from '../../workers/oddsTickWorker.js';
import type { RaceTelemetry } from '../../services/oddsEngineService.js';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { oddsTicks, betOrders } from '../../db/schema.js';

const router = Router();

type AsyncHandler = (req: Request, res: Response) => Promise<void> | void;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
};

function handleMarketError(res: Response, error: unknown): void {
  if (error instanceof MarketOrderError) {
    res.status(error.httpStatus).json({ error: error.message, code: error.code });
  } else {
    console.error('[v3/market] Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/v3/market/:id/bet
 * Place a bet on a market outcome
 */
router.post('/:id/bet', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as {
      userId: string;
      side: 'A' | 'B';
      stakeWei: string;
      idempotencyKey: string;
    };

    if (!id) {
      res.status(400).json({ error: 'Market ID is required' });
      return;
    }
    if (!body.userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (!body.side || (body.side !== 'A' && body.side !== 'B')) {
      res.status(400).json({ error: 'side must be A or B' });
      return;
    }
    if (!body.stakeWei) {
      res.status(400).json({ error: 'stakeWei is required' });
      return;
    }
    if (!body.idempotencyKey) {
      res.status(400).json({ error: 'idempotencyKey is required' });
      return;
    }

    // Rate limit check
    if (!checkRateLimit(body.userId)) {
      res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' });
      return;
    }

    const result = await placeBet({
      marketId: id,
      userId: body.userId,
      side: body.side,
      stakeWei: body.stakeWei,
      idempotencyKey: body.idempotencyKey,
    });

    res.status(201).json(result);
  } catch (error) {
    handleMarketError(res, error);
  }
}));

/**
 * POST /api/v3/market/:id/cancel
 * Cancel a pending bet
 */
router.post('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      orderId: string;
      userId: string;
    };

    if (!body.orderId) {
      res.status(400).json({ error: 'orderId is required' });
      return;
    }
    if (!body.userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const result = await cancelBet({
      orderId: body.orderId,
      userId: body.userId,
    });

    res.json(result);
  } catch (error) {
    handleMarketError(res, error);
  }
}));

/**
 * GET /api/v3/market/:id
 * Get market state, current odds, and active bets
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Market ID is required' });
      return;
    }

    const market = await getMarket(id);
    if (!market) {
      res.status(404).json({ error: 'Market not found', code: 'MARKET_NOT_FOUND' });
      return;
    }

    // Get latest odds
    const latestOddsRows = await db
      .select()
      .from(oddsTicks)
      .where(eq(oddsTicks.marketId, id))
      .orderBy(desc(oddsTicks.seq))
      .limit(1);
    const latestOdds = latestOddsRows[0] ?? null;

    // Get active bet count
    const activeBets = await db
      .select()
      .from(betOrders)
      .where(eq(betOrders.marketId, id));

    res.json({
      market: {
        id: market.id,
        matchId: market.matchId,
        state: market.state,
        player1Address: market.player1Address,
        player2Address: market.player2Address,
        totalPoolWei: market.totalPoolWei,
        createdAt: market.createdAt instanceof Date
          ? market.createdAt.getTime()
          : Number(market.createdAt),
        lockedAt: market.lockedAt instanceof Date
          ? market.lockedAt.getTime()
          : market.lockedAt ? Number(market.lockedAt) : null,
        settledAt: market.settledAt instanceof Date
          ? market.settledAt.getTime()
          : market.settledAt ? Number(market.settledAt) : null,
      },
      odds: latestOdds ? {
        seq: latestOdds.seq,
        probABps: latestOdds.probABps,
        probBBps: latestOdds.probBBps,
        timestamp: latestOdds.createdAt instanceof Date
          ? latestOdds.createdAt.getTime()
          : Number(latestOdds.createdAt),
      } : null,
      bets: activeBets.map((b) => ({
        id: b.id,
        side: b.side,
        stakeWei: b.stakeWei,
        oddsAtPlacementBps: b.oddsAtPlacementBps,
        status: b.status,
        userId: b.userId,
        createdAt: b.createdAt instanceof Date
          ? b.createdAt.getTime()
          : Number(b.createdAt),
      })),
    });
  } catch (error) {
    handleMarketError(res, error);
  }
}));

/**
 * GET /api/v3/market/match/:matchId
 * Get market by match ID
 */
router.get('/match/:matchId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    if (!matchId) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    const market = await getMarketByMatchId(matchId);
    if (!market) {
      res.status(404).json({ error: 'Market not found for this match', code: 'MARKET_NOT_FOUND' });
      return;
    }

    res.json({ marketId: market.id, state: market.state, matchId: market.matchId });
  } catch (error) {
    handleMarketError(res, error);
  }
}));

/**
 * POST /api/v3/market/:id/telemetry
 * Submit race telemetry for odds calculation
 */
router.post('/:id/telemetry', asyncHandler((req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as RaceTelemetry;

    if (!id) {
      res.status(400).json({ error: 'Market ID is required' });
      return;
    }
    if (typeof body.player1Distance !== 'number' || typeof body.player2Distance !== 'number') {
      res.status(400).json({ error: 'player1Distance and player2Distance are required' });
      return;
    }

    submitTelemetry(id, {
      player1Distance: body.player1Distance,
      player1Speed: body.player1Speed ?? 0,
      player2Distance: body.player2Distance,
      player2Speed: body.player2Speed ?? 0,
      elapsedMs: body.elapsedMs ?? 0,
      totalDurationMs: body.totalDurationMs ?? 30000,
    });

    res.json({ accepted: true });
  } catch (error) {
    handleMarketError(res, error);
  }
}));

/**
 * POST /api/v3/market/:id/settle
 * Settle a market with the race result
 */
router.post('/:id/settle', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as { winnerSide: 'A' | 'B' | 'draw' };

    if (!id) {
      res.status(400).json({ error: 'Market ID is required' });
      return;
    }
    if (!body.winnerSide || !['A', 'B', 'draw'].includes(body.winnerSide)) {
      res.status(400).json({ error: 'winnerSide must be A, B, or draw' });
      return;
    }

    const result = await settleMarket(id, body.winnerSide);
    res.json(result);
  } catch (error) {
    handleMarketError(res, error);
  }
}));

/**
 * POST /api/v3/market/:id/cancel
 * Cancel a market (refund all bets)
 * Note: This is market-level cancel, not individual bet cancel
 */
router.post('/:id/cancel-market', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as { reason?: string; actor?: string };
    if (!id) {
      res.status(400).json({ error: 'Market ID is required' });
      return;
    }

    logAdminCancel(id, body.actor ?? 'api', body.reason ?? 'manual cancel');
    await cancelMarket(id);
    res.json({ cancelled: true });
  } catch (error) {
    handleMarketError(res, error);
  }
}));

export default router;
