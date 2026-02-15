import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatEther } from 'viem';
import { type Address, parseAbi } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { EvmWalletButton, useEvmWallet, kasplexTestnet } from '../evm';
import logoSymbol from '../assets/logo-symbol.png';

const GITHUB_URL = 'https://github.com/anthropics/kas-racing';
const TWITTER_SHARE_TEXT = encodeURIComponent(
  'Check out KAS Racing - a web game with real Kaspa blockchain rewards! Every checkpoint = kFUEL. Watch transactions confirm in real-time.'
);

const PROD_KFUEL_TOKEN_ADDRESS = '0xF8B8D3b674baE33f8f9b4775F9AEd2D487C0Cd8D';

export function Home() {
  const { address, isConnected, isCorrectChain } = useEvmWallet();
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<string | null>(null);
  const [faucetTxHash, setFaucetTxHash] = useState<`0x${string}` | null>(null);
  const fuelTokenAddress = useMemo(() => {
    const raw = import.meta.env.VITE_KFUEL_TOKEN_ADDRESS as string | undefined;
    if (import.meta.env.DEV) {
      return raw && raw.length > 0 ? (raw as Address) : null;
    }
    return (raw && raw.length > 0 ? raw : PROD_KFUEL_TOKEN_ADDRESS) as Address;
  }, []);
  const faucetAbi = useMemo(
    () => parseAbi(['function faucetMint() external']),
    [],
  );

  const { writeContract, data: txHash, isPending, error: faucetError } = useWriteContract();
  const { isSuccess: faucetMined } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  const handleFaucet = () => {
    if (!address || faucetLoading) return;
    setFaucetLoading(true);
    setFaucetMessage(null);

    try {
      if (!fuelTokenAddress) {
        setFaucetMessage('kFUEL token address not configured');
        return;
      }

      writeContract({
        address: fuelTokenAddress,
        abi: faucetAbi,
        functionName: 'faucetMint',
        chainId: kasplexTestnet.id,
      });
      setFaucetTxHash(null);
    } catch (err) {
      setFaucetMessage(err instanceof Error ? err.message : 'Faucet request failed');
    } finally {
      setFaucetLoading(false);
    }
  };

  useEffect(() => {
    if (txHash && faucetTxHash !== txHash) {
      setFaucetTxHash(txHash);
    }
  }, [txHash, faucetTxHash]);

  useEffect(() => {
    if (faucetMined && faucetTxHash) {
      setFaucetMessage(`Faucet sent ${formatEther(10n * 10n ** 18n)} kFUEL`);
    }
  }, [faucetMined, faucetTxHash]);

  return (
    <div className="landing">
      {/* Hero Section */}
      <div className="hero">
        <img className="hero-logo" src={logoSymbol} alt="KAS Racing logo symbol" />
        <h1 className="hero-title">KAS Racing</h1>
        <p className="hero-subtitle">
          Real-time blockchain gaming on Kaspa
        </p>
        <p className="hero-tagline">
          Collect checkpoints. Earn kFUEL instantly. Watch it happen on-chain.
        </p>
      </div>

      {/* Wallet Connection */}
      <div className="wallet-section">
        <div className="wallet-actions">
          <EvmWalletButton />
          <button
            className="faucet-btn"
            onClick={() => { void handleFaucet(); }}
            disabled={!isConnected || !isCorrectChain || faucetLoading || isPending}
          >
            {faucetLoading || isPending ? 'Requesting kFUEL...' : 'Get 10 kFUEL (Faucet)'}
          </button>
          {!isConnected && (
            <span className="faucet-hint">Connect your wallet to claim kFUEL.</span>
          )}
          {isConnected && !isCorrectChain && (
            <span className="faucet-hint">Switch to KASPLEX Testnet to use the faucet.</span>
          )}
          {faucetMessage && (
            <span className="faucet-status">{faucetMessage}</span>
          )}
          {faucetError && (
            <span className="faucet-status">{faucetError.message.split('\n')[0]}</span>
          )}
        </div>
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
              <span className="mode-highlight">Earn up to 0.1 kFUEL per checkpoint</span>
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
