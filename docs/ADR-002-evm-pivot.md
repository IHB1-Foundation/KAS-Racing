# ADR-002: EVM Pivot — KASPLEX zkEVM Testnet

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-02-15 |
| Deciders | Core team |
| Supersedes | ADR-001 Contract-first Architecture (Kaspa UTXO) |

---

## Context

KAS Racing P13 (T-200–T-210) was built on **Kaspa UTXO + kaspa-wasm + KIP-10 covenants**:

- Escrow scripts in `apps/contracts/src/scriptBuilder.ts` generate P2SH addresses.
- Settlement/refund TX builders operate on raw UTXO inputs/outputs.
- A custom Ponder-fallback indexer (`apps/indexer`) watches Kaspa DAG blocks.
- Wallet integration targeted a Kaspa-native browser extension.

**Problems encountered:**

1. **Tooling maturity** — `kaspa-wasm` lacks stable TypeScript bindings; covenant script debugging is manual opcode inspection.
2. **Wallet ecosystem** — only one browser extension; mobile coverage was zero.
3. **Indexing** — Ponder does not natively support Kaspa DAG; our custom indexer (`apps/indexer`) required significant scaffolding and has reorg edge cases.
4. **Testing** — No Hardhat/Foundry equivalent for Kaspa scripts; unit tests mock most on-chain behavior.
5. **Demo risk** — Testnet 12 RPC instability caused several demo rehearsal failures.

**New opportunity:**

KASPLEX has launched a **zkEVM Testnet** (Chain ID `167012`, RPC `https://rpc.kasplextest.xyz`, Explorer `https://zkevm.kasplex.org`). This gives us:

- Standard Solidity contracts (Hardhat, OpenZeppelin, typechain)
- MetaMask + wagmi/viem wallet stack
- Ponder native EVM support (no custom indexer needed)
- Mature testing tools (Hardhat test, coverage, gas snapshots)
- Familiar deploy pipeline (hardhat-deploy, verification)

---

## Decision

### Stop UTXO-based implementation; pivot all on-chain logic to KASPLEX zkEVM Testnet.

### What We Keep (Reuse)

| Component | Location | Reason |
|---|---|---|
| Phaser game engine | `apps/client/src/game/` | No chain dependency |
| Speed-Visualizer SDK | `packages/speed-visualizer-sdk/` | Chain-agnostic UI components |
| Backend orchestration patterns | `apps/server/src/services/` | Session/match/reward policy logic is chain-agnostic |
| Postgres + Drizzle ORM | `apps/server/src/db/` | Schema evolves but engine stays |
| Express + WebSocket layer | `apps/server/src/routes/`, `apps/server/src/ws/` | Transport layer unchanged |
| Deploy infrastructure | Vercel (FE) + Railway (BE/DB/Indexer) | Platform stays, env vars change |
| UI pages/components | `apps/client/src/pages/`, `apps/client/src/components/` | Presentation layer reusable |
| Game HUD integration | `apps/client/src/components/hud/` | SDK consumption pattern unchanged |

### What We Discard / Move to Legacy

| Component | Location | Action |
|---|---|---|
| kaspa-wasm dependency | `apps/contracts/`, `apps/server/` | Remove from active deps |
| UTXO covenant script builder | `apps/contracts/src/scriptBuilder.ts` | Archive to `legacy/` |
| UTXO opcodes module | `apps/contracts/src/opcodes.ts` | Archive to `legacy/` |
| Settlement/Refund TX builders | `apps/contracts/src/settlement*.ts`, `refund*.ts` | Archive to `legacy/` |
| Custom Kaspa indexer | `apps/indexer/` (current) | Replace with Ponder EVM indexer |
| Legacy wallet provider | `apps/client/src/wallet/` | Removed; replaced by `apps/client/src/evm/` (wagmi + viem) |
| UTXO-specific API routes | `apps/server/src/routes/` (tx build/broadcast) | Rewrite for EVM |
| Escrow module (server) | `apps/server/src/escrow/` | Replace with contract interaction via viem |
| UTXO tx engine | `apps/server/src/tx/` | Replace with EVM tx engine |

### What We Create (New)

| Component | Location | Description |
|---|---|---|
| Solidity contracts workspace | `apps/contracts-evm/` | Hardhat + OpenZeppelin + typechain |
| MatchEscrow contract | `apps/contracts-evm/contracts/` | On-chain escrow with deposit/settle/refund |
| RewardVault contract | `apps/contracts-evm/contracts/` | FreeRun reward payouts + proof registry |
| EVM Ponder indexer | `apps/indexer-evm/` | Native Ponder EVM indexer |
| wagmi/viem wallet module | `apps/client/src/evm/` | MetaMask + injected EVM wallet support |
| EVM tx engine (server) | `apps/server/src/tx/` | viem-based RPC client + signer |
| Postgres schema v3 | `apps/server/src/db/` | EVM event tables, updated deposits/settlements |

---

## Demo Scope Freeze

### Must (Demo-blocking)

| Feature | Description | On-chain? |
|---|---|---|
| Free Run reward payout | Server calls RewardVault to send KAS to player | Yes — EVM tx |
| Tx lifecycle HUD | accepted → mined → confirmed timeline | Read-only |
| Duel deposit | Player approves + deposits via MatchEscrow | Yes — player signs |
| Duel settlement | Server calls MatchEscrow.settle() | Yes — oracle tx |
| Proof page | Decode contract events, verify on explorer | Read-only |
| Wallet connect | MetaMask connect/disconnect/chain-switch | Client-side |

### Should (High value, do if time allows)

| Feature | Description |
|---|---|
| Timelock refund | Player can reclaim deposit after timeout |
| Gas estimation UI | Show estimated tx cost before signing |
| Multi-checkpoint batch | Batch reward events to reduce tx count |

### Could (Stretch / post-demo)

| Feature | Description |
|---|---|
| WalletConnect mobile | Support mobile wallets via WC v2 |
| Leaderboard persistence | On-chain or indexed leaderboard |
| Multi-round tournaments | Sequential match brackets |
| Mainnet deployment | Requires KASPLEX mainnet availability |

### Not Doing (Explicit exclusions)

- Kaspa UTXO covenant mode (archived, not deleted)
- Real-time multiplayer sync (each player plays locally)
- Mobile-native app (web only)
- Token (ERC-20) integration — demo uses native KAS on KASPLEX

---

## UTXO Legacy Separation Plan

### Step 1 — Preserve (T-300)
- Current `apps/contracts/` stays as-is for reference.
- Tag current HEAD as `utxo-final` before major changes begin.

### Step 2 — New workspace alongside (T-310)
- `apps/contracts-evm/` is created as a new Hardhat workspace.
- No code is deleted from `apps/contracts/` at this stage.

### Step 3 — Server dual-path (T-330)
- Server tx engine supports both paths via `TX_ENGINE=evm|utxo` env var.
- Default switches to `evm` once contracts are deployed.

### Step 4 — Frontend switch (T-340)
- Wallet module switches from legacy wallet stack to wagmi/viem.
- Old wallet code moved to `apps/client/src/wallet/legacy/`.

### Step 5 — Cleanup (T-353, post-demo)
- Remove UTXO code paths if KASPLEX mainnet is confirmed.
- Until then, legacy code stays in repo (unused but preserved).

---

## Environment Matrix (Updated)

| Environment | Chain | Chain ID | RPC | Explorer | FE Host | BE Host |
|---|---|---|---|---|---|---|
| **local** | KASPLEX Testnet | 167012 | `https://rpc.kasplextest.xyz` | `https://zkevm.kasplex.org` | localhost:5173 | localhost:8787 |
| **testnet** | KASPLEX Testnet | 167012 | `https://rpc.kasplextest.xyz` | `https://zkevm.kasplex.org` | Vercel preview | Railway dev |
| **production** | KASPLEX Mainnet | TBD | TBD | TBD | Vercel prod | Railway prod |

### New/Changed Environment Variables

**API Server (additions):**

| Variable | Required | Description |
|---|---|---|
| `EVM_RPC_URL` | Yes | `https://rpc.kasplextest.xyz` |
| `EVM_CHAIN_ID` | Yes | `167012` |
| `OPERATOR_PRIVATE_KEY` | Yes | Hex, 64 chars — server signer for contract calls |
| `ESCROW_CONTRACT_ADDRESS` | Yes | Deployed MatchEscrow address |
| `REWARD_CONTRACT_ADDRESS` | Yes | Deployed RewardVault address |

**Frontend (additions):**

| Variable | Required | Description |
|---|---|---|
| `VITE_EVM_RPC_URL` | Yes | `https://rpc.kasplextest.xyz` |
| `VITE_CHAIN_ID` | Yes | `167012` |
| `VITE_ESCROW_ADDRESS` | Yes | MatchEscrow contract address |
| `VITE_REWARD_ADDRESS` | Yes | RewardVault contract address |

**Deprecated (from ADR-001):**

| Variable | Status |
|---|---|
| `TREASURY_PRIVATE_KEY` | Replaced by `OPERATOR_PRIVATE_KEY` |
| `TREASURY_CHANGE_ADDRESS` | Not needed (EVM accounts, no UTXO change) |
| `ORACLE_PRIVATE_KEY` | Merged into `OPERATOR_PRIVATE_KEY` (single signer for MVP) |
| `VITE_NETWORK` | Replaced by `VITE_CHAIN_ID` |

---

## Cutover Checklist (Draft)

- [ ] ADR-002 reviewed and accepted (this document)
- [ ] Chain/wallet/token matrix finalized (T-301)
- [ ] `apps/contracts-evm/` bootstrapped with Hardhat (T-310)
- [ ] Core Solidity contracts implemented and tested (T-311, T-312, T-313)
- [ ] Contracts deployed to KASPLEX Testnet (T-314)
- [ ] Ponder EVM indexer operational (T-320)
- [ ] DB schema v3 migrated (T-321)
- [ ] Server tx engine switched to EVM (T-330)
- [ ] API routes updated for contract-first EVM (T-331)
- [ ] WS bridge connected to indexer events (T-332)
- [ ] Frontend wallet switched to wagmi/viem (T-340)
- [ ] Duel UX updated for approve/deposit/settle flow (T-341)
- [ ] FreeRun reward UX updated for EVM (T-342)
- [ ] LOCAL.md + deploy templates updated (T-350)
- [ ] Railway/Vercel pipeline updated (T-351)
- [ ] E2E rehearsal passed (T-352)
- [ ] Rollback plan documented (T-353)

---

## Implementation Priority (T-300 → T-353)

| Order | Ticket | What | Blocked By |
|---|---|---|---|
| 1 | **T-300** | This ADR + scope freeze | — |
| 2 | T-301 | Chain/wallet/token decision matrix | T-300 |
| 3 | T-310 | Contracts workspace bootstrap (Hardhat) | T-301 |
| 4 | T-311 | Core contracts (Escrow/Match/Settlement) | T-310 |
| 5 | T-312 | Reward + Proof registry contract | T-310 |
| 6 | T-313 | Contract test/security baseline | T-311, T-312 |
| 7 | T-314 | KASPLEX Testnet deploy + verify | T-313 |
| 8 | T-320 | Ponder EVM indexer | T-314 |
| 9 | T-321 | Postgres schema v3 | T-320 |
| 10 | T-330 | Backend tx engine EVM | T-314, T-321 |
| 11 | T-331 | API refactor (contract-first EVM) | T-330 |
| 12 | T-332 | Realtime bridge (WS + indexer) | T-320, T-331 |
| 13 | T-340 | Frontend wallet EVM switch | T-301 |
| 14 | T-341 | Duel UX (approve/deposit/settle) | T-331, T-340 |
| 15 | T-342 | FreeRun reward + proof UX | T-331, T-340 |
| 16 | T-350 | Docs/env overhaul | T-314, T-320, T-331, T-340 |
| 17 | T-351 | Deploy pipeline update | T-350 |
| 18 | T-352 | E2E rehearsal | T-351 |
| 19 | T-353 | Cutover + rollback plan | T-352 |

**Critical path**: T-300 → T-301 → T-310 → T-311 → T-313 → T-314 → T-330 → T-331 → T-341

**Parallelizable**: T-312 alongside T-311. T-340 alongside T-310–T-314. T-320 once T-314 lands.

---

## Consequences

### What Changes from ADR-001

1. **Contract model**: Kaspa covenants → Solidity smart contracts
2. **TX model**: UTXO inputs/outputs → EVM account model (nonce, gas, receipts)
3. **Wallet**: legacy extension → MetaMask (+ optional WalletConnect)
4. **Indexer**: Custom Kaspa DAG indexer → Ponder native EVM support
5. **Testing**: Mock-heavy unit tests → Hardhat test with local EVM

### What Stays the Same from ADR-001

1. **Server as orchestrator** — still true
2. **Postgres single source of truth** — still true
3. **Deploy split** (Vercel/Railway) — still true
4. **Game engine** (Phaser) — unchanged
5. **Speed-Visualizer SDK** — chain-agnostic, unchanged
6. **Session policy** (cooldown, max events, idempotency) — unchanged

### Risks

| Risk | Mitigation |
|---|---|
| KASPLEX Testnet instability | Keep UTXO fallback code in repo; can revert if needed |
| MetaMask chain add UX friction | Auto-prompt `wallet_addEthereumChain` with correct params |
| Gas costs on KASPLEX unknown | Measure during T-314; adjust reward amounts if needed |
| Ponder indexer lag on new chain | Set conservative polling interval; add latency metrics |
| Team ramp-up on Solidity | Use OpenZeppelin battle-tested patterns; minimize custom logic |

---

## References

- [ADR-001: Contract-first Architecture](./ADR-001-contract-first.md)
- [KASPLEX zkEVM Testnet](https://zkevm.kasplex.org)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [wagmi Documentation](https://wagmi.sh)
- [Ponder Documentation](https://ponder.sh/docs)
