/**
 * Match State Machine
 *
 * Enforces on-chain match lifecycle state transitions.
 * Each transition has preconditions that must be met.
 *
 * State flow:
 *   created → waiting_for_opponent → deposits_pending
 *   → deposits_confirmed → racing → settling → settled
 *
 * Alternative paths:
 *   deposits_pending → refunded (after timelock)
 *   created/waiting_for_opponent → cancelled
 */

import type {
  MatchState,
  MatchAction,
  MatchContext,
  TransitionResult,
} from './types.js';
import { ESCROW_DEFAULTS } from './types.js';

/**
 * Valid state transitions map.
 * Key: current state. Value: map of action → target state.
 */
const TRANSITIONS: Record<MatchState, Partial<Record<MatchAction, MatchState>>> = {
  created: {
    join: 'waiting_for_opponent',
    cancel: 'cancelled',
  },
  waiting_for_opponent: {
    join: 'deposits_pending',
    cancel: 'cancelled',
  },
  deposits_pending: {
    deposit_a: 'deposits_pending',
    deposit_b: 'deposits_pending',
    confirm_deposit_a: 'deposits_pending',
    confirm_deposit_b: 'deposits_pending',
    request_refund: 'refunded',
    cancel: 'cancelled',
  },
  deposits_confirmed: {
    start_race: 'racing',
    request_refund: 'refunded',
  },
  racing: {
    submit_result: 'settling',
  },
  settling: {
    settle: 'settled',
  },
  settled: {},
  refunded: {},
  cancelled: {},
};

/**
 * Attempt a state transition with precondition validation.
 */
export function transition(
  ctx: MatchContext,
  action: MatchAction,
  params?: { currentDaaScore?: number }
): TransitionResult {
  const allowed = TRANSITIONS[ctx.state];
  const targetState = allowed?.[action];

  if (!targetState) {
    return {
      ok: false,
      newState: ctx.state,
      error: `Action '${action}' not allowed in state '${ctx.state}'`,
    };
  }

  // Precondition checks per action
  const preconditionError = checkPreconditions(ctx, action, params);
  if (preconditionError) {
    return { ok: false, newState: ctx.state, error: preconditionError };
  }

  // Special case: deposits_pending → deposits_confirmed when both confirmed
  if (ctx.state === 'deposits_pending' && isDepositConfirmAction(action)) {
    const bothConfirmed = willBothDepositsBeConfirmed(ctx, action);
    if (bothConfirmed) {
      return { ok: true, newState: 'deposits_confirmed' };
    }
    return { ok: true, newState: 'deposits_pending' };
  }

  return { ok: true, newState: targetState };
}

function isDepositConfirmAction(action: MatchAction): boolean {
  return action === 'confirm_deposit_a' || action === 'confirm_deposit_b';
}

function willBothDepositsBeConfirmed(ctx: MatchContext, action: MatchAction): boolean {
  const aConfirmed = action === 'confirm_deposit_a' ? true : ctx.depositAConfirmed;
  const bConfirmed = action === 'confirm_deposit_b' ? true : ctx.depositBConfirmed;
  return aConfirmed && bConfirmed;
}

/**
 * Validate preconditions for an action.
 * Returns error message if precondition fails, null if OK.
 */
function checkPreconditions(
  ctx: MatchContext,
  action: MatchAction,
  params?: { currentDaaScore?: number }
): string | null {
  switch (action) {
    case 'join':
      if (ctx.state === 'created' && !ctx.playerAAddress) {
        return 'Player A address required before join';
      }
      if (ctx.state === 'waiting_for_opponent' && !ctx.playerBAddress) {
        return 'Player B address must be set to join';
      }
      if (ctx.state === 'waiting_for_opponent' && ctx.playerAAddress === ctx.playerBAddress) {
        return 'Player B cannot be the same as Player A';
      }
      return null;

    case 'deposit_a':
      if (!ctx.playerAAddress) return 'Player A not registered';
      if (ctx.depositATxid) return 'Player A already deposited';
      return null;

    case 'deposit_b':
      if (!ctx.playerBAddress) return 'Player B not registered';
      if (ctx.depositBTxid) return 'Player B already deposited';
      return null;

    case 'confirm_deposit_a':
      if (!ctx.depositATxid) return 'No deposit A txid to confirm';
      if (ctx.depositAConfirmed) return 'Deposit A already confirmed';
      return null;

    case 'confirm_deposit_b':
      if (!ctx.depositBTxid) return 'No deposit B txid to confirm';
      if (ctx.depositBConfirmed) return 'Deposit B already confirmed';
      return null;

    case 'start_race':
      if (!ctx.depositAConfirmed || !ctx.depositBConfirmed) {
        return 'Both deposits must be confirmed before starting race';
      }
      return null;

    case 'submit_result':
      if (!ctx.winnerAddress && ctx.state === 'racing') {
        // Winner will be set during this action; no precondition needed
      }
      return null;

    case 'settle':
      if (ctx.settleTxid) return 'Match already settled (duplicate settlement)';
      return null;

    case 'request_refund': {
      const daaScore = params?.currentDaaScore;
      if (daaScore === undefined) {
        return 'Current DAA score required for refund eligibility check';
      }
      const refundEligibleAt = ctx.createdAtBlock + ctx.refundLocktimeBlocks;
      if (daaScore < refundEligibleAt) {
        return `Refund not available until DAA score ${refundEligibleAt} (current: ${daaScore})`;
      }
      // Cannot refund if already settled
      if (ctx.settleTxid) return 'Cannot refund: match already settled';
      return null;
    }

    case 'cancel':
      // Can only cancel if no deposits made
      if (ctx.depositATxid || ctx.depositBTxid) {
        return 'Cannot cancel: deposits already made (use refund after timelock)';
      }
      return null;
  }
}

/**
 * Get all valid actions for the current state.
 */
export function getValidActions(ctx: MatchContext): MatchAction[] {
  const allowed = TRANSITIONS[ctx.state];
  if (!allowed) return [];
  return Object.keys(allowed) as MatchAction[];
}

/**
 * Check if a match is in a terminal state.
 */
export function isTerminal(state: MatchState): boolean {
  return state === 'settled' || state === 'refunded' || state === 'cancelled';
}

/**
 * Create initial match context.
 */
export function createMatchContext(params: {
  matchId: string;
  playerAAddress: string;
  betAmountSompi: bigint;
  escrowMode: 'covenant' | 'fallback';
  createdAtBlock: number;
  refundLocktimeBlocks?: number;
}): MatchContext {
  if (params.betAmountSompi < ESCROW_DEFAULTS.MIN_DEPOSIT_SOMPI) {
    throw new Error(
      `Bet amount ${params.betAmountSompi} below minimum ${ESCROW_DEFAULTS.MIN_DEPOSIT_SOMPI}`
    );
  }

  return {
    matchId: params.matchId,
    state: 'created',
    playerAAddress: params.playerAAddress,
    playerBAddress: null,
    playerAPubkey: null,
    playerBPubkey: null,
    betAmountSompi: params.betAmountSompi,
    depositATxid: null,
    depositBTxid: null,
    depositAConfirmed: false,
    depositBConfirmed: false,
    settleTxid: null,
    refundATxid: null,
    refundBTxid: null,
    escrowMode: params.escrowMode,
    escrowScriptA: null,
    escrowScriptB: null,
    escrowAddressA: null,
    escrowAddressB: null,
    winnerAddress: null,
    createdAtBlock: params.createdAtBlock,
    refundLocktimeBlocks:
      params.refundLocktimeBlocks ?? ESCROW_DEFAULTS.REFUND_LOCKTIME_BLOCKS,
  };
}
