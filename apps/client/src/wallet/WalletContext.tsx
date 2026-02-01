/**
 * Wallet Context
 *
 * React context for wallet provider state management.
 * Provides wallet connection status and methods throughout the app.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { IWalletProvider, WalletError, WalletErrorCode } from './types';
import { getDefaultWalletProvider } from './index';

interface WalletContextState {
  /** Current wallet provider instance */
  provider: IWalletProvider;
  /** Connected wallet address, or null if not connected */
  address: string | null;
  /** Current network */
  network: 'mainnet' | 'testnet' | null;
  /** Whether wallet is currently connected */
  isConnected: boolean;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Last error that occurred */
  error: WalletError | null;
  /** Connect to wallet */
  connect: () => Promise<void>;
  /** Disconnect from wallet */
  disconnect: () => Promise<void>;
  /** Clear current error */
  clearError: () => void;
}

const WalletContext = createContext<WalletContextState | null>(null);

interface WalletProviderProps {
  /** Optional custom wallet provider (for testing) */
  provider?: IWalletProvider;
  children: React.ReactNode;
}

export function WalletProvider({ provider: customProvider, children }: WalletProviderProps) {
  const provider = useMemo(
    () => customProvider ?? getDefaultWalletProvider(),
    [customProvider]
  );

  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<WalletError | null>(null);

  const isConnected = address !== null;

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const addr = await provider.connect();
      setAddress(addr);

      try {
        const net = await provider.getNetwork();
        setNetwork(net);
      } catch {
        // Network fetch is non-critical
      }
    } catch (err) {
      const walletError = err as WalletError;
      setError(walletError);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    try {
      await provider.disconnect();
    } finally {
      setAddress(null);
      setNetwork(null);
    }
  }, [provider]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Try to restore connection on mount (for Kasware)
  useEffect(() => {
    const tryRestore = async () => {
      if ('refreshConnection' in provider) {
        const restored = await (provider as { refreshConnection: () => Promise<string | null> }).refreshConnection();
        if (restored) {
          setAddress(restored);
          try {
            const net = await provider.getNetwork();
            setNetwork(net);
          } catch {
            // Ignore
          }
        }
      }
    };
    void tryRestore();
  }, [provider]);

  const value: WalletContextState = {
    provider,
    address,
    network,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    clearError,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Hook to access wallet context
 *
 * @throws Error if used outside of WalletProvider
 */
export function useWallet(): WalletContextState {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

/**
 * Get user-friendly error message
 */
export function getWalletErrorMessage(error: WalletError): string {
  switch (error.code) {
    case WalletErrorCode.NOT_INSTALLED:
      return 'Kasware wallet is not installed. Please install it from kasware.xyz';
    case WalletErrorCode.CONNECTION_REJECTED:
      return 'Connection request was rejected. Please try again.';
    case WalletErrorCode.NOT_CONNECTED:
      return 'Wallet is not connected. Please connect first.';
    case WalletErrorCode.TRANSACTION_REJECTED:
      return 'Transaction was rejected.';
    case WalletErrorCode.TRANSACTION_FAILED:
      return 'Transaction failed. Please try again.';
    case WalletErrorCode.NETWORK_MISMATCH:
      return 'Network mismatch. Please switch to the correct network.';
    default:
      return error.message || 'An unknown wallet error occurred.';
  }
}
