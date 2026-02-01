import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GameCanvas, type GameStats, type CheckpointEvent, type GameOverEvent } from '../components/GameCanvas';

const MAX_CHECKPOINTS = 10;

interface TxRecord {
  seq: number;
  status: 'pending' | 'sent';
  timestamp: number;
}

export function FreeRun() {
  const [stats, setStats] = useState<GameStats>({
    distance: 0,
    speed: 0,
    checkpoints: 0,
    isPlaying: false,
    isGameOver: false,
  });

  const [txRecords, setTxRecords] = useState<TxRecord[]>([]);

  const handleStatsUpdate = useCallback((newStats: GameStats) => {
    setStats(newStats);
  }, []);

  const handleCheckpoint = useCallback((event: CheckpointEvent) => {
    console.log('[FreeRun] Checkpoint collected:', event);

    // Add pending tx record (will be sent to server in T-043)
    setTxRecords((prev) => [
      ...prev,
      {
        seq: event.seq,
        status: 'pending',
        timestamp: Date.now(),
      },
    ]);

    // TODO: T-043 - Send to server: POST /api/session/event
    // The server will respond with txid and reward amount
  }, []);

  const handleGameOver = useCallback((event: GameOverEvent) => {
    console.log('[FreeRun] Game over:', event);
  }, []);

  const handleGameStart = useCallback(() => {
    console.log('[FreeRun] Game started');
    setTxRecords([]);
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
            <p className="status-text">Press SPACE to start</p>
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
              {txRecords.map((tx) => (
                <li key={tx.seq} className="tx-item">
                  <span className="tx-seq">#{tx.seq}</span>
                  <span className={`tx-status tx-status-${tx.status}`}>
                    {tx.status === 'pending' ? 'Pending...' : 'Sent'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>
            (Server integration in T-043)
          </p>
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
