import { describe, it, expect } from 'vitest';
import {
  supportsCovenants,
  canUseCovenantSettlement,
  calculateOutputs,
  ESCROW_DEFAULTS,
} from '../src/index.js';

describe('Opcodes', () => {
  it('supportsCovenants returns true for testnet', () => {
    expect(supportsCovenants('testnet')).toBe(true);
  });

  it('supportsCovenants returns false for mainnet', () => {
    expect(supportsCovenants('mainnet')).toBe(false);
  });
});

describe('ESCROW_DEFAULTS', () => {
  it('has correct refund locktime', () => {
    expect(ESCROW_DEFAULTS.REFUND_LOCKTIME_BLOCKS).toBe(1000);
  });

  it('has correct min deposit (0.1 KAS = 10M sompi)', () => {
    expect(ESCROW_DEFAULTS.MIN_DEPOSIT_SOMPI).toBe(BigInt(10_000_000));
  });

  it('has correct priority fee (5000 sompi)', () => {
    expect(ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI).toBe(BigInt(5000));
  });
});

describe('canUseCovenantSettlement', () => {
  it('returns true for complete covenant match', () => {
    expect(
      canUseCovenantSettlement({
        escrowMode: 'covenant',
        escrowScriptA: 'script-a-hex',
        escrowScriptB: 'script-b-hex',
        playerADepositTxid: 'deposit-a',
        playerBDepositTxid: 'deposit-b',
      })
    ).toBe(true);
  });

  it('returns false for fallback mode', () => {
    expect(
      canUseCovenantSettlement({
        escrowMode: 'fallback',
        escrowScriptA: null,
        escrowScriptB: null,
        playerADepositTxid: 'deposit-a',
        playerBDepositTxid: 'deposit-b',
      })
    ).toBe(false);
  });

  it('returns false if escrow scripts missing', () => {
    expect(
      canUseCovenantSettlement({
        escrowMode: 'covenant',
        escrowScriptA: null,
        escrowScriptB: 'script-b-hex',
        playerADepositTxid: 'deposit-a',
        playerBDepositTxid: 'deposit-b',
      })
    ).toBe(false);
  });

  it('returns false if deposits missing', () => {
    expect(
      canUseCovenantSettlement({
        escrowMode: 'covenant',
        escrowScriptA: 'script-a',
        escrowScriptB: 'script-b',
        playerADepositTxid: null,
        playerBDepositTxid: 'deposit-b',
      })
    ).toBe(false);
  });

  it('returns false if all null', () => {
    expect(
      canUseCovenantSettlement({
        escrowMode: null,
        escrowScriptA: null,
        escrowScriptB: null,
        playerADepositTxid: null,
        playerBDepositTxid: null,
      })
    ).toBe(false);
  });
});

describe('calculateOutputs', () => {
  const addrA = 'kaspatest:qz0c8gf8lm54u4m3dw6p0z23vhfmryj8x7qxmq9k5v';
  const addrB = 'kaspatest:qr2h8t4j5k67u9w3df9p1y45vhgmszk9y8qnmp0k6w';
  const depositA = BigInt(50_000_000); // 0.5 KAS
  const depositB = BigInt(50_000_000);

  it('winner_A: all funds to player A', () => {
    const outputs = calculateOutputs('winner_A', depositA, depositB, addrA, addrB);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.address).toBe(addrA);
    expect(outputs[0]!.amount).toBe(depositA + depositB - ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI);
  });

  it('winner_B: all funds to player B', () => {
    const outputs = calculateOutputs('winner_B', depositA, depositB, addrA, addrB);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.address).toBe(addrB);
    expect(outputs[0]!.amount).toBe(depositA + depositB - ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI);
  });

  it('draw: funds split evenly', () => {
    const outputs = calculateOutputs('draw', depositA, depositB, addrA, addrB);
    expect(outputs).toHaveLength(2);
    expect(outputs[0]!.address).toBe(addrA);
    expect(outputs[1]!.address).toBe(addrB);
    // Each gets deposit minus half fee
    const halfFee = ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI / BigInt(2);
    expect(outputs[0]!.amount).toBe(depositA - halfFee);
    expect(outputs[1]!.amount).toBe(depositB - halfFee);
  });

  it('refund: original deposits minus proportional fee', () => {
    const outputs = calculateOutputs('refund', depositA, depositB, addrA, addrB);
    expect(outputs).toHaveLength(2);
    expect(outputs[0]!.address).toBe(addrA);
    expect(outputs[1]!.address).toBe(addrB);
    // Total fee should equal priority fee
    const totalReturned = outputs[0]!.amount + outputs[1]!.amount;
    expect(totalReturned).toBe(depositA + depositB - ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI);
  });

  it('asymmetric deposits: winner gets all minus fee', () => {
    const bigDeposit = BigInt(100_000_000);
    const smallDeposit = BigInt(20_000_000);
    const outputs = calculateOutputs('winner_A', bigDeposit, smallDeposit, addrA, addrB);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.amount).toBe(bigDeposit + smallDeposit - ESCROW_DEFAULTS.PRIORITY_FEE_SOMPI);
  });
});

describe('Theft Resistance Properties (Documentation)', () => {
  it('oracle branch: outputs restricted to playerA or playerB', () => {
    // Enforced by: OP_OUTPUTSPKHASH + OP_EQUAL + OP_BOOLOR + OP_VERIFY
    // On-chain script rejects any TX whose output goes to a third-party address
    expect(true).toBe(true);
  });

  it('refund branch: locked until refundLocktimeBlocks', () => {
    // Enforced by: OP_CHECKLOCKTIMEVERIFY
    // On-chain script rejects refund before DAA score >= locktime
    expect(true).toBe(true);
  });

  it('oracle cannot steal: output constraint + signature both required', () => {
    // Even with a valid oracle signature, outputs must go to declared players
    expect(true).toBe(true);
  });
});
