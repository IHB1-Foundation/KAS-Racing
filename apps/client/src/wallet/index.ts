/**
 * Wallet Provider Module
 *
 * Provides abstraction layer for different Kaspa wallet implementations.
 * Allows swapping between Kasware (production) and Mock (UI development).
 */

export type {
  IWalletProvider,
  TransactionOptions,
  TransactionResult,
  WalletError,
  WalletProviderType,
} from './types';

export { WalletErrorCode, createWalletError } from './types';

export { KaswareProvider } from './KaswareProvider';
export { MockProvider } from './MockProvider';
export type { MockProviderOptions } from './MockProvider';

export { WalletProvider, useWallet, getWalletErrorMessage } from './WalletContext';

import type { IWalletProvider, WalletProviderType } from './types';
import { KaswareProvider } from './KaswareProvider';
import { MockProvider } from './MockProvider';
import type { MockProviderOptions } from './MockProvider';

/**
 * Create a wallet provider instance
 *
 * @param type - Provider type: 'kasware' for production, 'mock' for UI development
 * @param options - Options for mock provider (ignored for kasware)
 * @returns Wallet provider instance
 *
 * @example
 * // Production: Use Kasware
 * const wallet = createWalletProvider('kasware');
 *
 * // Development: Use Mock
 * const wallet = createWalletProvider('mock', { network: 'testnet' });
 */
export function createWalletProvider(
  type: WalletProviderType,
  options?: MockProviderOptions
): IWalletProvider {
  switch (type) {
    case 'kasware':
      return new KaswareProvider();
    case 'mock':
      return new MockProvider(options);
    default:
      throw new Error(`Unknown wallet provider type: ${String(type)}`);
  }
}

/**
 * Get the recommended wallet provider based on environment
 *
 * - If Kasware is available, use it
 * - Otherwise, fall back to mock (with warning)
 *
 * @returns Wallet provider instance
 */
export function getDefaultWalletProvider(): IWalletProvider {
  if (KaswareProvider.isAvailable()) {
    return new KaswareProvider();
  }

  console.warn(
    '[Wallet] Kasware not detected. Falling back to MockProvider for UI development.'
  );
  return new MockProvider({ network: 'testnet' });
}
