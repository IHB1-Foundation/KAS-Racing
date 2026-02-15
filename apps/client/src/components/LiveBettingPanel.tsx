/**
 * LiveBettingPanel — Real-time odds display + bet/cancel UI
 *
 * Shows:
 *  - Current odds for player A vs B (probability bars + decimal odds)
 *  - Bet placement form (side selector, stake input, confirm button)
 *  - Active bets list with cancel button
 *  - Market state badge (OPEN / LOCKED / SETTLED)
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  MarketInfo,
  MarketOdds,
  MarketBet,
  PlaceBetResponse,
} from '../api/v3client';
import { placeBetV3, cancelBetV3 } from '../api/v3client';

// ── Helpers ──

function bpsToDecimalOdds(bps: number): string {
  if (bps <= 0) return '-.--';
  return (10000 / bps).toFixed(2);
}

function bpsToPct(bps: number): string {
  return (bps / 100).toFixed(1);
}

function weiToKas(wei: string): string {
  const val = Number(BigInt(wei)) / 1e18;
  return val.toFixed(4);
}

function generateIdempotencyKey(): string {
  return `bet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Types ──

interface LiveBettingPanelProps {
  market: MarketInfo | null;
  odds: MarketOdds | null;
  bets: MarketBet[];
  userId: string;
  player1Label?: string;
  player2Label?: string;
  onBetPlaced?: (result: PlaceBetResponse) => void;
  onBetCancelled?: (orderId: string) => void;
  onError?: (error: string) => void;
}

// ── Preset Stakes ──

const STAKE_PRESETS = [
  { label: '0.01', wei: '10000000000000000' },
  { label: '0.05', wei: '50000000000000000' },
  { label: '0.1', wei: '100000000000000000' },
  { label: '0.5', wei: '500000000000000000' },
];

// ── Component ──

export function LiveBettingPanel({
  market,
  odds,
  bets,
  userId,
  player1Label = 'Player 1',
  player2Label = 'Player 2',
  onBetPlaced,
  onBetCancelled,
  onError,
}: LiveBettingPanelProps) {
  const [selectedSide, setSelectedSide] = useState<'A' | 'B' | null>(null);
  const [stakeWei, setStakeWei] = useState<string>(STAKE_PRESETS[0]!.wei);
  const [placing, setPlacing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const isOpen = market?.state === 'open';
  const probA = odds?.probABps ?? 5000;
  const probB = odds?.probBBps ?? 5000;

  // My active (pending) bets
  const myBets = useMemo(
    () => bets.filter((b) => b.userId === userId && b.status === 'pending'),
    [bets, userId],
  );

  // Total exposure
  const totalExposure = useMemo(
    () => myBets.reduce((sum, b) => sum + BigInt(b.stakeWei), 0n),
    [myBets],
  );

  const handlePlaceBet = useCallback(async () => {
    if (!market || !selectedSide || !isOpen) return;
    setPlacing(true);
    try {
      const result = await placeBetV3(
        market.id,
        userId,
        selectedSide,
        stakeWei,
        generateIdempotencyKey(),
      );
      onBetPlaced?.(result);
      setSelectedSide(null);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  }, [market, selectedSide, stakeWei, userId, isOpen, onBetPlaced, onError]);

  const handleCancelBet = useCallback(async (orderId: string) => {
    if (!market) return;
    setCancellingId(orderId);
    try {
      await cancelBetV3(market.id, orderId, userId);
      onBetCancelled?.(orderId);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to cancel bet');
    } finally {
      setCancellingId(null);
    }
  }, [market, userId, onBetCancelled, onError]);

  if (!market) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Live Market</div>
        <div style={styles.empty}>No active market</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span>Live Market</span>
        <span style={{
          ...styles.stateBadge,
          backgroundColor: isOpen ? '#22c55e' : market.state === 'locked' ? '#f59e0b' : '#6b7280',
        }}>
          {market.state.toUpperCase()}
        </span>
      </div>

      {/* Odds Bar */}
      <div style={styles.oddsSection}>
        <div style={styles.oddsRow}>
          <div style={styles.oddsLabel}>
            <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{player1Label}</span>
            <span style={styles.oddsValue}>{bpsToPct(probA)}% ({bpsToDecimalOdds(probA)}x)</span>
          </div>
          <div style={styles.oddsLabel}>
            <span style={styles.oddsValue}>{bpsToPct(probB)}% ({bpsToDecimalOdds(probB)}x)</span>
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{player2Label}</span>
          </div>
        </div>
        <div style={styles.oddsBar}>
          <div style={{
            ...styles.oddsBarFillA,
            width: `${probA / 100}%`,
          }} />
          <div style={{
            ...styles.oddsBarFillB,
            width: `${probB / 100}%`,
          }} />
        </div>
        <div style={styles.poolInfo}>
          Pool: {weiToKas(market.totalPoolWei)} KAS
          {odds && <span style={styles.seqInfo}> | Tick #{odds.seq}</span>}
        </div>
      </div>

      {/* Bet Form */}
      {isOpen && (
        <div style={styles.betForm}>
          <div style={styles.sideSelector}>
            <button
              style={{
                ...styles.sideButton,
                ...(selectedSide === 'A' ? styles.sideButtonActiveA : {}),
              }}
              onClick={() => setSelectedSide('A')}
            >
              {player1Label}
            </button>
            <button
              style={{
                ...styles.sideButton,
                ...(selectedSide === 'B' ? styles.sideButtonActiveB : {}),
              }}
              onClick={() => setSelectedSide('B')}
            >
              {player2Label}
            </button>
          </div>

          <div style={styles.stakeRow}>
            {STAKE_PRESETS.map((p) => (
              <button
                key={p.wei}
                style={{
                  ...styles.stakePreset,
                  ...(stakeWei === p.wei ? styles.stakePresetActive : {}),
                }}
                onClick={() => setStakeWei(p.wei)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {selectedSide && (
            <div style={styles.betSummary}>
              Bet {weiToKas(stakeWei)} KAS on {selectedSide === 'A' ? player1Label : player2Label}
              {' '}@ {bpsToDecimalOdds(selectedSide === 'A' ? probA : probB)}x
              {' '}→ potential {weiToKas(
                String(BigInt(stakeWei) * 10000n / BigInt(selectedSide === 'A' ? probA : probB)),
              )} KAS
            </div>
          )}

          <button
            style={{
              ...styles.placeBetButton,
              opacity: !selectedSide || placing ? 0.5 : 1,
            }}
            onClick={() => void handlePlaceBet()}
            disabled={!selectedSide || placing}
          >
            {placing ? 'Placing...' : 'Place Bet'}
          </button>
        </div>
      )}

      {/* My Bets */}
      {myBets.length > 0 && (
        <div style={styles.myBets}>
          <div style={styles.myBetsHeader}>
            My Bets ({myBets.length}) | Exposure: {weiToKas(totalExposure.toString())} KAS
          </div>
          {myBets.map((bet) => (
            <div key={bet.id} style={styles.betRow}>
              <span style={{
                color: bet.side === 'A' ? '#3b82f6' : '#ef4444',
                fontWeight: 'bold',
              }}>
                {bet.side === 'A' ? player1Label : player2Label}
              </span>
              <span>{weiToKas(bet.stakeWei)} KAS @ {bpsToDecimalOdds(bet.oddsAtPlacementBps)}x</span>
              {isOpen && (
                <button
                  style={styles.cancelButton}
                  onClick={() => void handleCancelBet(bet.id)}
                  disabled={cancellingId === bet.id}
                >
                  {cancellingId === bet.id ? '...' : 'Cancel'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Settled / Locked info */}
      {market.state === 'locked' && (
        <div style={styles.lockedBanner}>
          Market locked — waiting for race result
        </div>
      )}
      {market.state === 'settled' && (
        <div style={styles.settledBanner}>
          Market settled
        </div>
      )}
    </div>
  );
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 8,
    padding: 12,
    color: '#e0e0e0',
    fontFamily: 'monospace',
    fontSize: 13,
    maxWidth: 360,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
    fontSize: 14,
  },
  stateBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  empty: {
    textAlign: 'center' as const,
    color: '#888',
    padding: 16,
  },
  oddsSection: {
    marginBottom: 10,
  },
  oddsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  oddsLabel: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    fontSize: 12,
  },
  oddsValue: {
    color: '#aaa',
    fontSize: 11,
  },
  oddsBar: {
    display: 'flex',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  oddsBarFillA: {
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease',
  },
  oddsBarFillB: {
    backgroundColor: '#ef4444',
    transition: 'width 0.3s ease',
  },
  poolInfo: {
    textAlign: 'center' as const,
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  seqInfo: {
    color: '#666',
  },
  betForm: {
    borderTop: '1px solid #333',
    paddingTop: 8,
    marginTop: 8,
  },
  sideSelector: {
    display: 'flex',
    gap: 6,
    marginBottom: 8,
  },
  sideButton: {
    flex: 1,
    padding: '6px 0',
    border: '1px solid #555',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: '#ccc',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  sideButtonActiveA: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f620',
    color: '#3b82f6',
  },
  sideButtonActiveB: {
    borderColor: '#ef4444',
    backgroundColor: '#ef444420',
    color: '#ef4444',
  },
  stakeRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 8,
  },
  stakePreset: {
    flex: 1,
    padding: '4px 0',
    border: '1px solid #444',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  stakePresetActive: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e20',
    color: '#22c55e',
  },
  betSummary: {
    backgroundColor: '#0f0f23',
    padding: 6,
    borderRadius: 4,
    fontSize: 11,
    color: '#aaa',
    marginBottom: 8,
  },
  placeBetButton: {
    width: '100%',
    padding: '8px 0',
    border: 'none',
    borderRadius: 4,
    backgroundColor: '#22c55e',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  myBets: {
    borderTop: '1px solid #333',
    paddingTop: 8,
    marginTop: 8,
  },
  myBetsHeader: {
    fontSize: 11,
    color: '#888',
    marginBottom: 6,
  },
  betRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
    fontSize: 11,
  },
  cancelButton: {
    padding: '2px 8px',
    border: '1px solid #ef4444',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  lockedBanner: {
    borderTop: '1px solid #333',
    paddingTop: 8,
    marginTop: 8,
    textAlign: 'center' as const,
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  settledBanner: {
    borderTop: '1px solid #333',
    paddingTop: 8,
    marginTop: 8,
    textAlign: 'center' as const,
    color: '#22c55e',
    fontSize: 12,
    fontWeight: 'bold',
  },
};
