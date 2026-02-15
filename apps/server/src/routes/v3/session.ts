/**
 * V3 Session Routes — EVM Contract-first
 *
 * Session lifecycle is similar to v1, but rewards are paid
 * via RewardVault contract in kFUEL token units.
 */

import { Router, type Request, type Response, type RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, sessions, type NewSession } from '../../db/index.js';
import { processEvmReward, getEvmSessionEvents } from '../../services/evmRewardService.js';
import { parseEther } from 'viem';
import type { V3SessionEventRequest } from '../../types/evm.js';
import { normalizeEvmAddress } from '../../utils/evmAddress.js';

const router = Router();

interface SessionPolicy {
  rewardCooldownMs: number;
  rewardMaxPerSession: number;
  rewardAmounts: number[];
}

interface SessionEventResult {
  accepted: boolean;
  rejectReason?: string;
}

type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => { fn(req, res).catch(next); };
};

const DEFAULT_POLICY: SessionPolicy = {
  rewardCooldownMs: 2000,
  rewardMaxPerSession: 10,
  rewardAmounts: [0.02, 0.05, 0.1],
};

const TIMESTAMP_MAX_DRIFT_MS = 30000;

/**
 * POST /api/v3/session/start
 */
router.post('/start', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as { userAddress: string; mode?: string };

    if (!body.userAddress) {
      res.status(400).json({ error: 'userAddress is required' });
      return;
    }

    const mode = body.mode || 'free_run';
    if (mode !== 'free_run' && mode !== 'duel') {
      res.status(400).json({ error: 'mode must be free_run or duel' });
      return;
    }

    const normalizedAddress = normalizeEvmAddress(body.userAddress);
    if (!normalizedAddress) {
      res.status(400).json({ error: 'userAddress must be a valid EVM address' });
      return;
    }

    const sessionId = randomUUID();
    const newSession: NewSession = {
      id: sessionId,
      userAddress: normalizedAddress,
      mode,
      status: 'active',
      rewardCooldownMs: DEFAULT_POLICY.rewardCooldownMs,
      rewardMaxPerSession: DEFAULT_POLICY.rewardMaxPerSession,
      eventCount: 0,
      createdAt: new Date(),
    };

    await db.insert(sessions).values(newSession);
    console.log(`[v3/session] Created ${sessionId} for ${normalizedAddress} (${mode})`);

    res.json({ sessionId, policy: DEFAULT_POLICY });
  } catch (error) {
    console.error('[v3/session] Failed to create:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * POST /api/v3/session/event
 * Report checkpoint → pays reward via RewardVault contract (kFUEL)
 */
router.post('/event', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as V3SessionEventRequest;

    if (!body.sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    // Get session
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, body.sessionId))
      .limit(1);

    const session = sessionRows[0];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'active') {
      const result: SessionEventResult = { accepted: false, rejectReason: 'SESSION_ENDED' };
      res.json(result);
      return;
    }

    // Policy checks
    const now = Date.now();

    if (body.timestamp) {
      const drift = Math.abs(now - body.timestamp);
      if (drift > TIMESTAMP_MAX_DRIFT_MS) {
        res.json({ accepted: false, rejectReason: 'TIMESTAMP_INVALID' });
        return;
      }
    }

    if (session.eventCount >= session.rewardMaxPerSession) {
      res.json({ accepted: false, rejectReason: 'MAX_EVENTS_REACHED' });
      return;
    }

    if (session.lastEventAt !== null) {
      const lastTime = session.lastEventAt instanceof Date ? session.lastEventAt.getTime() : Number(session.lastEventAt);
      if (now - lastTime < session.rewardCooldownMs) {
        res.json({ accepted: false, rejectReason: 'COOLDOWN_ACTIVE' });
        return;
      }
    }

    // Select reward amount (rotation)
    const amounts = DEFAULT_POLICY.rewardAmounts;
    const idx = (session.eventCount + 1) % amounts.length;
    const rewardKas = amounts[idx] ?? amounts[0] ?? 0.02;
    const rewardWei = parseEther(rewardKas.toString()).toString();

    // Process reward via RewardVault contract
    const rewardResult = await processEvmReward({
      sessionId: body.sessionId,
      seq: body.seq,
      type: body.type || 'checkpoint',
      rewardAmountWei: rewardWei,
    });

    if (rewardResult.error) {
      console.warn(`[v3/session] Reward error: ${rewardResult.error}`);
      res.json({ accepted: false, rejectReason: rewardResult.error });
      return;
    }

    // Reward tx submission succeeded; update session counters after success.
    try {
      await db
        .update(sessions)
        .set({ eventCount: session.eventCount + 1, lastEventAt: new Date(now) })
        .where(eq(sessions.id, body.sessionId));
    } catch (counterError) {
      // The reward tx may already be on-chain; keep response successful to avoid
      // duplicate client retries. We can reconcile counters from DB events later.
      console.error('[v3/session] Failed to update session counters after reward submit:', counterError);
    }

    res.json({
      accepted: true,
      rewardAmountWei: rewardResult.amountWei,
      txHash: rewardResult.txHash,
      txStatus: rewardResult.txStatus,
      eventId: rewardResult.eventId,
    });
  } catch (error) {
    console.error('[v3/session] Event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/v3/session/:id
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    const session = rows[0];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      id: session.id,
      mode: session.mode,
      status: session.status,
      eventCount: session.eventCount,
      policy: {
        rewardCooldownMs: session.rewardCooldownMs,
        rewardMaxPerSession: session.rewardMaxPerSession,
        rewardAmounts: DEFAULT_POLICY.rewardAmounts,
      },
      createdAt: session.createdAt instanceof Date ? session.createdAt.getTime() : session.createdAt,
    });
  } catch (error) {
    console.error('[v3/session] Get failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/v3/session/:id/events
 * Get all reward events with EVM chain data
 */
router.get('/:id/events', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const events = await getEvmSessionEvents(id);

    res.json({ sessionId: id, events, total: events.length });
  } catch (error) {
    console.error('[v3/session] Events failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * POST /api/v3/session/:id/end
 */
router.post('/:id/end', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await db.update(sessions).set({ status: 'ended', endedAt: new Date() }).where(eq(sessions.id, id));
    res.json({ ok: true, sessionId: id });
  } catch (error) {
    console.error('[v3/session] End failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

export default router;
