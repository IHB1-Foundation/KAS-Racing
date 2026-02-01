/**
 * Wallet Provider Abstraction for KAS Racing
 *
 * This interface allows swapping between different wallet implementations
 * (Kasware, future wallets, mock for UI testing).
 */

export interface TransactionOptions {
  /** Optional memo/payload to include in transaction */
  payload?: string;
  /** Priority fee in sompi (optional) */
  priorityFee?: bigint;
}

export interface TransactionResult {
  /** Transaction ID (hash) */
  txid: string;
}

export interface IWalletProvider {
  /** Provider name for identification */
  readonly name: string;

  /**
   * Connect to the wallet
   * @returns The connected wallet address
   * @throws Error if connection fails (user rejected, wallet not installed, etc.)
   */
  connect(): Promise<string>;

  /**
   * Disconnect from the wallet
   */
  disconnect(): Promise<void>;

  /**
   * Check if wallet is currently connected
   */
  isConnected(): boolean;

  /**
   * Get the current connected address
   * @returns The address or null if not connected
   */
  getAddress(): string | null;

  /**
   * Send a transaction
   * @param to - Recipient address
   * @param amount - Amount in sompi (1 KAS = 100_000_000 sompi)
   * @param options - Optional transaction options
   * @returns Transaction result with txid
   * @throws Error if transaction fails
   */
  sendTransaction(
    to: string,
    amount: bigint,
    options?: TransactionOptions
  ): Promise<TransactionResult>;

  /**
   * Get the current network (mainnet/testnet)
   */
  getNetwork(): Promise<'mainnet' | 'testnet'>;
}

export type WalletProviderType = 'kasware' | 'mock';

export interface WalletError extends Error {
  code: WalletErrorCode;
}

export enum WalletErrorCode {
  NOT_INSTALLED = 'NOT_INSTALLED',
  CONNECTION_REJECTED = 'CONNECTION_REJECTED',
  NOT_CONNECTED = 'NOT_CONNECTED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',
  UNKNOWN = 'UNKNOWN',
}

export function createWalletError(
  code: WalletErrorCode,
  message: string
): WalletError {
  const error = new Error(message) as WalletError;
  error.code = code;
  return error;
}
