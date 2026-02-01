import { Link } from 'react-router-dom';

export function Proof() {
  return (
    <div className="layout">
      <main className="game">
        <div className="proof-content">
          <h1>Proof of Action</h1>
          <p className="muted">Verify on-chain game events</p>

          <div className="proof-input" style={{ marginTop: '32px' }}>
            <label htmlFor="txid">Transaction ID</label>
            <input
              id="txid"
              type="text"
              placeholder="Enter txid to verify..."
              className="input"
              style={{ width: '100%', marginTop: '8px' }}
            />
            <button className="btn btn-primary" style={{ marginTop: '16px' }}>
              Verify
            </button>
          </div>

          <p className="muted" style={{ marginTop: '32px', fontSize: '12px' }}>
            (Proof Page implementation in T-082)
          </p>
        </div>
      </main>
      <aside className="panel">
        <h2>Verification</h2>
        <p className="muted">Parse transaction payload and display event details.</p>

        <div className="proof-result" style={{ marginTop: '24px' }}>
          <h3>Result</h3>
          <p className="muted">Enter a txid to see verification result</p>
        </div>

        <div style={{ marginTop: '24px' }}>
          <h3>Explorer</h3>
          <a href="https://explorer.kaspa.org" target="_blank" rel="noopener noreferrer" className="btn">
            Open Kaspa Explorer
          </a>
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
