/**
 * Reward Payout Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetConfigCache } from '../config/index.js';
import { kasToSompi, sompiToKas, SOMPI_PER_KAS } from './rewardPayout.js';

describe('Reward Payout Utils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfigCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfigCache();
  });

  describe('kasToSompi', () => {
    it('should convert 1 KAS to 100_000_000 sompi', () => {
      expect(kasToSompi(1)).toBe(BigInt(100_000_000));
    });

    it('should convert 0.02 KAS to 2_000_000 sompi', () => {
      expect(kasToSompi(0.02)).toBe(BigInt(2_000_000));
    });

    it('should convert 0.05 KAS to 5_000_000 sompi', () => {
      expect(kasToSompi(0.05)).toBe(BigInt(5_000_000));
    });

    it('should handle small amounts', () => {
      expect(kasToSompi(0.00000001)).toBe(BigInt(1));
    });
  });

  describe('sompiToKas', () => {
    it('should convert 100_000_000 sompi to 1 KAS', () => {
      expect(sompiToKas(BigInt(100_000_000))).toBe(1);
    });

    it('should convert 2_000_000 sompi to 0.02 KAS', () => {
      expect(sompiToKas(BigInt(2_000_000))).toBe(0.02);
    });
  });

  describe('SOMPI_PER_KAS', () => {
    it('should be 100_000_000', () => {
      expect(SOMPI_PER_KAS).toBe(BigInt(100_000_000));
    });
  });
});
