import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { TxLifecycleTimeline, type TxStatus } from '@kas-racing/speed-visualizer-sdk';
import { getTxDetails, getTxStatus, type TxDetails, type TxStatusInfo } from '../api/client';
import { parsePayload, isKasRacingPayload, LABELS, type ParsedPayload } from '../utils/payloadParser';

const NETWORK = (import.meta.env.VITE_NETWORK as string | undefined) ?? 'mainnet';

interface VerificationResult {
  txDetails: TxDetails;
  txStatus: TxStatusInfo & { source?: string };
  parsedPayload: ParsedPayload | null;
  isValid: boolean;
  error?: string;
}

export function Proof() {
  const [txidInput, setTxidInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = useCallback(async () => {
    const txid = txidInput.trim();
    if (!txid) {
      setError('Please enter a transaction ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Fetch both TX details and status in parallel
      const [txDetails, txStatus] = await Promise.all([
        getTxDetails(txid),
        getTxStatus(txid),
      ]);

      // Try to parse the payload
      let parsedPayload: ParsedPayload | null = null;
      let isValid = false;

      if (txDetails.payload && isKasRacingPayload(txDetails.payload)) {
        parsedPayload = parsePayload(txDetails.payload);
        isValid = parsedPayload !== null;
      }

      setResult({
        txDetails,
        txStatus,
        parsedPayload,
        isValid,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transaction');
    } finally {
      setLoading(false);
    }
  }, [txidInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        void handleVerify();
      }
    },
    [handleVerify, loading]
  );

  // Format sompi to KAS
  const formatKas = (sompi: number) => {
    const kas = sompi / 100_000_000;
    return `${kas.toFixed(4)} KAS`;
  };

  // Explorer URL
  const getExplorerUrl = (txid: string) => {
    const base = NETWORK === 'testnet'
      ? 'https://explorer-tn11.kaspa.org'
      : 'https://explorer.kaspa.org';
    return `${base}/txs/${txid}`;
  };

  return (
    <div className="layout">
      <main className="game">
        <div className="proof-content" style={{ padding: '24px' }}>
          <h1>Proof of Action</h1>
          <p className="muted">Verify on-chain game events</p>

          <div className="proof-input" style={{ marginTop: '32px' }}>
            <label htmlFor="txid">Transaction ID</label>
            <input
              id="txid"
              type="text"
              placeholder="Enter txid to verify..."
              className="input"
              style={{ width: '100%', marginTop: '8px', fontFamily: 'monospace', fontSize: '14px' }}
              value={txidInput}
              onChange={(e) => setTxidInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
              onClick={() => void handleVerify()}
              disabled={loading || !txidInput.trim()}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>

          {error && (
            <div className="error-box" style={{ marginTop: '24px', color: '#ff6b6b', padding: '12px', background: 'rgba(255,107,107,0.1)', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          {result && (
            <div className="proof-result" style={{ marginTop: '32px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {result.isValid ? (
                  <>
                    <span style={{ color: '#4ecdc4' }}>&#x2714;</span> Valid KAS Racing Event
                  </>
                ) : result.txDetails.payload ? (
                  <>
                    <span style={{ color: '#ffd93d' }}>&#x26A0;</span> Payload Not Recognized
                  </>
                ) : (
                  <>
                    <span style={{ color: '#888' }}>&#x2715;</span> No Payload Found
                  </>
                )}
              </h2>

              {result.parsedPayload && (
                <div className="parsed-payload" style={{ marginTop: '24px' }}>
                  <h3>Event Details</h3>
                  <table style={{ width: '100%', marginTop: '12px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Network</td>
                        <td style={{ padding: '8px 0' }}>{LABELS.network[result.parsedPayload.network]}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Game Mode</td>
                        <td style={{ padding: '8px 0' }}>{LABELS.mode[result.parsedPayload.mode]}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Event Type</td>
                        <td style={{ padding: '8px 0' }}>{LABELS.event[result.parsedPayload.event]}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Session ID</td>
                        <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{result.parsedPayload.sessionId}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Sequence #</td>
                        <td style={{ padding: '8px 0' }}>{result.parsedPayload.seq}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Commit Hash</td>
                        <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: '12px' }}>{result.parsedPayload.commit}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {result.txDetails.payload && !result.parsedPayload && (
                <div className="raw-payload" style={{ marginTop: '24px' }}>
                  <h3>Raw Payload</h3>
                  <pre style={{ marginTop: '8px', padding: '12px', background: '#111', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
                    {result.txDetails.payload}
                  </pre>
                </div>
              )}

              <div className="tx-outputs" style={{ marginTop: '24px' }}>
                <h3>Transaction Outputs</h3>
                {result.txDetails.outputs?.map((output, i) => (
                  <div key={i} style={{ marginTop: '8px', padding: '8px 12px', background: '#111', borderRadius: '4px' }}>
                    <div style={{ color: '#4ecdc4', fontWeight: 'bold' }}>{formatKas(output.amount)}</div>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#888', marginTop: '4px', wordBreak: 'break-all' }}>
                      {output.script_public_key_address ?? output.address ?? 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="muted" style={{ marginTop: '32px', fontSize: '12px' }}>
            Proof-of-Action verifies that game events were recorded on the Kaspa blockchain.
          </p>
        </div>
      </main>

      <aside className="panel">
        <h2>Verification</h2>
        <p className="muted">Parse transaction payload and display event details.</p>

        {result && (
          <>
            <div style={{ marginTop: '24px' }}>
              <h3>Transaction Status</h3>
              <TxLifecycleTimeline
                txid={result.txDetails.txid}
                status={result.txStatus.status as TxStatus}
                timestamps={result.txStatus.timestamps}
                network={NETWORK as 'mainnet' | 'testnet'}
              />
            </div>

            {result.txStatus.source && (
              <div style={{ marginTop: '16px', fontSize: '11px', color: '#888' }}>
                Data source: <span style={{ color: result.txStatus.source === 'indexer' ? '#4ecdc4' : '#ccc' }}>
                  {result.txStatus.source === 'indexer' ? 'Chain Indexer' :
                   result.txStatus.source === 'db' ? 'Server DB' :
                   result.txStatus.source === 'api' ? 'REST API' :
                   result.txStatus.source}
                </span>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <h3>Block Info</h3>
              {result.txDetails.blockHash ? (
                <div style={{ fontSize: '12px', color: '#888' }}>
                  <div>Included in block:</div>
                  <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '4px' }}>
                    {result.txDetails.blockHash.slice(0, 16)}...
                  </div>
                  {result.txDetails.blockTime && (
                    <div style={{ marginTop: '4px' }}>
                      {new Date(result.txDetails.blockTime).toLocaleString()}
                    </div>
                  )}
                </div>
              ) : (
                <p className="muted">Not yet included in a block</p>
              )}
            </div>
          </>
        )}

        <div style={{ marginTop: '24px' }}>
          <h3>Explorer</h3>
          {result ? (
            <a
              href={getExplorerUrl(result.txDetails.txid)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ display: 'block', textAlign: 'center' }}
            >
              View on Kaspa Explorer
            </a>
          ) : (
            <a
              href={NETWORK === 'testnet' ? 'https://explorer-tn11.kaspa.org' : 'https://explorer.kaspa.org'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ display: 'block', textAlign: 'center' }}
            >
              Open Kaspa Explorer
            </a>
          )}
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
