import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GameCanvas, type GameStats, type CheckpointEvent, type GameOverEvent } from '../components/GameCanvas';
import { useEvmWallet, EvmNetworkGuard } from '../evm';
import {
  startSessionV3,
  sendEventV3,
  endSessionV3,
  type V3SessionPolicy,
} from '../api/v3client';
import { TxLifecycleTimeline, KaspaRPMGauge, type TxStatus } from '@kas-racing/speed-visualizer-sdk';
import { LatencyDebugPanel } from '../components/LatencyDebugPanel';
import { SidebarWalletBalances } from '../components/SidebarWalletBalances';
import { useRealtimeSync, type ChainStateEvent } from '../realtime';
import { formatEther } from 'viem';
import { isE2E } from '../e2e';
import { getEvmExplorerTxUrl } from '../utils/explorer';

const MAX_CHECKPOINTS = 10;
type TxRecordStatus = TxStatus | 'pending';

// Map EVM tx status to TxLifecycleTimeline status
function mapEvmStatus(s: string): TxStatus {
  switch (s) {
    case 'submitted': case 'pending': return 'broadcasted';
    case 'mined': return 'included';
    case 'confirmed': return 'confirmed';
    case 'failed': return 'failed';
    default: return 'broadcasted';
  }
}

interface TxRecord {
  seq: number;
  status: TxRecordStatus;
  txHash?: string;
  rewardAmountWei?: string;
  timestamp: number;
  error?: string;
  chainTimestamps?: Record<string, number | undefined>;
  confirmations?: number;
}

interface SessionState {
  sessionId: string;
  policy: V3SessionPolicy;
}

export function FreeRun() {
  const { address, isConnected, connect, isCorrectChain, switchToKasplex, balance, error: walletError } = useEvmWallet();

  const [stats, setStats] = useState<GameStats>({
    distance: 0,
    speed: 0,
    checkpoints: 0,
    isPlaying: false,
    isGameOver: false,
  });

  const [txRecords, setTxRecords] = useState<TxRecord[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showDebug, setShowDebug] = useState(false);
  const [e2eSeq, setE2eSeq] = useState(1);

  // Ref to track pending requests (prevent duplicate sends)
  const pendingSeqs = useRef<Set<number>>(new Set());
  // Ref to store session for use in callbacks (avoid stale closure)
  const sessionRef = useRef<SessionState | null>(null);
  sessionRef.current = session;

  // Indexer-fed chain state updates
  const handleChainStateChanged = useCallback((data: ChainStateEvent) => {
    if (data.entityType !== 'reward') return;
    setTxRecords(prev =>
      prev.map(tx =>
        tx.txHash === data.txid
          ? {
              ...tx,
              status: mapEvmStatus(data.newStatus),
              chainTimestamps: data.timestamps,
              confirmations: data.confirmations,
            }
          : tx
      )
    );
  }, []);

  const { connectionState, latencyRecords, avgLatencyMs } = useRealtimeSync({
    sessionId: session?.sessionId ?? null,
    enabled: !!session,
    onChainStateChanged: handleChainStateChanged,
  });

  const handleStatsUpdate = useCallback((newStats: GameStats) => {
    setStats(newStats);
  }, []);

  // Async implementation - called from sync wrapper
  const processCheckpoint = useCallback(async (event: CheckpointEvent) => {
    console.log('[FreeRun] Checkpoint collected:', event);

    const currentSession = sessionRef.current;

    // Skip if no session or already processing this seq
    if (!currentSession) {
      console.warn('[FreeRun] No session, skipping checkpoint');
      return;
    }

    if (pendingSeqs.current.has(event.seq)) {
      console.warn(`[FreeRun] Already processing seq ${event.seq}`);
      return;
    }

    // Mark as processing
    pendingSeqs.current.add(event.seq);

    // Add pending tx record immediately (optimistic UI)
    setTxRecords((prev) => [
      ...prev,
      {
        seq: event.seq,
        status: 'pending',
        timestamp: Date.now(),
      },
    ]);

    try {
      // Send to V3 server
      const result = await sendEventV3(
        currentSession.sessionId,
        'checkpoint',
        event.seq,
        Date.now()
      );

      // Update tx record with result
      setTxRecords((prev) =>
        prev.map((tx) =>
          tx.seq === event.seq
            ? {
                ...tx,
                status: result.accepted ? (result.txHash ? mapEvmStatus(result.txStatus ?? 'submitted') : 'pending') : 'failed',
                txHash: result.txHash,
                rewardAmountWei: result.rewardAmountWei,
                error: result.rejectReason,
              }
            : tx
        )
      );

      if (!result.accepted) {
        console.warn(`[FreeRun] Event rejected: ${result.rejectReason ?? 'unknown'}`);
      } else {
        const amountDisplay = result.rewardAmountWei
          ? formatEther(BigInt(result.rewardAmountWei))
          : '0';
        console.log(`[FreeRun] Reward TX: ${result.txHash ?? 'pending'}, amount: ${amountDisplay} kFUEL`);
      }
    } catch (err) {
      console.error('[FreeRun] Failed to send event:', err);
      // Update record with error
      setTxRecords((prev) =>
        prev.map((tx) =>
          tx.seq === event.seq
            ? {
                ...tx,
                status: 'failed',
                error: err instanceof Error ? err.message : 'Unknown error',
              }
            : tx
        )
      );
    } finally {
      pendingSeqs.current.delete(event.seq);
    }
  }, []);

  // Sync wrapper for GameCanvas callback
  const handleCheckpoint = useCallback((event: CheckpointEvent) => {
    void processCheckpoint(event);
  }, [processCheckpoint]);

  // Async implementation - called from sync wrapper
  const processGameOver = useCallback(async (event: GameOverEvent) => {
    console.log('[FreeRun] Game over:', event);

    const currentSession = sessionRef.current;

    // End session
    if (currentSession) {
      try {
        await endSessionV3(currentSession.sessionId);
        console.log('[FreeRun] Session ended');
      } catch (err) {
        console.warn('[FreeRun] Failed to end session:', err);
      }
    }
  }, []);

  // Sync wrapper for GameCanvas callback
  const handleGameOver = useCallback((event: GameOverEvent) => {
    void processGameOver(event);
  }, [processGameOver]);

  // Async implementation - called from sync wrapper
  const processGameStart = useCallback(async () => {
    console.log('[FreeRun] Game starting...');
    setTxRecords([]);
    setError(null);
    pendingSeqs.current.clear();
    setE2eSeq(1);

    // Need wallet connected
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    // Start new V3 session
    try {
      const response = await startSessionV3(address, 'free_run');
      setSession({
        sessionId: response.sessionId,
        policy: response.policy,
      });
      console.log('[FreeRun] Session started:', response.sessionId);
    } catch (err) {
      console.error('[FreeRun] Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  }, [isConnected, address]);

  // Sync wrapper for GameCanvas callback
  const handleGameStart = useCallback(() => {
    void processGameStart();
  }, [processGameStart]);

  const handleE2eStart = useCallback(() => {
    void processGameStart();
  }, [processGameStart]);

  const handleE2eCheckpoint = useCallback(() => {
    const nextSeq = e2eSeq;
    setE2eSeq(prev => prev + 1);
    handleCheckpoint({
      seq: nextSeq,
      distance: stats.distance,
      time: Date.now(),
    });
  }, [e2eSeq, handleCheckpoint, stats.distance]);

  const handleE2eGameOver = useCallback(() => {
    handleGameOver({
      distance: stats.distance,
      checkpoints: stats.checkpoints,
      time: Date.now(),
    });
  }, [handleGameOver, stats.checkpoints, stats.distance]);

  // Format reward amount for display
  const formatReward = (amountWei?: string) => {
    if (!amountWei) return null;
    try {
      return `${formatEther(BigInt(amountWei))} kFUEL`;
    } catch {
      return null;
    }
  };

  return (
    <div className="layout">
      <main className="game">
        <GameCanvas
          mode="freerun"
          onStatsUpdate={handleStatsUpdate}
          onCheckpoint={handleCheckpoint}
          onGameOver={handleGameOver}
          onGameStart={handleGameStart}
        />
      </main>
      <aside className="panel">
        <h2>Free Run</h2>
        <p className="muted">Collect checkpoints to earn kFUEL rewards.</p>
        <EvmNetworkGuard />
        <SidebarWalletBalances
          address={address}
          isConnected={isConnected}
          isCorrectChain={isCorrectChain}
          kasBalance={balance}
        />

        {/* Wallet Status */}
        {!isConnected && (
          <div className="wallet-prompt" style={{ marginBottom: '16px' }}>
            <p className="muted" style={{ marginBottom: '8px' }}>
              Connect wallet to receive rewards
            </p>
            <button className="btn btn-sm" onClick={connect}>
              Connect Wallet
            </button>
          </div>
        )}

        {isConnected && !isCorrectChain && (
          <div className="wallet-prompt" style={{ marginBottom: '16px' }}>
            <p className="muted" style={{ marginBottom: '8px' }}>
              Switch to KASPLEX Testnet
            </p>
            <button className="btn btn-sm" onClick={switchToKasplex}>
              Switch Network
            </button>
          </div>
        )}

        {walletError && (
          <div className="error-banner" style={{ marginBottom: '16px', color: '#ef4444' }}>
            {walletError}
          </div>
        )}

        {error && (
          <div className="error-banner" style={{ marginBottom: '16px', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <div className="stats">
          <div className="stat-item">
            <span className="stat-label">Distance</span>
            <span className="stat-value">{stats.distance.toLocaleString()} m</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Speed</span>
            <span className="stat-value">{stats.speed} km/h</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Checkpoints</span>
            <span className="stat-value">
              {stats.checkpoints} / {MAX_CHECKPOINTS}
            </span>
          </div>
        </div>

        {/* Network Pulse Gauge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '16px' }}>
          <KaspaRPMGauge
            bps={stats.isPlaying ? Math.min(stats.speed / 100, 10) : 0}
            maxBps={10}
            label="Network Pulse"
            showValue={true}
          />
        </div>

        <div className="game-status">
          {!stats.isPlaying && !stats.isGameOver && (
            <p className="status-text">
              {isConnected && isCorrectChain ? 'Press SPACE to start' : 'Connect wallet, then SPACE to start'}
            </p>
          )}
          {stats.isPlaying && <p className="status-text status-playing">Running...</p>}
          {stats.isGameOver && <p className="status-text status-over">Game Over</p>}
        </div>

        <div className="tx-panel">
          <h3>Transaction Timeline</h3>
          {txRecords.length === 0 ? (
            <p className="muted">No transactions yet</p>
          ) : (
            <div className="tx-list">
              {txRecords.map((tx) => (
                <div key={tx.seq} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="tx-seq">#{tx.seq}</span>
                    {formatReward(tx.rewardAmountWei) && (
                      <span className="tx-amount">{formatReward(tx.rewardAmountWei)}</span>
                    )}
                  </div>
                  {tx.txHash ? (
                    <TxLifecycleTimeline
                      txid={tx.txHash}
                      status={tx.status === 'pending' ? 'broadcasted' : tx.status}
                      timestamps={tx.chainTimestamps ?? { broadcasted: tx.timestamp }}
                      explorerUrl={getEvmExplorerTxUrl(tx.txHash)}
                    />
                  ) : (
                    <div className={`tx-status tx-status-${tx.status}`}>
                      {tx.status === 'pending' ? 'Processing...' : tx.status}
                    </div>
                  )}
                  {tx.error && (
                    <div className="tx-error" style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                      {tx.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {session && (
          <div style={{ marginTop: '16px' }}>
            <button
              className="btn"
              style={{ fontSize: '11px', padding: '4px 8px', opacity: 0.6 }}
              onClick={() => setShowDebug(prev => !prev)}
            >
              {showDebug ? 'Hide' : 'Show'} Debug
            </button>
            {showDebug && (
              <LatencyDebugPanel
                connectionState={connectionState}
                avgLatencyMs={avgLatencyMs}
                latencyRecords={latencyRecords}
              />
            )}
          </div>
        )}

        {isE2E && (
          <div style={{ marginTop: '16px' }}>
            <div className="muted" style={{ fontSize: '12px', marginBottom: '6px' }}>E2E Controls</div>
            <div className="row" style={{ gap: '8px' }}>
              <button className="btn btn-sm" data-testid="e2e-start-session" onClick={handleE2eStart}>
                Start Session
              </button>
              <button className="btn btn-sm" data-testid="e2e-checkpoint" onClick={handleE2eCheckpoint}>
                Checkpoint
              </button>
              <button className="btn btn-sm" data-testid="e2e-gameover" onClick={handleE2eGameOver}>
                End Run
              </button>
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px' }}>
              <span className="muted">Session:</span>{' '}
              <span data-testid="e2e-session-id" style={{ fontFamily: 'monospace' }}>
                {session?.sessionId ?? 'none'}
              </span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          <Link className="btn" to="/">
            Back Home
          </Link>
        </div>
      </aside>
    </div>
  );
}
