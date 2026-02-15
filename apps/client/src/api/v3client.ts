/**
 * V3 API Client — EVM Contract-first Match API
 *
 * All match operations use /api/v3/match/* endpoints.
 * Data types mirror server V3MatchResponse.
 */

const PROD_API_BASE = 'https://api-kasracing.ihb1.xyz';
const API_BASE = import.meta.env.DEV
  ? ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787')
  : PROD_API_BASE;

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
    fuelTokenAddress: string;
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

// ── Session / Reward API ──

export interface V3SessionPolicy {
  rewardCooldownMs: number;
  rewardMaxPerSession: number;
  rewardAmounts: number[];
}

export interface V3StartSessionResponse {
  sessionId: string;
  policy: V3SessionPolicy;
}

export interface V3SessionEventResponse {
  accepted: boolean;
  rejectReason?: string;
  rewardAmountWei?: string;
  txHash?: string;
  txStatus?: EvmTxStatus;
  eventId?: string;
}

export interface V3SessionInfo {
  id: string;
  mode: string;
  status: string;
  eventCount: number;
  policy: V3SessionPolicy;
  createdAt: number;
}

export interface V3FaucetResponse {
  txHash: string;
  amountWei: string;
}

export interface V3RewardEvent {
  id: string;
  sessionId: string;
  seq: number;
  recipientAddress: string;
  amountWei: string;
  proofHash: string | null;
  txHash: string | null;
  txStatus: EvmTxStatus;
  blockNumber: string | null;
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
  timestamps: {
    created: number;
    mined: number | null;
    confirmed: number | null;
  };
}

/**
 * Start a new game session (V3)
 */
export async function startSessionV3(
  userAddress: string,
  mode: 'free_run' | 'duel' = 'free_run',
): Promise<V3StartSessionResponse> {
  const response = await fetch(`${API_BASE}/api/v3/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAddress, mode }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3StartSessionResponse;
}

/**
 * Send a game event (V3 — reward via RewardVault contract)
 */
export async function sendEventV3(
  sessionId: string,
  type: 'checkpoint',
  seq: number,
  timestamp: number,
): Promise<V3SessionEventResponse> {
  const response = await fetch(`${API_BASE}/api/v3/session/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, type, seq, timestamp }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3SessionEventResponse;
}

/**
 * End a session (V3)
 */
export async function endSessionV3(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v3/session/${sessionId}/end`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

/**
 * Get session events with EVM chain data
 */
export async function getSessionEventsV3(
  sessionId: string,
): Promise<{ sessionId: string; events: V3RewardEvent[]; total: number }> {
  const response = await fetch(`${API_BASE}/api/v3/session/${sessionId}/events`);

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as { sessionId: string; events: V3RewardEvent[]; total: number };
}

// ── Transaction / Proof API ──

export interface V3TxStatusResponse {
  txHash: string;
  status: EvmTxStatus;
  blockNumber: string | null;
  confirmations: number;
  events: Array<{
    id: number;
    blockNumber: string;
    txHash: string;
    logIndex: number;
    contract: string;
    eventName: string;
    args: Record<string, unknown>;
    createdAt: number;
  }>;
  timestamps: {
    submitted?: number;
    mined?: number;
    confirmed?: number;
  };
}

export interface V3TxDetailsResponse {
  txHash: string;
  receipt: {
    blockNumber: string;
    status: string;
    gasUsed: string;
    from: string;
    to: string | null;
  } | null;
  events: Array<{
    id: number;
    blockNumber: string;
    txHash: string;
    logIndex: number;
    contract: string;
    eventName: string;
    args: Record<string, unknown>;
    createdAt: number;
  }>;
}

export interface V3ProofResponse {
  sessionId: string;
  seq: number;
  proofHash: string | null;
  payload: string | null;
  txHash: string | null;
  blockNumber: string | null;
  verified: boolean;
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
}

/**
 * Get EVM transaction status
 */
export async function getTxStatusV3(txHash: string): Promise<V3TxStatusResponse> {
  const response = await fetch(`${API_BASE}/api/v3/tx/${txHash}/status`);

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3TxStatusResponse;
}

/**
 * Get EVM transaction details
 */
export async function getTxDetailsV3(txHash: string): Promise<V3TxDetailsResponse> {
  const response = await fetch(`${API_BASE}/api/v3/tx/${txHash}`);

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3TxDetailsResponse;
}

// ── Market API ──

export interface MarketInfo {
  id: string;
  matchId: string;
  state: 'open' | 'locked' | 'settled' | 'cancelled';
  player1Address: string;
  player2Address: string;
  totalPoolWei: string;
  createdAt: number;
  lockedAt: number | null;
  settledAt: number | null;
}

export interface MarketOdds {
  seq: number;
  probABps: number;
  probBBps: number;
  timestamp: number;
}

export interface MarketBet {
  id: string;
  side: 'A' | 'B';
  stakeWei: string;
  oddsAtPlacementBps: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  userId: string;
  createdAt: number;
}

export interface MarketStateResponse {
  market: MarketInfo;
  odds: MarketOdds | null;
  bets: MarketBet[];
}

export interface PlaceBetResponse {
  orderId: string;
  side: 'A' | 'B';
  stakeWei: string;
  oddsAtPlacementBps: number;
  status: string;
}

export interface CancelBetResponse {
  orderId: string;
  cancelled: boolean;
}

/**
 * Get market state, current odds, and bets
 */
export async function getMarketV3(marketId: string): Promise<MarketStateResponse> {
  const response = await fetch(`${API_BASE}/api/v3/market/${marketId}`);

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as MarketStateResponse;
}

/**
 * Get market by match ID
 */
export async function getMarketByMatchV3(
  matchId: string,
): Promise<{ marketId: string; state: string; matchId: string }> {
  const response = await fetch(`${API_BASE}/api/v3/market/match/${matchId}`);

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as { marketId: string; state: string; matchId: string };
}

/**
 * Place a bet on a market outcome
 */
export async function placeBetV3(
  marketId: string,
  userId: string,
  side: 'A' | 'B',
  stakeWei: string,
  idempotencyKey: string,
): Promise<PlaceBetResponse> {
  const response = await fetch(`${API_BASE}/api/v3/market/${marketId}/bet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, side, stakeWei, idempotencyKey }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as PlaceBetResponse;
}

/**
 * Cancel a pending bet
 */
export async function cancelBetV3(
  marketId: string,
  orderId: string,
  userId: string,
): Promise<CancelBetResponse> {
  const response = await fetch(`${API_BASE}/api/v3/market/${marketId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, userId }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as CancelBetResponse;
}

/**
 * Submit race telemetry for odds calculation
 */
export async function submitTelemetryV3(
  marketId: string,
  telemetry: {
    player1Distance: number;
    player1Speed: number;
    player2Distance: number;
    player2Speed: number;
    elapsedMs: number;
    totalDurationMs: number;
  },
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v3/market/${marketId}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(telemetry),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

/**
 * Get proof-of-action data
 */
export async function getProofV3(
  sessionId: string,
  seq: number,
): Promise<V3ProofResponse> {
  const response = await fetch(`${API_BASE}/api/v3/tx/proof/${sessionId}/${seq}`);

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3ProofResponse;
}

/**
 * Request kFUEL from faucet
 */
export async function requestFaucet(
  address: string,
  amountWei?: string,
): Promise<V3FaucetResponse> {
  const response = await fetch(`${API_BASE}/api/v3/faucet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, amountWei }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return (await response.json()) as V3FaucetResponse;
}
