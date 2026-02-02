import { Router, type Request, type Response, type RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, sessions, type NewSession } from '../db/index.js';
import { processRewardRequest } from '../services/rewardService.js';
import type {
  SessionPolicy,
  StartSessionRequest,
  StartSessionResponse,
  SessionEventRequest,
  SessionEventResult,
} from '../types/index.js';

const router = Router();

// Default policy
const DEFAULT_POLICY: SessionPolicy = {
  rewardCooldownMs: 2000,
  rewardMaxPerSession: 10,
  rewardAmounts: [0.02, 0.05, 0.1],
};

// Policy constants
const TIMESTAMP_MAX_DRIFT_MS = 30000; // 30 seconds max drift from server time

// Async handler wrapper to fix TypeScript errors with Express
type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
};

/**
 * POST /api/session/start
 * Start a new game session
 */
router.post('/start', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as StartSessionRequest;

    if (!body.userAddress) {
      res.status(400).json({ error: 'userAddress is required' });
      return;
    }

    const mode = body.mode || 'free_run';
    if (mode !== 'free_run' && mode !== 'duel') {
      res.status(400).json({ error: 'mode must be free_run or duel' });
      return;
    }

    const sessionId = randomUUID();
    const now = new Date();

    // Create session in database
    const newSession: NewSession = {
      id: sessionId,
      userAddress: body.userAddress,
      mode,
      status: 'active',
      rewardCooldownMs: DEFAULT_POLICY.rewardCooldownMs,
      rewardMaxPerSession: DEFAULT_POLICY.rewardMaxPerSession,
      eventCount: 0,
      createdAt: now,
    };

    await db.insert(sessions).values(newSession);
    console.log(`[session] Created session ${sessionId} for ${body.userAddress} (${mode})`);

    const response: StartSessionResponse = {
      sessionId,
      policy: DEFAULT_POLICY,
    };

    res.json(response);
  } catch (error) {
    console.error('[session] Failed to create session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * POST /api/session/event
 * Report a game event (checkpoint collection)
 */
router.post('/event', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as SessionEventRequest;

    // Validate request
    if (!body.sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    // Get session from database
    const sessionResults = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, body.sessionId))
      .limit(1);

    const session = sessionResults[0];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'active') {
      const result: SessionEventResult = {
        accepted: false,
        rejectReason: 'SESSION_ENDED',
      };
      res.json(result);
      return;
    }

    // Policy checks
    const now = Date.now();

    // Timestamp sanity check
    if (body.timestamp) {
      const drift = Math.abs(now - body.timestamp);
      if (drift > TIMESTAMP_MAX_DRIFT_MS) {
        const result: SessionEventResult = {
          accepted: false,
          rejectReason: 'TIMESTAMP_INVALID',
        };
        res.json(result);
        return;
      }
    }

    // Check max events
    if (session.eventCount >= session.rewardMaxPerSession) {
      const result: SessionEventResult = {
        accepted: false,
        rejectReason: 'MAX_EVENTS_REACHED',
      };
      res.json(result);
      return;
    }

    // Check cooldown
    if (session.lastEventAt !== null) {
      const lastEventTime = session.lastEventAt instanceof Date
        ? session.lastEventAt.getTime()
        : session.lastEventAt;
      const elapsed = now - lastEventTime;
      if (elapsed < session.rewardCooldownMs) {
        const result: SessionEventResult = {
          accepted: false,
          rejectReason: 'COOLDOWN_ACTIVE',
        };
        res.json(result);
        return;
      }
    }

    // Select reward amount (simple rotation)
    const amounts = DEFAULT_POLICY.rewardAmounts;
    const rewardIndex = (session.eventCount + 1) % amounts.length;
    const rewardAmount = amounts[rewardIndex] ?? amounts[0] ?? 0.02;

    // Update session state first (for cooldown tracking)
    // This ensures cooldown check works even if rewardService is mocked
    await db
      .update(sessions)
      .set({
        eventCount: session.eventCount + 1,
        lastEventAt: new Date(now),
      })
      .where(eq(sessions.id, body.sessionId));

    // Process reward with idempotency
    const rewardResult = await processRewardRequest({
      sessionId: body.sessionId,
      seq: body.seq,
      type: body.type || 'checkpoint',
      rewardAmountKas: rewardAmount,
    });

    if (rewardResult.error) {
      console.warn(`[session] Reward processing error: ${rewardResult.error}`);
      const result: SessionEventResult = {
        accepted: false,
        rejectReason: rewardResult.error,
      };
      res.json(result);
      return;
    }

    // Success
    const result: SessionEventResult = {
      accepted: true,
      rewardAmount: rewardResult.rewardAmount,
      txid: rewardResult.txid ?? undefined,
    };

    console.log(`[session] Event accepted: session=${body.sessionId} seq=${body.seq} txid=${rewardResult.txid ?? 'null'}`);
    res.json(result);

  } catch (error) {
    console.error('[session] Event processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/session/:id
 * Get session info
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const sessionResults = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    const session = sessionResults[0];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const createdAtMs = session.createdAt instanceof Date
      ? session.createdAt.getTime()
      : session.createdAt;

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
      createdAt: createdAtMs,
    });
  } catch (error) {
    console.error('[session] Failed to get session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * POST /api/session/:id/end
 * End a session
 */
router.post('/:id/end', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const sessionResults = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    const session = sessionResults[0];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Update session status
    await db
      .update(sessions)
      .set({
        status: 'ended',
        endedAt: new Date(),
      })
      .where(eq(sessions.id, id));

    console.log(`[session] Session ${id} ended`);
    res.json({ ok: true, sessionId: id });

  } catch (error) {
    console.error('[session] Failed to end session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

export default router;
