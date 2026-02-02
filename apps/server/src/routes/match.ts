import { Router, type Request, type Response, type RequestHandler } from 'express';
import { randomUUID, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, matches, type NewMatch } from '../db/index.js';
import type { Match } from '../db/schema.js';

const router = Router();

// Async handler wrapper to fix TypeScript errors with Express
type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
};

// Generate a 6-character join code (uppercase alphanumeric, no ambiguous chars)
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
  let code = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

// Convert Match to API response format
function matchToResponse(match: Match) {
  return {
    id: match.id,
    joinCode: match.joinCode,
    status: match.status,
    betAmount: match.betAmount,
    playerA: match.playerAAddress ? {
      address: match.playerAAddress,
      depositTxid: match.playerADepositTxid,
      depositStatus: match.playerADepositStatus,
    } : null,
    playerB: match.playerBAddress ? {
      address: match.playerBAddress,
      depositTxid: match.playerBDepositTxid,
      depositStatus: match.playerBDepositStatus,
    } : null,
    escrowAddressA: match.escrowAddressA,
    escrowAddressB: match.escrowAddressB,
    winner: match.winnerId,
    playerAScore: match.playerAScore,
    playerBScore: match.playerBScore,
    settleTxid: match.settleTxid,
    settleStatus: match.settleStatus,
    createdAt: match.createdAt instanceof Date ? match.createdAt.getTime() : match.createdAt,
    startedAt: match.startedAt instanceof Date ? match.startedAt.getTime() : match.startedAt,
    finishedAt: match.finishedAt instanceof Date ? match.finishedAt.getTime() : match.finishedAt,
  };
}

interface CreateMatchRequest {
  playerAddress: string;
  betAmount: number;
}

interface JoinMatchRequest {
  joinCode: string;
  playerAddress: string;
}

/**
 * POST /api/match/create
 * Create a new match and get a join code
 */
router.post('/create', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateMatchRequest;

    if (!body.playerAddress) {
      res.status(400).json({ error: 'playerAddress is required' });
      return;
    }

    if (typeof body.betAmount !== 'number' || body.betAmount <= 0) {
      res.status(400).json({ error: 'betAmount must be a positive number' });
      return;
    }

    // Minimum bet amount check (0.1 KAS)
    if (body.betAmount < 0.1) {
      res.status(400).json({ error: 'betAmount must be at least 0.1 KAS' });
      return;
    }

    const matchId = randomUUID();
    const joinCode = generateJoinCode();
    const now = new Date();

    // Create match in database
    const newMatch: NewMatch = {
      id: matchId,
      joinCode,
      playerAAddress: body.playerAddress,
      betAmount: body.betAmount,
      status: 'waiting',
      createdAt: now,
    };

    await db.insert(matches).values(newMatch);
    console.log(`[match] Created match ${matchId} with code ${joinCode} by ${body.playerAddress}`);

    res.json({
      matchId,
      joinCode,
      betAmount: body.betAmount,
      status: 'waiting',
    });
  } catch (error) {
    console.error('[match] Failed to create match:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * POST /api/match/join
 * Join an existing match by code
 */
router.post('/join', asyncHandler(async (req: Request, res: Response) => {
  try {
    const body = req.body as JoinMatchRequest;

    if (!body.joinCode) {
      res.status(400).json({ error: 'joinCode is required' });
      return;
    }

    if (!body.playerAddress) {
      res.status(400).json({ error: 'playerAddress is required' });
      return;
    }

    // Normalize join code to uppercase
    const normalizedCode = body.joinCode.toUpperCase();

    // Find match by join code
    const matchResults = await db
      .select()
      .from(matches)
      .where(eq(matches.joinCode, normalizedCode))
      .limit(1);

    const match = matchResults[0];
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    // Check match status
    if (match.status !== 'waiting') {
      res.status(400).json({ error: 'Match is not available for joining', status: match.status });
      return;
    }

    // Check if trying to join own match
    if (match.playerAAddress === body.playerAddress) {
      res.status(400).json({ error: 'Cannot join your own match' });
      return;
    }

    // Update match with player B
    await db
      .update(matches)
      .set({
        playerBAddress: body.playerAddress,
        status: 'deposits_pending',
      })
      .where(eq(matches.id, match.id));

    console.log(`[match] Player ${body.playerAddress} joined match ${match.id}`);

    // Fetch updated match
    const updatedResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, match.id))
      .limit(1);

    const updatedMatch = updatedResults[0];
    if (!updatedMatch) {
      res.status(500).json({ error: 'Failed to fetch updated match' });
      return;
    }

    res.json(matchToResponse(updatedMatch));
  } catch (error) {
    console.error('[match] Failed to join match:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/match/:id
 * Get match info by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    const matchResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    const match = matchResults[0];
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    res.json(matchToResponse(match));
  } catch (error) {
    console.error('[match] Failed to get match:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

interface RegisterDepositRequest {
  player: 'A' | 'B';
  txid: string;
}

/**
 * POST /api/match/:id/deposit
 * Register a deposit transaction for a match
 */
router.post('/:id/deposit', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as RegisterDepositRequest;

    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    if (!body.player || (body.player !== 'A' && body.player !== 'B')) {
      res.status(400).json({ error: 'player must be A or B' });
      return;
    }

    if (!body.txid) {
      res.status(400).json({ error: 'txid is required' });
      return;
    }

    // Find match
    const matchResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    const match = matchResults[0];
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    // Check match status
    if (match.status !== 'deposits_pending') {
      res.status(400).json({ error: 'Match is not accepting deposits', status: match.status });
      return;
    }

    // Update deposit info
    const updateData = body.player === 'A'
      ? { playerADepositTxid: body.txid, playerADepositStatus: 'broadcasted' }
      : { playerBDepositTxid: body.txid, playerBDepositStatus: 'broadcasted' };

    await db
      .update(matches)
      .set(updateData)
      .where(eq(matches.id, id));

    console.log(`[match] Player ${body.player} deposited ${body.txid} for match ${id}`);

    // Check if both deposits are now registered
    const updatedResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    const updatedMatch = updatedResults[0];
    if (!updatedMatch) {
      res.status(500).json({ error: 'Failed to fetch updated match' });
      return;
    }

    // If both deposits are registered, update status to ready
    if (updatedMatch.playerADepositTxid && updatedMatch.playerBDepositTxid) {
      await db
        .update(matches)
        .set({ status: 'ready' })
        .where(eq(matches.id, id));

      console.log(`[match] Both deposits registered, match ${id} is now ready`);

      // Fetch again with updated status
      const finalResults = await db
        .select()
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      res.json(matchToResponse(finalResults[0]!));
      return;
    }

    res.json(matchToResponse(updatedMatch));
  } catch (error) {
    console.error('[match] Failed to register deposit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/match/code/:joinCode
 * Get match info by join code
 */
router.get('/code/:joinCode', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { joinCode } = req.params;
    if (!joinCode) {
      res.status(400).json({ error: 'Join code is required' });
      return;
    }

    const normalizedCode = joinCode.toUpperCase();

    const matchResults = await db
      .select()
      .from(matches)
      .where(eq(matches.joinCode, normalizedCode))
      .limit(1);

    const match = matchResults[0];
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    res.json(matchToResponse(match));
  } catch (error) {
    console.error('[match] Failed to get match by code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

interface StartGameRequest {
  player: 'A' | 'B';
}

/**
 * POST /api/match/:id/start
 * Start the game for a match
 */
router.post('/:id/start', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as StartGameRequest;

    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    // Find match
    const matchResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    const match = matchResults[0];
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    // Check match status
    if (match.status !== 'ready') {
      res.status(400).json({ error: 'Match is not ready to start', status: match.status });
      return;
    }

    // Update match to playing
    await db
      .update(matches)
      .set({
        status: 'playing',
        startedAt: new Date(),
      })
      .where(eq(matches.id, id));

    console.log(`[match] Game started for match ${id} by player ${body.player}`);

    // Fetch updated match
    const updatedResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    res.json(matchToResponse(updatedResults[0]!));
  } catch (error) {
    console.error('[match] Failed to start game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

interface SubmitScoreRequest {
  player: 'A' | 'B';
  score: number;
}

/**
 * POST /api/match/:id/submit-score
 * Submit player's score after race ends
 */
router.post('/:id/submit-score', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as SubmitScoreRequest;

    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    if (!body.player || (body.player !== 'A' && body.player !== 'B')) {
      res.status(400).json({ error: 'player must be A or B' });
      return;
    }

    if (typeof body.score !== 'number' || body.score < 0) {
      res.status(400).json({ error: 'score must be a non-negative number' });
      return;
    }

    // Find match
    const matchResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    const match = matchResults[0];
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    // Check match status
    if (match.status !== 'playing' && match.status !== 'ready') {
      res.status(400).json({ error: 'Match is not in progress', status: match.status });
      return;
    }

    // Update score
    const updateData = body.player === 'A'
      ? { playerAScore: body.score }
      : { playerBScore: body.score };

    await db
      .update(matches)
      .set(updateData)
      .where(eq(matches.id, id));

    console.log(`[match] Player ${body.player} submitted score ${body.score} for match ${id}`);

    // Check if both scores are in
    const updatedResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    const updatedMatch = updatedResults[0]!;

    // If both scores are submitted, determine winner
    if (updatedMatch.playerAScore !== null && updatedMatch.playerBScore !== null) {
      let winnerId: string;
      if (updatedMatch.playerAScore > updatedMatch.playerBScore) {
        winnerId = 'A';
      } else if (updatedMatch.playerBScore > updatedMatch.playerAScore) {
        winnerId = 'B';
      } else {
        winnerId = 'draw';
      }

      await db
        .update(matches)
        .set({
          status: 'finished',
          winnerId,
          finishedAt: new Date(),
        })
        .where(eq(matches.id, id));

      console.log(`[match] Match ${id} finished. Winner: ${winnerId}`);

      // Fetch final state
      const finalResults = await db
        .select()
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      res.json(matchToResponse(finalResults[0]!));
      return;
    }

    res.json(matchToResponse(updatedMatch));
  } catch (error) {
    console.error('[match] Failed to submit score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

export default router;
