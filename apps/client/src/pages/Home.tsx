import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="card">
      <h1>KAS Racing</h1>
      <p className="muted">
        Web-based racing game with real Kaspa on-chain rewards.
        <br />
        Collect checkpoints, earn KAS instantly.
      </p>
      <div className="row">
        <Link className="btn btn-primary" to="/free-run">
          Play Free Run
        </Link>
        <Link className="btn" to="/duel">
          Ghost-Wheel Duel
        </Link>
        <Link className="btn" to="/proof">
          Proof Page
        </Link>
      </div>
      <div style={{ marginTop: '24px' }}>
        <button className="btn btn-outline" disabled>
          Connect Wallet
        </button>
        <span className="muted" style={{ marginLeft: '12px', fontSize: '14px' }}>
          (Kasware integration in T-031)
        </span>
      </div>
    </div>
  );
}
