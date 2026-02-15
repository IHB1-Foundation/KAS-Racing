import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { TxLifecycleTimeline, type TxStatus } from '@kas-racing/speed-visualizer-sdk';
import {
  getTxDetailsV3,
  getTxStatusV3,
  getProofV3,
  type V3TxDetailsResponse,
  type V3TxStatusResponse,
  type V3ProofResponse,
} from '../api/v3client';

const EXPLORER_BASE = 'https://zkevm.kasplex.org';

// Map EVM tx status to TxLifecycleTimeline status
function mapEvmStatus(s: string): TxStatus {
  switch (s) {
    case 'submitted': case 'pending': return 'broadcasted';
    case 'mined': return 'included';
    case 'confirmed': return 'confirmed';
    case 'failed': return 'failed';
    default: return 'broadcasted';
  }
}

type LookupMode = 'txhash' | 'proof';

interface TxVerificationResult {
  txDetails: V3TxDetailsResponse;
  txStatus: V3TxStatusResponse;
}

export function Proof() {
  const [lookupMode, setLookupMode] = useState<LookupMode>('txhash');
  const [txHashInput, setTxHashInput] = useState('');
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [seqInput, setSeqInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<TxVerificationResult | null>(null);
  const [proofResult, setProofResult] = useState<V3ProofResponse | null>(null);

  const handleVerifyTx = useCallback(async () => {
    const txHash = txHashInput.trim();
    if (!txHash) {
      setError('Please enter a transaction hash');
      return;
    }

    setLoading(true);
    setError(null);
    setTxResult(null);
    setProofResult(null);

    try {
      const [txDetails, txStatus] = await Promise.all([
        getTxDetailsV3(txHash),
        getTxStatusV3(txHash),
      ]);

      setTxResult({ txDetails, txStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transaction');
    } finally {
      setLoading(false);
    }
  }, [txHashInput]);

  const handleVerifyProof = useCallback(async () => {
    const sessionId = sessionIdInput.trim();
    const seq = parseInt(seqInput.trim(), 10);

    if (!sessionId) {
      setError('Please enter a session ID');
      return;
    }
    if (isNaN(seq) || seq < 0) {
      setError('Please enter a valid sequence number');
      return;
    }

    setLoading(true);
    setError(null);
    setTxResult(null);
    setProofResult(null);

    try {
      const proof = await getProofV3(sessionId, seq);
      setProofResult(proof);

      // Also fetch tx details if we have a tx hash
      if (proof.txHash) {
        try {
          const [txDetails, txStatus] = await Promise.all([
            getTxDetailsV3(proof.txHash),
            getTxStatusV3(proof.txHash),
          ]);
          setTxResult({ txDetails, txStatus });
        } catch {
          // tx details are optional for proof display
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proof');
    } finally {
      setLoading(false);
    }
  }, [sessionIdInput, seqInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        if (lookupMode === 'txhash') {
          void handleVerifyTx();
        } else {
          void handleVerifyProof();
        }
      }
    },
    [handleVerifyTx, handleVerifyProof, loading, lookupMode]
  );

  const getExplorerUrl = (txHash: string) => `${EXPLORER_BASE}/tx/${txHash}`;

  return (
    <div className="layout">
      <main className="game">
        <div className="proof-content" style={{ padding: '24px' }}>
          <h1>Proof of Action</h1>
          <p className="muted">Verify on-chain game events on KASPLEX zkEVM</p>

          {/* Lookup Mode Toggle */}
          <div className="row" style={{ marginTop: '24px', gap: '8px' }}>
            <button
              className={`btn ${lookupMode === 'txhash' ? 'btn-primary' : ''}`}
              onClick={() => { setLookupMode('txhash'); setError(null); }}
            >
              By Tx Hash
            </button>
            <button
              className={`btn ${lookupMode === 'proof' ? 'btn-primary' : ''}`}
              onClick={() => { setLookupMode('proof'); setError(null); }}
            >
              By Session + Seq
            </button>
          </div>

          {/* Input area */}
          {lookupMode === 'txhash' ? (
            <div className="proof-input" style={{ marginTop: '24px' }}>
              <label htmlFor="txhash">Transaction Hash</label>
              <input
                id="txhash"
                type="text"
                placeholder="0x..."
                className="input"
                style={{ width: '100%', marginTop: '8px', fontFamily: 'monospace', fontSize: '14px' }}
                value={txHashInput}
                onChange={(e) => setTxHashInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: '16px' }}
                onClick={() => void handleVerifyTx()}
                disabled={loading || !txHashInput.trim()}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          ) : (
            <div className="proof-input" style={{ marginTop: '24px' }}>
              <label htmlFor="sessionId">Session ID</label>
              <input
                id="sessionId"
                type="text"
                placeholder="Session UUID..."
                className="input"
                style={{ width: '100%', marginTop: '8px', fontFamily: 'monospace', fontSize: '14px' }}
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <label htmlFor="seq" style={{ display: 'block', marginTop: '16px' }}>Sequence Number</label>
              <input
                id="seq"
                type="number"
                placeholder="0"
                className="input"
                style={{ width: '120px', marginTop: '8px', fontSize: '14px' }}
                value={seqInput}
                onChange={(e) => setSeqInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                min={0}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: '16px' }}
                onClick={() => void handleVerifyProof()}
                disabled={loading || !sessionIdInput.trim() || !seqInput.trim()}
              >
                {loading ? 'Verifying...' : 'Verify Proof'}
              </button>
            </div>
          )}

          {error && (
            <div className="error-box" style={{ marginTop: '24px', color: '#ff6b6b', padding: '12px', background: 'rgba(255,107,107,0.1)', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          {/* Proof Result */}
          {proofResult && (
            <div className="proof-result" style={{ marginTop: '32px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {proofResult.verified ? (
                  <>
                    <span style={{ color: '#4ecdc4' }}>&#x2714;</span> Verified On-Chain Proof
                  </>
                ) : (
                  <>
                    <span style={{ color: '#ffd93d' }}>&#x26A0;</span> Proof Pending Verification
                  </>
                )}
              </h2>

              <div className="parsed-payload" style={{ marginTop: '24px' }}>
                <h3>Proof Details</h3>
                <table style={{ width: '100%', marginTop: '12px' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#888' }}>Session ID</td>
                      <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: '12px' }}>{proofResult.sessionId}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#888' }}>Sequence</td>
                      <td style={{ padding: '8px 0' }}>{proofResult.seq}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#888' }}>Proof Hash</td>
                      <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                        {proofResult.proofHash ?? 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#888' }}>Tx Hash</td>
                      <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                        {proofResult.txHash ?? 'Pending'}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#888' }}>Block</td>
                      <td style={{ padding: '8px 0' }}>{proofResult.blockNumber ?? 'Pending'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#888' }}>Verified</td>
                      <td style={{ padding: '8px 0', color: proofResult.verified ? '#4ecdc4' : '#ffd93d' }}>
                        {proofResult.verified ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Chain Events */}
              {proofResult.chainEvents.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <h3>Chain Events</h3>
                  {proofResult.chainEvents.map((evt) => (
                    <div key={evt.id} style={{ marginTop: '8px', padding: '8px 12px', background: '#111', borderRadius: '4px' }}>
                      <div style={{ color: '#4ecdc4', fontWeight: 'bold', fontSize: '13px' }}>{evt.eventName}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        Block: {evt.blockNumber} | Log: {evt.logIndex}
                      </div>
                      <pre style={{ fontSize: '10px', color: '#666', marginTop: '4px', overflow: 'auto' }}>
                        {JSON.stringify(evt.args, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tx Result (from tx hash lookup or enriched proof) */}
          {txResult && !proofResult && (
            <div className="proof-result" style={{ marginTop: '32px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {txResult.txStatus.status === 'mined' || txResult.txStatus.status === 'confirmed' ? (
                  <>
                    <span style={{ color: '#4ecdc4' }}>&#x2714;</span> Transaction Found
                  </>
                ) : (
                  <>
                    <span style={{ color: '#ffd93d' }}>&#x26A0;</span> Transaction Pending
                  </>
                )}
              </h2>

              {/* Display decoded events */}
              {txResult.txDetails.events.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <h3>Decoded Events</h3>
                  {txResult.txDetails.events.map((evt) => (
                    <div key={evt.id} style={{ marginTop: '8px', padding: '8px 12px', background: '#111', borderRadius: '4px' }}>
                      <div style={{ color: '#4ecdc4', fontWeight: 'bold', fontSize: '13px' }}>{evt.eventName}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        Contract: {evt.contract.slice(0, 10)}... | Block: {evt.blockNumber}
                      </div>
                      <pre style={{ fontSize: '10px', color: '#666', marginTop: '4px', overflow: 'auto' }}>
                        {JSON.stringify(evt.args, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Receipt info */}
              {txResult.txDetails.receipt && (
                <div style={{ marginTop: '24px' }}>
                  <h3>Receipt</h3>
                  <table style={{ width: '100%', marginTop: '12px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Status</td>
                        <td style={{ padding: '8px 0' }}>{txResult.txDetails.receipt.status}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Block</td>
                        <td style={{ padding: '8px 0' }}>{txResult.txDetails.receipt.blockNumber}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>Gas Used</td>
                        <td style={{ padding: '8px 0' }}>{txResult.txDetails.receipt.gasUsed}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>From</td>
                        <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                          {txResult.txDetails.receipt.from}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#888' }}>To</td>
                        <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                          {txResult.txDetails.receipt.to ?? 'Contract Creation'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <p className="muted" style={{ marginTop: '32px', fontSize: '12px' }}>
            Proof-of-Action verifies that game events were recorded on the KASPLEX zkEVM blockchain.
          </p>
        </div>
      </main>

      <aside className="panel">
        <h2>Verification</h2>
        <p className="muted">
          {lookupMode === 'txhash'
            ? 'Look up a transaction by its hash to see decoded events.'
            : 'Look up a proof-of-action by session ID and sequence number.'}
        </p>

        {/* Tx Status Timeline */}
        {txResult && (
          <>
            <div style={{ marginTop: '24px' }}>
              <h3>Transaction Status</h3>
              <TxLifecycleTimeline
                txid={txResult.txDetails.txHash}
                status={mapEvmStatus(txResult.txStatus.status)}
                timestamps={txResult.txStatus.timestamps}
                network="testnet"
              />
            </div>

            <div style={{ marginTop: '16px', fontSize: '11px', color: '#888' }}>
              Confirmations: <span style={{ color: '#4ecdc4' }}>{txResult.txStatus.confirmations}</span>
            </div>
          </>
        )}

        <div style={{ marginTop: '24px' }}>
          <h3>Explorer</h3>
          {txResult ? (
            <a
              href={getExplorerUrl(txResult.txDetails.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ display: 'block', textAlign: 'center' }}
            >
              View on KASPLEX Explorer
            </a>
          ) : proofResult?.txHash ? (
            <a
              href={getExplorerUrl(proofResult.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ display: 'block', textAlign: 'center' }}
            >
              View on KASPLEX Explorer
            </a>
          ) : (
            <a
              href={EXPLORER_BASE}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ display: 'block', textAlign: 'center' }}
            >
              Open KASPLEX Explorer
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
