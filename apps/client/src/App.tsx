import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

function Home() {
  return (
    <div className="card">
      <h1>KAS Racing</h1>
      <p className="muted">Client skeleton (web UI). Phaser scenes land in T-010.</p>
      <div className="row">
        <Link className="btn" to="/free-run">
          Play Free Run
        </Link>
        <Link className="btn" to="/duel">
          Duel Lobby
        </Link>
        <Link className="btn" to="/proof">
          Proof
        </Link>
      </div>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="layout">
      <main className="game">[{title}] (placeholder)</main>
      <aside className="panel">
        <h2>{title} Panel</h2>
        <p className="muted">Server health: <a href="/api/health">/api/health</a></p>
        <Link className="btn" to="/">
          Back Home
        </Link>
      </aside>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/free-run" element={<Placeholder title="Free Run" />} />
        <Route path="/duel" element={<Placeholder title="Duel Lobby" />} />
        <Route path="/proof" element={<Placeholder title="Proof" />} />
      </Routes>
    </BrowserRouter>
  );
}

