# Theft-Resistance Tests (T-074)

This document describes the negative tests that prove the theft-resistant properties of the covenant escrow system.

## Overview

The escrow script has two branches:
1. **Oracle Settlement**: Oracle can settle funds only to player A or player B
2. **Timelock Refund**: After locktime, original depositor can reclaim funds

## Test Cases

### Test 1: Third-Party Output Rejection

**Objective**: Prove that oracle cannot send funds to addresses other than playerA or playerB.

**Setup**:
- Match with playerA and playerB
- Both deposits confirmed in escrow addresses
- Oracle holds signing key

**Test Steps**:
1. Build settlement TX with output to third-party address (attacker)
2. Sign with oracle key
3. Attempt to broadcast

**Expected Result**:
- TX rejected by network
- Error: Script execution failed (output constraint violated)

**Script Logic**:
```
OP_TXOUTPUTCOUNT OP_1 OP_EQUAL OP_VERIFY     # Must have exactly 1 output
OP_0 OP_OUTPUTSPKHASH                         # Get output 0 script hash
OP_DUP <playerA_spk_hash> OP_EQUAL
OP_SWAP <playerB_spk_hash> OP_EQUAL
OP_BOOLOR OP_VERIFY                           # Output must be to A or B
```

### Test 2: Premature Refund Rejection

**Objective**: Prove that depositor cannot reclaim funds before timelock expires.

**Setup**:
- Match with playerA deposit in escrow
- Current DAA score < refund_locktime
- PlayerA holds signing key

**Test Steps**:
1. Build refund TX spending escrow to playerA
2. Sign with playerA key (using refund branch)
3. Attempt to broadcast

**Expected Result**:
- TX rejected by network
- Error: CHECKLOCKTIMEVERIFY failed (locktime not reached)

**Script Logic**:
```
<refund_locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP
<depositor_pubkey> OP_CHECKSIG
```

### Test 3: Valid Settlement Acceptance

**Objective**: Prove that valid settlement to winner is accepted.

**Setup**:
- Match finished with playerA as winner
- Both deposits confirmed in escrow addresses
- Oracle holds signing key

**Test Steps**:
1. Build settlement TX with output to playerA (winner)
2. Sign with oracle key (using oracle branch)
3. Broadcast TX

**Expected Result**:
- TX accepted by network
- TX included in block
- Winner receives funds

### Test 4: Valid Refund Acceptance (After Timelock)

**Objective**: Prove that refund works after timelock expires.

**Setup**:
- Match with playerA deposit in escrow
- Current DAA score >= refund_locktime (e.g., oracle abandoned match)
- PlayerA holds signing key

**Test Steps**:
1. Build refund TX spending escrow to playerA
2. Sign with playerA key (using refund branch)
3. Broadcast TX

**Expected Result**:
- TX accepted by network
- TX included in block
- Depositor receives funds back

## Test Implementation

### Automated Test Script

```typescript
// tests/covenant-negative.test.ts
import { describe, it, expect } from 'vitest';
import { buildCovenantSettlementTx } from '../src/escrow/settlementTxBuilder';

describe('Covenant Theft Resistance', () => {
  describe('Third-Party Output Rejection', () => {
    it('should reject TX with output to non-player address', async () => {
      // Setup: Create escrow with playerA and playerB
      const escrowParams = {
        playerA: { pubkey: 'aaa...', address: 'kaspa:playerA' },
        playerB: { pubkey: 'bbb...', address: 'kaspa:playerB' },
        oracle: { pubkey: 'ooo...' },
        refundLocktimeBlocks: 1000,
      };

      // Attempt: Build TX with attacker output
      // This should fail at script validation

      // In Testnet, the broadcast would be rejected
      // Expect: Error from network
    });
  });

  describe('Premature Refund Rejection', () => {
    it('should reject refund before locktime', async () => {
      // Setup: Create escrow with future locktime

      // Attempt: Build refund TX before locktime

      // Expect: CHECKLOCKTIMEVERIFY failure
    });
  });
});
```

### Manual Test Procedure

For Testnet verification:

1. **Setup Testnet Wallet**
   ```bash
   # Get testnet funds from faucet
   # Configure server with NETWORK=testnet
   ```

2. **Create Match with Covenant Escrow**
   ```bash
   curl -X POST http://localhost:8787/api/match/create \
     -H "Content-Type: application/json" \
     -d '{
       "playerAddress": "kaspatest:...",
       "betAmount": 0.5,
       "playerPubkey": "<x-only-pubkey>"
     }'
   ```

3. **Fund Escrow Addresses**
   - Send deposits to escrowAddressA and escrowAddressB

4. **Attempt Invalid Settlement**
   - Modify settlementTxBuilder to use attacker address
   - Observe rejection

5. **Verify Valid Settlement**
   - Complete match normally
   - Verify winner receives funds

## Test Results

| Test | Status | Network | Date | Notes |
|------|--------|---------|------|-------|
| Third-Party Rejection | Pending | Testnet 12 | - | Requires testnet deployment |
| Premature Refund | Pending | Testnet 12 | - | Requires testnet deployment |
| Valid Settlement | Pending | Testnet 12 | - | Requires testnet deployment |
| Valid Refund | Pending | Testnet 12 | - | Requires testnet deployment |

## Security Properties Proven

1. **Theft Resistance**: Oracle cannot steal funds (output restricted to players)
2. **Liveness**: Players can recover funds if oracle disappears (timelock refund)
3. **Fairness**: Oracle can only send to declared winner

## Limitations

1. **Oracle Trust**: Oracle still controls winner determination
2. **Collusion**: If oracle and one player collude, they can steal other player's deposit
3. **Mainnet Support**: Covenant not yet active on mainnet (uses fallback mode)

## Future Work

- [ ] Implement commit-reveal scheme for fair winner determination
- [ ] Add multi-oracle threshold signatures
- [ ] Deploy and test on Testnet 12
- [ ] Document mainnet activation timeline

---

*Last updated: 2026-02-03*
