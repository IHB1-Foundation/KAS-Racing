/**
 * EVM Wallet Provider
 *
 * Wraps the app with wagmi + react-query providers.
 * Enforces KASPLEX Testnet (Chain ID 167012).
 */

import React, { useEffect } from 'react';
import { WagmiProvider, useReconnect } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './config.js';

const queryClient = new QueryClient();

interface EvmWalletProviderProps {
  children: React.ReactNode;
}

function EvmReconnectGate({ children }: { children: React.ReactNode }) {
  const { reconnect } = useReconnect();

  useEffect(() => {
    reconnect();
  }, [reconnect]);

  return <>{children}</>;
}

export function EvmWalletProvider({ children }: EvmWalletProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <EvmReconnectGate>{children}</EvmReconnectGate>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
