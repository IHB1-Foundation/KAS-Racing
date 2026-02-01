import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GameCanvas } from '../components/GameCanvas';

export function DuelLobby() {
  const [view, setView] = useState<'lobby' | 'game'>('lobby');

  return (
    <div className="layout">
      <main className="game">
        {view === 'lobby' ? (
          <div className="lobby-content">
            <h1>Ghost-Wheel Duel</h1>
            <p className="muted">1v1 Race - Deposit KAS, Winner Takes All</p>
            <div className="row" style={{ marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={() => setView('game')}>
                Create Match
              </button>
              <button className="btn" onClick={() => setView('game')}>
                Join with Code
              </button>
            </div>
          </div>
        ) : (
          <GameCanvas mode="duel" />
        )}
      </main>
      <aside className="panel">
        <h2>Duel</h2>
        <p className="muted">30-second race. Highest distance wins.</p>

        {view === 'lobby' ? (
          <>
            <div className="match-info">
              <h3>Match Settings</h3>
              <div className="stat-item">
                <span className="stat-label">Bet Amount</span>
                <span className="stat-value">1 KAS</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Duration</span>
                <span className="stat-value">30 sec</span>
              </div>
            </div>
            <p className="muted" style={{ fontSize: '12px', marginTop: '16px' }}>
              (Matchmaking API in T-060)
            </p>
          </>
        ) : (
          <>
            <div className="stats">
              <div className="stat-item">
                <span className="stat-label">Your Distance</span>
                <span className="stat-value">0 m</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Opponent</span>
                <span className="stat-value">Waiting...</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Time Left</span>
                <span className="stat-value">30s</span>
              </div>
            </div>

            <div className="tx-panel">
              <h3>Deposits</h3>
              <p className="muted">No deposits yet</p>
            </div>

            <button className="btn" onClick={() => setView('lobby')} style={{ marginTop: '16px' }}>
              Leave Match
            </button>
          </>
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
