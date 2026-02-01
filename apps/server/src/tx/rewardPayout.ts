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
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import { getConfig } from '../config/index.js';
import { getKaspaClient, getKaspaWasm, type UtxoEntry } from './kaspaClient.js';

// 1 KAS = 100,000,000 sompi
export const SOMPI_PER_KAS = BigInt(100_000_000);

// Default priority fee per transaction (1000 sompi = 0.00001 KAS)
// This is additional fee on top of the computed mass-based fee
export const DEFAULT_PRIORITY_FEE_SOMPI = BigInt(1000);

// Minimum output amount (dust threshold)
// Kaspa requires outputs to be at least 294 sompi (for script size)
export const MIN_OUTPUT_SOMPI = BigInt(546);

export interface PayoutRequest {
  /** Recipient address */
  toAddress: string;
  /** Amount in sompi (1 KAS = 100,000,000 sompi) */
  amountSompi: bigint;
  /** Optional payload to include in transaction (hex string) */
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
 * Get treasury address derived from private key
 */
async function getTreasuryAddress(): Promise<string> {
  const config = getConfig();
  const kaspa = await getKaspaWasm();

  // Derive address from private key
  const privateKey = new kaspa.PrivateKey(config.treasuryPrivateKey);
  const keypair = privateKey.toKeypair();
  const publicKey = keypair.publicKey as string;

  // Network type for address derivation
  const networkType = config.network === 'mainnet'
    ? kaspa.NetworkType.Mainnet
    : kaspa.NetworkType.Testnet;

  const address = kaspa.createAddress(publicKey, networkType);
  // kaspa Address has toString() method
  const addrObj = address as { toString(): string };
  return addrObj.toString();
}

/**
 * Get UTXOs for treasury address
 */
async function getTreasuryUtxos(): Promise<UtxoEntry[]> {
  const client = await getKaspaClient();
  const treasuryAddress = await getTreasuryAddress();

  console.log(`[payout] Fetching UTXOs for treasury: ${treasuryAddress}`);

  const response = await client.getUtxosByAddresses([treasuryAddress]);

  const utxos = response.entries ?? [];
  console.log(`[payout] Found ${utxos.length} UTXOs`);

  return utxos;
}

/**
 * Select UTXOs to cover the required amount + fee
 *
 * Uses simple "largest first" strategy for simplicity.
 * Production should consider mass/fee optimization.
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
 * Uses kaspa-wasm for transaction creation, signing, and broadcast.
 */
export async function sendRewardPayout(
  request: PayoutRequest
): Promise<PayoutResult> {
  validatePayoutRequest(request);

  const config = getConfig();
  const kaspa = await getKaspaWasm();
  const rpcClient = await getKaspaClient();

  // Get treasury private key
  const privateKey = new kaspa.PrivateKey(config.treasuryPrivateKey);

  // Get UTXOs from treasury address
  const allUtxos = await getTreasuryUtxos();

  if (allUtxos.length === 0) {
    throw new Error('No UTXOs available in treasury');
  }

  // Estimate fee: priority fee + margin for mass calculation
  // Mass fee is computed automatically by createTransaction
  const priorityFee = DEFAULT_PRIORITY_FEE_SOMPI;
  const feeMargin = BigInt(5000); // Extra margin for safety
  const estimatedFee = priorityFee + feeMargin;

  // Select UTXOs to cover amount + estimated fee
  const requiredSompi = request.amountSompi + estimatedFee;
  const { selected: selectedUtxos, total: inputTotal } = selectUtxos(
    allUtxos,
    requiredSompi
  );

  console.log(
    `[payout] Selected ${selectedUtxos.length} UTXOs, total: ${inputTotal} sompi`
  );
  console.log(`[payout] Payout: ${request.amountSompi} sompi to ${request.toAddress}`);

  // Prepare UTXO entries for kaspa-wasm
  // Convert our UtxoEntry format to kaspa-wasm format
  const utxoEntries = selectedUtxos.map((u) => ({
    address: u.address,
    outpoint: {
      transactionId: u.outpoint.transactionId,
      index: u.outpoint.index,
    },
    utxoEntry: {
      amount: BigInt(u.utxoEntry.amount),
      scriptPublicKey: u.utxoEntry.scriptPublicKey,
      blockDaaScore: BigInt(u.utxoEntry.blockDaaScore),
      isCoinbase: u.utxoEntry.isCoinbase,
    },
  }));

  // Prepare outputs
  const recipientAddress = new kaspa.Address(request.toAddress);
  const outputs = [
    {
      address: recipientAddress,
      amount: request.amountSompi,
    },
  ];

  // Change address
  const changeAddress = new kaspa.Address(config.treasuryChangeAddress);

  // Prepare payload if provided
  const payload = request.payload
    ? new TextEncoder().encode(request.payload)
    : undefined;

  // Create transaction using kaspa-wasm
  // createTransaction(utxo_entry_source, outputs, change_address, priority_fee, payload, sig_op_count, minimum_signatures)
  const signableTransaction = kaspa.createTransaction(
    utxoEntries,
    outputs,
    changeAddress,
    priorityFee,
    payload,
    1, // sig_op_count (1 signature per input)
    1  // minimum_signatures (1 for standard P2PK)
  );

  console.log('[payout] Transaction created, signing...');

  // Sign the transaction
  const signedTransaction = kaspa.signTransaction(
    signableTransaction,
    [privateKey],
    true // verify_sig
  );

  console.log('[payout] Transaction signed, submitting...');

  // Submit to network
  const txid = await rpcClient.submitTransaction(signedTransaction);

  // Calculate actual fee from transaction
  // For now, use the priority fee + estimated overhead
  const actualFee = priorityFee;

  console.log(`[payout] Transaction submitted: ${txid}`);

  return {
    txid,
    amountSompi: request.amountSompi,
    feeSompi: actualFee,
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

/**
 * Check if an amount is above dust threshold
 */
export function isAboveDust(sompi: bigint): boolean {
  return sompi >= MIN_OUTPUT_SOMPI;
}
