/**
 * Metrics Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordLatencyMetric,
  getRecentMetrics,
  getSlaSummary,
  resetMetrics,
  type LatencyMetric,
} from './metricsService.js';

describe('Metrics Service', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('recordLatencyMetric', () => {
    it('records a metric', () => {
      const metric: LatencyMetric = {
        entityType: 'reward',
        entityId: 'test-1',
        event: 'RewardPaid',
        txHash: '0xabc',
        blockNumber: '100',
        minedAt: Date.now(),
      };

      recordLatencyMetric(metric);
      const recent = getRecentMetrics(10);
      expect(recent.length).toBe(1);
      expect(recent[0]!.metric.entityId).toBe('test-1');
    });

    it('computes latency when submittedAt is provided', () => {
      const now = Date.now();
      recordLatencyMetric({
        entityType: 'match',
        entityId: 'test-2',
        event: 'Settled',
        txHash: '0xdef',
        blockNumber: '200',
        minedAt: now,
        submittedAt: now - 1500,
      });

      const recent = getRecentMetrics(10);
      expect(recent[0]!.latencyMs).toBe(1500);
    });

    it('sets latency to null without submittedAt', () => {
      recordLatencyMetric({
        entityType: 'deposit',
        entityId: 'test-3',
        event: 'Deposited',
        txHash: '0x123',
        blockNumber: '300',
        minedAt: Date.now(),
      });

      const recent = getRecentMetrics(10);
      expect(recent[0]!.latencyMs).toBeNull();
    });
  });

  describe('getSlaSummary', () => {
    it('returns empty summary when no metrics', () => {
      const summary = getSlaSummary();
      expect(summary.totalEvents).toBe(0);
      expect(summary.recentCount).toBe(0);
      expect(summary.avgLatencyMs).toBeNull();
    });

    it('computes aggregated stats', () => {
      const now = Date.now();

      recordLatencyMetric({
        entityType: 'reward',
        entityId: '1',
        event: 'RewardPaid',
        txHash: '0xa',
        blockNumber: '1',
        minedAt: now,
        submittedAt: now - 1000,
      });

      recordLatencyMetric({
        entityType: 'reward',
        entityId: '2',
        event: 'RewardPaid',
        txHash: '0xb',
        blockNumber: '2',
        minedAt: now,
        submittedAt: now - 3000,
      });

      const summary = getSlaSummary();
      expect(summary.totalEvents).toBe(2);
      expect(summary.recentCount).toBe(2);
      expect(summary.avgLatencyMs).toBe(2000);
      expect(summary.byType.reward).toBeDefined();
      expect(summary.byType.reward!.count).toBe(2);
    });

    it('tracks by entity type', () => {
      const now = Date.now();

      recordLatencyMetric({
        entityType: 'match',
        entityId: 'm1',
        event: 'Settled',
        txHash: '0x1',
        blockNumber: '1',
        minedAt: now,
        submittedAt: now - 500,
      });

      recordLatencyMetric({
        entityType: 'reward',
        entityId: 'r1',
        event: 'RewardPaid',
        txHash: '0x2',
        blockNumber: '2',
        minedAt: now,
        submittedAt: now - 2000,
      });

      const summary = getSlaSummary();
      expect(summary.byType.match?.count).toBe(1);
      expect(summary.byType.reward?.count).toBe(1);
      expect(summary.byType.match?.avgLatencyMs).toBe(500);
      expect(summary.byType.reward?.avgLatencyMs).toBe(2000);
    });
  });

  describe('getRecentMetrics', () => {
    it('respects limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        recordLatencyMetric({
          entityType: 'reward',
          entityId: `e${i}`,
          event: 'RewardPaid',
          txHash: `0x${i}`,
          blockNumber: String(i),
          minedAt: Date.now(),
        });
      }

      expect(getRecentMetrics(3).length).toBe(3);
      expect(getRecentMetrics(20).length).toBe(10);
    });
  });
});
