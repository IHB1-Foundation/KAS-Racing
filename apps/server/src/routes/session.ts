import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import type {
  Session,
  SessionPolicy,
  StartSessionRequest,
  StartSessionResponse,
  SessionEventRequest,
  SessionEventResult,
} from '../types/index.js';

const router = Router();

// In-memory session store (will be replaced with DB in T-021)
const sessions = new Map<string, Session>();

// Default policy
const DEFAULT_POLICY: SessionPolicy = {
  rewardCooldownMs: 2000,
  rewardMaxPerSession: 10,
  rewardAmounts: [0.02, 0.05, 0.1],
};

/**
 * POST /api/session/start
 * Start a new game session
 */
router.post('/start', (req: Request, res: Response) => {
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
  const session: Session = {
    id: sessionId,
    userAddress: body.userAddress,
    mode,
    policy: { ...DEFAULT_POLICY },
    status: 'active',
    createdAt: Date.now(),
    eventCount: 0,
    lastEventAt: null,
  };

  sessions.set(sessionId, session);

  const response: StartSessionResponse = {
    sessionId,
    policy: session.policy,
  };

  res.json(response);
});

/**
 * POST /api/session/event
 * Report a game event (checkpoint collection)
 */
router.post('/event', (req: Request, res: Response) => {
  const body = req.body as SessionEventRequest;

  // Validate request
  if (!body.sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const session = sessions.get(body.sessionId);
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

  // Check max events
  if (session.eventCount >= session.policy.rewardMaxPerSession) {
    const result: SessionEventResult = {
      accepted: false,
      rejectReason: 'MAX_EVENTS_REACHED',
    };
    res.json(result);
    return;
  }

  // Check cooldown
  if (session.lastEventAt !== null) {
    const elapsed = now - session.lastEventAt;
    if (elapsed < session.policy.rewardCooldownMs) {
      const result: SessionEventResult = {
        accepted: false,
        rejectReason: 'COOLDOWN_ACTIVE',
      };
      res.json(result);
      return;
    }
  }

  // Accept the event
  session.eventCount += 1;
  session.lastEventAt = now;

  // Select reward amount (simple rotation for now)
  const amounts = session.policy.rewardAmounts;
  const rewardAmount = amounts[session.eventCount % amounts.length];

  // TODO: T-041/T-042 will implement actual tx generation
  // For now, return a stub txid
  const stubTxid = `stub_${body.sessionId}_${body.seq}_${Date.now().toString(36)}`;

  const result: SessionEventResult = {
    accepted: true,
    rewardAmount,
    txid: stubTxid,
  };

  res.json(result);
});

/**
 * GET /api/session/:id
 * Get session info
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Session ID is required' });
    return;
  }
  const session = sessions.get(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({
    id: session.id,
    mode: session.mode,
    status: session.status,
    eventCount: session.eventCount,
    policy: session.policy,
    createdAt: session.createdAt,
  });
});

/**
 * POST /api/session/:id/end
 * End a session
 */
router.post('/:id/end', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Session ID is required' });
    return;
  }
  const session = sessions.get(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  session.status = 'ended';
  res.json({ ok: true, sessionId: session.id });
});

export default router;
export { sessions };
