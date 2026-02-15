/**
 * Mock Wallet Provider
 *
 * IMPORTANT: This provider is for UI development and testing ONLY.
 * It MUST NOT be used for actual on-chain payments, deposits, or settlements.
 *
 * Per PROJECT.md:
 * "Mock은 UI 개발 보조용으로만 허용하며, 지급/입금/정산의 핵심 경로에는 절대 쓰지 마라."
 */

import type {
  IWalletProvider,
  TransactionOptions,
  TransactionResult,
} from './types';
import {
  WalletErrorCode,
  createWalletError,
} from './types';

export interface MockProviderOptions {
  /** Mock address to use */
  address?: string;
  /** Network to simulate */
  network?: 'mainnet' | 'testnet';
  /** Delay in ms to simulate network latency */
  simulatedDelay?: number;
  /** If true, sendTransaction will fail */
  failTransactions?: boolean;
}

const DEFAULT_MOCK_ADDRESS =
  'kaspa:qz0c8gf8lm54u4m3dw6p0z23vhfmryj8x7qxmq9k5v';

/**
 * Generate a fake transaction ID
 */
function generateMockTxid(): string {
  const chars = '0123456789abcdef';
  let txid = '';
  for (let i = 0; i < 64; i++) {
    txid += chars[Math.floor(Math.random() * chars.length)];
  }
  return txid;
}

export class MockProvider implements IWalletProvider {
  readonly name = 'Mock';
  private address: string | null = null;
  private readonly mockAddress: string;
  private readonly network: 'mainnet' | 'testnet';
  private readonly simulatedDelay: number;
  private readonly failTransactions: boolean;

  constructor(options: MockProviderOptions = {}) {
    this.mockAddress = options.address ?? DEFAULT_MOCK_ADDRESS;
    this.network = options.network ?? 'testnet';
    this.simulatedDelay = options.simulatedDelay ?? 500;
    this.failTransactions = options.failTransactions ?? false;

    // Log warning in development
    if (typeof console !== 'undefined') {
      console.warn(
        '[MockProvider] Using mock wallet. This is for UI development only!'
      );
    }
  }

  private async delay(): Promise<void> {
    if (this.simulatedDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedDelay));
    }
  }

  async connect(): Promise<string> {
    await this.delay();
    this.address = this.mockAddress;
    return this.address;
  }

  async disconnect(): Promise<void> {
    await this.delay();
    this.address = null;
  }

  isConnected(): boolean {
    return this.address !== null;
  }

  getAddress(): string | null {
    return this.address;
  }

  async sendTransaction(
    to: string,
    amount: bigint,
    options?: TransactionOptions
  ): Promise<TransactionResult> {
    // options currently unused but kept for interface compatibility
    void options;
    if (!this.isConnected()) {
      throw createWalletError(
        WalletErrorCode.NOT_CONNECTED,
        'Wallet is not connected'
      );
    }

    await this.delay();

    if (this.failTransactions) {
      throw createWalletError(
        WalletErrorCode.TRANSACTION_FAILED,
        'Mock transaction failed (configured to fail)'
      );
    }

    // Log for development visibility
    if (typeof console !== 'undefined') {
      console.log('[MockProvider] Simulated transaction:', {
        from: this.address,
        to,
        amount: amount.toString(),
        amountKAS: Number(amount) / 100_000_000,
      });
    }

    const txid = generateMockTxid();
    return { txid };
  }

  getNetwork(): Promise<'mainnet' | 'testnet'> {
    return Promise.resolve(this.network);
  }
}
