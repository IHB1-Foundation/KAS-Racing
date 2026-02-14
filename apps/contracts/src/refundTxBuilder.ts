/**
 * Refund TX Builder
 *
 * Builds refund transactions using the timelock branch (Branch B)
 * of the escrow script. Only usable after refundLocktimeBlocks have passed.
 *
 * Script Branch B:
 *   <refund_locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP
 *   <depositor_pubkey> OP_CHECKSIG
 */

import type {
  MatchContext,
  RefundRequest,
  RefundResult,
  SettlementConfig,
} from './types.js';
import { ESCROW_DEFAULTS } from './types.js';
import { validateRefundEligibility } from './validation.js';

const PRIORITY_FEE = ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI;

/**
 * Build and broadcast a refund transaction for a single player.
 *
 * Uses the timelock branch of the escrow script:
 *   - Validates refund eligibility (timelock passed, not already settled)
 *   - Constructs TX spending the escrow UTXO back to the depositor
 *   - Signs with the depositor's key (provided by the player)
 */
export function buildRefundTx(
  config: SettlementConfig,
  request: RefundRequest,
  ctx: MatchContext
): RefundResult {
  // Validate eligibility
  const validation = validateRefundEligibility(request, ctx);
  if (!validation.valid) {
    throw new Error(`Refund validation failed: ${validation.error}`);
  }

  const refundAddress = request.forPlayer === 'A'
    ? ctx.playerAAddress!
    : ctx.playerBAddress!;

  const refundAmount = request.depositAmount - PRIORITY_FEE;

  if (refundAmount <= BigInt(0)) {
    throw new Error('Deposit too small to cover refund fee');
  }

  // Build and broadcast (currently stub for actual TX construction)
  const txid = broadcastRefundTx(
    config,
    request,
    ctx,
    refundAddress,
    refundAmount
  );

  return {
    txid,
    forPlayer: request.forPlayer,
    refundAddress,
    amount: refundAmount,
    feeSompi: PRIORITY_FEE,
  };
}

/**
 * Broadcast refund transaction.
 * Uses the timelock branch, requiring:
 *   - locktime in TX >= refundLocktimeBlocks
 *   - depositor's signature
 */
function broadcastRefundTx(
  config: SettlementConfig,
  request: RefundRequest,
  ctx: MatchContext,
  refundAddress: string,
  refundAmount: bigint
): string {
  const escrowScript = request.forPlayer === 'A'
    ? ctx.escrowScriptA
    : ctx.escrowScriptB;

  console.log(`[refund] Building refund TX for match ${request.matchId}`);
  console.log(`[refund]   Player: ${request.forPlayer}`);
  console.log(`[refund]   Deposit: ${request.depositTxid}:${request.depositIndex}`);
  console.log(`[refund]   Refund to: ${refundAddress}`);
  console.log(`[refund]   Amount: ${refundAmount} sompi (fee: ${PRIORITY_FEE})`);
  console.log(`[refund]   Escrow script: ${escrowScript ? 'present' : 'missing'}`);
  console.log(`[refund]   Locktime: ${ctx.refundLocktimeBlocks} blocks`);
  console.log(`[refund]   Current DAA: ${request.currentDaaScore}`);

  // TODO: Implement actual refund TX broadcast
  // The TX needs:
  //   - Input: escrow UTXO (deposit)
  //   - Output: refund to depositor address
  //   - Locktime: >= refundLocktimeBlocks
  //   - ScriptSig: OP_FALSE (select ELSE branch) + depositor signature
  const txidPlaceholder = `refund_${request.matchId}_${request.forPlayer}_${Date.now().toString(16)}`;
  console.warn(`[refund] Actual TX broadcast not implemented — returning placeholder`);

  return txidPlaceholder;
}

/**
 * Check if a refund is currently eligible (timelock passed).
 */
export function isRefundEligible(
  ctx: MatchContext,
  currentDaaScore: number
): { eligible: boolean; eligibleAt: number; blocksRemaining: number } {
  const eligibleAt = ctx.createdAtBlock + ctx.refundLocktimeBlocks;
  const blocksRemaining = Math.max(0, eligibleAt - currentDaaScore);

  return {
    eligible: currentDaaScore >= eligibleAt && !ctx.settleTxid,
    eligibleAt,
    blocksRemaining,
  };
}
