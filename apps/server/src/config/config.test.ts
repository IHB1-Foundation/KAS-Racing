/**
 * Config Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, resetConfigCache, safeLogConfig } from './index.js';

describe('Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfigCache();
    // Clear all relevant env vars
    delete process.env.NETWORK;
    delete process.env.TREASURY_PRIVATE_KEY;
    delete process.env.TREASURY_CHANGE_ADDRESS;
    delete process.env.ORACLE_PRIVATE_KEY;
    delete process.env.MIN_REWARD_KAS;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    resetConfigCache();
  });

  const validPrivateKey =
    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const validAddress = 'kaspa:qz0c8gf8lm54u4m3dw6p0z23vhfmryj8x7qxmq9k5v';

  describe('loadConfig', () => {
    it('should throw when TREASURY_PRIVATE_KEY is missing', () => {
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      expect(() => loadConfig()).toThrow('TREASURY_PRIVATE_KEY');
    });

    it('should throw when TREASURY_CHANGE_ADDRESS is missing', () => {
      process.env.TREASURY_PRIVATE_KEY = validPrivateKey;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      expect(() => loadConfig()).toThrow('TREASURY_CHANGE_ADDRESS');
    });

    it('should throw when ORACLE_PRIVATE_KEY is missing', () => {
      process.env.TREASURY_PRIVATE_KEY = validPrivateKey;
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;

      expect(() => loadConfig()).toThrow('ORACLE_PRIVATE_KEY');
    });

    it('should throw when private key format is invalid', () => {
      process.env.TREASURY_PRIVATE_KEY = 'not-a-valid-hex';
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      expect(() => loadConfig()).toThrow('Invalid format');
    });

    it('should throw when address format is invalid', () => {
      process.env.TREASURY_PRIVATE_KEY = validPrivateKey;
      process.env.TREASURY_CHANGE_ADDRESS = 'not-a-valid-address';
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      expect(() => loadConfig()).toThrow('Invalid Kaspa address');
    });

    it('should load valid config successfully', () => {
      process.env.NETWORK = 'testnet';
      process.env.TREASURY_PRIVATE_KEY = validPrivateKey;
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      const config = loadConfig();

      expect(config.network).toBe('testnet');
      expect(config.treasuryPrivateKey).toBe(validPrivateKey);
      expect(config.treasuryChangeAddress).toBe(validAddress);
      expect(config.oraclePrivateKey).toBe(validPrivateKey);
    });

    it('should default to testnet when NETWORK is not set', () => {
      process.env.TREASURY_PRIVATE_KEY = validPrivateKey;
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      const config = loadConfig();
      expect(config.network).toBe('testnet');
    });

    it('should default minRewardSompi to 0.02 KAS', () => {
      process.env.TREASURY_PRIVATE_KEY = validPrivateKey;
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      const config = loadConfig();
      expect(config.minRewardSompi).toBe(BigInt(2_000_000));
    });

    it('should parse custom MIN_REWARD_KAS', () => {
      process.env.TREASURY_PRIVATE_KEY = validPrivateKey;
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;
      process.env.MIN_REWARD_KAS = '0.05';

      const config = loadConfig();
      expect(config.minRewardSompi).toBe(BigInt(5_000_000));
    });

    it('should accept private key with 0x prefix', () => {
      process.env.TREASURY_PRIVATE_KEY = '0x' + validPrivateKey;
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      const config = loadConfig();
      expect(config.treasuryPrivateKey).toBe('0x' + validPrivateKey);
    });
  });

  describe('safeLogConfig', () => {
    it('should redact sensitive values', () => {
      process.env.TREASURY_PRIVATE_KEY = validPrivateKey;
      process.env.TREASURY_CHANGE_ADDRESS = validAddress;
      process.env.ORACLE_PRIVATE_KEY = validPrivateKey;

      const config = loadConfig();
      const safe = safeLogConfig(config);

      expect(safe.treasuryPrivateKey).toBe('[REDACTED]');
      expect(safe.oraclePrivateKey).toBe('[REDACTED]');
      expect(safe.treasuryChangeAddress).toBe(validAddress);
    });
  });
});
