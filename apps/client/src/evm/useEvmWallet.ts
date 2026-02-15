/**
 * useEvmWallet — EVM wallet hook for KASPLEX zkEVM
 *
 * Wraps wagmi hooks into a simple interface matching the app's needs:
 *   address, isConnected, connect, disconnect, chainId, switchChain
 */

import { useAccount, useConnect, useDisconnect, useSwitchChain, useBalance } from 'wagmi';
import { useCallback, useMemo } from 'react';
import { formatUnits } from 'viem';
import { kasplexTestnet } from './chains.js';

export interface EvmWalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | undefined;
  isCorrectChain: boolean;
  balance: string | null; // formatted KAS
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  switchToKasplex: () => void;
}

export function useEvmWallet(): EvmWalletState {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const { data: balanceData } = useBalance({
    address,
  });

  const isCorrectChain = chainId === kasplexTestnet.id;

  const handleConnect = useCallback(() => {
    // Prefer MetaMask, then first available injected connector
    const metamask = connectors.find(c => c.id === 'io.metamask' || c.name.toLowerCase().includes('metamask'));
    const connector = metamask ?? connectors[0];
    if (connector) {
      connect({ connector, chainId: kasplexTestnet.id });
    }
  }, [connect, connectors]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleSwitchToKasplex = useCallback(() => {
    switchChain({ chainId: kasplexTestnet.id });
  }, [switchChain]);

  const error = useMemo(() => {
    if (connectError) {
      if (connectError.message.includes('rejected') || connectError.message.includes('denied')) {
        return 'Connection rejected. Please try again.';
      }
      return connectError.message;
    }
    return null;
  }, [connectError]);

  return {
    address: address ?? null,
    isConnected,
    isConnecting,
    chainId,
    isCorrectChain,
    balance: balanceData ? formatUnits(balanceData.value, balanceData.decimals) : null,
    error,
    connect: handleConnect,
    disconnect: handleDisconnect,
    switchToKasplex: handleSwitchToKasplex,
  };
}
