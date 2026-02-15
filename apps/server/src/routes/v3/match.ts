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
import type { V3CreateMatchRequest, V3JoinMatchRequest, V3SubmitScoreRequest, V3MatchResponse } from '../../types/evm.js';
import { emitMatchStateChanged } from '../../ws/index.js';

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

function emitV3MatchSnapshot(match: V3MatchResponse, oldStatus?: string): void {
  const p1Addr = match.players.player1.address.toLowerCase();
  const p2Addr = match.players.player2.address?.toLowerCase() ?? '';
  const dep1 = match.deposits.find((d) => d.playerAddress.toLowerCase() === p1Addr);
  const dep2 = match.deposits.find((d) => d.playerAddress.toLowerCase() === p2Addr);

  emitMatchStateChanged({
    matchId: match.id,
    oldStatus: oldStatus ?? match.state,
    newStatus: match.state,
    deposits: {
      A: { txid: dep1?.txHash ?? null, status: dep1?.txStatus ?? null },
      B: { txid: dep2?.txHash ?? null, status: dep2?.txStatus ?? null },
    },
    settlement: match.settlement
      ? { txid: match.settlement.txHash ?? null, status: match.settlement.txStatus ?? null }
      : null,
    winner: match.winner?.address ?? null,
    scores: {
      A: match.players.player1.score,
      B: match.players.player2.score,
    },
  });
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

    const before = await getMatchByJoinCode(body.joinCode).catch(() => null);
    const result = await joinMatch(body.joinCode, body.playerAddress);
    emitV3MatchSnapshot(result, before?.state);
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

    const before = await getMatchResponse(id).catch(() => null);
    const result = await submitScore(id, body.playerAddress, body.score);
    emitV3MatchSnapshot(result, before?.state);
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
