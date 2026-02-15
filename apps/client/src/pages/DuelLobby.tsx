import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEvmWallet, useMatchEscrow, EvmNetworkGuard } from '../evm';
import {
  createMatchV3,
  joinMatchV3,
  getMatchV3,
  type V3MatchResponse,
} from '../api/v3client';
import { TxLifecycleTimeline } from '@kas-racing/speed-visualizer-sdk';
import { LatencyDebugPanel } from '../components/LatencyDebugPanel';
import { useRealtimeSync, type ChainStateEvent, type MatchStateEvent } from '../realtime';
import { parseEther, formatEther, type Address, type Hash } from 'viem';

type View = 'lobby' | 'create' | 'join' | 'waiting' | 'deposits' | 'game' | 'finished';

const BET_AMOUNTS_KAS = [0.1, 0.5, 1.0, 5.0];
const RECONCILE_INTERVAL_MS = 10_000;
const DEPOSIT_POLL_INTERVAL_MS = 5_000;

// Map V3 match state to view
function stateToView(state: string): View {
  switch (state) {
    case 'lobby': return 'waiting';
    case 'created': return 'deposits';
    case 'funded': return 'game';
    case 'settled': return 'finished';
    case 'refunded': return 'finished';
    case 'cancelled': return 'lobby';
    default: return 'lobby';
  }
}

export function DuelLobby() {
  const { address, isConnected, connect, isCorrectChain, switchToKasplex, balance } = useEvmWallet();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<View>('lobby');
  const [betAmountKas, setBetAmountKas] = useState(1.0);
  const [joinCode, setJoinCode] = useState('');
  const [match, setMatch] = useState<V3MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [myRole, setMyRole] = useState<'player1' | 'player2' | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Contract deposit hook
  const escrowAddress = (match?.contract.escrowAddress || null) as Address | null;
  const { depositState, depositTxHash, depositError, deposit, reset: resetDeposit } = useMatchEscrow(escrowAddress);

  // ── Realtime Sync ──

  const handleMatchUpdate = useCallback((data: unknown) => {
    // Realtime updates may come in old format — refresh V3 data instead
    if (match?.id) {
      void getMatchV3(match.id, { sync: true }).then(setMatch).catch(() => {});
    }
    void data; // consumed
  }, [match?.id]);

  const handleChainStateChanged = useCallback(
    (evt: ChainStateEvent) => {
      void evt; // required by callback signature
      // Chain state changed — refresh match data
      if (match?.id) {
        void getMatchV3(match.id, { sync: true }).then(setMatch).catch(() => {});
      }
    },
    [match?.id],
  );

  const handleMatchStateChanged = useCallback((data: MatchStateEvent) => {
    // Refresh V3 data on match state changes
    if (match?.id) {
      void getMatchV3(match.id, { sync: true }).then((updated) => {
        setMatch(updated);
        setView(stateToView(updated.state));
      }).catch(() => {});
    }
    void data;
  }, [match?.id]);

  const { connectionState, latencyRecords, avgLatencyMs } = useRealtimeSync({
    matchId: match?.id ?? null,
    enabled: !!match,
    reconcileIntervalMs: RECONCILE_INTERVAL_MS,
    onMatchUpdate: handleMatchUpdate,
    onChainStateChanged: handleChainStateChanged,
    onMatchStateChanged: handleMatchStateChanged,
  });

  // ── Deposit Polling ──
  // Poll for deposit state changes (indexer sync) when in deposits view
  useEffect(() => {
    if (view !== 'deposits' || !match?.id) return;
    const interval = setInterval(() => {
      void getMatchV3(match.id, { sync: true }).then((updated) => {
        setMatch(updated);
        // Auto-transition when both deposited (funded)
        if (updated.state === 'funded') {
          setView('game');
        }
      }).catch(() => {});
    }, DEPOSIT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [view, match?.id]);

  // ── Restore match from URL ──
  useEffect(() => {
    const matchId = searchParams.get('matchId');
    const role = searchParams.get('role') as 'player1' | 'player2' | null;
    if (!matchId) return;

    setLoading(true);
    getMatchV3(matchId, { sync: true })
      .then((restored) => {
        setMatch(restored);
        if (role) {
          setMyRole(role);
        } else if (address) {
          if (restored.players.player1.address.toLowerCase() === address.toLowerCase()) {
            setMyRole('player1');
          } else if (restored.players.player2.address?.toLowerCase() === address.toLowerCase()) {
            setMyRole('player2');
          }
        }
        setView(stateToView(restored.state));
      })
      .catch((e: unknown) => {
        console.error('Failed to restore match:', e);
        setSearchParams({});
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save match to URL
  useEffect(() => {
    if (match && myRole) {
      setSearchParams({ matchId: match.id, role: myRole }, { replace: true });
    }
  }, [match?.id, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──

  const handleCreateMatch = useCallback(() => {
    if (!address) return;

    setLoading(true);
    setError(null);

    const betAmountWei = parseEther(betAmountKas.toString()).toString();

    createMatchV3(address, betAmountWei)
      .then((result) => {
        setMatch(result);
        setMyRole('player1');
        setView('waiting');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to create match');
      })
      .finally(() => setLoading(false));
  }, [address, betAmountKas]);

  const handleJoinMatch = useCallback(() => {
    if (!address || !joinCode) return;

    setLoading(true);
    setError(null);

    joinMatchV3(joinCode, address)
      .then((result) => {
        setMatch(result);
        setMyRole('player2');
        setView('deposits');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to join match');
      })
      .finally(() => setLoading(false));
  }, [address, joinCode]);

  const handleDeposit = useCallback(() => {
    if (!match?.contract.matchIdBytes32 || !match.depositAmountWei) return;

    setError(null);
    deposit(
      match.contract.matchIdBytes32 as Hash,
      BigInt(match.depositAmountWei),
    );
  }, [match, deposit]);

  const handleRetry = useCallback(() => {
    setError(null);
    resetDeposit();
    if (match) {
      void getMatchV3(match.id, { sync: true }).then(setMatch).catch(() => {});
    }
  }, [match, resetDeposit]);

  const resetMatch = () => {
    setMatch(null);
    setView('lobby');
    setError(null);
    resetDeposit();
    setSearchParams({});
  };

  // ── Derived state ──

  const myDeposited = match
    ? myRole === 'player1'
      ? match.players.player1.deposited
      : match.players.player2.deposited
    : false;

  const opDeposited = match
    ? myRole === 'player1'
      ? match.players.player2.deposited
      : match.players.player1.deposited
    : false;

  const myDepositTx = match?.deposits.find(d =>
    myRole === 'player1'
      ? d.playerAddress.toLowerCase() === match.players.player1.address.toLowerCase()
      : d.playerAddress.toLowerCase() === (match.players.player2.address?.toLowerCase() ?? ''),
  );

  const opDepositTx = match?.deposits.find(d =>
    myRole === 'player1'
      ? d.playerAddress.toLowerCase() === (match.players.player2.address?.toLowerCase() ?? '')
      : d.playerAddress.toLowerCase() === match.players.player1.address.toLowerCase(),
  );

  const betDisplayKas = match
    ? formatEther(BigInt(match.depositAmountWei))
    : betAmountKas.toString();

  // Map EVM tx status to TxLifecycleTimeline status
  const mapTxStatus = (s: string): 'broadcasted' | 'accepted' | 'included' | 'confirmed' => {
    switch (s) {
      case 'submitted': case 'pending': return 'broadcasted';
      case 'mined': return 'included';
      case 'confirmed': return 'confirmed';
      default: return 'broadcasted';
    }
  };

  // Show combined deposit error
  const displayError = error ?? depositError;

  // ── Render ──

  const renderMainContent = () => {
    switch (view) {
      case 'lobby':
        return (
          <div className="lobby-content">
            <h1>Ghost-Wheel Duel</h1>
            <p className="muted">1v1 Race - Deposit KAS, Winner Takes All</p>
            <EvmNetworkGuard />

            {!isConnected ? (
              <div style={{ marginTop: '24px' }}>
                <p className="muted">Connect your EVM wallet to play</p>
                <button className="btn btn-primary" onClick={connect} style={{ marginTop: '12px' }}>
                  Connect Wallet
                </button>
              </div>
            ) : !isCorrectChain ? (
              <div style={{ marginTop: '24px' }}>
                <p className="muted">Please switch to KASPLEX Testnet</p>
                <button className="btn btn-primary" onClick={switchToKasplex} style={{ marginTop: '12px' }}>
                  Switch Network
                </button>
              </div>
            ) : (
              <div className="row" style={{ marginTop: '24px' }}>
                <button className="btn btn-primary" onClick={() => setView('create')}>
                  Create Match
                </button>
                <button className="btn" onClick={() => setView('join')}>
                  Join with Code
                </button>
              </div>
            )}
          </div>
        );

      case 'create':
        return (
          <div className="lobby-content">
            <h1>Create Match</h1>
            <p className="muted">Select bet amount and share the code</p>
            <EvmNetworkGuard />

            <div className="bet-selector" style={{ marginTop: '24px' }}>
              <label className="muted">Bet Amount (KAS)</label>
              <div className="row" style={{ marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                {BET_AMOUNTS_KAS.map((amount) => (
                  <button
                    key={amount}
                    className={`btn ${betAmountKas === amount ? 'btn-primary' : ''}`}
                    onClick={() => setBetAmountKas(amount)}
                  >
                    {amount} KAS
                  </button>
                ))}
              </div>
            </div>

            {displayError && <p className="error" style={{ marginTop: '16px' }}>{displayError}</p>}

            <div className="row" style={{ marginTop: '24px' }}>
              <button
                className="btn btn-primary"
                onClick={handleCreateMatch}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Match'}
              </button>
              <button className="btn" onClick={() => setView('lobby')}>
                Cancel
              </button>
            </div>
          </div>
        );

      case 'join':
        return (
          <div className="lobby-content">
            <h1>Join Match</h1>
            <p className="muted">Enter the 6-character code</p>
            <EvmNetworkGuard />

            <div style={{ marginTop: '24px' }}>
              <input
                type="text"
                className="input-code"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                style={{
                  fontSize: '24px',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  padding: '12px 24px',
                  width: '200px',
                  textTransform: 'uppercase',
                }}
              />
            </div>

            {displayError && <p className="error" style={{ marginTop: '16px' }}>{displayError}</p>}

            <div className="row" style={{ marginTop: '24px' }}>
              <button
                className="btn btn-primary"
                onClick={handleJoinMatch}
                disabled={loading || joinCode.length !== 6}
              >
                {loading ? 'Joining...' : 'Join Match'}
              </button>
              <button className="btn" onClick={() => setView('lobby')}>
                Cancel
              </button>
            </div>
          </div>
        );

      case 'waiting':
        return (
          <div className="lobby-content">
            <h1>Waiting for Opponent</h1>
            <p className="muted">Share this code with your opponent</p>

            <div className="join-code" style={{
              marginTop: '24px',
              fontSize: '48px',
              fontWeight: 'bold',
              letterSpacing: '12px',
              color: 'var(--accent-primary)',
            }}>
              {match?.joinCode}
            </div>

            <p className="muted" style={{ marginTop: '8px', fontSize: '12px' }}>
              Code is case-insensitive
            </p>

            <button
              className="btn"
              onClick={() => void navigator.clipboard.writeText(match?.joinCode ?? '')}
              style={{ marginTop: '16px' }}
            >
              Copy Code
            </button>

            <div className="spinner" style={{ marginTop: '32px' }}>
              <div className="loading-dots">
                <span>Waiting</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
              </div>
            </div>

            {connectionState === 'polling' && (
              <p className="muted" style={{ marginTop: '12px', fontSize: '12px', color: '#ffa94d' }}>
                WS disconnected. Polling for updates...
              </p>
            )}

            <button className="btn" onClick={resetMatch} style={{ marginTop: '24px' }}>
              Cancel Match
            </button>
          </div>
        );

      case 'deposits':
        return (
          <div className="lobby-content">
            <h1>Deposit Required</h1>
            <p className="muted">Both players must deposit {betDisplayKas} KAS to start the race</p>

            <div className="deposit-status" style={{ marginTop: '24px' }}>
              {/* My Deposit */}
              <div className="deposit-card" style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Your Deposit ({myRole === 'player1' ? 'P1' : 'P2'})</span>
                  <span style={{
                    color: myDeposited ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}>
                    {myDeposited
                      ? 'Deposited'
                      : depositState === 'submitted'
                        ? 'Tx Submitted...'
                        : depositState === 'confirming'
                          ? 'Confirm in Wallet...'
                          : 'Pending'}
                  </span>
                </div>
                {/* Show deposit tx timeline if we have a hash */}
                {(myDepositTx?.txHash ?? depositTxHash) && (
                  <TxLifecycleTimeline
                    txid={(myDepositTx?.txHash ?? depositTxHash)!}
                    status={mapTxStatus(myDepositTx?.txStatus ?? (depositState === 'mined' ? 'mined' : 'submitted'))}
                    timestamps={{ broadcasted: Date.now() }}
                    network="testnet"
                  />
                )}
              </div>

              {/* Opponent Deposit */}
              <div className="deposit-card" style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Opponent Deposit ({myRole === 'player1' ? 'P2' : 'P1'})</span>
                  <span style={{
                    color: opDeposited ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}>
                    {opDeposited ? 'Deposited' : 'Waiting...'}
                  </span>
                </div>
                {opDepositTx?.txHash && (
                  <TxLifecycleTimeline
                    txid={opDepositTx.txHash}
                    status={mapTxStatus(opDepositTx.txStatus)}
                    timestamps={{ broadcasted: Date.now() }}
                    network="testnet"
                  />
                )}
              </div>
            </div>

            {/* Deposit button — show only if not yet deposited and no pending tx */}
            {!myDeposited && depositState !== 'submitted' && depositState !== 'mined' && (
              <>
                {displayError && (
                  <div style={{ marginTop: '16px' }}>
                    <p className="error">{displayError}</p>
                    <button className="btn" onClick={handleRetry} style={{ marginTop: '8px', fontSize: '12px' }}>
                      Retry
                    </button>
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleDeposit}
                  disabled={depositState === 'confirming'}
                  style={{ marginTop: '24px', width: '100%' }}
                >
                  {depositState === 'confirming'
                    ? 'Confirm in Wallet...'
                    : `Deposit ${betDisplayKas} KAS`}
                </button>
              </>
            )}

            <button className="btn" onClick={resetMatch} style={{ marginTop: '16px' }}>
              Cancel
            </button>
          </div>
        );

      case 'game':
        return (
          <div className="lobby-content">
            <h1>Race in Progress</h1>
            <p className="muted">Both deposits confirmed. Race is running...</p>

            <div style={{ marginTop: '24px' }}>
              <p className="muted">Navigate to game scene or check match status.</p>
            </div>

            <button className="btn" onClick={resetMatch} style={{ marginTop: '24px' }}>
              Back to Lobby
            </button>
          </div>
        );

      case 'finished': {
        const p1Score = match?.players.player1.score;
        const p2Score = match?.players.player2.score;
        const winnerAddr = match?.winner?.address;
        const myAddr = address?.toLowerCase();
        const isWinner = winnerAddr ? winnerAddr.toLowerCase() === myAddr : false;
        const isDraw = match?.settlement?.type === 'draw';
        const winnerLabel = isDraw
          ? 'Draw'
          : isWinner
            ? 'You Win!'
            : 'You Lose';

        const settleTxHash = match?.settlement?.txHash;
        const settleStatus = match?.settlement?.txStatus;

        return (
          <div className="lobby-content">
            <h1>{winnerLabel}</h1>
            <p className="muted">
              {isDraw
                ? 'Both players scored the same.'
                : `Winner: ${winnerAddr ? `${winnerAddr.slice(0, 8)}...${winnerAddr.slice(-4)}` : 'Pending'}`}
            </p>

            <div className="result-scores" style={{
              marginTop: '24px',
              display: 'flex',
              gap: '24px',
              justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div className="muted">Player 1</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  {p1Score?.toLocaleString() ?? '-'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="muted">Player 2</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  {p2Score?.toLocaleString() ?? '-'}
                </div>
              </div>
            </div>

            {/* Settlement Transaction */}
            {settleTxHash && (
              <div style={{ marginTop: '24px' }}>
                <h3>Settlement Transaction</h3>
                <TxLifecycleTimeline
                  txid={settleTxHash}
                  status={mapTxStatus(settleStatus ?? 'submitted')}
                  timestamps={{ broadcasted: Date.now() }}
                  network="testnet"
                />
              </div>
            )}

            {isDraw && (
              <p className="muted" style={{ marginTop: '16px', fontSize: '14px' }}>
                In a draw, deposits are returned via the contract.
              </p>
            )}

            <button className="btn btn-primary" onClick={resetMatch} style={{ marginTop: '24px' }}>
              Play Again
            </button>
          </div>
        );
      }
    }
  };

  const renderSidebar = () => {
    switch (view) {
      case 'lobby':
        return (
          <>
            <h2>Duel Rules</h2>
            <ul className="muted" style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <li>Both players deposit the bet amount via smart contract</li>
              <li>30-second race starts when deposits confirm</li>
              <li>Highest distance wins the pot</li>
              <li>Winner receives both deposits (minus gas)</li>
              <li>In a draw, deposits are returned</li>
            </ul>
          </>
        );

      case 'create':
        return (
          <>
            <h2>Create Match</h2>
            <div className="match-info">
              <div className="stat-item">
                <span className="stat-label">Your Wallet</span>
                <span className="stat-value" style={{ fontSize: '12px' }}>
                  {address?.slice(0, 8)}...{address?.slice(-4)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Bet Amount</span>
                <span className="stat-value">{betAmountKas} KAS</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Balance</span>
                <span className="stat-value">
                  {balance ? `${parseFloat(balance).toFixed(4)} KAS` : '...'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Network</span>
                <span className="stat-value">{isCorrectChain ? 'KASPLEX Testnet' : 'Wrong Network'}</span>
              </div>
            </div>
          </>
        );

      case 'join':
        return (
          <>
            <h2>Join Match</h2>
            <p className="muted">Get the code from your opponent</p>
            <div className="match-info" style={{ marginTop: '16px' }}>
              <div className="stat-item">
                <span className="stat-label">Your Wallet</span>
                <span className="stat-value" style={{ fontSize: '12px' }}>
                  {address?.slice(0, 8)}...{address?.slice(-4)}
                </span>
              </div>
            </div>
          </>
        );

      case 'waiting':
        return (
          <>
            <h2>Match Details</h2>
            <div className="match-info">
              <div className="stat-item">
                <span className="stat-label">Bet Amount</span>
                <span className="stat-value">{betDisplayKas} KAS</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">State</span>
                <span className="stat-value">{match?.state ?? 'lobby'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">You are</span>
                <span className="stat-value">Player 1</span>
              </div>
              {match?.contract.escrowAddress && (
                <div className="stat-item">
                  <span className="stat-label">Contract</span>
                  <span className="stat-value" style={{ fontSize: '11px' }}>
                    {match.contract.escrowAddress.slice(0, 10)}...
                  </span>
                </div>
              )}
            </div>
          </>
        );

      case 'deposits':
        return (
          <>
            <h2>Match #{match?.joinCode}</h2>
            <div className="match-info">
              <div className="stat-item">
                <span className="stat-label">Bet Amount</span>
                <span className="stat-value">{betDisplayKas} KAS</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Pot</span>
                <span className="stat-value">
                  {match ? formatEther(BigInt(match.depositAmountWei) * 2n) : '0'} KAS
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">State</span>
                <span className="stat-value">{match?.state}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Player 1</span>
                <span className="stat-value" style={{ fontSize: '11px' }}>
                  {match?.players.player1.address.slice(0, 10)}...
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Player 2</span>
                <span className="stat-value" style={{ fontSize: '11px' }}>
                  {match?.players.player2.address?.slice(0, 10) ?? 'N/A'}...
                </span>
              </div>
              {match?.contract.matchIdBytes32 && (
                <div className="stat-item">
                  <span className="stat-label">On-chain ID</span>
                  <span className="stat-value" style={{ fontSize: '10px' }}>
                    {match.contract.matchIdBytes32.slice(0, 14)}...
                  </span>
                </div>
              )}
            </div>
          </>
        );

      case 'game':
        return (
          <>
            <h2>Race</h2>
            <div className="match-info">
              <div className="stat-item">
                <span className="stat-label">Total Pot</span>
                <span className="stat-value">
                  {match ? formatEther(BigInt(match.depositAmountWei) * 2n) : '0'} KAS
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">State</span>
                <span className="stat-value">{match?.state}</span>
              </div>
            </div>
          </>
        );

      case 'finished':
        return (
          <>
            <h2>Match Complete</h2>
            <div className="match-info">
              <div className="stat-item">
                <span className="stat-label">Total Pot</span>
                <span className="stat-value">
                  {match ? formatEther(BigInt(match.depositAmountWei) * 2n) : '0'} KAS
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Winner</span>
                <span className="stat-value">
                  {match?.settlement?.type === 'draw'
                    ? 'Draw'
                    : match?.winner?.address
                      ? `${match.winner.address.slice(0, 8)}...${match.winner.address.slice(-4)}`
                      : 'Pending'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Settlement</span>
                <span className="stat-value" style={{ fontSize: '12px' }}>
                  {match?.settlement?.txHash
                    ? `${match.settlement.txHash.slice(0, 12)}...`
                    : 'Pending'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Settle Status</span>
                <span className="stat-value">{match?.settlement?.txStatus ?? 'pending'}</span>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="layout">
      <main className="game">
        {renderMainContent()}
      </main>
      <aside className="panel">
        {renderSidebar()}

        {match && (
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

        <div style={{ marginTop: 'auto' }}>
          <Link className="btn" to="/">
            Back Home
          </Link>
        </div>
      </aside>
    </div>
  );
}
