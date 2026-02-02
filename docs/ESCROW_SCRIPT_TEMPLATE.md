# Escrow Script Template Design (T-071)

## Overview

This document defines the escrow script template for KAS Racing duels using Kaspa's KIP-10 covenant opcodes.

## Script Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `playerA_pubkey` | 32 bytes | Player A's x-only public key |
| `playerB_pubkey` | 32 bytes | Player B's x-only public key |
| `oracle_pubkey` | 32 bytes | Oracle (server) x-only public key |
| `refund_locktime` | 8 bytes | Block DAA score for refund unlock |

## Script Branches

### Branch A: Oracle Settlement
Oracle can spend to either player (winner) or both (draw).

**Conditions:**
1. Oracle signature is valid
2. Outputs are restricted to `playerA_pubkey` or `playerB_pubkey`

### Branch B: Timelock Refund
After locktime, original depositor can reclaim funds.

**Conditions:**
1. Current DAA score >= `refund_locktime`
2. Depositor signature is valid

## Script Template (Pseudocode)

```
# Escrow Script for Player A's deposit
# Similar structure for Player B

OP_IF
  # Branch A: Oracle Settlement

  # Verify oracle signature
  <oracle_pubkey> OP_CHECKSIGVERIFY

  # Verify output is to playerA or playerB only
  # Using KIP-10 introspection opcodes
  OP_OUTPUTVALUE 0 OP_PICK              # Get output 0 value
  OP_OUTPUTSCRIPT 0 OP_PICK             # Get output 0 script

  # Check output script is P2PK to playerA or playerB
  OP_DUP
  <playerA_p2pk_script> OP_EQUAL
  OP_SWAP
  <playerB_p2pk_script> OP_EQUAL
  OP_BOOLOR
  OP_VERIFY

  OP_TRUE

OP_ELSE
  # Branch B: Timelock Refund

  # Check locktime has passed
  <refund_locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP

  # Verify depositor signature
  <playerA_pubkey> OP_CHECKSIG

OP_ENDIF
```

## KIP-10 Opcodes Used

| Opcode | Description |
|--------|-------------|
| `OP_OUTPUTVALUE` | Get value of output at index |
| `OP_OUTPUTSCRIPT` | Get script of output at index |
| `OP_OUTPUTCOUNT` | Get number of outputs |
| `OP_CHECKLOCKTIMEVERIFY` | Verify locktime constraint |

## Script Address Generation

For each match, generate escrow addresses:

```typescript
interface EscrowParams {
  playerA: {
    pubkey: string;      // x-only pubkey (32 bytes hex)
    address: string;     // Kaspa address
  };
  playerB: {
    pubkey: string;
    address: string;
  };
  oracle: {
    pubkey: string;
  };
  refundLocktimeBlocks: number;  // Default: 1000 blocks (~16 hours)
}

function generateEscrowScript(params: EscrowParams, forPlayer: 'A' | 'B'): Buffer {
  // Compile script with parameters
  // Return script bytes
}

function generateEscrowAddress(script: Buffer, network: 'mainnet' | 'testnet'): string {
  // P2SH address from script
  // Return kaspa:p... or kaspatest:p... address
}
```

## Settlement Transaction Structure

### Winner Takes All
```
Inputs:
  - escrowA UTXO (Player A's deposit)
  - escrowB UTXO (Player B's deposit)

Outputs:
  - winner_address: (total - fee)

Signatures:
  - Oracle signature for Branch A (both inputs)
```

### Draw (Return Deposits)
```
Inputs:
  - escrowA UTXO
  - escrowB UTXO

Outputs:
  - playerA_address: (betAmount - fee/2)
  - playerB_address: (betAmount - fee/2)

Signatures:
  - Oracle signature for Branch A (both inputs)
```

## Security Properties

1. **Theft Resistance**: Oracle cannot send funds to addresses other than playerA or playerB
2. **Liveness**: After refund locktime, players can reclaim deposits without oracle
3. **No Collusion**: Even with oracle key compromise, funds can only go to original players

## Limitations

1. **No Partial Outputs**: Cannot split output arbitrarily (covenant restricts to player addresses)
2. **Script Size**: Complex scripts increase transaction size/fee
3. **Testnet Only**: Currently only available on Testnet 12 (as of Feb 2026)

## Implementation Status

- [x] Template design (this document)
- [ ] Script compiler implementation (T-072)
- [ ] Settlement TX builder (T-073)
- [ ] Negative tests (T-074)

## References

- [KIP-10: Script Engine Enhancements](https://github.com/kaspanet/kips/blob/master/kip-0010.md)
- [Kaspa Script Documentation](https://github.com/kaspanet/rusty-kaspa/blob/master/consensus/core/src/tx/script_public_key.rs)

---

*Last updated: 2026-02-02*
