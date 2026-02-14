/**
 * Covenant Settlement TX Builder
 *
 * Builds settlement transactions that spend escrow UTXOs.
 * Uses oracle signature to satisfy the covenant script.
 *
 * Note: Only works on Testnet 12+ where KIP-10 is active.
 */

import * as kaspa from 'kaspa-wasm';
import type {
  SettlementConfig,
  SettlementRequest,
  SettlementResult,
  SettlementType,
} from './types.js';
import { ESCROW_DEFAULTS } from './types.js';

const PRIORITY_FEE = ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI;

/** REST API base URLs per network */
const API_BASE: Record<string, string> = {
  mainnet: 'https://api.kaspa.org',
  testnet: 'https://api-tn11.kaspa.org',
};

/**
 * Build and broadcast a covenant settlement transaction.
 *
 * @param config - Settlement configuration (network, oraclePrivateKey)
 * @param request - Settlement request with escrow UTXOs
 * @param escrowScriptA - Script hex for player A's escrow
 * @param escrowScriptB - Script hex for player B's escrow
 * @param playerAAddress - Player A's address
 * @param playerBAddress - Player B's address
 */
export function buildCovenantSettlementTx(
  config: SettlementConfig,
  request: SettlementRequest,
  escrowScriptA: string,
  escrowScriptB: string,
  playerAAddress: string,
  playerBAddress: string
): SettlementResult {
  if (config.network !== 'testnet') {
    throw new Error('Covenant settlement only available on testnet');
  }

  const outputs = calculateOutputs(
    request.type,
    request.depositA.amount,
    request.depositB.amount,
    playerAAddress,
    playerBAddress
  );

  const txid = broadcastCovenantTx(
    config,
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
 * Calculate outputs based on settlement type.
 */
export function calculateOutputs(
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
      return [
        { address: playerAAddress, amount: depositA - halfFee },
        { address: playerBAddress, amount: depositB - halfFee },
      ];
    case 'refund':
      return [
        { address: playerAAddress, amount: depositA - refundFeeA },
        { address: playerBAddress, amount: depositB - refundFeeB },
      ];
  }
}

/**
 * Broadcast covenant settlement transaction.
 * Currently a stub — returns placeholder txid.
 */
function broadcastCovenantTx(
  config: SettlementConfig,
  request: SettlementRequest,
  _escrowScriptA: string,
  _escrowScriptB: string,
  outputs: { address: string; amount: bigint }[]
): string {
  const oraclePrivateKey = new kaspa.PrivateKey(config.oraclePrivateKey);
  const oracleKeypair = oraclePrivateKey.toKeypair();

  console.log(`[covenant] Oracle pubkey: ${oracleKeypair.publicKey as string}`);
  console.log(`[covenant] Building settlement TX for match ${request.matchId}`);
  console.log(`[covenant] Type: ${request.type}`);
  console.log(`[covenant]   Input A: ${request.depositA.txid}:${request.depositA.index}`);
  console.log(`[covenant]   Input B: ${request.depositB.txid}:${request.depositB.index}`);
  outputs.forEach((out, i) => {
    console.log(`[covenant]   Output ${i}: ${out.amount} sompi -> ${out.address}`);
  });

  // TODO: Implement actual covenant TX broadcast when kaspa-wasm supports custom script sigs
  const txidPlaceholder = `covenant_${request.matchId}_${Date.now().toString(16)}`;
  console.warn(`[covenant] Actual TX broadcast not implemented — returning placeholder`);

  return txidPlaceholder;
}

/**
 * Check if covenant settlement is possible for a match.
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
 * Get escrow UTXO info from deposit txid.
 */
export async function getEscrowUtxo(
  depositTxid: string,
  escrowAddress: string,
  network: string
): Promise<{ txid: string; index: number; amount: bigint } | null> {
  const apiBase = API_BASE[network] ?? API_BASE['mainnet'];

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
