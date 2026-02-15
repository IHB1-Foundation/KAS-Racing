import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Address, type Hash, parseAbi } from 'viem';
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { kasplexTestnet } from './chains.js';

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

export type ApproveState = 'idle' | 'confirming' | 'submitted' | 'mined' | 'error';

export interface UseFuelTokenResult {
  allowance: bigint;
  approveState: ApproveState;
  approveTxHash: Hash | null;
  approveError: string | null;
  approve: (spender: Address, amount: bigint) => void;
  hasAllowance: (requiredAmount: bigint) => boolean;
  refreshAllowance: () => void;
}

export function useFuelToken(
  tokenAddress: Address | null,
  ownerAddress: Address | null,
  spenderAddress: Address | null,
): UseFuelTokenResult {
  const [approveState, setApproveState] = useState<ApproveState>('idle');
  const [approveError, setApproveError] = useState<string | null>(null);

  const {
    data: allowanceData,
    refetch,
  } = useReadContract({
    address: tokenAddress ?? undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    chainId: kasplexTestnet.id,
    query: {
      enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress,
      refetchInterval: 5_000,
    },
  });

  const {
    writeContract,
    data: approveTxHash,
    isPending: approvePending,
    error: writeError,
  } = useWriteContract();

  const { isSuccess: approveMined } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    confirmations: 1,
  });

  useEffect(() => {
    if (approveMined) {
      setApproveState('mined');
      void refetch();
    }
  }, [approveMined, refetch]);

  const approve = useCallback((spender: Address, amount: bigint) => {
    if (!tokenAddress) {
      setApproveError('kFUEL token address not configured');
      setApproveState('error');
      return;
    }

    setApproveState('confirming');
    setApproveError(null);

    writeContract(
      {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
        chainId: kasplexTestnet.id,
      },
      {
        onError: (error) => {
          setApproveError(parseApproveError(error));
          setApproveState('error');
        },
      },
    );
  }, [tokenAddress, writeContract]);

  const currentState: ApproveState = useMemo(() => {
    if (approveState === 'error') return 'error';
    if (approveMined) return 'mined';
    if (approveTxHash) return 'submitted';
    if (approvePending) return 'confirming';
    return approveState;
  }, [approveMined, approvePending, approveState, approveTxHash]);

  const currentError = approveError ?? (writeError ? parseApproveError(writeError) : null);
  const allowance = allowanceData ?? 0n;

  const hasAllowance = useCallback((requiredAmount: bigint) => allowance >= requiredAmount, [allowance]);
  const refreshAllowance = useCallback(() => { void refetch(); }, [refetch]);

  return {
    allowance,
    approveState: currentState,
    approveTxHash: approveTxHash ?? null,
    approveError: currentError,
    approve,
    hasAllowance,
    refreshAllowance,
  };
}

function parseApproveError(err: Error): string {
  const msg = err.message;
  if (msg.includes('rejected') || msg.includes('denied') || msg.includes('User rejected')) {
    return 'Approval rejected by user';
  }
  return msg.split('\n')[0] ?? msg;
}
