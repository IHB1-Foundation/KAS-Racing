/**
 * API Client for KAS Racing server
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

export interface SessionPolicy {
  rewardCooldownMs: number;
  rewardMaxPerSession: number;
  rewardAmounts: number[];
}

export interface StartSessionResponse {
  sessionId: string;
  policy: SessionPolicy;
}

export interface SessionEventResponse {
  accepted: boolean;
  rejectReason?: string;
  rewardAmount?: number;
  txid?: string;
}

export interface SessionInfo {
  id: string;
  mode: string;
  status: string;
  eventCount: number;
  policy: SessionPolicy;
  createdAt: number;
}

interface ApiError {
  error?: string;
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiError;
    return data.error ?? `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

/**
 * Start a new game session
 */
export async function startSession(
  userAddress: string,
  mode: 'free_run' | 'duel' = 'free_run'
): Promise<StartSessionResponse> {
  const response = await fetch(`${API_BASE}/api/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAddress, mode }),
  });

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as StartSessionResponse;
}

/**
 * Send a game event (checkpoint collection)
 */
export async function sendEvent(
  sessionId: string,
  type: 'checkpoint',
  seq: number,
  timestamp: number
): Promise<SessionEventResponse> {
  const response = await fetch(`${API_BASE}/api/session/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, type, seq, timestamp }),
  });

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as SessionEventResponse;
}

/**
 * Get session info
 */
export async function getSession(sessionId: string): Promise<SessionInfo> {
  const response = await fetch(`${API_BASE}/api/session/${sessionId}`);

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as SessionInfo;
}

/**
 * End a session
 */
export async function endSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/session/${sessionId}/end`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }
}

// ============ Match API ============

export interface MatchPlayer {
  address: string;
  depositTxid: string | null;
  depositStatus: string | null;
}

export interface DepositInfo {
  id: string;
  matchId: string;
  player: 'A' | 'B';
  playerAddress: string;
  escrowAddress: string;
  amountSompi: string;
  txid: string | null;
  txStatus: string;
  daaScore: string | null;
  createdAt: number;
  broadcastedAt: number | null;
  acceptedAt: number | null;
  includedAt: number | null;
  confirmedAt: number | null;
}

export interface SettlementInfo {
  id: string;
  matchId: string;
  settlementType: string;
  txid: string | null;
  txStatus: string;
  winnerAddress: string | null;
  totalAmountSompi: string;
  feeSompi: string;
  daaScore: string | null;
  createdAt: number;
  broadcastedAt: number | null;
  acceptedAt: number | null;
  includedAt: number | null;
  confirmedAt: number | null;
}

export interface MatchInfo {
  id: string;
  joinCode: string;
  status: 'waiting' | 'deposits_pending' | 'ready' | 'playing' | 'finished' | 'cancelled';
  betAmount: number;
  playerA: MatchPlayer | null;
  playerB: MatchPlayer | null;
  escrowAddressA: string | null;
  escrowAddressB: string | null;
  winner: string | null;
  playerAScore: number | null;
  playerBScore: number | null;
  settleTxid: string | null;
  settleStatus: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  // v2 enriched fields
  deposits?: DepositInfo[];
  settlement?: SettlementInfo | null;
}

export interface SessionEventInfo {
  id: string;
  seq: number;
  type: string;
  rewardAmount: number;
  txid: string | null;
  txStatus: string;
  timestamps: {
    created: number;
    broadcasted: number | null;
    accepted: number | null;
    included: number | null;
    confirmed: number | null;
  };
  chain: {
    source: 'indexer';
    daaScore: string | null;
    confirmations: number;
    payload: string | null;
    indexedAt: number;
  } | null;
}

export interface SessionEventsResponse {
  sessionId: string;
  events: SessionEventInfo[];
  total: number;
}

export interface ChainEventInfo {
  id: string;
  txid: string;
  eventType: string;
  fromAddress: string;
  toAddress: string;
  amountSompi: string;
  daaScore: string | null;
  confirmations: number;
  payload: string | null;
  indexedAt: number;
}

export interface CreateMatchResponse {
  matchId: string;
  joinCode: string;
  betAmount: number;
  status: string;
}

/**
 * Create a new match
 */
export async function createMatch(
  playerAddress: string,
  betAmount: number
): Promise<CreateMatchResponse> {
  const response = await fetch(`${API_BASE}/api/match/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerAddress, betAmount }),
  });

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as CreateMatchResponse;
}

/**
 * Join a match by code
 */
export async function joinMatch(
  joinCode: string,
  playerAddress: string
): Promise<MatchInfo> {
  const response = await fetch(`${API_BASE}/api/match/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode, playerAddress }),
  });

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as MatchInfo;
}

/**
 * Get match info by ID
 */
export async function getMatch(matchId: string): Promise<MatchInfo> {
  const response = await fetch(`${API_BASE}/api/match/${matchId}`);

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as MatchInfo;
}

/**
 * Register a deposit transaction for a match
 */
export async function registerDeposit(
  matchId: string,
  player: 'A' | 'B',
  txid: string
): Promise<MatchInfo> {
  const response = await fetch(`${API_BASE}/api/match/${matchId}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, txid }),
  });

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as MatchInfo;
}

/**
 * Start the game for a match
 */
export async function startGame(
  matchId: string,
  player: 'A' | 'B'
): Promise<MatchInfo> {
  const response = await fetch(`${API_BASE}/api/match/${matchId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player }),
  });

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as MatchInfo;
}

/**
 * Submit score after race ends
 */
export async function submitScore(
  matchId: string,
  player: 'A' | 'B',
  score: number
): Promise<MatchInfo> {
  const response = await fetch(`${API_BASE}/api/match/${matchId}/submit-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, score }),
  });

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as MatchInfo;
}

/**
 * Get session events with chain enrichment
 */
export async function getSessionEvents(sessionId: string): Promise<SessionEventsResponse> {
  const response = await fetch(`${API_BASE}/api/session/${sessionId}/events`);

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as SessionEventsResponse;
}

/**
 * Get chain events for a match
 */
export async function getMatchChainEvents(matchId: string): Promise<{ matchId: string; events: ChainEventInfo[] }> {
  const response = await fetch(`${API_BASE}/api/match/${matchId}/chain-events`);

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as { matchId: string; events: ChainEventInfo[] };
}

// ============ Transaction API ============

export interface TxStatusInfo {
  txid: string;
  status: 'broadcasted' | 'accepted' | 'included' | 'confirmed' | 'failed';
  timestamps: {
    broadcasted?: number;
    accepted?: number;
    included?: number;
    confirmed?: number;
  };
  confirmations: number;
}

export interface TxDetails {
  txid: string;
  payload: string | null;
  outputs: Array<{ amount: number; address?: string; script_public_key_address?: string }>;
  inputs: Array<{ previous_outpoint_hash?: string; previous_outpoint_index?: number }>;
  blockHash: string | null;
  blockTime: number | null;
}

/**
 * Get transaction status
 */
export async function getTxStatus(txid: string): Promise<TxStatusInfo> {
  const response = await fetch(`${API_BASE}/api/tx/${txid}/status`);

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as TxStatusInfo;
}

/**
 * Get full transaction details (including payload)
 */
export async function getTxDetails(txid: string): Promise<TxDetails> {
  const response = await fetch(`${API_BASE}/api/tx/${txid}`);

  if (!response.ok) {
    const errorMsg = await parseErrorResponse(response);
    throw new Error(errorMsg);
  }

  return (await response.json()) as TxDetails;
}
