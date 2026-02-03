import { describe, expect, it } from 'vitest';
import {
  getEscrowMode,
  getExplorerUrl,
} from './escrowService.js';

describe('Escrow Service', () => {
  describe('getEscrowMode', () => {
    it('returns fallback mode for mainnet', () => {
      // Mainnet doesn't support covenant yet
      const mode = getEscrowMode('mainnet');
      expect(mode).toBe('fallback');
    });

    it('returns covenant mode for testnet', () => {
      // Testnet supports covenant
      const mode = getEscrowMode('testnet');
      expect(mode).toBe('covenant');
    });
  });

  describe('getExplorerUrl', () => {
    it('returns mainnet explorer URL', () => {
      const url = getExplorerUrl('abc123', 'mainnet');
      expect(url).toBe('https://explorer.kaspa.org/txs/abc123');
    });

    it('returns testnet explorer URL', () => {
      const url = getExplorerUrl('abc123', 'testnet');
      expect(url).toBe('https://explorer-tn11.kaspa.org/txs/abc123');
    });
  });

  // Note: getTreasuryAddress and generateMatchEscrowAddresses require
  // valid environment variables and kaspa-wasm, so they are tested
  // indirectly through the match API tests.
});
