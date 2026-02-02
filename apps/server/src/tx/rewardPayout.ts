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

import { getConfig } from '../config/index.js';
import { getKaspaRestClient, type RestUtxoEntry } from './kaspaRestClient.js';

// 1 KAS = 100,000,000 sompi
export const SOMPI_PER_KAS = BigInt(100_000_000);

// Default priority fee per transaction (5000 sompi = 0.00005 KAS)
// This is the fee we subtract from total
export const DEFAULT_PRIORITY_FEE_SOMPI = BigInt(5000);

// Minimum output amount (dust threshold)
// Kaspa requires outputs to be at least this amount
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

// Module-level kaspa-wasm (loaded dynamically)
let kaspaWasm: typeof import('kaspa-wasm') | null = null;

/**
 * Load kaspa-wasm module
 */
async function loadKaspaWasm(): Promise<typeof import('kaspa-wasm')> {
  if (!kaspaWasm) {
    kaspaWasm = await import('kaspa-wasm');
  }
  return kaspaWasm;
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
 * Get treasury address and keypair from private key
 */
async function getTreasuryInfo(): Promise<{
  address: string;
  privateKey: InstanceType<typeof import('kaspa-wasm').PrivateKey>;
  xOnlyPubkey: string;
}> {
  const config = getConfig();
  const kaspa = await loadKaspaWasm();

  const privateKey = new kaspa.PrivateKey(config.treasuryPrivateKey);
  const keypair = privateKey.toKeypair();
  const xOnlyPubkey = keypair.xOnlyPublicKey as string;

  const networkType = config.network === 'mainnet'
    ? kaspa.NetworkType.Mainnet
    : kaspa.NetworkType.Testnet;

  // Type assertion to handle kaspa-wasm Address type
  const addrObj = kaspa.createAddress(keypair.publicKey as string, networkType) as { toString(): string };
  const address = addrObj.toString();

  return { address, privateKey, xOnlyPubkey };
}

/**
 * Select UTXOs to cover the required amount + fee
 * Uses "largest first" strategy for simplicity.
 */
function selectUtxos(
  utxos: RestUtxoEntry[],
  requiredSompi: bigint
): { selected: RestUtxoEntry[]; total: bigint } {
  // Sort by amount descending (largest first)
  const sorted = [...utxos].sort((a, b) => {
    const aAmount = BigInt(a.utxoEntry.amount);
    const bAmount = BigInt(b.utxoEntry.amount);
    return bAmount > aAmount ? 1 : bAmount < aAmount ? -1 : 0;
  });

  const selected: RestUtxoEntry[] = [];
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
 */
export async function sendRewardPayout(
  request: PayoutRequest
): Promise<PayoutResult> {
  validatePayoutRequest(request);

  const config = getConfig();
  const kaspa = await loadKaspaWasm();
  const restClient = getKaspaRestClient(config.network);

  // Get treasury info
  const { address: treasuryAddress, privateKey, xOnlyPubkey } = await getTreasuryInfo();

  console.log(`[payout] Treasury: ${treasuryAddress}`);
  console.log(`[payout] Recipient: ${request.toAddress}`);
  console.log(`[payout] Amount: ${request.amountSompi} sompi`);

  // Fetch UTXOs from REST API
  const allUtxos = await restClient.getUtxosByAddress(treasuryAddress);

  if (allUtxos.length === 0) {
    throw new Error('No UTXOs available in treasury');
  }

  console.log(`[payout] Found ${allUtxos.length} UTXOs`);

  // Calculate fee and required amount
  const feeSompi = DEFAULT_PRIORITY_FEE_SOMPI;
  const requiredSompi = request.amountSompi + feeSompi;

  // Select UTXOs
  const { selected: selectedUtxos, total: inputTotal } = selectUtxos(allUtxos, requiredSompi);
  const changeAmount = inputTotal - request.amountSompi - feeSompi;

  console.log(`[payout] Selected ${selectedUtxos.length} UTXOs, total: ${inputTotal} sompi`);
  console.log(`[payout] Change: ${changeAmount} sompi`);

  // Build kaspa-wasm compatible UTXO entries
  const treasuryAddrObj = new kaspa.Address(treasuryAddress);
  const scriptPubKey = '20' + xOnlyPubkey + 'ac'; // P2PK script

  const wasmUtxos = selectedUtxos.map(u => ({
    address: treasuryAddrObj,
    outpoint: {
      transactionId: u.outpoint.transactionId,
      index: u.outpoint.index,
    },
    utxoEntry: {
      amount: BigInt(u.utxoEntry.amount),
      scriptPublicKey: scriptPubKey,
      blockDaaScore: BigInt(u.utxoEntry.blockDaaScore),
      isCoinbase: u.utxoEntry.isCoinbase,
    },
  }));

  // Build outputs
  const recipientAddr = new kaspa.Address(request.toAddress);
  const outputs: Array<{ address: unknown; amount: bigint }> = [
    { address: recipientAddr, amount: request.amountSompi },
  ];

  // Add change output if there's change
  if (changeAmount > MIN_OUTPUT_SOMPI) {
    outputs.push({ address: treasuryAddrObj, amount: changeAmount });
  }

  // Create transaction using kaspa-wasm
  const signableTx = kaspa.createTransaction(
    wasmUtxos,
    outputs,
    treasuryAddrObj, // change address (not used since we manually handle change)
    BigInt(0), // priority fee = 0 (already calculated in outputs)
    request.payload ? new TextEncoder().encode(request.payload) : undefined,
    1, // sig_op_count
    1  // min_signatures
  );

  console.log('[payout] Transaction created');

  // Get transaction JSON for signing
  const txJsonString = String((signableTx as unknown as { toJSON: () => unknown }).toJSON());
  const txJson = JSON.parse(txJsonString) as {
    tx: {
      inner: {
        id: string;
        version: number;
        lockTime: number;
        subnetworkId: string;
        inputs: Array<{
          inner: {
            previousOutpoint: {
              inner: {
                transactionId: string;
                index: number;
              };
            };
            sequence: number;
            sigOpCount: number;
          };
        }>;
        outputs: Array<{
          inner: {
            value: number;
            scriptPublicKey: string;
          };
        }>;
      };
    };
  };
  const txId = txJson.tx.inner.id;

  console.log(`[payout] TX ID: ${txId}`);

  // Sign each input
  // For single-input transactions, sign with TX ID
  // Note: For multi-input, each input may need different sighash
  const signature: string = kaspa.signScriptHash(txId, privateKey);

  console.log('[payout] Transaction signed');

  // Build REST API payload
  const txInner = txJson.tx.inner;
  const restTx = {
    version: txInner.version,
    inputs: txInner.inputs.map(inp => ({
      previousOutpoint: {
        transactionId: inp.inner.previousOutpoint.inner.transactionId,
        index: inp.inner.previousOutpoint.inner.index,
      },
      signatureScript: signature,
      sequence: Number(inp.inner.sequence),
      sigOpCount: inp.inner.sigOpCount,
    })),
    outputs: txInner.outputs.map(out => {
      const spk = out.inner.scriptPublicKey;
      // Parse version from first 4 hex chars
      const version = parseInt(spk.slice(0, 4), 16);
      const script = spk.slice(4);
      return {
        amount: Number(out.inner.value),
        scriptPublicKey: {
          version: version,
          scriptPublicKey: script,
        },
      };
    }),
    lockTime: txInner.lockTime,
    subnetworkId: txInner.subnetworkId,
  };

  console.log('[payout] Submitting to REST API...');

  // Submit transaction
  const result = await restClient.submitTransaction({
    transaction: restTx,
    allowOrphan: false,
  });

  if (result.error) {
    throw new Error(`Transaction rejected: ${result.error}`);
  }

  const submittedTxid = result.transactionId || txId;
  console.log(`[payout] Transaction submitted: ${submittedTxid}`);

  return {
    txid: submittedTxid,
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

/**
 * Check if an amount is above dust threshold
 */
export function isAboveDust(sompi: bigint): boolean {
  return sompi >= MIN_OUTPUT_SOMPI;
}
