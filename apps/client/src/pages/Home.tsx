import { Link } from 'react-router-dom';
import { WalletButton } from '../components';

const GITHUB_URL = 'https://github.com/anthropics/kas-racing';
const TWITTER_SHARE_TEXT = encodeURIComponent(
  'Check out KAS Racing - a web game with real Kaspa blockchain rewards! Every checkpoint = real KAS. Watch transactions confirm in real-time.'
);

export function Home() {
  return (
    <div className="landing">
      {/* Hero Section */}
      <div className="hero">
        <h1 className="hero-title">KAS Racing</h1>
        <p className="hero-subtitle">
          Real-time blockchain gaming on Kaspa
        </p>
        <p className="hero-tagline">
          Collect checkpoints. Earn KAS instantly. Watch it happen on-chain.
        </p>
      </div>

      {/* Wallet Connection */}
      <div className="wallet-section">
        <WalletButton />
      </div>

      {/* Game Modes */}
      <div className="modes-section">
        <h2 className="section-title">Choose Your Mode</h2>
        <div className="modes-grid">
          <Link className="mode-card" to="/free-run">
            <div className="mode-icon">{">"}</div>
            <h3 className="mode-title">Free Run</h3>
            <p className="mode-desc">
              Endless runner with checkpoint rewards.
              <br />
              <span className="mode-highlight">Earn up to 0.1 KAS per checkpoint</span>
            </p>
            <span className="mode-action">Play Now</span>
          </Link>

          <Link className="mode-card" to="/duel">
            <div className="mode-icon">{"<>"}</div>
            <h3 className="mode-title">Ghost-Wheel Duel</h3>
            <p className="mode-desc">
              1v1 betting races.
              <br />
              <span className="mode-highlight">Winner takes all</span>
            </p>
            <span className="mode-action">Challenge</span>
          </Link>

          <Link className="mode-card mode-card-secondary" to="/proof">
            <div className="mode-icon">{"#"}</div>
            <h3 className="mode-title">Proof Page</h3>
            <p className="mode-desc">
              Verify any game transaction on-chain.
            </p>
            <span className="mode-action">Verify</span>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="features-section">
        <div className="feature">
          <span className="feature-label">Real Transactions</span>
          <span className="feature-value">No mocks, no simulations</span>
        </div>
        <div className="feature">
          <span className="feature-label">Live Tracking</span>
          <span className="feature-value">Watch TX lifecycle in real-time</span>
        </div>
        <div className="feature">
          <span className="feature-label">Proof of Play</span>
          <span className="feature-value">Every event recorded on-chain</span>
        </div>
      </div>

      {/* Share & Links */}
      <div className="share-section">
        <a
          className="share-btn share-twitter"
          href={`https://twitter.com/intent/tweet?text=${TWITTER_SHARE_TEXT}&url=${encodeURIComponent(window.location.origin)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on X
        </a>
        <a
          className="share-btn share-github"
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </div>

      {/* Footer */}
      <div className="landing-footer">
        <span className="footer-badge">Built with Kaspa</span>
        <span className="footer-text">MIT License</span>
      </div>
    </div>
  );
}
