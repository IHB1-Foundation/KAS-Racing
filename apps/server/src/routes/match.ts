import { Router, type Request, type Response, type RequestHandler } from 'express';
import { randomUUID, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, matches, deposits, settlements, type NewMatch, type NewDeposit } from '../db/index.js';
import type { Match, Deposit, Settlement } from '../db/schema.js';
import { generateMatchEscrowAddresses } from '../services/escrowService.js';
import { emitMatchUpdated, emitMatchStateChanged } from '../ws/index.js';
import { processSettlement } from '../services/settlementService.js';
import { checkIdempotencyKey, setIdempotencyKey, depositIdempotencyKey } from '../services/idempotencyService.js';
import { getMatchChainEvents } from '../services/chainQueryService.js';
import { kasToSompi } from '../tx/index.js';

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

// Convert Match to basic API response format
function matchToResponse(match: Match) {
  return {
    id: match.id,
    joinCode: match.joinCode,
    status: match.status,
    betAmount: match.betAmount,
    playerA: match.playerAAddress ? {
      address: match.playerAAddress,
      pubkey: match.playerAPubkey,
      depositTxid: match.playerADepositTxid,
      depositStatus: match.playerADepositStatus,
    } : null,
    playerB: match.playerBAddress ? {
      address: match.playerBAddress,
      pubkey: match.playerBPubkey,
      depositTxid: match.playerBDepositTxid,
      depositStatus: match.playerBDepositStatus,
    } : null,
    escrowAddressA: match.escrowAddressA,
    escrowAddressB: match.escrowAddressB,
    escrowMode: match.escrowMode,
    refundLocktimeBlocks: match.refundLocktimeBlocks,
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

function depositToResponse(dep: Deposit) {
  return {
    id: dep.id,
    matchId: dep.matchId,
    player: dep.player,
    playerAddress: dep.playerAddress,
    escrowAddress: dep.escrowAddress,
    amountSompi: dep.amountSompi.toString(),
    txid: dep.txid,
    txStatus: dep.txStatus,
    daaScore: dep.daaScore?.toString() ?? null,
    createdAt: dep.createdAt instanceof Date ? dep.createdAt.getTime() : dep.createdAt,
    broadcastedAt: dep.broadcastedAt instanceof Date ? dep.broadcastedAt.getTime() : dep.broadcastedAt,
    acceptedAt: dep.acceptedAt instanceof Date ? dep.acceptedAt.getTime() : dep.acceptedAt,
    includedAt: dep.includedAt instanceof Date ? dep.includedAt.getTime() : dep.includedAt,
    confirmedAt: dep.confirmedAt instanceof Date ? dep.confirmedAt.getTime() : dep.confirmedAt,
  };
}

function settlementToResponse(s: Settlement) {
  return {
    id: s.id,
    matchId: s.matchId,
    settlementType: s.settlementType,
    txid: s.txid,
    txStatus: s.txStatus,
    winnerAddress: s.winnerAddress,
    totalAmountSompi: s.totalAmountSompi.toString(),
    feeSompi: s.feeSompi.toString(),
    daaScore: s.daaScore?.toString() ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.getTime() : s.createdAt,
    broadcastedAt: s.broadcastedAt instanceof Date ? s.broadcastedAt.getTime() : s.broadcastedAt,
    acceptedAt: s.acceptedAt instanceof Date ? s.acceptedAt.getTime() : s.acceptedAt,
    includedAt: s.includedAt instanceof Date ? s.includedAt.getTime() : s.includedAt,
    confirmedAt: s.confirmedAt instanceof Date ? s.confirmedAt.getTime() : s.confirmedAt,
  };
}

/**
 * Enrich match response with v2 deposit/settlement data
 */
async function matchToEnrichedResponse(match: Match) {
  const base = matchToResponse(match);

  // Fetch v2 deposits
  const matchDeposits = await db
    .select()
    .from(deposits)
    .where(eq(deposits.matchId, match.id));

  // Fetch v2 settlement
  const matchSettlements = await db
    .select()
    .from(settlements)
    .where(eq(settlements.matchId, match.id))
    .limit(1);

  return {
    ...base,
    deposits: matchDeposits.map(depositToResponse),
    settlement: matchSettlements[0] ? settlementToResponse(matchSettlements[0]) : null,
  };
}

interface CreateMatchRequest {
  playerAddress: string;
  betAmount: number;
  playerPubkey?: string; // x-only pubkey for covenant mode (optional)
}

interface JoinMatchRequest {
  joinCode: string;
  playerAddress: string;
  playerPubkey?: string; // x-only pubkey for covenant mode (optional)
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

    // Generate escrow addresses (fallback mode for now, covenant will be set when player B joins)
    let escrowAddressA: string | undefined;
    let escrowAddressB: string | undefined;
    let escrowMode: 'covenant' | 'fallback' = 'fallback';

    try {
      const escrowAddresses = await generateMatchEscrowAddresses(
        matchId,
        body.playerAddress,
        '', // Player B address not yet known
        body.playerPubkey,
        undefined // Player B pubkey not yet known
      );
      escrowAddressA = escrowAddresses.escrowAddressA;
      escrowAddressB = escrowAddresses.escrowAddressB;
      escrowMode = escrowAddresses.mode;
    } catch (error) {
      console.warn(`[match] Failed to generate escrow addresses:`, error);
    }

    // Create match in database
    const newMatch: NewMatch = {
      id: matchId,
      joinCode,
      playerAAddress: body.playerAddress,
      playerAPubkey: body.playerPubkey,
      betAmount: body.betAmount,
      status: 'waiting',
      escrowAddressA,
      escrowAddressB,
      createdAt: now,
    };

    await db.insert(matches).values(newMatch);
    console.log(`[match] Created match ${matchId} with code ${joinCode} by ${body.playerAddress}`);
    console.log(`[match] Escrow mode: ${escrowMode}, addresses: A=${escrowAddressA}, B=${escrowAddressB}`);

    res.json({
      matchId,
      joinCode,
      betAmount: body.betAmount,
      status: 'waiting',
      escrowAddressA,
      escrowAddressB,
      escrowMode,
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

    const normalizedCode = body.joinCode.toUpperCase();

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

    if (match.status !== 'waiting') {
      res.status(400).json({ error: 'Match is not available for joining', status: match.status });
      return;
    }

    if (match.playerAAddress === body.playerAddress) {
      res.status(400).json({ error: 'Cannot join your own match' });
      return;
    }

    // If both players have pubkeys, regenerate covenant escrow addresses
    let escrowUpdate: Record<string, unknown> = {};
    if (match.playerAPubkey && body.playerPubkey) {
      try {
        const escrowAddresses = await generateMatchEscrowAddresses(
          match.id,
          match.playerAAddress!,
          body.playerAddress,
          match.playerAPubkey,
          body.playerPubkey
        );
        escrowUpdate = {
          escrowAddressA: escrowAddresses.escrowAddressA,
          escrowAddressB: escrowAddresses.escrowAddressB,
          escrowMode: escrowAddresses.mode,
          escrowScriptA: escrowAddresses.escrowScriptA,
          escrowScriptB: escrowAddresses.escrowScriptB,
          refundLocktimeBlocks: escrowAddresses.refundLocktimeBlocks,
          oraclePublicKey: escrowAddresses.oraclePublicKey,
        };
        console.log(`[match] Generated ${escrowAddresses.mode} escrow for match ${match.id}`);
      } catch (error) {
        console.warn(`[match] Failed to generate covenant escrow:`, error);
      }
    }

    const oldStatus = match.status;

    await db
      .update(matches)
      .set({
        playerBAddress: body.playerAddress,
        playerBPubkey: body.playerPubkey,
        status: 'deposits_pending',
        ...escrowUpdate,
      })
      .where(eq(matches.id, match.id));

    console.log(`[match] Player ${body.playerAddress} joined match ${match.id}`);

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

    // Emit match state change
    emitMatchStateChanged({
      matchId: match.id,
      oldStatus,
      newStatus: 'deposits_pending',
      deposits: {
        A: { txid: null, status: null },
        B: { txid: null, status: null },
      },
      settlement: null,
      winner: null,
      scores: { A: null, B: null },
    });

    res.json(await matchToEnrichedResponse(updatedMatch));
  } catch (error) {
    console.error('[match] Failed to join match:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/match/:id
 * Get match info by ID (enriched with v2 deposit/settlement data)
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

    res.json(await matchToEnrichedResponse(match));
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
 * Register a deposit transaction for a match.
 * Uses idempotency key to prevent duplicate registrations.
 * Writes to both matches table (backward compat) and deposits v2 table.
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

    // Idempotency check
    const idemKey = depositIdempotencyKey(id, body.player);
    const existing = await checkIdempotencyKey(idemKey);
    if (existing) {
      console.log(`[match] Duplicate deposit for match ${id} player ${body.player}, returning existing`);
      // Fetch current match state and return
      const matchResults = await db
        .select()
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);
      if (matchResults[0]) {
        res.json({
          ...(await matchToEnrichedResponse(matchResults[0])),
          idempotent: true,
        });
        return;
      }
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

    if (match.status !== 'deposits_pending') {
      res.status(400).json({ error: 'Match is not accepting deposits', status: match.status });
      return;
    }

    // Update matches table (backward compat)
    const updateData = body.player === 'A'
      ? { playerADepositTxid: body.txid, playerADepositStatus: 'broadcasted' }
      : { playerBDepositTxid: body.txid, playerBDepositStatus: 'broadcasted' };

    await db
      .update(matches)
      .set(updateData)
      .where(eq(matches.id, id));

    // Write to v2 deposits table
    const playerAddress = body.player === 'A' ? match.playerAAddress! : match.playerBAddress!;
    const escrowAddress = body.player === 'A' ? (match.escrowAddressA ?? '') : (match.escrowAddressB ?? '');
    const amountSompi = kasToSompi(match.betAmount);

    const newDeposit: NewDeposit = {
      id: randomUUID(),
      matchId: id,
      player: body.player,
      playerAddress,
      escrowAddress,
      amountSompi: BigInt(amountSompi),
      txid: body.txid,
      txStatus: 'broadcasted',
      createdAt: new Date(),
      broadcastedAt: new Date(),
    };

    // Insert deposit (ignore conflict on match_id + player unique constraint)
    try {
      await db.insert(deposits).values(newDeposit);
    } catch (err: unknown) {
      // If unique constraint violated, update existing
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('unique') || errMsg.includes('duplicate') || errMsg.includes('23505')) {
        await db
          .update(deposits)
          .set({
            txid: body.txid,
            txStatus: 'broadcasted',
            broadcastedAt: new Date(),
          })
          .where(
            eq(deposits.matchId, id)
          );
      } else {
        throw err;
      }
    }

    // Store idempotency key
    await setIdempotencyKey(idemKey, body.txid, { matchId: id, player: body.player });

    console.log(`[match] Player ${body.player} deposited ${body.txid} for match ${id}`);

    // Fetch updated match
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

    // Emit WebSocket updates
    emitMatchUpdated(id, updatedMatch);

    res.json({
      ...(await matchToEnrichedResponse(updatedMatch)),
      depositTracking: {
        message: 'Deposit registered. Status will update when transaction is accepted on-chain.',
        bothDepositsRegistered: !!(updatedMatch.playerADepositTxid && updatedMatch.playerBDepositTxid),
      },
    });
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

    res.json(await matchToEnrichedResponse(match));
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

    if (match.status !== 'ready') {
      res.status(400).json({ error: 'Match is not ready to start', status: match.status });
      return;
    }

    const oldStatus = match.status;

    await db
      .update(matches)
      .set({
        status: 'playing',
        startedAt: new Date(),
      })
      .where(eq(matches.id, id));

    console.log(`[match] Game started for match ${id} by player ${body.player}`);

    const updatedResults = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    const updatedMatch = updatedResults[0]!;

    // Emit match state change
    emitMatchStateChanged({
      matchId: id,
      oldStatus,
      newStatus: 'playing',
      deposits: {
        A: { txid: updatedMatch.playerADepositTxid, status: updatedMatch.playerADepositStatus },
        B: { txid: updatedMatch.playerBDepositTxid, status: updatedMatch.playerBDepositStatus },
      },
      settlement: null,
      winner: null,
      scores: { A: null, B: null },
    });

    res.json(await matchToEnrichedResponse(updatedMatch));
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

    if (match.status !== 'playing' && match.status !== 'ready') {
      res.status(400).json({ error: 'Match is not in progress', status: match.status });
      return;
    }

    const updateData = body.player === 'A'
      ? { playerAScore: body.score }
      : { playerBScore: body.score };

    await db
      .update(matches)
      .set(updateData)
      .where(eq(matches.id, id));

    console.log(`[match] Player ${body.player} submitted score ${body.score} for match ${id}`);

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

      const oldStatus = updatedMatch.status;

      await db
        .update(matches)
        .set({
          status: 'finished',
          winnerId,
          finishedAt: new Date(),
        })
        .where(eq(matches.id, id));

      console.log(`[match] Match ${id} finished. Winner: ${winnerId}`);

      // Emit match state change
      emitMatchStateChanged({
        matchId: id,
        oldStatus,
        newStatus: 'finished',
        deposits: {
          A: { txid: updatedMatch.playerADepositTxid, status: updatedMatch.playerADepositStatus },
          B: { txid: updatedMatch.playerBDepositTxid, status: updatedMatch.playerBDepositStatus },
        },
        settlement: null,
        winner: winnerId,
        scores: { A: updatedMatch.playerAScore, B: updatedMatch.playerBScore },
      });

      // Trigger settlement asynchronously (don't wait for TX)
      void (async () => {
        try {
          const settlement = await processSettlement(id);
          if (settlement.success) {
            console.log(`[match] Settlement initiated for ${id}: ${settlement.settleTxid ?? 'no txid (draw)'}`);
          } else {
            console.error(`[match] Settlement failed for ${id}: ${settlement.error}`);
          }
        } catch (err) {
          console.error(`[match] Settlement error for ${id}:`, err);
        }
      })();

      // Fetch final state
      const finalResults = await db
        .select()
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      res.json(await matchToEnrichedResponse(finalResults[0]!));
      return;
    }

    res.json(await matchToEnrichedResponse(updatedMatch));
  } catch (error) {
    console.error('[match] Failed to submit score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/match/:id/chain-events
 * Get indexed chain events for a match (from indexer)
 */
router.get('/:id/chain-events', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Match ID is required' });
      return;
    }

    const events = await getMatchChainEvents(id);

    res.json({
      matchId: id,
      events: events.map(e => ({
        id: e.id,
        txid: e.txid,
        eventType: e.eventType,
        fromAddress: e.fromAddress,
        toAddress: e.toAddress,
        amountSompi: e.amountSompi.toString(),
        daaScore: e.daaScore?.toString() ?? null,
        confirmations: e.confirmations,
        payload: e.payload,
        indexedAt: e.indexedAt instanceof Date ? e.indexedAt.getTime() : e.indexedAt,
      })),
    });
  } catch (error) {
    console.error('[match] Failed to get chain events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

export default router;
