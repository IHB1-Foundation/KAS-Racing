/**
 * TxLifecycleTimeline Component
 *
 * Displays the lifecycle stages of a Kaspa transaction:
 * broadcasted → accepted → included → confirmed
 */
import React, { useMemo } from 'react';
import type { TxStatus, TxLifecycleTimelineProps } from '../types.js';

const STAGES: TxStatus[] = ['broadcasted', 'accepted', 'included', 'confirmed'];

const STAGE_LABELS: Record<TxStatus, string> = {
  pending: 'Pending',
  broadcasted: 'Broadcasted',
  accepted: 'Accepted',
  included: 'Included',
  confirmed: 'Confirmed',
  failed: 'Failed',
};

const EXPLORER_URLS: Record<string, string> = {
  mainnet: 'https://explorer.kaspa.org/txs/',
  testnet: 'https://explorer-tn11.kaspa.org/txs/',
};

function getStageIndex(status: TxStatus): number {
  const idx = STAGES.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function TxLifecycleTimeline({
  txid,
  status,
  timestamps,
  confirmations = 0,
  explorerUrl,
  network = 'mainnet',
  onStatusClick,
}: TxLifecycleTimelineProps): React.ReactElement {
  const currentStageIndex = getStageIndex(status);

  const stageTimings = useMemo(() => {
    if (!timestamps) return {};

    const result: Record<string, string> = {};
    const broadcastedAt = timestamps.broadcasted;

    if (broadcastedAt) {
      if (timestamps.accepted) {
        result.accepted = formatElapsed(timestamps.accepted - broadcastedAt);
      }
      if (timestamps.included) {
        result.included = formatElapsed(timestamps.included - broadcastedAt);
      }
      if (timestamps.confirmed) {
        result.confirmed = formatElapsed(timestamps.confirmed - broadcastedAt);
      }
    }

    return result;
  }, [timestamps]);

  const explorerLink = explorerUrl || `${EXPLORER_URLS[network]}${txid}`;

  const handleStageClick = (stage: TxStatus) => {
    onStatusClick?.(stage);
  };

  return (
    <div className="svs-timeline" data-status={status}>
      <div className="svs-timeline-header">
        <a
          href={explorerLink}
          target="_blank"
          rel="noopener noreferrer"
          className="svs-txid"
          title={txid}
        >
          {txid.slice(0, 8)}...{txid.slice(-6)}
        </a>
        {status === 'confirmed' && confirmations > 0 && (
          <span className="svs-confirmations">{confirmations} conf</span>
        )}
      </div>

      <div className="svs-stages">
        {STAGES.map((stage, idx) => {
          const isActive = idx <= currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const timing = stageTimings[stage];

          return (
            <div
              key={stage}
              className={`svs-stage ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
              onClick={() => handleStageClick(stage)}
            >
              <div className="svs-stage-dot" />
              <div className="svs-stage-label">
                {STAGE_LABELS[stage]}
                {timing && <span className="svs-stage-timing">{timing}</span>}
              </div>
              {idx < STAGES.length - 1 && <div className="svs-stage-line" />}
            </div>
          );
        })}
      </div>

      {status === 'failed' && (
        <div className="svs-failed-badge">Failed</div>
      )}

      <style>{`
        .svs-timeline {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          padding: 12px;
          background: #1a1a2e;
          border-radius: 8px;
          color: #e0e0e0;
        }

        .svs-timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .svs-txid {
          color: #4fc3f7;
          text-decoration: none;
          font-family: monospace;
          font-size: 11px;
        }

        .svs-txid:hover {
          text-decoration: underline;
        }

        .svs-confirmations {
          background: #2e7d32;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
        }

        .svs-stages {
          display: flex;
          justify-content: space-between;
          position: relative;
        }

        .svs-stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          position: relative;
          cursor: pointer;
        }

        .svs-stage-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #444;
          border: 2px solid #666;
          z-index: 1;
          transition: all 0.3s ease;
        }

        .svs-stage.active .svs-stage-dot {
          background: #4fc3f7;
          border-color: #4fc3f7;
        }

        .svs-stage.current .svs-stage-dot {
          box-shadow: 0 0 8px #4fc3f7;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 8px #4fc3f7; }
          50% { box-shadow: 0 0 16px #4fc3f7; }
        }

        .svs-stage-label {
          margin-top: 8px;
          text-align: center;
          font-size: 10px;
          color: #888;
          transition: color 0.3s ease;
        }

        .svs-stage.active .svs-stage-label {
          color: #e0e0e0;
        }

        .svs-stage-timing {
          display: block;
          color: #4fc3f7;
          font-size: 9px;
          margin-top: 2px;
        }

        .svs-stage-line {
          position: absolute;
          top: 6px;
          left: 50%;
          width: 100%;
          height: 2px;
          background: #444;
          z-index: 0;
        }

        .svs-stage.active .svs-stage-line {
          background: #4fc3f7;
        }

        .svs-failed-badge {
          margin-top: 8px;
          text-align: center;
          background: #d32f2f;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
        }

        .svs-timeline[data-status="confirmed"] {
          border: 1px solid #2e7d32;
        }

        .svs-timeline[data-status="failed"] {
          border: 1px solid #d32f2f;
        }
      `}</style>
    </div>
  );
}

export default TxLifecycleTimeline;
