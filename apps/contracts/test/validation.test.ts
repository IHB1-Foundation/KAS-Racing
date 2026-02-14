import { describe, it, expect } from 'vitest';
import {
  validateSettlementOutputs,
  validateSettlementRequest,
  validateDeposit,
  validateRefundEligibility,
  validateCovenantMode,
  ESCROW_DEFAULTS,
} from '../src/index.js';
import type { MatchContext, SettlementRequest, RefundRequest } from '../src/index.js';

const addrA = 'kaspatest:qz0cplayer_a';
const addrB = 'kaspatest:qr2hplayer_b';
const addrThird = 'kaspatest:qx9ythird_party';

function makeCtx(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    matchId: 'match-001',
    state: 'settling',
    playerAAddress: addrA,
    playerBAddress: addrB,
    playerAPubkey: 'a'.repeat(64),
    playerBPubkey: 'b'.repeat(64),
    betAmountSompi: BigInt(50_000_000),
    depositATxid: 'deposit-a-txid',
    depositBTxid: 'deposit-b-txid',
    depositAConfirmed: true,
    depositBConfirmed: true,
    settleTxid: null,
    refundATxid: null,
    refundBTxid: null,
    escrowMode: 'covenant',
    escrowScriptA: 'script-a',
    escrowScriptB: 'script-b',
    escrowAddressA: 'kaspatest:p_escrow_a',
    escrowAddressB: 'kaspatest:p_escrow_b',
    winnerAddress: addrA,
    createdAtBlock: 1000,
    refundLocktimeBlocks: 1000,
    ...overrides,
  };
}

// ── validateSettlementOutputs (Theft Resistance) ──

describe('validateSettlementOutputs', () => {
  it('accepts outputs to player A only (winner)', () => {
    const result = validateSettlementOutputs(
      [{ address: addrA, amount: BigInt(99_995_000) }],
      addrA, addrB
    );
    expect(result.valid).toBe(true);
  });

  it('accepts outputs to both players (draw)', () => {
    const result = validateSettlementOutputs(
      [
        { address: addrA, amount: BigInt(49_997_500) },
        { address: addrB, amount: BigInt(49_997_500) },
      ],
      addrA, addrB
    );
    expect(result.valid).toBe(true);
  });

  it('REJECTS output to third-party address', () => {
    const result = validateSettlementOutputs(
      [{ address: addrThird, amount: BigInt(99_995_000) }],
      addrA, addrB
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a match participant');
    expect(result.error).toContain(addrThird);
  });

  it('REJECTS mixed outputs with third-party', () => {
    const result = validateSettlementOutputs(
      [
        { address: addrA, amount: BigInt(50_000_000) },
        { address: addrThird, amount: BigInt(49_995_000) },
      ],
      addrA, addrB
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a match participant');
  });

  it('REJECTS empty outputs', () => {
    const result = validateSettlementOutputs([], addrA, addrB);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least one output');
  });

  it('REJECTS more than 2 outputs', () => {
    const result = validateSettlementOutputs(
      [
        { address: addrA, amount: BigInt(30_000_000) },
        { address: addrB, amount: BigInt(30_000_000) },
        { address: addrA, amount: BigInt(30_000_000) },
      ],
      addrA, addrB
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('more than 2');
  });

  it('REJECTS zero-amount output', () => {
    const result = validateSettlementOutputs(
      [{ address: addrA, amount: BigInt(0) }],
      addrA, addrB
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('positive');
  });

  it('REJECTS negative-amount output', () => {
    const result = validateSettlementOutputs(
      [{ address: addrA, amount: BigInt(-1) }],
      addrA, addrB
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('positive');
  });
});

// ── validateSettlementRequest ──

describe('validateSettlementRequest', () => {
  const validRequest: SettlementRequest = {
    matchId: 'match-001',
    type: 'winner_A',
    depositA: { txid: 'deposit-a-txid', index: 0, amount: BigInt(50_000_000) },
    depositB: { txid: 'deposit-b-txid', index: 0, amount: BigInt(50_000_000) },
  };

  it('accepts valid settlement request', () => {
    const ctx = makeCtx();
    const result = validateSettlementRequest(validRequest, ctx);
    expect(result.valid).toBe(true);
  });

  it('rejects if match not in settling/racing state', () => {
    const ctx = makeCtx({ state: 'created' });
    const result = validateSettlementRequest(validRequest, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("state 'created'");
  });

  it('rejects duplicate settlement', () => {
    const ctx = makeCtx({ settleTxid: 'already-settled' });
    const result = validateSettlementRequest(validRequest, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already settled');
  });

  it('rejects if deposits missing', () => {
    const ctx = makeCtx({ depositATxid: null });
    const result = validateSettlementRequest(validRequest, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Both deposits required');
  });

  it('rejects if deposits not confirmed', () => {
    const ctx = makeCtx({ depositAConfirmed: false });
    const result = validateSettlementRequest(validRequest, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('confirmed');
  });

  it('rejects zero deposit amount', () => {
    const badRequest = {
      ...validRequest,
      depositA: { ...validRequest.depositA, amount: BigInt(0) },
    };
    const ctx = makeCtx();
    const result = validateSettlementRequest(badRequest, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('positive');
  });

  it('rejects if total deposits do not exceed fee', () => {
    const tinyRequest = {
      ...validRequest,
      depositA: { ...validRequest.depositA, amount: BigInt(1000) },
      depositB: { ...validRequest.depositB, amount: BigInt(1000) },
    };
    const ctx = makeCtx();
    const result = validateSettlementRequest(tinyRequest, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceed settlement fee');
  });

  it('rejects mismatched matchId', () => {
    const badRequest = { ...validRequest, matchId: 'wrong-match' };
    const ctx = makeCtx();
    const result = validateSettlementRequest(badRequest, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not match');
  });

  it('rejects winner_A when winner is actually B', () => {
    const ctx = makeCtx({ winnerAddress: addrB });
    const result = validateSettlementRequest(validRequest, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('winner is not player A');
  });

  it('accepts winner_B when winner is B', () => {
    const ctx = makeCtx({ winnerAddress: addrB });
    const requestB = { ...validRequest, type: 'winner_B' as const };
    const result = validateSettlementRequest(requestB, ctx);
    expect(result.valid).toBe(true);
  });
});

// ── validateDeposit ──

describe('validateDeposit', () => {
  it('accepts valid deposit', () => {
    const result = validateDeposit(BigInt(50_000_000), BigInt(50_000_000));
    expect(result.valid).toBe(true);
  });

  it('rejects below minimum', () => {
    const result = validateDeposit(BigInt(1000), BigInt(1000));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('below minimum');
  });

  it('rejects below bet amount', () => {
    const result = validateDeposit(BigInt(30_000_000), BigInt(50_000_000));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('below required bet amount');
  });

  it('accepts deposit equal to bet amount', () => {
    const result = validateDeposit(BigInt(50_000_000), BigInt(50_000_000));
    expect(result.valid).toBe(true);
  });

  it('accepts deposit above bet amount', () => {
    const result = validateDeposit(BigInt(100_000_000), BigInt(50_000_000));
    expect(result.valid).toBe(true);
  });
});

// ── validateRefundEligibility ──

describe('validateRefundEligibility', () => {
  const validRefund: RefundRequest = {
    matchId: 'match-001',
    forPlayer: 'A',
    depositTxid: 'deposit-a-txid',
    depositIndex: 0,
    depositAmount: BigInt(50_000_000),
    currentDaaScore: 2500,
  };

  it('accepts valid refund after timelock', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      settleTxid: null,
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const result = validateRefundEligibility(validRefund, ctx);
    expect(result.valid).toBe(true);
  });

  it('rejects refund before timelock', () => {
    const earlyRefund = { ...validRefund, currentDaaScore: 1500 };
    const ctx = makeCtx({ state: 'deposits_pending', settleTxid: null });
    const result = validateRefundEligibility(earlyRefund, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('locked until');
  });

  it('rejects refund if already settled', () => {
    const ctx = makeCtx({ settleTxid: 'settle-tx' });
    const result = validateRefundEligibility(validRefund, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already settled');
  });

  it('rejects refund if player A already refunded', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      settleTxid: null,
      refundATxid: 'refund-a-tx',
    });
    const result = validateRefundEligibility(validRefund, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already refunded');
  });

  it('rejects refund if deposit does not exist', () => {
    const ctx = makeCtx({
      state: 'deposits_pending',
      settleTxid: null,
      depositATxid: null,
    });
    const result = validateRefundEligibility(validRefund, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No deposit found');
  });

  it('rejects zero deposit amount', () => {
    const zeroRefund = { ...validRefund, depositAmount: BigInt(0) };
    const ctx = makeCtx({ state: 'deposits_pending', settleTxid: null });
    const result = validateRefundEligibility(zeroRefund, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('positive');
  });
});

// ── validateCovenantMode ──

describe('validateCovenantMode', () => {
  it('accepts valid covenant setup on testnet', () => {
    const ctx = makeCtx();
    const result = validateCovenantMode(ctx, 'testnet');
    expect(result.valid).toBe(true);
  });

  it('rejects covenant on mainnet', () => {
    const ctx = makeCtx();
    const result = validateCovenantMode(ctx, 'mainnet');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('rejects fallback mode', () => {
    const ctx = makeCtx({ escrowMode: 'fallback' });
    const result = validateCovenantMode(ctx, 'testnet');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not in covenant mode');
  });

  it('rejects missing escrow scripts', () => {
    const ctx = makeCtx({ escrowScriptA: null });
    const result = validateCovenantMode(ctx, 'testnet');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('scripts not generated');
  });

  it('rejects missing player pubkeys', () => {
    const ctx = makeCtx({ playerAPubkey: null });
    const result = validateCovenantMode(ctx, 'testnet');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('public keys required');
  });
});
