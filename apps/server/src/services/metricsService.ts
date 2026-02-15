/**
 * Metrics Service — Latency + SLA tracking
 *
 * Collects timing data for EVM transaction lifecycle:
 *   submitted → mined → confirmed
 *
 * Provides aggregated metrics for the Speed-Visualizer panel.
 */

export interface LatencyMetric {
  entityType: 'match' | 'reward' | 'deposit' | 'settlement';
  entityId: string;
  event: string;
  txHash: string;
  blockNumber: string;
  minedAt: number; // timestamp ms
  submittedAt?: number; // timestamp ms (if known)
}

interface MetricEntry {
  metric: LatencyMetric;
  latencyMs: number | null; // submitted → mined (null if submittedAt unknown)
  recordedAt: number;
}

// In-memory ring buffer for recent metrics (last 500 entries)
const MAX_ENTRIES = 500;
const metrics: MetricEntry[] = [];

/**
 * Record a latency metric.
 */
export function recordLatencyMetric(metric: LatencyMetric): void {
  const latencyMs = metric.submittedAt
    ? metric.minedAt - metric.submittedAt
    : null;

  const entry: MetricEntry = {
    metric,
    latencyMs,
    recordedAt: Date.now(),
  };

  metrics.push(entry);
  if (metrics.length > MAX_ENTRIES) {
    metrics.shift();
  }
}

/**
 * Get recent metrics (last N entries).
 */
export function getRecentMetrics(limit = 50): MetricEntry[] {
  return metrics.slice(-limit);
}

/**
 * Get aggregated SLA summary.
 */
export function getSlaSummary(): {
  totalEvents: number;
  recentCount: number;
  avgLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  maxLatencyMs: number | null;
  byType: Record<string, { count: number; avgLatencyMs: number | null }>;
  lastEventAt: number | null;
} {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 min window
  const recent = metrics.filter(m => now - m.recordedAt < windowMs);

  const withLatency = recent.filter(m => m.latencyMs !== null) as (MetricEntry & { latencyMs: number })[];
  const sorted = [...withLatency].sort((a, b) => a.latencyMs - b.latencyMs);

  // Avg
  const avgLatencyMs = sorted.length > 0
    ? sorted.reduce((sum, m) => sum + m.latencyMs, 0) / sorted.length
    : null;

  // Percentiles
  const p50LatencyMs = sorted.length > 0
    ? sorted[Math.floor(sorted.length * 0.5)]!.latencyMs
    : null;

  const p95LatencyMs = sorted.length > 0
    ? sorted[Math.floor(sorted.length * 0.95)]!.latencyMs
    : null;

  const maxLatencyMs = sorted.length > 0
    ? sorted[sorted.length - 1]!.latencyMs
    : null;

  // By type
  const byType: Record<string, { count: number; latencies: number[] }> = {};
  for (const m of recent) {
    const key = m.metric.entityType;
    if (!byType[key]) byType[key] = { count: 0, latencies: [] };
    byType[key].count++;
    if (m.latencyMs !== null) byType[key].latencies.push(m.latencyMs);
  }

  const byTypeResult: Record<string, { count: number; avgLatencyMs: number | null }> = {};
  for (const [key, val] of Object.entries(byType)) {
    byTypeResult[key] = {
      count: val.count,
      avgLatencyMs: val.latencies.length > 0
        ? val.latencies.reduce((s, v) => s + v, 0) / val.latencies.length
        : null,
    };
  }

  return {
    totalEvents: metrics.length,
    recentCount: recent.length,
    avgLatencyMs,
    p50LatencyMs,
    p95LatencyMs,
    maxLatencyMs,
    byType: byTypeResult,
    lastEventAt: metrics.length > 0 ? metrics[metrics.length - 1]!.recordedAt : null,
  };
}

/**
 * Reset all metrics (for testing).
 */
export function resetMetrics(): void {
  metrics.length = 0;
}
