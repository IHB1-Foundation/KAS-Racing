import { useMemo } from 'react';
import { formatUnits, parseAbi, type Address } from 'viem';
import { useReadContract } from 'wagmi';
import { formatEvmAddress, kasplexTestnet } from '../evm';
import { isE2E } from '../e2e.js';

const PROD_KFUEL_TOKEN_ADDRESS = '0xF8B8D3b674baE33f8f9b4775F9AEd2D487C0Cd8D';
const erc20BalanceAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
]);

interface SidebarWalletBalancesProps {
  address: string | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  kasBalance: string | null;
  tokenAddress?: Address | null;
}

export function SidebarWalletBalances({
  address,
  isConnected,
  isCorrectChain,
  kasBalance,
  tokenAddress,
}: SidebarWalletBalancesProps) {
  const defaultTokenAddress = useMemo(() => {
    const raw = import.meta.env.VITE_KFUEL_TOKEN_ADDRESS as string | undefined;
    if (import.meta.env.DEV) {
      return (raw && raw.length > 0 ? raw : null) as Address | null;
    }
    return (raw && raw.length > 0 ? raw : PROD_KFUEL_TOKEN_ADDRESS) as Address;
  }, []);

  const effectiveTokenAddress = tokenAddress ?? defaultTokenAddress;

  const { data: kfuelBalanceWei } = useReadContract({
    address: effectiveTokenAddress ?? undefined,
    abi: erc20BalanceAbi,
    functionName: 'balanceOf',
    args: address ? [address as Address] : undefined,
    chainId: kasplexTestnet.id,
    query: {
      enabled: !isE2E && isConnected && isCorrectChain && !!effectiveTokenAddress && !!address,
      refetchInterval: 10_000,
    },
  });

  const kasText = useMemo(() => {
    if (!isConnected) return '-';
    if (!isCorrectChain) return 'Wrong Network';
    if (!kasBalance) return '...';
    return `${toFixed4(kasBalance)} KAS`;
  }, [isConnected, isCorrectChain, kasBalance]);

  const kfuelText = useMemo(() => {
    if (!isConnected) return '-';
    if (!isCorrectChain) return 'Wrong Network';
    if (!effectiveTokenAddress) return 'Not Configured';
    if (isE2E) return `${toFixed4(formatUnits(10_000n * 10n ** 18n, 18))} kFUEL`;
    if (typeof kfuelBalanceWei !== 'bigint') return '...';
    return `${toFixed4(formatUnits(kfuelBalanceWei, 18))} kFUEL`;
  }, [effectiveTokenAddress, isConnected, isCorrectChain, kfuelBalanceWei]);

  return (
    <section className="sidebar-wallet-card">
      <h3>Wallet</h3>
      <div className="match-info" style={{ marginTop: '8px' }}>
        <div className="stat-item">
          <span className="stat-label">Address</span>
          <span className="stat-value sidebar-wallet-address">
            {address ? formatEvmAddress(address) : '-'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Network</span>
          <span className="stat-value">
            {!isConnected ? '-' : (isCorrectChain ? 'KASPLEX Testnet' : 'Wrong Network')}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">KAS</span>
          <span className="stat-value">{kasText}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">kFUEL</span>
          <span className="stat-value">{kfuelText}</span>
        </div>
      </div>
    </section>
  );
}

function toFixed4(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toFixed(4);
}
