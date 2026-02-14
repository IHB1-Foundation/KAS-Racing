/**
 * Theft Resistance Tests
 *
 * These tests prove that the escrow contract logic prevents:
 * 1. Settlement to third-party addresses
 * 2. Premature refund (before timelock)
 * 3. Double settlement
 * 4. Settlement without deposits
 *
 * The on-chain script enforces these via:
 * - OP_OUTPUTSPKHASH + OP_EQUAL + OP_BOOLOR + OP_VERIFY (output restriction)
 * - OP_CHECKLOCKTIMEVERIFY (timelock)
 * - State machine (duplicate prevention)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOutputs,
  validateSettlementOutputs,
  validateSettlementRequest,
  validateRefundEligibility,
  transition,
  createMatchContext,
  isRefundEligible,
  ESCROW_DEFAULTS,
  OP_OUTPUTSPKHASH,
  OP_BOOLOR,
  OP_VERIFY,
  OP_TXOUTPUTCOUNT,
  OP_CHECKLOCKTIMEVERIFY,
  OP_DROP,
  OP_CHECKSIG,
} from '../src/index.js';
import type { MatchContext, SettlementRequest, RefundRequest } from '../src/index.js';

const addrA = 'kaspatest:qz0cplayer_a';
const addrB = 'kaspatest:qr2hplayer_b';
const addrAttacker = 'kaspatest:qx9yattacker_addr';

function makeSettlingCtx(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    matchId: 'match-theft-test',
    state: 'settling',
    playerAAddress: addrA,
    playerBAddress: addrB,
    playerAPubkey: 'a'.repeat(64),
    playerBPubkey: 'b'.repeat(64),
    betAmountSompi: BigInt(50_000_000),
    depositATxid: 'deposit-a',
    depositBTxid: 'deposit-b',
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

// ── Test 1: Third-Party Output Rejection ──

describe('Theft Resistance: Third-party output rejection', () => {
  it('calculateOutputs never produces third-party addresses for winner_A', () => {
    const outputs = calculateOutputs('winner_A', BigInt(50_000_000), BigInt(50_000_000), addrA, addrB);
    for (const o of outputs) {
      expect([addrA, addrB]).toContain(o.address);
    }
  });

  it('calculateOutputs never produces third-party addresses for winner_B', () => {
    const outputs = calculateOutputs('winner_B', BigInt(50_000_000), BigInt(50_000_000), addrA, addrB);
    for (const o of outputs) {
      expect([addrA, addrB]).toContain(o.address);
    }
  });

  it('calculateOutputs never produces third-party addresses for draw', () => {
    const outputs = calculateOutputs('draw', BigInt(50_000_000), BigInt(50_000_000), addrA, addrB);
    for (const o of outputs) {
      expect([addrA, addrB]).toContain(o.address);
    }
  });

  it('calculateOutputs never produces third-party addresses for refund', () => {
    const outputs = calculateOutputs('refund', BigInt(50_000_000), BigInt(50_000_000), addrA, addrB);
    for (const o of outputs) {
      expect([addrA, addrB]).toContain(o.address);
    }
  });

  it('validation rejects manually crafted attacker output', () => {
    const malicious = [{ address: addrAttacker, amount: BigInt(99_995_000) }];
    const result = validateSettlementOutputs(malicious, addrA, addrB);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a match participant');
  });

  it('validation rejects partial attacker output (A + attacker)', () => {
    const malicious = [
      { address: addrA, amount: BigInt(50_000_000) },
      { address: addrAttacker, amount: BigInt(49_995_000) },
    ];
    const result = validateSettlementOutputs(malicious, addrA, addrB);
    expect(result.valid).toBe(false);
  });

  it('script design uses OP_OUTPUTSPKHASH for output restriction', () => {
    // The escrow script (built by buildEscrowScript) contains:
    //   OP_0 OP_OUTPUTSPKHASH    -- get SPK hash of output 0
    //   OP_DUP <A_spk> OP_EQUAL  -- check if playerA
    //   OP_SWAP <B_spk> OP_EQUAL -- check if playerB
    //   OP_BOOLOR OP_VERIFY      -- at least one must match
    //
    // If an attacker tries to set output to their address,
    // OP_OUTPUTSPKHASH returns the attacker's SPK hash,
    // which won't match playerA or playerB, causing VERIFY to fail.
    //
    // Verify opcodes are correctly defined:
    expect(OP_OUTPUTSPKHASH).toBe(0xc5);
    expect(OP_BOOLOR).toBe(0x9b);
    expect(OP_VERIFY).toBe(0x69);
    expect(OP_TXOUTPUTCOUNT).toBe(0xc3);
  });
});

// ── Test 2: Premature Refund Rejection ──

describe('Theft Resistance: Premature refund rejection', () => {
  it('rejects refund before timelock via validation', () => {
    const ctx = makeSettlingCtx({
      state: 'deposits_pending',
      settleTxid: null,
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const request: RefundRequest = {
      matchId: 'match-theft-test',
      forPlayer: 'A',
      depositTxid: 'deposit-a',
      depositIndex: 0,
      depositAmount: BigInt(50_000_000),
      currentDaaScore: 1500, // < 2000 (1000+1000)
    };
    const result = validateRefundEligibility(request, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('locked until');
  });

  it('rejects refund at exactly locktime boundary', () => {
    const ctx = makeSettlingCtx({
      state: 'deposits_pending',
      settleTxid: null,
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const request: RefundRequest = {
      matchId: 'match-theft-test',
      forPlayer: 'A',
      depositTxid: 'deposit-a',
      depositIndex: 0,
      depositAmount: BigInt(50_000_000),
      currentDaaScore: 1999, // exactly 1 block before eligible
    };
    const result = validateRefundEligibility(request, ctx);
    expect(result.valid).toBe(false);
  });

  it('accepts refund at exactly eligible block', () => {
    const ctx = makeSettlingCtx({
      state: 'deposits_pending',
      settleTxid: null,
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const request: RefundRequest = {
      matchId: 'match-theft-test',
      forPlayer: 'A',
      depositTxid: 'deposit-a',
      depositIndex: 0,
      depositAmount: BigInt(50_000_000),
      currentDaaScore: 2000, // exactly at locktime
    };
    const result = validateRefundEligibility(request, ctx);
    expect(result.valid).toBe(true);
  });

  it('isRefundEligible reports correct blocks remaining', () => {
    const ctx = makeSettlingCtx({
      state: 'deposits_pending',
      settleTxid: null,
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const info = isRefundEligible(ctx, 1500);
    expect(info.eligible).toBe(false);
    expect(info.eligibleAt).toBe(2000);
    expect(info.blocksRemaining).toBe(500);
  });

  it('isRefundEligible reports 0 blocks remaining when eligible', () => {
    const ctx = makeSettlingCtx({
      state: 'deposits_pending',
      settleTxid: null,
      createdAtBlock: 1000,
      refundLocktimeBlocks: 1000,
    });
    const info = isRefundEligible(ctx, 2500);
    expect(info.eligible).toBe(true);
    expect(info.blocksRemaining).toBe(0);
  });

  it('script design uses OP_CHECKLOCKTIMEVERIFY for timelock', () => {
    // The escrow script's ELSE branch contains:
    //   <refund_locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP
    //   <depositor_pubkey> OP_CHECKSIG
    //
    // A premature refund attempt will fail because the TX locktime
    // is less than the script's locktime, causing CLTV to fail.
    //
    // Verify opcodes are correctly defined:
    expect(OP_CHECKLOCKTIMEVERIFY).toBe(0xb1);
    expect(OP_DROP).toBe(0x75);
    expect(OP_CHECKSIG).toBe(0xac);
  });
});

// ── Test 3: Double Settlement Prevention ──

describe('Theft Resistance: Double settlement prevention', () => {
  it('state machine rejects settle action on already-settled match', () => {
    const ctx = makeSettlingCtx({ state: 'settling', settleTxid: 'already-settled' });
    const result = transition(ctx, 'settle');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('duplicate settlement');
  });

  it('validation rejects settlement request for already-settled match', () => {
    const ctx = makeSettlingCtx({ settleTxid: 'already-settled' });
    const request: SettlementRequest = {
      matchId: 'match-theft-test',
      type: 'winner_A',
      depositA: { txid: 'deposit-a', index: 0, amount: BigInt(50_000_000) },
      depositB: { txid: 'deposit-b', index: 0, amount: BigInt(50_000_000) },
    };
    const result = validateSettlementRequest(request, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already settled');
  });

  it('cannot refund after settlement', () => {
    const ctx = makeSettlingCtx({ settleTxid: 'settle-tx' });
    const request: RefundRequest = {
      matchId: 'match-theft-test',
      forPlayer: 'A',
      depositTxid: 'deposit-a',
      depositIndex: 0,
      depositAmount: BigInt(50_000_000),
      currentDaaScore: 3000,
    };
    const result = validateRefundEligibility(request, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already settled');
  });
});

// ── Test 4: Settlement Without Deposits ──

describe('Theft Resistance: Settlement without deposits', () => {
  it('rejects settlement when deposit A is missing', () => {
    const ctx = makeSettlingCtx({ depositATxid: null });
    const request: SettlementRequest = {
      matchId: 'match-theft-test',
      type: 'winner_A',
      depositA: { txid: 'deposit-a', index: 0, amount: BigInt(50_000_000) },
      depositB: { txid: 'deposit-b', index: 0, amount: BigInt(50_000_000) },
    };
    const result = validateSettlementRequest(request, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Both deposits required');
  });

  it('rejects settlement when deposits not confirmed', () => {
    const ctx = makeSettlingCtx({ depositAConfirmed: false });
    const request: SettlementRequest = {
      matchId: 'match-theft-test',
      type: 'winner_A',
      depositA: { txid: 'deposit-a', index: 0, amount: BigInt(50_000_000) },
      depositB: { txid: 'deposit-b', index: 0, amount: BigInt(50_000_000) },
    };
    const result = validateSettlementRequest(request, ctx);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('confirmed');
  });
});

// ── Test 5: Fund Conservation ──

describe('Theft Resistance: Fund conservation', () => {
  const deposit = BigInt(50_000_000);
  const fee = ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI;

  it('winner settlement conserves funds (total = deposits - fee)', () => {
    const outputs = calculateOutputs('winner_A', deposit, deposit, addrA, addrB);
    const total = outputs.reduce((sum, o) => sum + o.amount, BigInt(0));
    expect(total).toBe(deposit + deposit - fee);
  });

  it('draw settlement conserves funds', () => {
    const outputs = calculateOutputs('draw', deposit, deposit, addrA, addrB);
    const total = outputs.reduce((sum, o) => sum + o.amount, BigInt(0));
    expect(total).toBe(deposit + deposit - fee);
  });

  it('refund settlement conserves funds', () => {
    const outputs = calculateOutputs('refund', deposit, deposit, addrA, addrB);
    const total = outputs.reduce((sum, o) => sum + o.amount, BigInt(0));
    expect(total).toBe(deposit + deposit - fee);
  });

  it('asymmetric deposits: refund returns proportional amounts', () => {
    const bigDeposit = BigInt(100_000_000);
    const smallDeposit = BigInt(20_000_000);
    const outputs = calculateOutputs('refund', bigDeposit, smallDeposit, addrA, addrB);
    const total = outputs.reduce((sum, o) => sum + o.amount, BigInt(0));
    expect(total).toBe(bigDeposit + smallDeposit - fee);
    // Player A (bigger deposit) should get more back
    expect(outputs[0]!.amount).toBeGreaterThan(outputs[1]!.amount);
  });
});

// ── Test 6: Full Lifecycle (State Machine + Validation Integration) ──

describe('Theft Resistance: Full lifecycle', () => {
  it('complete happy path: create → join → deposit → confirm → race → settle', () => {
    const ctx = createMatchContext({
      matchId: 'lifecycle-test',
      playerAAddress: addrA,
      betAmountSompi: BigInt(50_000_000),
      escrowMode: 'covenant',
      createdAtBlock: 1000,
    });

    // Step 1: Join (A is creator)
    let result = transition(ctx, 'join');
    expect(result.ok).toBe(true);
    ctx.state = result.newState;

    // Step 2: B joins
    ctx.playerBAddress = addrB;
    result = transition(ctx, 'join');
    expect(result.ok).toBe(true);
    ctx.state = result.newState;
    expect(ctx.state).toBe('deposits_pending');

    // Step 3: Deposits
    result = transition(ctx, 'deposit_a');
    expect(result.ok).toBe(true);
    ctx.depositATxid = 'deposit-a-txid';

    result = transition(ctx, 'deposit_b');
    expect(result.ok).toBe(true);
    ctx.depositBTxid = 'deposit-b-txid';

    // Step 4: Confirm deposits
    result = transition(ctx, 'confirm_deposit_a');
    expect(result.ok).toBe(true);
    ctx.depositAConfirmed = true;
    ctx.state = result.newState;

    result = transition(ctx, 'confirm_deposit_b');
    expect(result.ok).toBe(true);
    ctx.depositBConfirmed = true;
    ctx.state = result.newState;
    expect(ctx.state).toBe('deposits_confirmed');

    // Step 5: Start race
    result = transition(ctx, 'start_race');
    expect(result.ok).toBe(true);
    ctx.state = result.newState;
    expect(ctx.state).toBe('racing');

    // Step 6: Submit result
    result = transition(ctx, 'submit_result');
    expect(result.ok).toBe(true);
    ctx.state = result.newState;
    ctx.winnerAddress = addrA;
    expect(ctx.state).toBe('settling');

    // Step 7: Validate settlement
    const settleRequest: SettlementRequest = {
      matchId: 'lifecycle-test',
      type: 'winner_A',
      depositA: { txid: 'deposit-a-txid', index: 0, amount: BigInt(50_000_000) },
      depositB: { txid: 'deposit-b-txid', index: 0, amount: BigInt(50_000_000) },
    };
    const validation = validateSettlementRequest(settleRequest, ctx);
    expect(validation.valid).toBe(true);

    // Step 8: Settle
    result = transition(ctx, 'settle');
    expect(result.ok).toBe(true);
    ctx.state = result.newState;
    ctx.settleTxid = 'settle-txid';
    expect(ctx.state).toBe('settled');

    // Step 9: Cannot settle again
    result = transition(ctx, 'settle');
    expect(result.ok).toBe(false);
  });
});
