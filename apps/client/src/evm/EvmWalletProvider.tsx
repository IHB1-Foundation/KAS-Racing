/**
 * EVM Wallet Provider
 *
 * Wraps the app with wagmi + react-query providers.
 * Enforces KASPLEX Testnet (Chain ID 167012).
 */

import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './config.js';

const queryClient = new QueryClient();

interface EvmWalletProviderProps {
  children: React.ReactNode;
}

export function EvmWalletProvider({ children }: EvmWalletProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
