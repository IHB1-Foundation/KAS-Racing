/**
 * Market Risk Service — Rate limiting, circuit breaker, and audit logging
 *
 * Protections:
 *  - Per-user bet rate limiting (max N requests per second)
 *  - Odds volatility circuit breaker (halt if change exceeds threshold)
 *  - Admin force lock/cancel with audit trail
 *  - All operator actions are logged
 */

// ── Rate Limiter (in-memory sliding window) ──

interface RateWindow {
  timestamps: number[];
}

const userRateWindows = new Map<string, RateWindow>();

const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_REQUESTS = parseInt(
  process.env.MARKET_RATE_LIMIT_PER_SEC ?? '5',
  10,
);

/**
 * Check if a user is within rate limits.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  let window = userRateWindows.get(userId);

  if (!window) {
    window = { timestamps: [] };
    userRateWindows.set(userId, window);
  }

  // Remove expired timestamps
  window.timestamps = window.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );

  if (window.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  window.timestamps.push(now);
  return true;
}

/**
 * Periodically clean up stale rate windows.
 */
export function cleanupRateWindows(): void {
  const now = Date.now();
  for (const [userId, window] of userRateWindows) {
    window.timestamps = window.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );
    if (window.timestamps.length === 0) {
      userRateWindows.delete(userId);
    }
  }
}

// ── Circuit Breaker (odds volatility) ──

const CIRCUIT_BREAKER_THRESHOLD_BPS = parseInt(
  process.env.MARKET_CIRCUIT_BREAKER_BPS ?? '3000',
  10,
); // 30% swing in one tick triggers halt

interface CircuitBreakerState {
  tripped: boolean;
  lastProbABps: number;
  trippedAt: number | null;
  reason: string | null;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Check odds change against circuit breaker threshold.
 * Returns true if OK, false if circuit breaker should trip.
 */
export function checkOddsCircuitBreaker(
  marketId: string,
  newProbABps: number,
): { allowed: boolean; reason?: string } {
  let state = circuitBreakers.get(marketId);

  if (!state) {
    state = {
      tripped: false,
      lastProbABps: 5000,
      trippedAt: null,
      reason: null,
    };
    circuitBreakers.set(marketId, state);
  }

  if (state.tripped) {
    return { allowed: false, reason: state.reason ?? 'Circuit breaker tripped' };
  }

  const change = Math.abs(newProbABps - state.lastProbABps);

  if (change > CIRCUIT_BREAKER_THRESHOLD_BPS) {
    state.tripped = true;
    state.trippedAt = Date.now();
    state.reason = `Odds swing ${change} bps exceeds threshold ${CIRCUIT_BREAKER_THRESHOLD_BPS} bps`;

    addAuditLog({
      action: 'circuit_breaker_tripped',
      marketId,
      details: state.reason,
      actor: 'system',
    });

    return { allowed: false, reason: state.reason };
  }

  state.lastProbABps = newProbABps;
  return { allowed: true };
}

/**
 * Reset circuit breaker for a market (admin action).
 */
export function resetCircuitBreaker(marketId: string, actor: string): void {
  circuitBreakers.delete(marketId);
  addAuditLog({
    action: 'circuit_breaker_reset',
    marketId,
    details: null,
    actor,
  });
}

/**
 * Clear circuit breaker state when market ends.
 */
export function clearCircuitBreaker(marketId: string): void {
  circuitBreakers.delete(marketId);
}

// ── Audit Log ──

export interface AuditEntry {
  timestamp: number;
  action: string;
  marketId: string | null;
  actor: string;
  details: string | null;
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 1000;

export function addAuditLog(entry: Omit<AuditEntry, 'timestamp'>): void {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: Date.now(),
  };

  auditLog.push(fullEntry);
  console.log(
    `[audit] ${fullEntry.action} | market=${fullEntry.marketId ?? '-'} | actor=${fullEntry.actor} | ${fullEntry.details ?? ''}`,
  );

  // Trim old entries
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG_SIZE);
  }
}

/**
 * Get recent audit entries.
 */
export function getAuditLog(limit: number = 50): AuditEntry[] {
  return auditLog.slice(-limit);
}

// ── Admin Actions ──

/**
 * Force lock a market (operator override).
 */
export function logAdminLock(marketId: string, actor: string, reason: string): void {
  addAuditLog({
    action: 'admin_force_lock',
    marketId,
    actor,
    details: reason,
  });
}

/**
 * Force cancel a market (operator override).
 */
export function logAdminCancel(marketId: string, actor: string, reason: string): void {
  addAuditLog({
    action: 'admin_force_cancel',
    marketId,
    actor,
    details: reason,
  });
}
