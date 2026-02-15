/**
 * EVM Contract interaction wrappers
 *
 * High-level functions for MatchEscrow and RewardVault operations.
 * Each function handles encoding, sending, receipt tracking.
 */

import { type Address, type Hash, keccak256, toBytes } from "viem";
import { sendContractTx, getPublicClient, type TxResult } from "./evmClient.js";
import { matchEscrowAbi, rewardVaultAbi } from "./evmAbis.js";
import { isE2EEnabled, nextMockTxHash } from "../utils/e2e.js";
import { getEscrowAddress, getRewardAddress } from "./evmAddresses.js";

// ─── MatchEscrow Operations ──────────────────────────────────

/**
 * Create a match on-chain
 */
export async function createMatchOnchain(params: {
  matchId: Hash;
  player1: Address;
  player2: Address;
  depositAmountWei: bigint;
}): Promise<TxResult> {
  if (isE2EEnabled()) {
    return { hash: nextMockTxHash(), receipt: null, success: true };
  }
  return sendContractTx({
    address: getEscrowAddress(),
    abi: matchEscrowAbi,
    functionName: "createMatch",
    args: [params.matchId, params.player1, params.player2, params.depositAmountWei],
  });
}

/**
 * Settle a match — pay the winner
 */
export async function settleMatch(params: {
  matchId: Hash;
  winner: Address;
}): Promise<TxResult> {
  if (isE2EEnabled()) {
    return { hash: nextMockTxHash(), receipt: null, success: true };
  }
  return sendContractTx({
    address: getEscrowAddress(),
    abi: matchEscrowAbi,
    functionName: "settle",
    args: [params.matchId, params.winner],
  });
}

/**
 * Settle a match as draw — refund both players
 */
export async function settleMatchDraw(matchId: Hash): Promise<TxResult> {
  if (isE2EEnabled()) {
    return { hash: nextMockTxHash(), receipt: null, success: true };
  }
  return sendContractTx({
    address: getEscrowAddress(),
    abi: matchEscrowAbi,
    functionName: "settleDraw",
    args: [matchId],
  });
}

/**
 * Cancel a match (before fully funded)
 */
export async function cancelMatch(matchId: Hash): Promise<TxResult> {
  if (isE2EEnabled()) {
    return { hash: nextMockTxHash(), receipt: null, success: true };
  }
  return sendContractTx({
    address: getEscrowAddress(),
    abi: matchEscrowAbi,
    functionName: "cancel",
    args: [matchId],
  });
}

/**
 * Read match state from contract
 */
export async function getMatchStateOnchain(matchId: Hash): Promise<number> {
  if (isE2EEnabled()) {
    return 0;
  }
  const client = getPublicClient();
  const result = await client.readContract({
    address: getEscrowAddress(),
    abi: matchEscrowAbi,
    functionName: "getMatchState",
    args: [matchId],
  });
  return Number(result);
}

// ─── RewardVault Operations ──────────────────────────────────

/**
 * Pay a reward to a player via RewardVault
 */
export async function payRewardOnchain(params: {
  sessionId: Hash;
  seq: bigint;
  recipient: Address;
  amountWei: bigint;
  proofHash: Hash;
  payload: `0x${string}`;
}): Promise<TxResult> {
  if (isE2EEnabled()) {
    return { hash: nextMockTxHash(), receipt: null, success: true };
  }
  return sendContractTx({
    address: getRewardAddress(),
    abi: rewardVaultAbi,
    functionName: "payReward",
    args: [
      params.sessionId,
      params.seq,
      params.recipient,
      params.amountWei,
      params.proofHash,
      params.payload,
    ],
  });
}

/**
 * Check if a reward has already been paid
 */
export async function isRewardPaid(sessionId: Hash, seq: bigint): Promise<boolean> {
  if (isE2EEnabled()) {
    return false;
  }
  const client = getPublicClient();
  const result = await client.readContract({
    address: getRewardAddress(),
    abi: rewardVaultAbi,
    functionName: "isPaid",
    args: [sessionId, seq],
  });
  return result === true;
}

/**
 * Get vault balance
 */
export async function getVaultBalance(): Promise<bigint> {
  if (isE2EEnabled()) {
    return 0n;
  }
  const client = getPublicClient();
  const result = await client.readContract({
    address: getRewardAddress(),
    abi: rewardVaultAbi,
    functionName: "vaultBalance",
  });
  return typeof result === "bigint" ? result : BigInt(result as string);
}

/**
 * Mint kFUEL to a recipient (faucet)
 */

// ─── Utility ─────────────────────────────────────────────────

/**
 * Generate a deterministic bytes32 match ID from a string
 */
export function toMatchId(matchIdString: string): Hash {
  return keccak256(toBytes(matchIdString));
}

/**
 * Generate a deterministic bytes32 session ID from a string
 */
export function toSessionId(sessionIdString: string): Hash {
  return keccak256(toBytes(sessionIdString));
}

/**
 * Build proof hash from game event data
 */
export function buildProofHash(data: {
  network: string;
  mode: string;
  sessionId: string;
  event: string;
  seq: number;
}): Hash {
  const payload = `KASRACE1|${data.network}|${data.mode}|${data.sessionId}|${data.event}|${data.seq}`;
  return keccak256(toBytes(payload));
}
