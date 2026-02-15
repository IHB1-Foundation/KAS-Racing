# ADR-002: EVM/KASPLEX Architecture

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-02-16 |
| Deciders | Core team |

---

## Context
We need a production‑ready chain environment with mature tooling, stable RPC, and a large wallet ecosystem. The app requires:

- Smart‑contract escrow for duels
- Server‑signed reward payouts
- Reliable indexing for realtime UI updates

## Decision
Adopt **KASPLEX zkEVM** as the sole on‑chain runtime for KAS Racing.

### Key Choices
- **Contracts:** MatchEscrow + RewardVault
- **Wallet stack:** MetaMask/injected via wagmi/viem
- **Indexer:** `apps/indexer-evm` (Ponder)
- **Server tx engine:** viem (operator key)

## Consequences
- Server requires an operator key for contract writes.
- Contract addresses must be configured in env.
- Indexer is mandatory for realtime UX.

## Environment Variables

**API Server**
| Variable | Required | Description |
|---|---|---|
| `EVM_RPC_URL` | Yes | KASPLEX RPC URL |
| `EVM_CHAIN_ID` | Yes | 167012 (testnet) |
| `OPERATOR_PRIVATE_KEY` | Yes | Server signer |
| `ESCROW_CONTRACT_ADDRESS` | Yes | MatchEscrow address |
| `REWARD_CONTRACT_ADDRESS` | Yes | RewardVault address |
| `FUEL_TOKEN_ADDRESS` | Yes | kFUEL token address |

**Frontend**
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Server base URL |
| `VITE_NETWORK` | No | Payload label only |
| `VITE_EXPLORER_URL` | No | Explorer base URL |
| `VITE_KFUEL_TOKEN_ADDRESS` | Yes | kFUEL token address |
