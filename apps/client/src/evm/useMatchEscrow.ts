/**
 * useMatchEscrow — Hook for MatchEscrow contract interaction (deposit)
 *
 * Players call deposit(matchId) after approving kFUEL to MatchEscrow.
 * The server (operator) handles createMatch/settle — FE only needs deposit.
 */

import { useState, useCallback } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { type Address, type Hash, parseAbi } from 'viem';
import { kasplexTestnet } from './chains.js';

// Minimal ABI — only the functions the FE needs
const matchEscrowAbi = parseAbi([
  'function deposit(bytes32 matchId) external',
  'function getMatch(bytes32 matchId) view returns ((address player1, address player2, uint256 depositAmount, uint256 timeoutBlock, uint8 state, bool player1Deposited, bool player2Deposited))',
  'function isDeposited(bytes32 matchId, address player) view returns (bool)',
  'event Deposited(bytes32 indexed matchId, address indexed player, uint256 amount)',
  'event MatchFunded(bytes32 indexed matchId)',
]);

export type DepositState =
  | 'idle'
  | 'confirming'     // user confirming in wallet
  | 'submitted'      // tx sent, waiting for receipt
  | 'mined'          // receipt received
  | 'error';

export interface UseMatchEscrowResult {
  depositState: DepositState;
  depositTxHash: Hash | null;
  depositError: string | null;
  deposit: (matchIdBytes32: Hash) => void;
  reset: () => void;
  // Read helpers
  useIsDeposited: (escrowAddress: Address, matchIdBytes32: Hash | null, playerAddress: Address | null) => boolean | undefined;
}

export function useMatchEscrow(escrowAddress: Address | null): Omit<UseMatchEscrowResult, 'useIsDeposited'> {
  const [depositState, setDepositState] = useState<DepositState>('idle');
  const [depositError, setDepositError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  // Wait for tx receipt
  const { isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  // Derive state
  const currentState: DepositState = (() => {
    if (depositState === 'error') return 'error';
    if (isMined) return 'mined';
    if (txHash) return 'submitted';
    if (isPending) return 'confirming';
    return depositState;
  })();

  const currentError = depositError ?? (writeError ? parseWalletError(writeError) : null);

  const handleDeposit = useCallback(
    (matchIdBytes32: Hash) => {
      if (!escrowAddress) {
        setDepositError('Escrow contract address not configured');
        setDepositState('error');
        return;
      }

      setDepositState('confirming');
      setDepositError(null);

      writeContract(
        {
          address: escrowAddress,
          abi: matchEscrowAbi,
          functionName: 'deposit',
          args: [matchIdBytes32],
          chainId: kasplexTestnet.id,
        },
        {
          onError: (err) => {
            setDepositError(parseWalletError(err));
            setDepositState('error');
          },
        },
      );
    },
    [escrowAddress, writeContract],
  );

  const reset = useCallback(() => {
    setDepositState('idle');
    setDepositError(null);
  }, []);

  return {
    depositState: currentState,
    depositTxHash: txHash ?? null,
    depositError: currentError,
    deposit: handleDeposit,
    reset,
  };
}

/**
 * Standalone hook to check if a player has deposited (read-only contract call)
 */
export function useIsDeposited(
  escrowAddress: Address | null,
  matchIdBytes32: Hash | null,
  playerAddress: Address | null,
): boolean | undefined {
  const { data } = useReadContract({
    address: escrowAddress ?? undefined,
    abi: matchEscrowAbi,
    functionName: 'isDeposited',
    args: matchIdBytes32 && playerAddress ? [matchIdBytes32, playerAddress] : undefined,
    chainId: kasplexTestnet.id,
    query: {
      enabled: !!escrowAddress && !!matchIdBytes32 && !!playerAddress,
      refetchInterval: 5_000,
    },
  });

  return data;
}

function parseWalletError(err: Error): string {
  const msg = err.message;
  if (msg.includes('rejected') || msg.includes('denied') || msg.includes('User rejected')) {
    return 'Transaction rejected by user';
  }
  if (msg.includes('insufficient funds') || msg.includes('allowance') || msg.includes('transfer amount exceeds')) {
    return 'Insufficient kFUEL balance or approval';
  }
  if (msg.includes('already deposited')) {
    return 'Already deposited for this match';
  }
  // Return first line only for cleaner display
  return msg.split('\n')[0] ?? msg;
}
