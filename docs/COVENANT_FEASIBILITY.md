# Covenant Feasibility Check (T-070)

## Summary

This document records the feasibility assessment of implementing theft-resistant escrow using Kaspa's covenant (KIP-10) features.

## KIP-10 Overview

KIP-10 introduces transaction introspection opcodes to Kaspa's scripting language:
- Transaction metadata queries
- Input/output property introspection
- 8-byte integer arithmetic
- Spending condition constraints (covenants)

## Current Status (as of February 2026)

### Testnet 12
- **Status**: ACTIVE (since January 2026)
- **Covenant support**: ENABLED
- Developers can experiment with:
  - Vaults
  - Escrow systems
  - Layered protocols

### Mainnet
- **Status**: NOT YET ACTIVATED
- **Timeline**: Expected activation in 2026 (pending audits and testing)
- Crescendo Hard Fork (May 2025) included infrastructure for KIP-10

## Implications for KAS Racing

### Current Approach (MVP)
- Use **fallback mode** (server-custodial) for duels
- Both deposits go to treasury address
- Server pays winner from treasury
- Clear documentation that this is fallback mode

### Future Upgrade Path (Post-Mainnet Covenant Activation)
- Generate unique escrow addresses per match using covenant scripts
- Spending restricted to:
  - Branch A: Oracle signature + outputs restricted to players
  - Branch B: Timelock refund to original depositor
- Theft-resistant: Server cannot send funds to third-party addresses

## Decision

| Ticket | Decision | Rationale |
|--------|----------|-----------|
| T-071 | PROCEED (Testnet only) | Design escrow script template for testnet testing |
| T-072 | DEFER | Requires T-071; can implement for testnet |
| T-073 | DEFER | Requires T-072; can implement for testnet |
| T-074 | DEFER | Requires T-073; negative tests for theft resistance |

## Recommendations

1. **For Hackathon Demo**:
   - Use fallback mode (already implemented)
   - Document roadmap to covenant-based escrow
   - Mention testnet covenant availability in presentation

2. **Post-Hackathon**:
   - Implement T-071~T-074 targeting testnet
   - Monitor mainnet activation timeline
   - Switch to covenant mode when mainnet ready

## References

- [KIP-10: Script Engine Enhancements](https://github.com/kaspanet/kips/blob/master/kip-0010.md)
- [KIP-14: Crescendo Hard Fork](https://github.com/kaspanet/kips/blob/master/kip-0014.md)
- [Kaspa Testnet 12 Covenants Launch](https://ourcryptotalk.com/news/kaspa-testnet-12-covenants-launch/)
- [Kaspa Developments](https://kaspa.org/developments/)

---

*Last updated: 2026-02-02*
