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
import { normalizeEvmAddress } from './formatAddress.js';
import { isE2E } from '../e2e.js';

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
  const { connectAsync, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const e2eDisconnected =
    isE2E && typeof window !== 'undefined' && window.localStorage.getItem('e2eDisconnected') === 'true';
  const e2eWrongChain =
    isE2E && typeof window !== 'undefined' && window.localStorage.getItem('e2eWrongChain') === 'true';
  const e2eWalletError =
    isE2E && typeof window !== 'undefined'
      ? window.localStorage.getItem('e2eWalletError')
      : null;

  const { data: balanceData } = useBalance({
    address,
    query: {
      enabled: !isE2E && !!address,
    },
  });

  const isCorrectChain = chainId === kasplexTestnet.id;

  const handleConnect = useCallback(() => {
    // Prefer MetaMask, then first available injected connector
    const metamask = connectors.find(c => c.id === 'io.metamask' || c.name.toLowerCase().includes('metamask'));
    const connector = metamask ?? connectors[0];
    if (!connector) return;

    void connectAsync({ connector, chainId: kasplexTestnet.id })
      .catch(() => connectAsync({ connector }).catch(() => {}));
  }, [connectAsync, connectors]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleSwitchToKasplex = useCallback(() => {
    switchChain({ chainId: kasplexTestnet.id });
  }, [switchChain]);

  const error = useMemo(() => {
    if (e2eWalletError) {
      return e2eWalletError;
    }
    if (connectError) {
      if (connectError.message.includes('rejected') || connectError.message.includes('denied')) {
        return 'Connection rejected. Please try again.';
      }
      return connectError.message;
    }
    return null;
  }, [connectError, e2eWalletError]);

  const normalizedAddress = useMemo(() => {
    const normalized = normalizeEvmAddress(address ?? null);
    return normalized ?? (address ?? null);
  }, [address]);

  const effectiveIsConnected = e2eDisconnected ? false : isConnected;
  const effectiveAddress = e2eDisconnected ? null : normalizedAddress;
  const effectiveChainId = e2eDisconnected ? undefined : (e2eWrongChain ? 1 : chainId);
  const effectiveIsCorrectChain = e2eDisconnected ? false : (e2eWrongChain ? false : isCorrectChain);

  return {
    address: effectiveAddress,
    isConnected: effectiveIsConnected,
    isConnecting,
    chainId: effectiveChainId,
    isCorrectChain: effectiveIsCorrectChain,
    balance: balanceData ? formatUnits(balanceData.value, balanceData.decimals) : null,
    error,
    connect: handleConnect,
    disconnect: handleDisconnect,
    switchToKasplex: handleSwitchToKasplex,
  };
}
