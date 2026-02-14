import { describe, it, expect } from 'vitest';
import {
  transition,
  getValidActions,
  isTerminal,
  createMatchContext,
  ESCROW_DEFAULTS,
} from '../src/index.js';
import type { MatchContext } from '../src/index.js';

function makeCtx(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    matchId: 'match-001',
    state: 'created',
    playerAAddress: 'kaspatest:qz0cplayer_a',
    playerBAddress: null,
    playerAPubkey: null,
    playerBPubkey: null,
    betAmountSompi: BigInt(50_000_000),
    depositATxid: null,
    depositBTxid: null,
    depositAConfirmed: false,
    depositBConfirmed: false,
    settleTxid: null,
    refundATxid: null,
    refundBTxid: null,
    escrowMode: 'covenant',
    escrowScriptA: null,
    escrowScriptB: null,
    escrowAddressA: null,
    escrowAddressB: null,
    winnerAddress: null,
    createdAtBlock: 1000,
    refundLocktimeBlocks: 1000,
    ...overrides,
  };
}

describe('createMatchContext', () => {
  it('creates context with correct defaults', () => {
    const ctx = createMatchContext({
      matchId: 'match-001',
      playerAAddress: 'kaspatest:qz0c_a',
      betAmountSompi: BigInt(50_000_000),
      escrowMode: 'covenant',
      createdAtBlock: 500,
    });
    expect(ctx.state).toBe('created');
    expect(ctx.matchId).toBe('match-001');
    expect(ctx.refundLocktimeBlocks).toBe(ESCROW_DEFAULTS.REFUND_LOCKTIME_BLOCKS);
    expect(ctx.depositATxid).toBeNull();
  });

  it('rejects bet below minimum deposit', () => {
    expect(() =>
      createMatchContext({
        matchId: 'match-001',
        playerAAddress: 'kaspatest:qz0c_a',
        betAmountSompi: BigInt(1000), // way below 10M
        escrowMode: 'covenant',
        createdAtBlock: 500,
      })
    ).toThrow('below minimum');
  });
});

describe('transition: happy path', () => {
  it('created → waiting_for_opponent (join)', () => {
    const ctx = makeCtx({ state: 'created' });
    const result = transition(ctx, 'join');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('waiting_for_opponent');
  });

  it('waiting_for_opponent → deposits_pending (join)', () => {
    const ctx = makeCtx({
      state: 'waiting_for_opponent',
      playerBAddress: 'kaspatest:qz0cplayer_b',
    });
    const result = transition(ctx, 'join');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('deposits_pending');
  });

  it('deposits_pending: deposit_a stays in deposits_pending', () => {
    const ctx = makeCtx({ state: 'deposits_pending', playerBAddress: 'kaspatest:b' });
    const result = transition(ctx, 'deposit_a');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('deposits_pending');
  });

  it('deposits_pending → deposits_confirmed (both confirm)', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      playerBAddress: 'kaspatest:b',
      depositATxid: 'tx-a',
      depositBTxid: 'tx-b',
      depositAConfirmed: true,
      depositBConfirmed: false,
    });
    const result = transition(ctx, 'confirm_deposit_b');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('deposits_confirmed');
  });

  it('deposits_pending stays pending if only one confirmed', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      playerBAddress: 'kaspatest:b',
      depositATxid: 'tx-a',
      depositBTxid: null,
      depositAConfirmed: false,
      depositBConfirmed: false,
    });
    const result = transition(ctx, 'confirm_deposit_a');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('deposits_pending');
  });

  it('deposits_confirmed → racing (start_race)', () => {
    const ctx = makeCtx({
      state: 'deposits_confirmed',
      depositAConfirmed: true,
      depositBConfirmed: true,
    });
    const result = transition(ctx, 'start_race');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('racing');
  });

  it('racing → settling (submit_result)', () => {
    const ctx = makeCtx({ state: 'racing' });
    const result = transition(ctx, 'submit_result');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('settling');
  });

  it('settling → settled (settle)', () => {
    const ctx = makeCtx({ state: 'settling' });
    const result = transition(ctx, 'settle');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('settled');
  });
});

describe('transition: cancel', () => {
  it('created → cancelled', () => {
    const ctx = makeCtx({ state: 'created' });
    const result = transition(ctx, 'cancel');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('cancelled');
  });

  it('waiting_for_opponent → cancelled', () => {
    const ctx = makeCtx({ state: 'waiting_for_opponent' });
    const result = transition(ctx, 'cancel');
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('cancelled');
  });

  it('cannot cancel after deposits made', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      playerBAddress: 'kaspatest:b',
      depositATxid: 'tx-a',
    });
    const result = transition(ctx, 'cancel');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('deposits already made');
  });
});

describe('transition: refund', () => {
  it('deposits_pending → refunded (after timelock)', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      playerBAddress: 'kaspatest:b',
      depositATxid: 'tx-a',
      depositBTxid: 'tx-b',
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const result = transition(ctx, 'request_refund', { currentDaaScore: 2001 });
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('refunded');
  });

  it('rejects refund before timelock', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      playerBAddress: 'kaspatest:b',
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const result = transition(ctx, 'request_refund', { currentDaaScore: 1500 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Refund not available');
  });

  it('rejects refund without DAA score', () => {
    const ctx = makeCtx({ state: 'deposits_pending', playerBAddress: 'kaspatest:b' });
    const result = transition(ctx, 'request_refund');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('DAA score required');
  });

  it('rejects refund if already settled', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      playerBAddress: 'kaspatest:b',
      settleTxid: 'settle-tx',
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const result = transition(ctx, 'request_refund', { currentDaaScore: 2001 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('already settled');
  });
});

describe('transition: invalid actions', () => {
  it('cannot settle from created state', () => {
    const ctx = makeCtx({ state: 'created' });
    const result = transition(ctx, 'settle');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('cannot start race from deposits_pending', () => {
    const ctx = makeCtx({ state: 'deposits_pending', playerBAddress: 'kaspatest:b' });
    const result = transition(ctx, 'start_race');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('cannot do anything in settled state', () => {
    const ctx = makeCtx({ state: 'settled' });
    const result = transition(ctx, 'cancel');
    expect(result.ok).toBe(false);
  });

  it('cannot deposit without player registered', () => {
    const ctx = makeCtx({ state: 'deposits_pending', playerBAddress: 'kaspatest:b' });
    ctx.playerAAddress = null;
    const result = transition(ctx, 'deposit_a');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not registered');
  });

  it('rejects duplicate deposit_a', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      playerBAddress: 'kaspatest:b',
      depositATxid: 'already-deposited',
    });
    const result = transition(ctx, 'deposit_a');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('already deposited');
  });

  it('rejects duplicate settlement', () => {
    const ctx = makeCtx({ state: 'settling', settleTxid: 'settle-tx-123' });
    const result = transition(ctx, 'settle');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('duplicate settlement');
  });

  it('rejects same player joining as both A and B', () => {
    const ctx = makeCtx({
      state: 'waiting_for_opponent',
      playerAAddress: 'kaspatest:same',
      playerBAddress: 'kaspatest:same',
    });
    const result = transition(ctx, 'join');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cannot be the same');
  });
});

describe('getValidActions', () => {
  it('created: join, cancel', () => {
    const ctx = makeCtx({ state: 'created' });
    const actions = getValidActions(ctx);
    expect(actions).toContain('join');
    expect(actions).toContain('cancel');
  });

  it('settled: no actions', () => {
    const ctx = makeCtx({ state: 'settled' });
    expect(getValidActions(ctx)).toHaveLength(0);
  });
});

describe('isTerminal', () => {
  it('settled is terminal', () => expect(isTerminal('settled')).toBe(true));
  it('refunded is terminal', () => expect(isTerminal('refunded')).toBe(true));
  it('cancelled is terminal', () => expect(isTerminal('cancelled')).toBe(true));
  it('racing is not terminal', () => expect(isTerminal('racing')).toBe(false));
  it('created is not terminal', () => expect(isTerminal('created')).toBe(false));
});
