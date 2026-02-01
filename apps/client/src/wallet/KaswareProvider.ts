/**
 * Kasware Wallet Provider
 *
 * Integrates with the Kasware browser extension wallet.
 * Kasware injects `window.kasware` API when installed.
 *
 * @see https://kasware.xyz
 */

import {
  IWalletProvider,
  TransactionOptions,
  TransactionResult,
  WalletErrorCode,
  createWalletError,
} from './types';

/**
 * Kasware window API type definitions
 * Based on observed Kasware extension behavior
 */
interface KaswareApi {
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  disconnect(): Promise<void>;
  getNetwork(): Promise<string>;
  getBalance(): Promise<{
    confirmed: number;
    unconfirmed: number;
    total: number;
  }>;
  sendKaspa(
    toAddress: string,
    amount: number,
    options?: { priorityFee?: number }
  ): Promise<string>;
  on(event: string, callback: (data: unknown) => void): void;
  removeListener(event: string, callback: (data: unknown) => void): void;
}

declare global {
  interface Window {
    kasware?: KaswareApi;
  }
}

export class KaswareProvider implements IWalletProvider {
  readonly name = 'Kasware';
  private address: string | null = null;

  /**
   * Check if Kasware extension is installed
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.kasware;
  }

  async connect(): Promise<string> {
    if (!KaswareProvider.isAvailable()) {
      throw createWalletError(
        WalletErrorCode.NOT_INSTALLED,
        'Kasware wallet is not installed. Please install it from https://kasware.xyz'
      );
    }

    try {
      const accounts = await window.kasware!.requestAccounts();

      if (!accounts || accounts.length === 0) {
        throw createWalletError(
          WalletErrorCode.CONNECTION_REJECTED,
          'No accounts returned from Kasware'
        );
      }

      this.address = accounts[0];
      return this.address;
    } catch (err) {
      // Check if user rejected the connection
      const error = err as Error;
      if (
        error.message?.includes('rejected') ||
        error.message?.includes('denied')
      ) {
        throw createWalletError(
          WalletErrorCode.CONNECTION_REJECTED,
          'User rejected the connection request'
        );
      }
      throw createWalletError(
        WalletErrorCode.UNKNOWN,
        `Failed to connect to Kasware: ${error.message}`
      );
    }
  }

  async disconnect(): Promise<void> {
    if (KaswareProvider.isAvailable() && this.address) {
      try {
        await window.kasware!.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
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
    if (!this.isConnected()) {
      throw createWalletError(
        WalletErrorCode.NOT_CONNECTED,
        'Wallet is not connected'
      );
    }

    if (!KaswareProvider.isAvailable()) {
      throw createWalletError(
        WalletErrorCode.NOT_INSTALLED,
        'Kasware wallet is not available'
      );
    }

    try {
      // Kasware expects amount in sompi as number
      // Note: For very large amounts, precision might be lost
      const amountNumber = Number(amount);

      const sendOptions: { priorityFee?: number } = {};
      if (options?.priorityFee) {
        sendOptions.priorityFee = Number(options.priorityFee);
      }

      const txid = await window.kasware!.sendKaspa(to, amountNumber, sendOptions);

      return { txid };
    } catch (err) {
      const error = err as Error;

      if (
        error.message?.includes('rejected') ||
        error.message?.includes('denied') ||
        error.message?.includes('cancel')
      ) {
        throw createWalletError(
          WalletErrorCode.TRANSACTION_REJECTED,
          'User rejected the transaction'
        );
      }

      throw createWalletError(
        WalletErrorCode.TRANSACTION_FAILED,
        `Transaction failed: ${error.message}`
      );
    }
  }

  async getNetwork(): Promise<'mainnet' | 'testnet'> {
    if (!KaswareProvider.isAvailable()) {
      throw createWalletError(
        WalletErrorCode.NOT_INSTALLED,
        'Kasware wallet is not available'
      );
    }

    const network = await window.kasware!.getNetwork();

    // Kasware returns network name like 'mainnet' or 'testnet'
    if (network.toLowerCase().includes('mainnet')) {
      return 'mainnet';
    }
    return 'testnet';
  }

  /**
   * Refresh connection state by checking with Kasware
   * Useful after page reload to restore connection
   */
  async refreshConnection(): Promise<string | null> {
    if (!KaswareProvider.isAvailable()) {
      this.address = null;
      return null;
    }

    try {
      const accounts = await window.kasware!.getAccounts();
      if (accounts && accounts.length > 0) {
        this.address = accounts[0];
        return this.address;
      }
    } catch {
      // Ignore errors
    }

    this.address = null;
    return null;
  }
}
