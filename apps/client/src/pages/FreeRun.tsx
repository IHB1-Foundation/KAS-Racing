import { Link } from 'react-router-dom';
import { GameCanvas } from '../components/GameCanvas';

export function FreeRun() {
  return (
    <div className="layout">
      <main className="game">
        <GameCanvas mode="freerun" />
      </main>
      <aside className="panel">
        <h2>Free Run</h2>
        <p className="muted">Collect checkpoints to earn KAS rewards.</p>

        <div className="stats">
          <div className="stat-item">
            <span className="stat-label">Distance</span>
            <span className="stat-value">0 m</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Speed</span>
            <span className="stat-value">0 km/h</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Checkpoints</span>
            <span className="stat-value">0 / 10</span>
          </div>
        </div>

        <div className="tx-panel">
          <h3>Transaction Timeline</h3>
          <p className="muted">No transactions yet</p>
          <p className="muted" style={{ fontSize: '12px' }}>
            (TxLifecycleTimeline in T-052)
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
