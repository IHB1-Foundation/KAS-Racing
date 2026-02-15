/**
 * useRealtimeSync - WebSocket + Polling Hybrid Hook
 *
 * Connects to server via Socket.IO for real-time updates.
 * Falls back to polling if WebSocket connection fails.
 * Optionally runs reconciliation polling even when connected.
 * Tracks event latency for debugging.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getMatch, type TxStatusInfo, type MatchInfo } from '../api/client';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';
const POLL_INTERVAL_FALLBACK_MS = 3000;
const RECONNECT_DELAY_MS = 2000;

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'polling';

export interface LatencyRecord {
  event: string;
  entityId: string;
  latencyMs: number;
  timestamp: number;
  source: 'ws' | 'poll';
}

export interface ChainStateEvent {
  entityType: 'reward' | 'deposit' | 'settlement';
  entityId: string;
  txid: string;
  oldStatus: string;
  newStatus: string;
  timestamps: Record<string, number | undefined>;
  confirmations: number;
  source: string;
}

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

interface EvmChainEventInfo {
  id: number;
  blockNumber: string;
  txHash: string;
  logIndex: number;
  contract: string;
  eventName: string;
  args: Record<string, unknown>;
  createdAt: number;
}

interface EvmMatchUpdateEvent {
  matchId: string;
  eventName: string;
  chainEvent: EvmChainEventInfo;
}

interface EvmRewardUpdateEvent {
  txHash: string;
  eventName: string;
  chainEvent: EvmChainEventInfo;
}

interface UseRealtimeSyncOptions {
  sessionId?: string | null;
  matchId?: string | null;
  enabled?: boolean;
  /** When set, poll at this interval even when WS is connected (reconciliation). */
  reconcileIntervalMs?: number;
  onTxStatusUpdate?: (data: TxStatusInfo) => void;
  onMatchUpdate?: (data: MatchInfo) => void;
  onChainStateChanged?: (data: ChainStateEvent) => void;
  onMatchStateChanged?: (data: MatchStateEvent) => void;
}

function mapEvmEventToTxStatus(eventName: string): TxStatusInfo['status'] {
  switch (eventName) {
    case 'MatchFunded':
    case 'Settled':
    case 'Draw':
    case 'Deposited':
    case 'RewardPaid':
    case 'ProofRecorded':
      return 'included';
    default:
      return 'accepted';
  }
}

export function useRealtimeSync(options: UseRealtimeSyncOptions) {
  const {
    sessionId,
    matchId,
    enabled = true,
    reconcileIntervalMs,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [latencyRecords, setLatencyRecords] = useState<LatencyRecord[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconcileTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const addLatencyRecord = useCallback((record: LatencyRecord) => {
    setLatencyRecords(prev => {
      const updated = [...prev, record];
      return updated.length > 50 ? updated.slice(-50) : updated;
    });
  }, []);

  // Poll match status (shared by fallback and reconciliation)
  const pollOnce = useCallback(async () => {
    const startTime = Date.now();

    if (callbacksRef.current.matchId && callbacksRef.current.onMatchUpdate) {
      try {
        const match = await getMatch(callbacksRef.current.matchId);
        callbacksRef.current.onMatchUpdate(match);
        addLatencyRecord({
          event: 'matchPoll',
          entityId: callbacksRef.current.matchId,
          latencyMs: Date.now() - startTime,
          timestamp: Date.now(),
          source: 'poll',
        });
      } catch {
        // Ignore poll errors
      }
    }
  }, [addLatencyRecord]);

  // Start fallback polling (when WS disconnects)
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;

    setConnectionState('polling');

    pollTimerRef.current = setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_FALLBACK_MS);
  }, [pollOnce]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Reconciliation polling (runs even when WS connected)
  useEffect(() => {
    if (!enabled || !reconcileIntervalMs) return;

    // Only reconcile when WS is connected (fallback polling handles disconnected)
    if (connectionState !== 'connected') return;

    reconcileTimerRef.current = setInterval(() => {
      void pollOnce();
    }, reconcileIntervalMs);

    return () => {
      if (reconcileTimerRef.current) {
        clearInterval(reconcileTimerRef.current);
        reconcileTimerRef.current = null;
      }
    };
  }, [enabled, reconcileIntervalMs, connectionState, pollOnce]);

  // Connect WebSocket
  useEffect(() => {
    if (!enabled) return;

    const socket = io(API_BASE, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;
    setConnectionState('connecting');

    socket.on('connect', () => {
      setConnectionState('connected');
      stopPolling();

      // Subscribe to session
      if (sessionId) {
        socket.emit('subscribe', { sessionId });
      }

      // Subscribe to match
      if (matchId) {
        socket.emit('subscribeMatch', { matchId });
      }

      // Reconcile on reconnect: fetch latest state to catch missed events
      void pollOnce();
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
      startPolling();
    });

    socket.on('connect_error', () => {
      setConnectionState('disconnected');
      startPolling();
    });

    // Handle tx status updates
    socket.on('txStatusUpdated', (data: TxStatusInfo) => {
      const receiveTime = Date.now();
      callbacksRef.current.onTxStatusUpdate?.(data);

      addLatencyRecord({
        event: 'txStatusUpdated',
        entityId: data.txid,
        latencyMs: data.timestamps?.broadcasted
          ? receiveTime - data.timestamps.broadcasted
          : 0,
        timestamp: receiveTime,
        source: 'ws',
      });
    });

    // Handle match updates
    socket.on('matchUpdated', (data: MatchInfo) => {
      callbacksRef.current.onMatchUpdate?.(data);

      addLatencyRecord({
        event: 'matchUpdated',
        entityId: data.id,
        latencyMs: 0,
        timestamp: Date.now(),
        source: 'ws',
      });
    });

    // Handle chain state changes (indexer-fed)
    socket.on('chainStateChanged', (data: ChainStateEvent) => {
      const receiveTime = Date.now();
      callbacksRef.current.onChainStateChanged?.(data);

      // Calculate latency from the most recent chain timestamp
      let chainLatencyMs = 0;
      const ts = data.timestamps;
      const latestChainTs = ts.confirmed ?? ts.included ?? ts.accepted ?? ts.broadcasted;
      if (latestChainTs) {
        chainLatencyMs = receiveTime - latestChainTs;
      }

      addLatencyRecord({
        event: `chain:${data.entityType}:${data.newStatus}`,
        entityId: data.txid.slice(0, 12),
        latencyMs: chainLatencyMs,
        timestamp: receiveTime,
        source: 'ws',
      });
    });

    // Handle match state changes
    socket.on('matchStateChanged', (data: MatchStateEvent) => {
      callbacksRef.current.onMatchStateChanged?.(data);

      addLatencyRecord({
        event: `match:${data.newStatus}`,
        entityId: data.matchId,
        latencyMs: 0,
        timestamp: Date.now(),
        source: 'ws',
      });
    });

    // Handle EVM match updates (v3)
    socket.on('evmMatchUpdate', (data: EvmMatchUpdateEvent) => {
      const status = mapEvmEventToTxStatus(data.eventName);
      const entityType = data.eventName === 'Settled' || data.eventName === 'Draw'
        ? 'settlement'
        : 'deposit';

      callbacksRef.current.onChainStateChanged?.({
        entityType,
        entityId: data.matchId,
        txid: data.chainEvent.txHash,
        oldStatus: status,
        newStatus: status,
        timestamps: { included: data.chainEvent.createdAt },
        confirmations: 1,
        source: 'indexer',
      });

      callbacksRef.current.onMatchStateChanged?.({
        matchId: data.matchId,
        oldStatus: data.eventName,
        newStatus: data.eventName,
        deposits: {
          A: { txid: null, status: null },
          B: { txid: null, status: null },
        },
        settlement: null,
        winner: null,
        scores: { A: null, B: null },
      });

      addLatencyRecord({
        event: `evm:${data.eventName}`,
        entityId: data.matchId,
        latencyMs: Math.max(0, Date.now() - data.chainEvent.createdAt),
        timestamp: Date.now(),
        source: 'ws',
      });
    });

    // Handle EVM reward updates (v3)
    socket.on('evmRewardUpdate', (data: EvmRewardUpdateEvent) => {
      const status = mapEvmEventToTxStatus(data.eventName);

      callbacksRef.current.onChainStateChanged?.({
        entityType: 'reward',
        entityId: String(data.chainEvent.args.sessionId ?? ''),
        txid: data.txHash,
        oldStatus: status,
        newStatus: status,
        timestamps: { included: data.chainEvent.createdAt },
        confirmations: 1,
        source: 'indexer',
      });

      addLatencyRecord({
        event: `evm:${data.eventName}`,
        entityId: data.txHash.slice(0, 12),
        latencyMs: Math.max(0, Date.now() - data.chainEvent.createdAt),
        timestamp: Date.now(),
        source: 'ws',
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      stopPolling();
    };
  }, [enabled, sessionId, matchId, startPolling, stopPolling, addLatencyRecord, pollOnce]);

  // Re-subscribe when session/match changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    if (sessionId) {
      socket.emit('subscribe', { sessionId });
    }
    if (matchId) {
      socket.emit('subscribeMatch', { matchId });
    }

    return () => {
      if (sessionId) {
        socket.emit('unsubscribe', { sessionId });
      }
      if (matchId) {
        socket.emit('unsubscribeMatch', { matchId });
      }
    };
  }, [sessionId, matchId]);

  // Compute average latency
  const avgLatencyMs = latencyRecords.length > 0
    ? Math.round(latencyRecords.reduce((sum, r) => sum + r.latencyMs, 0) / latencyRecords.length)
    : 0;

  return {
    connectionState,
    latencyRecords,
    avgLatencyMs,
    clearLatencyRecords: () => setLatencyRecords([]),
  };
}
