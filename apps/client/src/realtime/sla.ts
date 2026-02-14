/**
 * SLA Thresholds for chain event reflection latency.
 * Defines target times from on-chain event to FE display.
 */

export const SLA = {
  /** Broadcast → accepted reflected in UI (ms) */
  acceptedMs: 3_000,
  /** Accepted → included reflected in UI (ms) */
  includedMs: 10_000,
  /** Included → confirmed (10 confs) reflected in UI (ms) */
  confirmedMs: 60_000,
} as const;

export type SlaLevel = 'ok' | 'warn' | 'breach';

export function checkSla(elapsedMs: number, thresholdMs: number): SlaLevel {
  if (elapsedMs <= thresholdMs) return 'ok';
  if (elapsedMs <= thresholdMs * 1.5) return 'warn';
  return 'breach';
}

export const SLA_COLORS: Record<SlaLevel, string> = {
  ok: '#4ecdc4',
  warn: '#ffd93d',
  breach: '#ff6b6b',
};
