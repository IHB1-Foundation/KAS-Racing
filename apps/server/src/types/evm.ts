/**
 * EVM-specific types for KASPLEX zkEVM integration (V3 API)
 */

// ── Tx Lifecycle ──

/** EVM transaction lifecycle status */
export type EvmTxStatus = 'pending' | 'submitted' | 'mined' | 'confirmed' | 'failed';

/** EVM transaction status info */
export interface EvmTxStatusInfo {
  txHash: string;
  status: EvmTxStatus;
  blockNumber: string | null;
  confirmations: number;
  events: EvmChainEventInfo[];
  timestamps: {
    submitted?: number;
    mined?: number;
    confirmed?: number;
  };
}

// ── Chain Events ──

/** Chain event info from indexer (chain_events_evm) */
export interface EvmChainEventInfo {
  id: number;
  blockNumber: string;
  txHash: string;
  logIndex: number;
  contract: string;
  eventName: string;
  args: Record<string, unknown>;
  createdAt: number;
}

// ── Match ──

/** Unified V3 match response — single endpoint for FE */
export interface V3MatchResponse {
  id: string;
  matchIdOnchain: string | null;
  joinCode: string;
  state: string;
  players: {
    player1: {
      address: string;
      deposited: boolean;
      score: number | null;
    };
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
  chainEvents: EvmChainEventInfo[];
  contract: {
    escrowAddress: string;
    matchIdBytes32: string | null;
  };
  createdAt: number;
  fundedAt: number | null;
  settledAt: number | null;
}

// ── Session / Reward ──

/** V3 reward event response */
export interface V3RewardEventResponse {
  id: string;
  sessionId: string;
  seq: number;
  recipientAddress: string;
  amountWei: string;
  proofHash: string | null;
  txHash: string | null;
  txStatus: EvmTxStatus;
  blockNumber: string | null;
  chainEvents: EvmChainEventInfo[];
  timestamps: {
    created: number;
    mined: number | null;
    confirmed: number | null;
  };
}

// ── Proof ──

/** V3 proof data response */
export interface V3ProofResponse {
  sessionId: string;
  seq: number;
  proofHash: string | null;
  payload: string | null;
  txHash: string | null;
  blockNumber: string | null;
  verified: boolean;
  chainEvents: EvmChainEventInfo[];
}

// ── API Request Types ──

export interface V3CreateMatchRequest {
  playerAddress: string;
  betAmountWei: string; // wei as string
}

export interface V3JoinMatchRequest {
  joinCode: string;
  playerAddress: string;
}

export interface V3SubmitScoreRequest {
  playerAddress: string;
  score: number;
}

export interface V3SessionEventRequest {
  sessionId: string;
  type: 'checkpoint';
  seq: number;
  timestamp: number;
}
