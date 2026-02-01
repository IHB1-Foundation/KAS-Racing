/**
 * Reward Payout TX Builder
 *
 * Creates, signs, and broadcasts reward payment transactions.
 * Uses treasury wallet to send rewards to players.
 *
 * Transaction structure:
 * - Input: Treasury UTXO(s)
 * - Output 1: User address (reward amount)
 * - Output 2: Treasury change address (remaining balance - fee)
 *
 * NOTE: This is a skeleton implementation. Full kaspa-wasm transaction
 * building will be completed when testnet environment is ready.
 */

import { getConfig } from '../config/index.js';
import { getKaspaClient, type UtxoEntry } from './kaspaClient.js';

// 1 KAS = 100,000,000 sompi
export const SOMPI_PER_KAS = BigInt(100_000_000);

// Default fee per transaction (1000 sompi = 0.00001 KAS)
export const DEFAULT_FEE_SOMPI = BigInt(1000);

export interface PayoutRequest {
  /** Recipient address */
  toAddress: string;
  /** Amount in sompi (1 KAS = 100,000,000 sompi) */
  amountSompi: bigint;
  /** Optional payload to include in transaction */
  payload?: string;
}

export interface PayoutResult {
  /** Transaction ID (hash) */
  txid: string;
  /** Amount sent in sompi */
  amountSompi: bigint;
  /** Fee paid in sompi */
  feeSompi: bigint;
}

/**
 * Validate payout request
 */
function validatePayoutRequest(request: PayoutRequest): void {
  const config = getConfig();

  if (!request.toAddress) {
    throw new Error('Recipient address is required');
  }

  if (request.amountSompi <= 0n) {
    throw new Error('Amount must be positive');
  }

  if (request.amountSompi < config.minRewardSompi) {
    throw new Error(
      `Amount ${request.amountSompi} sompi is below minimum ${config.minRewardSompi} sompi`
    );
  }
}

/**
 * Get treasury address from config
 */
function getTreasuryAddress(): string {
  const config = getConfig();
  // In real implementation, derive from private key
  // For now, use the change address as the treasury address
  return config.treasuryChangeAddress;
}

/**
 * Get UTXOs for treasury address
 */
async function getTreasuryUtxos(): Promise<UtxoEntry[]> {
  const client = await getKaspaClient();
  const treasuryAddress = getTreasuryAddress();

  console.log(`[payout] Fetching UTXOs for treasury: ${treasuryAddress}`);

  const response = await client.getUtxosByAddresses([treasuryAddress]);

  const utxos = response.entries ?? [];
  console.log(`[payout] Found ${utxos.length} UTXOs`);

  return utxos;
}

/**
 * Select UTXOs to cover the required amount + fee
 *
 * Uses simple "largest first" strategy
 */
function selectUtxos(
  utxos: UtxoEntry[],
  requiredSompi: bigint
): { selected: UtxoEntry[]; total: bigint } {
  // Sort by amount descending (largest first)
  const sorted = [...utxos].sort((a, b) => {
    const aAmount = BigInt(a.utxoEntry.amount);
    const bAmount = BigInt(b.utxoEntry.amount);
    return bAmount > aAmount ? 1 : bAmount < aAmount ? -1 : 0;
  });

  const selected: UtxoEntry[] = [];
  let total = 0n;

  for (const utxo of sorted) {
    if (total >= requiredSompi) break;

    selected.push(utxo);
    total += BigInt(utxo.utxoEntry.amount);
  }

  if (total < requiredSompi) {
    throw new Error(
      `Insufficient funds: have ${total} sompi, need ${requiredSompi} sompi`
    );
  }

  return { selected, total };
}

/**
 * Build, sign, and broadcast a reward payout transaction
 *
 * NOTE: Currently uses placeholder RPC client.
 * Real implementation will use kaspa-wasm for transaction building.
 */
export async function sendRewardPayout(
  request: PayoutRequest
): Promise<PayoutResult> {
  validatePayoutRequest(request);

  const config = getConfig();
  const client = await getKaspaClient();

  // Get UTXOs
  const allUtxos = await getTreasuryUtxos();

  // Calculate required amount (reward + fee)
  const feeSompi = DEFAULT_FEE_SOMPI;
  const requiredSompi = request.amountSompi + feeSompi;

  // Select UTXOs
  const { selected: selectedUtxos, total: inputTotal } = selectUtxos(
    allUtxos,
    requiredSompi
  );

  console.log(
    `[payout] Selected ${selectedUtxos.length} UTXOs, total: ${inputTotal} sompi`
  );

  // Calculate change
  const changeSompi = inputTotal - request.amountSompi - feeSompi;

  console.log(`[payout] Payout: ${request.amountSompi} sompi to ${request.toAddress}`);
  console.log(`[payout] Change: ${changeSompi} sompi to ${config.treasuryChangeAddress}`);
  console.log(`[payout] Fee: ${feeSompi} sompi`);

  // TODO: Build actual transaction with kaspa-wasm
  // 1. Create transaction inputs from selected UTXOs
  // 2. Create transaction outputs (recipient + change)
  // 3. Sign with treasury private key
  // 4. Submit to network

  // For now, use placeholder RPC which returns mock txid
  console.warn('[payout] Using placeholder - no real transaction sent');
  const result = await client.submitTransaction({
    transaction: {
      inputs: selectedUtxos.map((u) => u.outpoint),
      outputs: [
        { address: request.toAddress, amount: request.amountSompi.toString() },
        { address: config.treasuryChangeAddress, amount: changeSompi.toString() },
      ],
    },
    allowOrphan: false,
  });

  const txid = result.transactionId;
  console.log(`[payout] Transaction submitted: ${txid}`);

  return {
    txid,
    amountSompi: request.amountSompi,
    feeSompi,
  };
}

/**
 * Convert KAS to sompi
 */
export function kasToSompi(kas: number): bigint {
  return BigInt(Math.floor(kas * Number(SOMPI_PER_KAS)));
}

/**
 * Convert sompi to KAS (for display)
 */
export function sompiToKas(sompi: bigint): number {
  return Number(sompi) / Number(SOMPI_PER_KAS);
}
