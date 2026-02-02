import { useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GameCanvas, type GameStats, type CheckpointEvent, type GameOverEvent } from '../components/GameCanvas';
import { useWallet } from '../wallet';
import { startSession, sendEvent, endSession, type SessionPolicy } from '../api/client';

const MAX_CHECKPOINTS = 10;

// TX Status type matching server
type TxStatus = 'pending' | 'broadcasted' | 'accepted' | 'included' | 'confirmed' | 'failed';

interface TxRecord {
  seq: number;
  status: TxStatus;
  txid?: string;
  rewardAmount?: number;
  timestamp: number;
  error?: string;
}

interface SessionState {
  sessionId: string;
  policy: SessionPolicy;
}

export function FreeRun() {
  const { address, isConnected, connect } = useWallet();

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

  // Ref to track pending requests (prevent duplicate sends)
  const pendingSeqs = useRef<Set<number>>(new Set());
  // Ref to store session for use in callbacks (avoid stale closure)
  const sessionRef = useRef<SessionState | null>(null);
  sessionRef.current = session;

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
      // Send to server
      const result = await sendEvent(
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
                status: result.accepted ? (result.txid ? 'broadcasted' : 'pending') : 'failed',
                txid: result.txid,
                rewardAmount: result.rewardAmount,
                error: result.rejectReason,
              }
            : tx
        )
      );

      if (!result.accepted) {
        console.warn(`[FreeRun] Event rejected: ${result.rejectReason ?? 'unknown'}`);
      } else {
        console.log(`[FreeRun] Reward TX: ${result.txid ?? 'pending'}, amount: ${result.rewardAmount ?? 0} KAS`);
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
        await endSession(currentSession.sessionId);
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

    // Need wallet connected
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    // Start new session
    try {
      const response = await startSession(address, 'free_run');
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

  // Sync wrapper for connect button
  const handleConnect = useCallback(() => {
    void connect();
  }, [connect]);

  // Format txid for display
  const formatTxid = useCallback((txid: string) => {
    if (txid.length <= 16) return txid;
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
  }, []);

  // Get status display text and class
  const getStatusDisplay = useMemo(() => (record: TxRecord) => {
    switch (record.status) {
      case 'pending':
        return { text: 'Pending...', class: 'tx-status-pending' };
      case 'broadcasted':
        return { text: 'Broadcasted', class: 'tx-status-broadcasted' };
      case 'accepted':
        return { text: 'Accepted', class: 'tx-status-accepted' };
      case 'included':
        return { text: 'Included', class: 'tx-status-included' };
      case 'confirmed':
        return { text: 'Confirmed', class: 'tx-status-confirmed' };
      case 'failed':
        return { text: 'Failed', class: 'tx-status-failed' };
      default:
        return { text: record.status, class: '' };
    }
  }, []);

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
        <p className="muted">Collect checkpoints to earn KAS rewards.</p>

        {/* Wallet Status */}
        {!isConnected && (
          <div className="wallet-prompt" style={{ marginBottom: '16px' }}>
            <p className="muted" style={{ marginBottom: '8px' }}>
              Connect wallet to receive rewards
            </p>
            <button className="btn btn-sm" onClick={handleConnect}>
              Connect Wallet
            </button>
          </div>
        )}

        {isConnected && address && (
          <div className="wallet-info" style={{ marginBottom: '16px' }}>
            <span className="muted">Wallet: </span>
            <span className="address">{formatTxid(address)}</span>
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

        <div className="game-status">
          {!stats.isPlaying && !stats.isGameOver && (
            <p className="status-text">
              {isConnected ? 'Press SPACE to start' : 'Connect wallet, then SPACE to start'}
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
            <ul className="tx-list">
              {txRecords.map((tx) => {
                const statusDisplay = getStatusDisplay(tx);
                return (
                  <li key={tx.seq} className="tx-item">
                    <div className="tx-header">
                      <span className="tx-seq">#{tx.seq}</span>
                      {tx.rewardAmount && (
                        <span className="tx-amount">{tx.rewardAmount} KAS</span>
                      )}
                    </div>
                    <span className={`tx-status ${statusDisplay.class}`}>
                      {statusDisplay.text}
                    </span>
                    {tx.txid && (
                      <div className="tx-id">
                        <a
                          href={`https://explorer.kaspa.org/txs/${tx.txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={tx.txid}
                        >
                          {formatTxid(tx.txid)}
                        </a>
                      </div>
                    )}
                    {tx.error && (
                      <div className="tx-error" style={{ color: '#ef4444', fontSize: '11px' }}>
                        {tx.error}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ marginTop: 'auto' }}>
          <Link className="btn" to="/">
            Back Home
          </Link>
        </div>
      </aside>
    </div>
  );
}
