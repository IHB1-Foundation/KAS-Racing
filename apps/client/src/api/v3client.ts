/**
 * V3 API Client — EVM Contract-first Match API
 *
 * All match operations use /api/v3/match/* endpoints.
 * Data types mirror server V3MatchResponse.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

// ── Types ──

export type EvmTxStatus = 'pending' | 'submitted' | 'mined' | 'confirmed' | 'failed';

export interface V3MatchPlayer {
  address: string;
  deposited: boolean;
  score: number | null;
}

export interface V3MatchResponse {
  id: string;
  matchIdOnchain: string | null;
  joinCode: string;
  state: 'lobby' | 'created' | 'funded' | 'settled' | 'refunded' | 'cancelled';
  players: {
    player1: V3MatchPlayer;
    player2: {
      address: string | null;
      deposited: boolean;
      score: number | null;
    };
  };
  depositAmountWei: string;
  timeoutBlock: string | null;
  winner: { address: string } | null;
  settlement: {
    txHash: string | null;
    txStatus: EvmTxStatus;
    payoutWei: string;
    type: string;
  } | null;
  deposits: Array<{
    playerAddress: string;
    amountWei: string;
    txHash: string | null;
    txStatus: EvmTxStatus;
    blockNumber: string | null;
  }>;
  chainEvents: Array<{
    id: number;
    blockNumber: string;
    txHash: string;
    logIndex: number;
    contract: string;
    eventName: string;
    args: Record<string, unknown>;
    createdAt: number;
  }>;
  contract: {
    escrowAddress: string;
    matchIdBytes32: string | null;
  };
  createdAt: number;
  fundedAt: number | null;
  settledAt: number | null;
}

// ── Helpers ──

interface ApiError { error?: string }

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiError;
    return data.error ?? `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

// ── API Functions ──

/**
 * Create a match lobby (on-chain match created when player2 joins)
 */
export async function createMatchV3(
  playerAddress: string,
  betAmountWei: string,
): Promise<V3MatchResponse> {
  const response = await fetch(`${API_BASE}/api/v3/match/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerAddress, betAmountWei }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3MatchResponse;
}

/**
 * Join a match and trigger on-chain match creation
 */
export async function joinMatchV3(
  joinCode: string,
  playerAddress: string,
): Promise<V3MatchResponse> {
  const response = await fetch(`${API_BASE}/api/v3/match/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode, playerAddress }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3MatchResponse;
}

/**
 * Get match state (DB + on-chain events)
 */
export async function getMatchV3(
  matchId: string,
  opts?: { sync?: boolean },
): Promise<V3MatchResponse> {
  const params = opts?.sync ? '?sync=true' : '';
  const response = await fetch(`${API_BASE}/api/v3/match/${matchId}${params}`);

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3MatchResponse;
}

/**
 * Submit player score — auto-triggers settlement when both scores are in
 */
export async function submitScoreV3(
  matchId: string,
  playerAddress: string,
  score: number,
): Promise<V3MatchResponse> {
  const response = await fetch(`${API_BASE}/api/v3/match/${matchId}/submit-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerAddress, score }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3MatchResponse;
}

/**
 * Force sync match state from chain events
 */
export async function syncMatchV3(matchId: string): Promise<V3MatchResponse> {
  const response = await fetch(`${API_BASE}/api/v3/match/${matchId}/sync`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3MatchResponse;
}
