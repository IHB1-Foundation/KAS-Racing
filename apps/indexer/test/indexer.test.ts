import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../src/config.js';
import type { ChainEvent, IndexerConfig, AddressUtxo } from '../src/types.js';

describe('loadConfig', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...origEnv };
  });

  it('throws if DATABASE_URL is missing', () => {
    delete process.env['DATABASE_URL'];
    expect(() => loadConfig()).toThrow('DATABASE_URL is required');
  });

  it('uses testnet defaults', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    const config = loadConfig();
    expect(config.network).toBe('testnet');
    expect(config.apiBaseUrl).toContain('tn11');
    expect(config.pollIntervalMs).toBe(3000);
    expect(config.idlePollIntervalMs).toBe(30000);
  });

  it('parses WATCH_ADDRESSES', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    process.env['WATCH_ADDRESSES'] = 'kaspatest:addr1,kaspatest:addr2';
    const config = loadConfig();
    expect(config.watchAddresses).toEqual(['kaspatest:addr1', 'kaspatest:addr2']);
  });

  it('handles empty WATCH_ADDRESSES', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    process.env['WATCH_ADDRESSES'] = '';
    const config = loadConfig();
    expect(config.watchAddresses).toEqual([]);
  });

  it('accepts custom poll intervals', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    process.env['POLL_INTERVAL_MS'] = '5000';
    process.env['IDLE_POLL_INTERVAL_MS'] = '60000';
    const config = loadConfig();
    expect(config.pollIntervalMs).toBe(5000);
    expect(config.idlePollIntervalMs).toBe(60000);
  });

  it('supports mainnet network', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    process.env['NETWORK'] = 'mainnet';
    const config = loadConfig();
    expect(config.network).toBe('mainnet');
    expect(config.apiBaseUrl).toBe('https://api.kaspa.org');
  });
});

describe('ChainEvent type structure', () => {
  it('can create a valid chain event', () => {
    const event: ChainEvent = {
      id: 'test-id',
      txid: 'abc123',
      eventType: 'deposit',
      matchId: 'match-001',
      sessionId: null,
      fromAddress: 'kaspatest:sender',
      toAddress: 'kaspatest:escrow',
      amountSompi: BigInt(50_000_000),
      daaScore: 12345,
      acceptedAt: new Date(),
      includedAt: null,
      confirmedAt: null,
      confirmations: 0,
      payload: null,
      indexedAt: new Date(),
    };
    expect(event.eventType).toBe('deposit');
    expect(event.amountSompi).toBe(BigInt(50_000_000));
  });

  it('supports all event types', () => {
    const types: ChainEvent['eventType'][] = ['deposit', 'settlement', 'refund', 'reward_payout'];
    expect(types).toHaveLength(4);
  });
});

describe('AddressUtxo type structure', () => {
  it('can parse a UTXO response', () => {
    const utxo: AddressUtxo = {
      address: 'kaspatest:qz0c_test',
      outpoint: {
        transactionId: 'abc123',
        index: 0,
      },
      utxoEntry: {
        amount: '50000000',
        scriptPublicKey: { scriptPublicKey: 'deadbeef' },
        blockDaaScore: '12345',
        isCoinbase: false,
      },
    };
    expect(utxo.outpoint.transactionId).toBe('abc123');
    expect(BigInt(utxo.utxoEntry.amount)).toBe(BigInt(50_000_000));
    expect(Number(utxo.utxoEntry.blockDaaScore)).toBe(12345);
  });
});

describe('IndexerConfig', () => {
  it('has correct default structure', () => {
    const config: IndexerConfig = {
      databaseUrl: 'postgres://localhost/test',
      network: 'testnet',
      apiBaseUrl: 'https://api-tn11.kaspa.org',
      pollIntervalMs: 3000,
      idlePollIntervalMs: 30000,
      startDaaScore: 0,
      watchAddresses: ['kaspatest:addr1'],
    };
    expect(config.network).toBe('testnet');
    expect(config.watchAddresses).toHaveLength(1);
  });
});
