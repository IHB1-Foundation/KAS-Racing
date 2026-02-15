import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  checkOddsCircuitBreaker,
  resetCircuitBreaker,
  getAuditLog,
  addAuditLog,
} from './marketRiskService.js';

describe('checkRateLimit', () => {
  it('allows requests under limit', () => {
    const userId = `user_${Date.now()}_1`;
    expect(checkRateLimit(userId)).toBe(true);
    expect(checkRateLimit(userId)).toBe(true);
    expect(checkRateLimit(userId)).toBe(true);
  });

  it('blocks requests over limit (5 per second)', () => {
    const userId = `user_${Date.now()}_2`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(userId)).toBe(true);
    }
    // 6th request should be blocked
    expect(checkRateLimit(userId)).toBe(false);
  });
});

describe('checkOddsCircuitBreaker', () => {
  it('allows normal odds changes', () => {
    const marketId = `market_${Date.now()}_1`;
    const result = checkOddsCircuitBreaker(marketId, 5200); // +200 bps from 5000
    expect(result.allowed).toBe(true);
  });

  it('trips on extreme odds swing', () => {
    const marketId = `market_${Date.now()}_2`;
    // First call establishes baseline at 5000
    checkOddsCircuitBreaker(marketId, 5000);
    // Second call with massive swing
    const result = checkOddsCircuitBreaker(marketId, 9000); // +4000 bps
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('exceeds threshold');
  });

  it('stays tripped once tripped', () => {
    const marketId = `market_${Date.now()}_3`;
    checkOddsCircuitBreaker(marketId, 5000);
    checkOddsCircuitBreaker(marketId, 9000); // trip
    const result = checkOddsCircuitBreaker(marketId, 5100); // even small change blocked
    expect(result.allowed).toBe(false);
  });

  it('can be reset by admin', () => {
    const marketId = `market_${Date.now()}_4`;
    checkOddsCircuitBreaker(marketId, 5000);
    checkOddsCircuitBreaker(marketId, 9000); // trip
    resetCircuitBreaker(marketId, 'admin');
    const result = checkOddsCircuitBreaker(marketId, 5100);
    expect(result.allowed).toBe(true);
  });
});

describe('auditLog', () => {
  it('records entries with timestamps', () => {
    addAuditLog({
      action: 'test_action',
      marketId: 'test-market',
      actor: 'test',
      details: 'test details',
    });

    const entries = getAuditLog(1);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const last = entries[entries.length - 1]!;
    expect(last.action).toBe('test_action');
    expect(last.timestamp).toBeGreaterThan(0);
  });
});
