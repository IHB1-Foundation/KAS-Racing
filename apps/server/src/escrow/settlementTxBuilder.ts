/**
 * Covenant Settlement TX Builder (T-073)
 *
 * Builds settlement transactions that spend escrow UTXOs.
 * Uses oracle signature to satisfy the covenant script.
 *
 * Note: Only works on Testnet 12+ where KIP-10 is active.
 */

import * as kaspa from 'kaspa-wasm';
import { getConfig } from '../config/index.js';
import type { SettlementRequest, SettlementResult, SettlementType } from './types.js';

// Priority fee in sompi
const PRIORITY_FEE = BigInt(5000);

/**
 * Build and broadcast a covenant settlement transaction
 *
 * @param request - Settlement request with escrow UTXOs and settlement type
 * @param escrowScriptA - Script hex for player A's escrow
 * @param escrowScriptB - Script hex for player B's escrow
 */
export function buildCovenantSettlementTx(
  request: SettlementRequest,
  escrowScriptA: string,
  escrowScriptB: string,
  playerAAddress: string,
  playerBAddress: string
): SettlementResult {
  const config = getConfig();

  // Validate network
  if (config.network !== 'testnet') {
    throw new Error('Covenant settlement only available on testnet');
  }

  // Determine output configuration based on settlement type
  const outputs = calculateOutputs(
    request.type,
    request.depositA.amount,
    request.depositB.amount,
    playerAAddress,
    playerBAddress
  );

  console.log(`[covenant] Building settlement TX for match ${request.matchId}`);
  console.log(`[covenant] Type: ${request.type}, Outputs:`, outputs);

  // Build the transaction using kaspa-wasm
  // This is a simplified version - actual implementation would need:
  // 1. Create inputs from escrow UTXOs
  // 2. Set the script sig for oracle branch (OP_TRUE for IF branch)
  // 3. Sign with oracle key
  // 4. Broadcast

  const txid = broadcastCovenantTx(
    request,
    escrowScriptA,
    escrowScriptB,
    outputs
  );

  return {
    txid,
    type: request.type,
    outputs,
    feeSompi: PRIORITY_FEE,
  };
}

/**
 * Calculate outputs based on settlement type
 */
function calculateOutputs(
  type: SettlementType,
  depositA: bigint,
  depositB: bigint,
  playerAAddress: string,
  playerBAddress: string
): { address: string; amount: bigint }[] {
  const totalDeposits = depositA + depositB;
  const totalAfterFee = totalDeposits - PRIORITY_FEE;
  const halfFee = PRIORITY_FEE / BigInt(2);
  const refundFeeA = (PRIORITY_FEE * depositA) / totalDeposits;
  const refundFeeB = PRIORITY_FEE - refundFeeA;

  switch (type) {
    case 'winner_A':
      return [{ address: playerAAddress, amount: totalAfterFee }];

    case 'winner_B':
      return [{ address: playerBAddress, amount: totalAfterFee }];

    case 'draw':
      // Split evenly minus fee
      return [
        { address: playerAAddress, amount: depositA - halfFee },
        { address: playerBAddress, amount: depositB - halfFee },
      ];

    case 'refund':
      // Return original deposits minus fee
      return [
        { address: playerAAddress, amount: depositA - refundFeeA },
        { address: playerBAddress, amount: depositB - refundFeeB },
      ];
  }
}

/**
 * Broadcast covenant settlement transaction
 *
 * This creates a transaction that:
 * 1. Spends both escrow UTXOs (using oracle branch)
 * 2. Outputs to winner(s)
 * 3. Signs with oracle key
 */
function broadcastCovenantTx(
  request: SettlementRequest,
  _escrowScriptA: string,
  _escrowScriptB: string,
  outputs: { address: string; amount: bigint }[]
): string {
  const config = getConfig();

  // Load oracle private key
  const oraclePrivateKey = new kaspa.PrivateKey(config.oraclePrivateKey);
  const oracleKeypair = oraclePrivateKey.toKeypair();

  console.log(`[covenant] Oracle pubkey: ${oracleKeypair.publicKey as string}`);

  // For covenant transactions, we need to:
  // 1. Create transaction with escrow UTXOs as inputs
  // 2. Set script sig to push OP_TRUE (select oracle branch)
  // 3. Sign the transaction with oracle key
  // 4. Broadcast to network

  // Note: This requires kaspa-wasm to support custom script sigs
  // Current implementation is a stub that would need to be completed
  // when kaspa-wasm provides the necessary APIs

  // For now, generate a placeholder txid to indicate covenant mode was attempted
  // In production, this would be the actual broadcasted transaction ID
  const txidPlaceholder = `covenant_${request.matchId}_${Date.now().toString(16)}`;

  console.log(`[covenant] Settlement TX would spend:`);
  console.log(`  - Input A: ${request.depositA.txid}:${request.depositA.index}`);
  console.log(`  - Input B: ${request.depositB.txid}:${request.depositB.index}`);
  console.log(`[covenant] Outputs:`);
  outputs.forEach((out, i) => {
    console.log(`  - Output ${i}: ${out.amount} sompi -> ${out.address}`);
  });

  // TODO: Implement actual covenant TX broadcast when kaspa-wasm supports it
  // The implementation would look something like:
  //
  // 1. Fetch escrow UTXOs from network
  // 2. Build transaction with custom script sigs
  // 3. Sign with oracle key using signScriptHash
  // 4. Broadcast via REST API

  // For Testnet demo, we could use the REST API directly
  // But this requires the actual escrow UTXOs to be funded

  console.warn(`[covenant] Actual TX broadcast not implemented - returning placeholder`);

  return txidPlaceholder;
}

/**
 * Check if covenant settlement is possible for a match
 */
export function canUseCovenantSettlement(match: {
  escrowMode?: string | null;
  escrowScriptA?: string | null;
  escrowScriptB?: string | null;
  playerADepositTxid?: string | null;
  playerBDepositTxid?: string | null;
}): boolean {
  return (
    match.escrowMode === 'covenant' &&
    !!match.escrowScriptA &&
    !!match.escrowScriptB &&
    !!match.playerADepositTxid &&
    !!match.playerBDepositTxid
  );
}

/**
 * Get escrow UTXO info from deposit txid
 *
 * Fetches the transaction and finds the output sent to the escrow address.
 */
export async function getEscrowUtxo(
  depositTxid: string,
  escrowAddress: string
): Promise<{ txid: string; index: number; amount: bigint } | null> {
  const config = getConfig();

  // Use REST API to fetch transaction
  const apiBase = config.network === 'mainnet'
    ? 'https://api.kaspa.org'
    : 'https://api-tn11.kaspa.org';

  try {
    const response = await fetch(`${apiBase}/transactions/${depositTxid}`);
    if (!response.ok) {
      console.warn(`[covenant] Failed to fetch tx ${depositTxid}: ${response.status}`);
      return null;
    }

    const tx = await response.json() as {
      outputs: Array<{
        script_public_key_address: string;
        amount: number;
      }>;
    };

    // Find output to escrow address
    const outputIndex = tx.outputs.findIndex(
      (out) => out.script_public_key_address === escrowAddress
    );

    if (outputIndex === -1) {
      console.warn(`[covenant] No output to escrow address in tx ${depositTxid}`);
      return null;
    }

    const output = tx.outputs[outputIndex]!;
    return {
      txid: depositTxid,
      index: outputIndex,
      amount: BigInt(output.amount),
    };
  } catch (error) {
    console.error(`[covenant] Error fetching escrow UTXO:`, error);
    return null;
  }
}
