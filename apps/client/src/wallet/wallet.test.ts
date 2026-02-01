/**
 * Wallet Provider Tests
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockProvider } from './MockProvider';
import { KaswareProvider } from './KaswareProvider';
import {
  createWalletProvider,
  getDefaultWalletProvider,
  WalletErrorCode,
} from './index';

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider({
      simulatedDelay: 0, // No delay for tests
      network: 'testnet',
    });
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('Mock');
  });

  it('should not be connected initially', () => {
    expect(provider.isConnected()).toBe(false);
    expect(provider.getAddress()).toBeNull();
  });

  it('should connect and return address', async () => {
    const address = await provider.connect();
    expect(address).toMatch(/^kaspa:/);
    expect(provider.isConnected()).toBe(true);
    expect(provider.getAddress()).toBe(address);
  });

  it('should disconnect', async () => {
    await provider.connect();
    expect(provider.isConnected()).toBe(true);

    await provider.disconnect();
    expect(provider.isConnected()).toBe(false);
    expect(provider.getAddress()).toBeNull();
  });

  it('should return configured network', async () => {
    const network = await provider.getNetwork();
    expect(network).toBe('testnet');
  });

  it('should send transaction and return txid', async () => {
    await provider.connect();

    const result = await provider.sendTransaction(
      'kaspa:recipient',
      BigInt(100_000_000) // 1 KAS
    );

    expect(result.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should throw when sending without connection', async () => {
    await expect(
      provider.sendTransaction('kaspa:recipient', BigInt(100_000_000))
    ).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('should fail transactions when configured to fail', async () => {
    const failingProvider = new MockProvider({
      simulatedDelay: 0,
      failTransactions: true,
    });

    await failingProvider.connect();

    await expect(
      failingProvider.sendTransaction('kaspa:recipient', BigInt(100_000_000))
    ).rejects.toMatchObject({
      code: WalletErrorCode.TRANSACTION_FAILED,
    });
  });
});

describe('KaswareProvider', () => {
  beforeEach(() => {
    // Reset window.kasware
    delete (window as { kasware?: unknown }).kasware;
  });

  it('should have correct name', () => {
    const provider = new KaswareProvider();
    expect(provider.name).toBe('Kasware');
  });

  it('should report not available when kasware is not injected', () => {
    expect(KaswareProvider.isAvailable()).toBe(false);
  });

  it('should report available when kasware is injected', () => {
    (window as { kasware?: unknown }).kasware = {
      requestAccounts: vi.fn(),
    };
    expect(KaswareProvider.isAvailable()).toBe(true);
  });

  it('should throw NOT_INSTALLED when connecting without kasware', async () => {
    const provider = new KaswareProvider();

    await expect(provider.connect()).rejects.toMatchObject({
      code: WalletErrorCode.NOT_INSTALLED,
    });
  });

  it('should connect when kasware is available', async () => {
    const mockAddress = 'kaspa:qz0c8gf8lm54u4m3dw6p0z23vhfmryj8x7qxmq9k5v';
    (window as { kasware?: unknown }).kasware = {
      requestAccounts: vi.fn().mockResolvedValue([mockAddress]),
    };

    const provider = new KaswareProvider();
    const address = await provider.connect();

    expect(address).toBe(mockAddress);
    expect(provider.isConnected()).toBe(true);
  });
});

describe('createWalletProvider', () => {
  it('should create MockProvider', () => {
    const provider = createWalletProvider('mock');
    expect(provider.name).toBe('Mock');
  });

  it('should create KaswareProvider', () => {
    const provider = createWalletProvider('kasware');
    expect(provider.name).toBe('Kasware');
  });

  it('should throw for unknown type', () => {
    expect(() => createWalletProvider('unknown' as 'mock')).toThrow(
      'Unknown wallet provider type'
    );
  });
});

describe('getDefaultWalletProvider', () => {
  beforeEach(() => {
    delete (window as { kasware?: unknown }).kasware;
  });

  it('should return MockProvider when Kasware is not available', () => {
    const provider = getDefaultWalletProvider();
    expect(provider.name).toBe('Mock');
  });

  it('should return KaswareProvider when Kasware is available', () => {
    (window as { kasware?: unknown }).kasware = {
      requestAccounts: vi.fn(),
    };
    const provider = getDefaultWalletProvider();
    expect(provider.name).toBe('Kasware');
  });
});
