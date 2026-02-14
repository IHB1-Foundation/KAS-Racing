/**
 * LatencyDebugPanel
 *
 * Debug overlay showing real-time sync status, event latency, and SLA compliance.
 * Only visible when debug mode is enabled.
 */

import { type ConnectionState, type LatencyRecord, SLA, checkSla, SLA_COLORS } from '../realtime';

interface LatencyDebugPanelProps {
  connectionState: ConnectionState;
  avgLatencyMs: number;
  latencyRecords: LatencyRecord[];
}

const stateColors: Record<ConnectionState, string> = {
  connected: '#4ecdc4',
  connecting: '#ffd93d',
  disconnected: '#ff6b6b',
  polling: '#ffa94d',
};

const stateLabels: Record<ConnectionState, string> = {
  connected: 'WS Connected',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
  polling: 'Polling Fallback',
};

export function LatencyDebugPanel({
  connectionState,
  avgLatencyMs,
  latencyRecords,
}: LatencyDebugPanelProps) {
  const recentRecords = latencyRecords.slice(-10);

  // Compute SLA compliance from chain events only
  const chainRecords = latencyRecords.filter(r => r.event.startsWith('chain:'));
  const slaStatus = chainRecords.length > 0
    ? checkSla(
        Math.max(...chainRecords.map(r => r.latencyMs)),
        SLA.acceptedMs,
      )
    : 'ok';

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.85)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '11px',
      fontFamily: 'monospace',
      marginTop: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', color: '#888' }}>Sync Debug</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          color: stateColors[connectionState],
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: stateColors[connectionState],
            display: 'inline-block',
          }} />
          {stateLabels[connectionState]}
        </span>
      </div>

      <div style={{ color: '#888', marginBottom: '4px' }}>
        Avg latency: <span style={{ color: avgLatencyMs < 100 ? '#4ecdc4' : avgLatencyMs < 500 ? '#ffd93d' : '#ff6b6b' }}>
          {avgLatencyMs}ms
        </span>
        {' | '}
        Events: {latencyRecords.length}
      </div>

      {/* SLA Thresholds */}
      <div style={{ color: '#666', marginBottom: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
        <span style={{ color: '#888' }}>SLA: </span>
        <span style={{ color: SLA_COLORS[slaStatus] }}>
          {slaStatus === 'ok' ? 'OK' : slaStatus === 'warn' ? 'WARN' : 'BREACH'}
        </span>
        <span style={{ color: '#555', marginLeft: '8px' }}>
          (accepted &lt;{SLA.acceptedMs / 1000}s | included &lt;{SLA.includedMs / 1000}s | confirmed &lt;{SLA.confirmedMs / 1000}s)
        </span>
      </div>

      {recentRecords.length > 0 && (
        <div style={{ maxHeight: '120px', overflow: 'auto' }}>
          {recentRecords.map((r, i) => (
            <div key={i} style={{
              color: '#666',
              padding: '2px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <span style={{ color: r.source === 'ws' ? '#4ecdc4' : '#ffa94d' }}>
                {r.source === 'ws' ? 'WS' : 'PL'}
              </span>
              {' '}
              {r.event}
              {' '}
              <span style={{
                color: r.latencyMs < 100 ? '#4ecdc4' : r.latencyMs < 500 ? '#ffd93d' : '#ff6b6b',
              }}>
                {r.latencyMs}ms
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
