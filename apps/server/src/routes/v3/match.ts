/**
 * V3 Match Routes — EVM Contract-first
 *
 * All match state queries return unified V3MatchResponse
 * with on-chain data from chain_events_evm.
 */

import { Router, type Request, type Response, type RequestHandler } from 'express';
import {
  createMatchLobby,
  joinMatch,
  getMatchResponse,
  getMatchByJoinCode,
  submitScore,
  syncMatchFromEvents,
  MatchError,
} from '../../services/evmMatchService.js';
import { getEvmEventsByMatchId } from '../../services/evmChainQueryService.js';
import type { V3CreateMatchRequest, V3JoinMatchRequest, V3SubmitScoreRequest } from '../../types/evm.js';

const router = Router();

type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => { fn(req, res).catch(next); };
};

function handleMatchError(res: Response, error: unknown): void {
  if (error instanceof MatchError) {
    res.status(error.httpStatus).json({ error: error.message, code: error.code });
  } else {
    console.error('[v3/match] Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/v3/match/create
 * Create a match lobby (on-chain match created when player2 joins)
 */
router.post('/create', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as V3CreateMatchRequest;

    if (!body.playerAddress) {
      res.status(400).json({ error: 'playerAddress is required' });
      return;
    }
    if (!body.betAmountWei || BigInt(body.betAmountWei) <= 0n) {
      res.status(400).json({ error: 'betAmountWei must be a positive value' });
      return;
    }

    const result = await createMatchLobby(body.playerAddress, body.betAmountWei);
    res.json(result);
  } catch (error) {
    handleMatchError(res, error);
  }
}));

/**
 * POST /api/v3/match/join
 * Join a match and create the on-chain match via MatchEscrow
 */
router.post('/join', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as V3JoinMatchRequest;

    if (!body.joinCode) {
      res.status(400).json({ error: 'joinCode is required' });
      return;
    }
    if (!body.playerAddress) {
      res.status(400).json({ error: 'playerAddress is required' });
      return;
    }

    const result = await joinMatch(body.joinCode, body.playerAddress);
    res.json(result);
  } catch (error) {
    handleMatchError(res, error);
  }
}));

/**
 * GET /api/v3/match/:id
 * Get unified match state (DB + on-chain events + contract state)
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    // Optionally sync from chain events before responding
    const sync = req.query.sync === 'true';
    if (sync) {
      await syncMatchFromEvents(id);
    }

    const result = await getMatchResponse(id);
    res.json(result);
  } catch (error) {
    handleMatchError(res, error);
  }
}));

/**
 * GET /api/v3/match/code/:joinCode
 * Get match by join code
 */
router.get('/code/:joinCode', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { joinCode } = req.params;
    if (!joinCode) {
      res.status(400).json({ error: 'Join code is required' });
      return;
    }

    const result = await getMatchByJoinCode(joinCode);
    res.json(result);
  } catch (error) {
    handleMatchError(res, error);
  }
}));

/**
 * POST /api/v3/match/:id/submit-score
 * Submit player score, auto-triggers settlement when both scores are in
 */
router.post('/:id/submit-score', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as V3SubmitScoreRequest;

    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }
    if (!body.playerAddress) {
      res.status(400).json({ error: 'playerAddress is required' });
      return;
    }
    if (typeof body.score !== 'number' || body.score < 0) {
      res.status(400).json({ error: 'score must be a non-negative number' });
      return;
    }

    const result = await submitScore(id, body.playerAddress, body.score);
    res.json(result);
  } catch (error) {
    handleMatchError(res, error);
  }
}));

/**
 * POST /api/v3/match/:id/sync
 * Force-sync match state from indexed chain events
 */
router.post('/:id/sync', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    await syncMatchFromEvents(id);
    const result = await getMatchResponse(id);
    res.json(result);
  } catch (error) {
    handleMatchError(res, error);
  }
}));

/**
 * GET /api/v3/match/:id/chain-events
 * Get raw indexed chain events for a match
 */
router.get('/:id/chain-events', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    // We need the matchIdOnchain to query events
    const match = await getMatchResponse(id);
    const events = match.matchIdOnchain
      ? await getEvmEventsByMatchId(match.matchIdOnchain)
      : [];

    res.json({ matchId: id, matchIdOnchain: match.matchIdOnchain, events });
  } catch (error) {
    handleMatchError(res, error);
  }
}));

export default router;
