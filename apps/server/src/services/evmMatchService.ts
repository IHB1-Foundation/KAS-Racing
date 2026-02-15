/**
 * EVM Match Service — Contract-first match lifecycle
 *
 * Uses MatchEscrow contract as source-of-truth for match state.
 * V3 DB tables serve as local cache + lobby management.
 *
 * Flow:
 *  1. createMatchLobby() → DB record with joinCode (state=lobby)
 *  2. joinMatch()         → Set player2, call createMatch on-chain (state=created)
 *  3. Players deposit directly via contract's deposit() payable function
 *  4. Indexer picks up Deposited/MatchFunded events → synced to v3 tables
 *  5. submitScore()       → Record scores, trigger settlement
 *  6. processSettlement() → Call settle/settleDraw on-chain
 */

import { eq } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'crypto';
import { db } from '../db/index.js';
import {
  matchesV3,
  depositsV3,
  settlementsV3,
  type MatchV3,
  type NewMatchV3,
  type NewDepositV3,
  type NewSettlementV3,
} from '../db/schema.js';
import {
  createMatchOnchain,
  settleMatch,
  settleMatchDraw,
  toMatchId,
} from '../tx/evmContracts.js';
import {
  getEvmEventsByMatchId,
} from './evmChainQueryService.js';
import type {
  V3MatchResponse,
  EvmTxStatus,
  EvmChainEventInfo,
} from '../types/evm.js';
import type { Address, Hash } from 'viem';

// ── Join Code Generator ──

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

// ── Lobby ──

/**
 * Create a match lobby. On-chain match is NOT created yet.
 */
export async function createMatchLobby(
  player1Address: string,
  depositAmountWei: string,
): Promise<V3MatchResponse> {
  const id = randomUUID();
  const joinCode = generateJoinCode();

  const newMatch: NewMatchV3 = {
    id,
    joinCode,
    player1Address,
    depositAmountWei,
    state: 'lobby',
    createdAt: new Date(),
  };

  await db.insert(matchesV3).values(newMatch);
  console.log(`[evm-match] Created lobby ${id} code=${joinCode} by ${player1Address}`);

  return buildMatchResponse(newMatch as MatchV3, [], null, []);
}

/**
 * Join a match lobby and create the on-chain match.
 */
export async function joinMatch(
  joinCode: string,
  player2Address: string,
): Promise<V3MatchResponse> {
  const normalizedCode = joinCode.toUpperCase();

  const rows = await db
    .select()
    .from(matchesV3)
    .where(eq(matchesV3.joinCode, normalizedCode))
    .limit(1);

  const match = rows[0];
  if (!match) {
    throw new MatchError('Match not found', 'NOT_FOUND');
  }

  if (match.state !== 'lobby') {
    throw new MatchError(`Match not in lobby state (state=${match.state})`, 'INVALID_STATE');
  }

  if (match.player1Address.toLowerCase() === player2Address.toLowerCase()) {
    throw new MatchError('Cannot join your own match', 'SELF_JOIN');
  }

  // Generate on-chain matchId
  const matchIdOnchain = toMatchId(match.id);

  // Create match on-chain
  let createTxHash: string | null = null;
  let newState: 'lobby' | 'created' | 'funded' | 'settled' | 'refunded' | 'cancelled' = 'created';

  try {
    const txResult = await createMatchOnchain({
      matchId: matchIdOnchain,
      player1: match.player1Address as Address,
      player2: player2Address as Address,
      depositAmountWei: BigInt(match.depositAmountWei),
    });
    createTxHash = txResult.hash;
    console.log(`[evm-match] On-chain match created: ${createTxHash}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[evm-match] Failed to create on-chain match: ${msg}`);
    // Still update DB with player2 but mark error
    newState = 'lobby'; // Stay in lobby if on-chain creation failed
    throw new MatchError(`On-chain match creation failed: ${msg}`, 'TX_FAILED');
  }

  // Update DB
  await db
    .update(matchesV3)
    .set({
      player2Address: player2Address,
      matchIdOnchain: matchIdOnchain,
      createTxHash: createTxHash,
      state: newState,
    })
    .where(eq(matchesV3.id, match.id));

  const updated = await getMatchById(match.id);
  if (!updated) throw new MatchError('Match disappeared after update', 'INTERNAL');

  return getMatchResponse(match.id);
}

// ── Query ──

/**
 * Get unified match response with all on-chain data.
 */
export async function getMatchResponse(matchId: string): Promise<V3MatchResponse> {
  const match = await getMatchById(matchId);
  if (!match) {
    throw new MatchError('Match not found', 'NOT_FOUND');
  }

  // Fetch deposits from v3 table
  const deposits = match.matchIdOnchain
    ? await db.select().from(depositsV3).where(eq(depositsV3.matchIdOnchain, match.matchIdOnchain))
    : [];

  // Fetch settlement from v3 table
  const settlementRows = match.matchIdOnchain
    ? await db.select().from(settlementsV3).where(eq(settlementsV3.matchIdOnchain, match.matchIdOnchain)).limit(1)
    : [];

  // Fetch chain events from indexer
  const chainEvents = match.matchIdOnchain
    ? await getEvmEventsByMatchId(match.matchIdOnchain)
    : [];

  return buildMatchResponse(match, deposits, settlementRows[0] ?? null, chainEvents);
}

/**
 * Get match by join code.
 */
export async function getMatchByJoinCode(joinCode: string): Promise<V3MatchResponse> {
  const normalizedCode = joinCode.toUpperCase();
  const rows = await db
    .select()
    .from(matchesV3)
    .where(eq(matchesV3.joinCode, normalizedCode))
    .limit(1);

  const match = rows[0];
  if (!match) {
    throw new MatchError('Match not found', 'NOT_FOUND');
  }

  return getMatchResponse(match.id);
}

// ── Score & Settlement ──

/**
 * Submit a player's score. Triggers settlement when both scores are in.
 */
export async function submitScore(
  matchId: string,
  playerAddress: string,
  score: number,
): Promise<V3MatchResponse> {
  const match = await getMatchById(matchId);
  if (!match) throw new MatchError('Match not found', 'NOT_FOUND');

  // Verify player belongs to this match
  const isPlayer1 = match.player1Address.toLowerCase() === playerAddress.toLowerCase();
  const isPlayer2 = match.player2Address?.toLowerCase() === playerAddress.toLowerCase();
  if (!isPlayer1 && !isPlayer2) {
    throw new MatchError('Address is not a player in this match', 'NOT_PLAYER');
  }

  // Verify match state allows scoring (funded or created — depends on indexer sync)
  const validStates = ['created', 'funded'];
  if (!validStates.includes(match.state)) {
    throw new MatchError(`Cannot submit score in state=${match.state}`, 'INVALID_STATE');
  }

  // Update score
  const updateData = isPlayer1
    ? { player1Score: score }
    : { player2Score: score };

  await db.update(matchesV3).set(updateData).where(eq(matchesV3.id, matchId));

  // Reload to check if both scores submitted
  const updated = await getMatchById(matchId);
  if (!updated) throw new MatchError('Match disappeared', 'INTERNAL');

  if (updated.player1Score !== null && updated.player2Score !== null) {
    // Both scores in — trigger settlement
    await processSettlement(matchId);
  }

  return getMatchResponse(matchId);
}

/**
 * Process match settlement on-chain.
 */
export async function processSettlement(matchId: string): Promise<void> {
  const match = await getMatchById(matchId);
  if (!match) throw new MatchError('Match not found', 'NOT_FOUND');
  if (!match.matchIdOnchain) throw new MatchError('No on-chain match', 'NOT_ON_CHAIN');
  if (match.settleTxHash) {
    console.log(`[evm-match] Match ${matchId} already settled: ${match.settleTxHash}`);
    return;
  }

  const p1Score = match.player1Score ?? 0;
  const p2Score = match.player2Score ?? 0;

  let settlementType: 'winner' | 'draw' | 'refund';
  let winnerAddress: string | null = null;

  if (p1Score > p2Score) {
    settlementType = 'winner';
    winnerAddress = match.player1Address;
  } else if (p2Score > p1Score) {
    settlementType = 'winner';
    winnerAddress = match.player2Address ?? null;
  } else {
    settlementType = 'draw';
  }

  try {
    let txResult;
    if (settlementType === 'draw') {
      txResult = await settleMatchDraw(match.matchIdOnchain as Hash);
    } else {
      txResult = await settleMatch({
        matchId: match.matchIdOnchain as Hash,
        winner: winnerAddress as Address,
      });
    }

    // Record settlement in v3 tables
    const payoutWei = settlementType === 'draw'
      ? match.depositAmountWei
      : (BigInt(match.depositAmountWei) * 2n).toString();

    const newSettlement: NewSettlementV3 = {
      id: randomUUID(),
      matchIdOnchain: match.matchIdOnchain,
      settlementType,
      winnerAddress,
      payoutWei,
      txHash: txResult.hash,
      txStatus: 'submitted',
      createdAt: new Date(),
    };

    await db.insert(settlementsV3).values(newSettlement);

    // Update match
    await db
      .update(matchesV3)
      .set({
        settleTxHash: txResult.hash,
        winnerAddress,
        state: 'settled',
        settledAt: new Date(),
      })
      .where(eq(matchesV3.id, matchId));

    console.log(`[evm-match] Settlement tx: ${txResult.hash} (${settlementType})`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[evm-match] Settlement failed for ${matchId}: ${msg}`);
    throw new MatchError(`Settlement failed: ${msg}`, 'TX_FAILED');
  }
}

/**
 * Sync match state from indexed chain events.
 * Called periodically or on-demand to update v3 tables from on-chain data.
 */
export async function syncMatchFromEvents(matchId: string): Promise<void> {
  const match = await getMatchById(matchId);
  if (!match?.matchIdOnchain) return;

  const events = await getEvmEventsByMatchId(match.matchIdOnchain);
  const updates: Partial<MatchV3> = {};

  for (const event of events) {
    switch (event.eventName) {
      case 'Deposited': {
        const playerAddr = (event.args.player as string)?.toLowerCase();
        if (playerAddr === match.player1Address.toLowerCase()) {
          updates.player1Deposited = 1;
        } else if (playerAddr === match.player2Address?.toLowerCase()) {
          updates.player2Deposited = 1;
        }

        // Upsert deposit record
        const depositId = `${match.matchIdOnchain}-${playerAddr}`;
        try {
          const newDep: NewDepositV3 = {
            id: depositId,
            matchIdOnchain: match.matchIdOnchain,
            playerAddress: playerAddr ?? '',
            amountWei: event.args.amount != null ? String(event.args.amount as string | number | bigint) : match.depositAmountWei,
            txHash: event.txHash,
            txStatus: 'mined',
            blockNumber: BigInt(event.blockNumber),
            createdAt: new Date(event.createdAt),
            minedAt: new Date(event.createdAt),
          };
          await db.insert(depositsV3).values(newDep).onConflictDoNothing();
        } catch { /* already exists */ }
        break;
      }
      case 'MatchFunded':
        updates.state = 'funded';
        updates.fundedAt = new Date(event.createdAt);
        break;
      case 'Settled':
        updates.state = 'settled';
        updates.winnerAddress = event.args.winner as string;
        updates.settledAt = new Date(event.createdAt);
        break;
      case 'Draw':
        updates.state = 'settled';
        updates.settledAt = new Date(event.createdAt);
        break;
      case 'MatchCancelled':
        updates.state = 'cancelled';
        break;
      case 'Refunded':
        updates.state = 'refunded';
        break;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(matchesV3).set(updates).where(eq(matchesV3.id, matchId));
  }
}

// ── Internal Helpers ──

async function getMatchById(matchId: string): Promise<MatchV3 | null> {
  const rows = await db
    .select()
    .from(matchesV3)
    .where(eq(matchesV3.id, matchId))
    .limit(1);
  return rows[0] ?? null;
}

function buildMatchResponse(
  match: MatchV3,
  deposits: Array<{ playerAddress: string; amountWei: string; txHash: string | null; txStatus: string; blockNumber: bigint | null }>,
  settlement: { txHash: string | null; txStatus: string; payoutWei: string; settlementType: string; winnerAddress: string | null } | null,
  chainEvents: EvmChainEventInfo[],
): V3MatchResponse {
  const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS ?? '';

  return {
    id: match.id,
    matchIdOnchain: match.matchIdOnchain,
    joinCode: match.joinCode ?? '',
    state: match.state,
    players: {
      player1: {
        address: match.player1Address,
        deposited: match.player1Deposited === 1,
        score: match.player1Score,
      },
      player2: {
        address: match.player2Address ?? null,
        deposited: match.player2Deposited === 1,
        score: match.player2Score,
      },
    },
    depositAmountWei: match.depositAmountWei,
    timeoutBlock: match.timeoutBlock?.toString() ?? null,
    winner: match.winnerAddress ? { address: match.winnerAddress } : null,
    settlement: settlement ? {
      txHash: settlement.txHash,
      txStatus: settlement.txStatus as EvmTxStatus,
      payoutWei: settlement.payoutWei,
      type: settlement.settlementType,
    } : null,
    deposits: deposits.map(d => ({
      playerAddress: d.playerAddress,
      amountWei: d.amountWei,
      txHash: d.txHash,
      txStatus: d.txStatus as EvmTxStatus,
      blockNumber: d.blockNumber?.toString() ?? null,
    })),
    chainEvents,
    contract: {
      escrowAddress,
      matchIdBytes32: match.matchIdOnchain,
    },
    createdAt: match.createdAt instanceof Date ? match.createdAt.getTime() : Number(match.createdAt),
    fundedAt: match.fundedAt instanceof Date ? match.fundedAt.getTime() : null,
    settledAt: match.settledAt instanceof Date ? match.settledAt.getTime() : null,
  };
}

// ── Error Class ──

export class MatchError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'INVALID_STATE' | 'SELF_JOIN' | 'NOT_PLAYER' | 'NOT_ON_CHAIN' | 'TX_FAILED' | 'INTERNAL',
  ) {
    super(message);
    this.name = 'MatchError';
  }

  get httpStatus(): number {
    switch (this.code) {
      case 'NOT_FOUND': return 404;
      case 'INVALID_STATE':
      case 'SELF_JOIN':
      case 'NOT_PLAYER':
      case 'NOT_ON_CHAIN':
        return 400;
      case 'TX_FAILED':
      case 'INTERNAL':
        return 500;
    }
  }
}
