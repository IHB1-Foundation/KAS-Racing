/**
 * Validation Module
 *
 * Enforces on-chain rules for settlements, deposits, and refunds.
 * These guards prevent theft, double-spending, and invalid state transitions.
 */

import type {
  MatchContext,
  SettlementRequest,
  SettlementType,
  ValidationResult,
  RefundRequest,
} from './types.js';
import { ESCROW_DEFAULTS } from './types.js';
import { supportsCovenants } from './opcodes.js';

/**
 * Validate that settlement outputs only go to match participants.
 * This is the primary theft-resistance check — rejects any output
 * to a third-party address.
 */
export function validateSettlementOutputs(
  outputs: { address: string; amount: bigint }[],
  playerAAddress: string,
  playerBAddress: string
): ValidationResult {
  if (outputs.length === 0) {
    return { valid: false, error: 'Settlement must have at least one output' };
  }

  if (outputs.length > 2) {
    return { valid: false, error: 'Settlement cannot have more than 2 outputs' };
  }

  for (const output of outputs) {
    if (output.address !== playerAAddress && output.address !== playerBAddress) {
      return {
        valid: false,
        error: `Output address ${output.address} is not a match participant. ` +
               `Allowed: ${playerAAddress}, ${playerBAddress}`,
      };
    }
    if (output.amount <= BigInt(0)) {
      return { valid: false, error: 'Output amount must be positive' };
    }
  }

  return { valid: true };
}

/**
 * Validate a settlement request before building the TX.
 */
export function validateSettlementRequest(
  request: SettlementRequest,
  ctx: MatchContext
): ValidationResult {
  // 1. Match must be in settling state
  if (ctx.state !== 'settling' && ctx.state !== 'racing') {
    return { valid: false, error: `Cannot settle match in state '${ctx.state}'` };
  }

  // 2. No duplicate settlement
  if (ctx.settleTxid) {
    return { valid: false, error: `Match already settled with txid ${ctx.settleTxid}` };
  }

  // 3. Both deposits must exist
  if (!ctx.depositATxid || !ctx.depositBTxid) {
    return { valid: false, error: 'Both deposits required for settlement' };
  }

  // 4. Deposits must be confirmed
  if (!ctx.depositAConfirmed || !ctx.depositBConfirmed) {
    return { valid: false, error: 'Both deposits must be confirmed before settlement' };
  }

  // 5. Deposit amounts must be positive
  if (request.depositA.amount <= BigInt(0) || request.depositB.amount <= BigInt(0)) {
    return { valid: false, error: 'Deposit amounts must be positive' };
  }

  // 6. Total deposits must exceed fee
  const total = request.depositA.amount + request.depositB.amount;
  if (total <= ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI) {
    return { valid: false, error: 'Total deposits must exceed settlement fee' };
  }

  // 7. Settlement type consistency
  const typeCheck = validateSettlementType(request.type, ctx);
  if (!typeCheck.valid) return typeCheck;

  // 8. Match ID must match
  if (request.matchId !== ctx.matchId) {
    return { valid: false, error: 'Settlement matchId does not match context' };
  }

  return { valid: true };
}

/**
 * Validate settlement type is consistent with match outcome.
 */
function validateSettlementType(
  type: SettlementType,
  ctx: MatchContext
): ValidationResult {
  if (type === 'winner_A' && ctx.winnerAddress && ctx.winnerAddress !== ctx.playerAAddress) {
    return { valid: false, error: 'Settlement type winner_A but winner is not player A' };
  }
  if (type === 'winner_B' && ctx.winnerAddress && ctx.winnerAddress !== ctx.playerBAddress) {
    return { valid: false, error: 'Settlement type winner_B but winner is not player B' };
  }
  return { valid: true };
}

/**
 * Validate deposit amount meets minimum requirements.
 */
export function validateDeposit(
  amount: bigint,
  expectedBetAmount: bigint
): ValidationResult {
  if (amount < ESCROW_DEFAULTS.MIN_DEPOSIT_SOMPI) {
    return {
      valid: false,
      error: `Deposit ${amount} below minimum ${ESCROW_DEFAULTS.MIN_DEPOSIT_SOMPI} sompi`,
    };
  }

  if (amount < expectedBetAmount) {
    return {
      valid: false,
      error: `Deposit ${amount} below required bet amount ${expectedBetAmount} sompi`,
    };
  }

  return { valid: true };
}

/**
 * Validate refund eligibility based on timelock.
 */
export function validateRefundEligibility(
  request: RefundRequest,
  ctx: MatchContext
): ValidationResult {
  // Cannot refund if already settled
  if (ctx.settleTxid) {
    return { valid: false, error: 'Cannot refund: match already settled' };
  }

  // Cannot refund if already refunded
  if (request.forPlayer === 'A' && ctx.refundATxid) {
    return { valid: false, error: 'Player A already refunded' };
  }
  if (request.forPlayer === 'B' && ctx.refundBTxid) {
    return { valid: false, error: 'Player B already refunded' };
  }

  // Check timelock
  const refundEligibleAt = ctx.createdAtBlock + ctx.refundLocktimeBlocks;
  if (request.currentDaaScore < refundEligibleAt) {
    return {
      valid: false,
      error: `Refund locked until DAA score ${refundEligibleAt} (current: ${request.currentDaaScore})`,
    };
  }

  // Deposit must exist
  const depositTxid = request.forPlayer === 'A' ? ctx.depositATxid : ctx.depositBTxid;
  if (!depositTxid) {
    return { valid: false, error: `No deposit found for player ${request.forPlayer}` };
  }

  // Amount must be positive
  if (request.depositAmount <= BigInt(0)) {
    return { valid: false, error: 'Deposit amount must be positive' };
  }

  return { valid: true };
}

/**
 * Validate covenant mode prerequisites.
 */
export function validateCovenantMode(
  ctx: MatchContext,
  network: string
): ValidationResult {
  if (!supportsCovenants(network as 'mainnet' | 'testnet')) {
    return { valid: false, error: `Covenant mode not supported on ${network}` };
  }

  if (ctx.escrowMode !== 'covenant') {
    return { valid: false, error: 'Match not in covenant mode' };
  }

  if (!ctx.escrowScriptA || !ctx.escrowScriptB) {
    return { valid: false, error: 'Escrow scripts not generated' };
  }

  if (!ctx.playerAPubkey || !ctx.playerBPubkey) {
    return { valid: false, error: 'Player public keys required for covenant mode' };
  }

  return { valid: true };
}
