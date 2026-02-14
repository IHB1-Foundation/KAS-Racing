// Session types
export interface Session {
  id: string;
  userAddress: string;
  mode: 'free_run' | 'duel';
  policy: SessionPolicy;
  status: 'active' | 'ended';
  createdAt: number;
  eventCount: number;
  lastEventAt: number | null;
}

export interface SessionPolicy {
  rewardCooldownMs: number;
  rewardMaxPerSession: number;
  rewardAmounts: number[]; // in KAS
}

// Event types
export interface SessionEvent {
  sessionId: string;
  type: 'checkpoint';
  seq: number;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface SessionEventResult {
  accepted: boolean;
  rejectReason?: string;
  rewardAmount?: number;
  txid?: string;
}

// Tx types
export type TxStatus =
  | 'pending'
  | 'broadcasted'
  | 'accepted'
  | 'included'
  | 'confirmed'
  | 'failed';

export interface TxStatusInfo {
  txid: string;
  status: TxStatus;
  broadcastedAt?: number;
  acceptedAt?: number;
  includedAt?: number;
  confirmedAt?: number;
  confirmations: number;
}

// On-chain state change event (standardized for all entity types)
export interface ChainStateEvent {
  entityType: 'reward' | 'deposit' | 'settlement';
  entityId: string; // sessionId, matchId, or depositId
  txid: string;
  oldStatus: TxStatus;
  newStatus: TxStatus;
  timestamps: {
    broadcasted?: number;
    accepted?: number;
    included?: number;
    confirmed?: number;
  };
  confirmations: number;
  source: 'indexer' | 'api' | 'db';
}

// Match state change event (high-level match lifecycle)
export interface MatchStateEvent {
  matchId: string;
  oldStatus: string;
  newStatus: string;
  deposits: {
    A: { txid: string | null; status: string | null };
    B: { txid: string | null; status: string | null };
  };
  settlement: { txid: string | null; status: string | null } | null;
  winner: string | null;
  scores: { A: number | null; B: number | null };
}

// WebSocket event types
export interface WsEvents {
  // Server -> Client
  txStatusUpdated: (data: TxStatusInfo) => void;
  sessionEventAck: (data: SessionEventResult & { seq: number }) => void;
  chainStateChanged: (data: ChainStateEvent) => void;
  matchStateChanged: (data: MatchStateEvent) => void;

  // Client -> Server
  subscribe: (data: { sessionId: string }) => void;
  unsubscribe: (data: { sessionId: string }) => void;
  subscribeMatch: (data: { matchId: string }) => void;
  unsubscribeMatch: (data: { matchId: string }) => void;
}

// API Request/Response types
export interface StartSessionRequest {
  userAddress: string;
  mode: 'free_run' | 'duel';
}

export interface StartSessionResponse {
  sessionId: string;
  policy: SessionPolicy;
}

export interface SessionEventRequest {
  sessionId: string;
  type: 'checkpoint';
  seq: number;
  timestamp: number;
}

export interface TxStatusResponse {
  txid: string;
  status: TxStatus;
  timestamps: {
    broadcasted?: number;
    accepted?: number;
    included?: number;
    confirmed?: number;
  };
  confirmations: number;
}
