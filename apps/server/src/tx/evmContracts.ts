/**
 * EVM Contract interaction wrappers
 *
 * High-level functions for MatchEscrow and RewardVault operations.
 * Each function handles encoding, sending, receipt tracking.
 */

import { type Address, type Hash, toHex, keccak256, toBytes, encodePacked } from "viem";
import { sendContractTx, getPublicClient, loadOperatorAccount, type TxResult } from "./evmClient.js";
import { matchEscrowAbi, rewardVaultAbi } from "./evmAbis.js";

// ─── Contract Addresses ──────────────────────────────────────

function getEscrowAddress(): Address {
  const addr = process.env.ESCROW_CONTRACT_ADDRESS;
  if (!addr || addr === "0x_TO_BE_DEPLOYED") {
    throw new Error("ESCROW_CONTRACT_ADDRESS not configured");
  }
  return addr as Address;
}

function getRewardAddress(): Address {
  const addr = process.env.REWARD_CONTRACT_ADDRESS;
  if (!addr || addr === "0x_TO_BE_DEPLOYED") {
    throw new Error("REWARD_CONTRACT_ADDRESS not configured");
  }
  return addr as Address;
}

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
  const client = getPublicClient();
  const result = await client.readContract({
    address: getRewardAddress(),
    abi: rewardVaultAbi,
    functionName: "isPaid",
    args: [sessionId, seq],
  });
  return result as boolean;
}

/**
 * Get vault balance
 */
export async function getVaultBalance(): Promise<bigint> {
  const client = getPublicClient();
  const result = await client.readContract({
    address: getRewardAddress(),
    abi: rewardVaultAbi,
    functionName: "vaultBalance",
  });
  return result as bigint;
}

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
