/**
 * KaspaRPMGauge Component
 *
 * Displays Kaspa network "blocks per second" as an RPM-style gauge.
 */
import React from 'react';
import type { KaspaRPMGaugeProps } from '../types.js';

export function KaspaRPMGauge({
  bps = 0,
  maxBps = 10,
  label = 'BPS',
  showValue = true,
}: KaspaRPMGaugeProps): React.ReactElement {
  const percentage = Math.min((bps / maxBps) * 100, 100);
  const rotation = (percentage / 100) * 180 - 90; // -90 to 90 degrees

  const getColor = (pct: number): string => {
    if (pct < 30) return '#f44336'; // Red - low activity
    if (pct < 70) return '#ff9800'; // Orange - moderate
    return '#4caf50'; // Green - high activity
  };

  const color = getColor(percentage);

  return (
    <div className="svs-gauge">
      <svg viewBox="0 0 100 60" className="svs-gauge-svg">
        {/* Background arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#333"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Foreground arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 1.26} 126`}
          className="svs-gauge-fill"
        />

        {/* Needle */}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="20"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${rotation} 50 50)`}
          className="svs-gauge-needle"
        />

        {/* Center dot */}
        <circle cx="50" cy="50" r="4" fill={color} />

        {/* Min/Max labels */}
        <text x="10" y="58" className="svs-gauge-label">0</text>
        <text x="85" y="58" className="svs-gauge-label">{maxBps}</text>
      </svg>

      {showValue && (
        <div className="svs-gauge-value" style={{ color }}>
          {bps.toFixed(1)}
        </div>
      )}

      <div className="svs-gauge-label-main">{label}</div>

      <style>{`
        .svs-gauge {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          text-align: center;
          padding: 8px;
          background: #1a1a2e;
          border-radius: 8px;
          min-width: 100px;
        }

        .svs-gauge-svg {
          width: 100%;
          max-width: 120px;
        }

        .svs-gauge-fill {
          transition: stroke-dasharray 0.5s ease;
        }

        .svs-gauge-needle {
          transition: transform 0.5s ease;
          transform-origin: 50px 50px;
        }

        .svs-gauge-label {
          fill: #666;
          font-size: 6px;
          font-family: monospace;
        }

        .svs-gauge-value {
          font-size: 24px;
          font-weight: bold;
          font-family: monospace;
          margin-top: -8px;
        }

        .svs-gauge-label-main {
          color: #888;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}

export default KaspaRPMGauge;
