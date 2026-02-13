# ADR-001: Contract-first Architecture

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-02-14 |
| Deciders | Core team |
| Supersedes | MVP fallback-only architecture (P0–P12) |

---

## Context

KAS Racing MVP (P0–P12) was built with a **server-custodial fallback** model:

- Duel deposits go to the treasury address; the server pays the winner.
- Reward payouts are signed/broadcast by the server's treasury key.
- Escrow covenant scripts were designed (T-071–T-074) but only tested at unit level; no on-chain covenant TX was executed.

Since January 2026, **Testnet 12 has KIP-10 covenants enabled**. This allows real
on-chain enforcement of escrow rules (output restriction, timelock refund).
Mainnet activation is expected later in 2026.

The existing codebase has:
- Drizzle ORM + Postgres (migrated from SQLite in T-021 follow-up).
- REST + WebSocket API on Express.
- kaspa-wasm + REST API for TX building/broadcasting.
- A covenant script builder (`apps/server/src/escrow/scriptBuilder.ts`) ready to generate P2SH addresses.

We need a clear, frozen architecture to guide the remaining P13 tickets (T-200–T-210) so that every contributor knows **what lives where** and **what is in scope for the demo**.

---

## Decision

### Principle 1 — Contract-first

The **on-chain contract** (covenant escrow script) is the source of truth for:
- Whether a deposit was received.
- Whether a settlement is valid (outputs restricted to players).
- Whether a refund is allowed (timelock expired).

The server **never overrides** contract state. If the indexer reports a deposit confirmed on-chain, that is authoritative — even if the server's in-memory state disagrees.

### Principle 2 — Server as Orchestrator

The server's responsibilities are limited to:

| Responsibility | Example |
|---|---|
| **Key custody** | Treasury key, oracle key (never leave server process) |
| **Policy enforcement** | Cooldown, max events, rate limiting, idempotency |
| **TX orchestration** | Build, sign, broadcast, retry (reward payouts, settlements) |
| **State coordination** | Read indexer data, push status to FE via WebSocket |
| **Game logic** | Session management, match scoring, winner determination |

The server does **not** hold deposits on behalf of users in production (covenant mode).
Fallback mode (server-custodial) is retained only for mainnet until covenants activate.

### Principle 3 — Postgres Single Source of Truth

All operational state is stored in a single Postgres instance:

- `users`, `sessions`, `reward_events`, `matches` (existing)
- `contracts` — deployed contract addresses per network (new)
- `deposits` — deposit TX tracking with on-chain status (extracted from matches)
- `settlements` — settlement TX tracking (extracted from matches)
- `chain_events` — raw indexed events from Ponder
- `idempotency_keys` — request deduplication

SQLite is fully removed from runtime paths. The `DATABASE_URL` env var points to Postgres.

### Principle 4 — Ponder for Event Indexing

[Ponder](https://ponder.sh) runs as a separate Railway service. It:

1. Watches the Kaspa testnet for events related to our escrow contract addresses.
2. Backfills historical blocks from a configured start block.
3. Writes indexed events into the shared Postgres (`chain_events`, `match_state_snapshots`).
4. Handles chain reorganizations within a configurable depth.

The API server reads Ponder-populated tables. If the indexer is behind, the API falls back to direct RPC queries (degraded mode, not silent failure).

### Principle 5 — Deploy Split

| Layer | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Static SPA, env vars for API URL / network / contract address |
| API Server | Railway (service 1) | Express + WS, connects to Postgres |
| Ponder Indexer | Railway (service 2) | Separate process, connects to Postgres + Kaspa RPC |
| Postgres | Railway (managed addon) | Single database, shared by API + Ponder |

---

## Scope Lock (Demo-required)

The following screens/flows are **required** for the hackathon demo. Everything else is stretch.

### Free Run (Required)

| Step | Actor | On-chain? |
|---|---|---|
| Start session | FE → API | No |
| Collect checkpoint | FE → API → TX builder | Yes — reward payout TX broadcast |
| View lifecycle | FE (SDK timeline) | Read-only (status polling) |

Contract involvement: **None** (reward payout uses treasury key directly).

### Duel (Required)

| Step | Actor | On-chain? |
|---|---|---|
| Create match | FE → API | No |
| Join match | FE → API | No |
| Generate escrow addresses | API (script builder) | No (address derivation only) |
| Deposit | Player wallet → escrow address | Yes — player signs |
| Confirm deposit | Indexer/poller → API → WS → FE | Read-only |
| Race (30s) | FE game + API scoring | No |
| Settlement | API → TX builder → broadcast | Yes — oracle signs |
| View result | FE (SDK timeline) | Read-only |

Contract involvement: **Testnet = covenant mode**, **Mainnet = fallback mode**.

### Proof Page (Required)

| Step | Actor | On-chain? |
|---|---|---|
| Enter txid | User | No |
| Fetch TX details | FE → API → Kaspa REST | Read-only |
| Parse payload | FE (client-side parser) | No |
| Display proof | FE | No |

### Settlement (Required)

| Mode | Mechanism |
|---|---|
| Testnet (covenant) | Escrow UTXO inputs, oracle signature, output-restricted to players |
| Mainnet (fallback) | Treasury pays winner directly |

### Out of Scope for Demo

- Real-time multiplayer synchronization (each player plays locally, scores compared).
- Mobile-native app (web-only).
- Mainnet covenant mode (blocked on network activation).
- Multi-round tournaments.
- Leaderboard persistence across sessions.

---

## Environment Matrix

| Environment | Chain | FE Host | BE Host | DB | Indexer | Contract Mode |
|---|---|---|---|---|---|---|
| **local** | testnet RPC | localhost:5173 | localhost:8787 | local Postgres | local Ponder (optional) | covenant or fallback |
| **testnet** | Testnet 12 | Vercel preview | Railway dev | Railway Postgres | Railway Ponder | covenant |
| **staging** | Testnet 12 | Vercel preview | Railway staging | Railway Postgres | Railway Ponder | covenant |
| **production** | Mainnet | Vercel prod | Railway prod | Railway Postgres | Railway Ponder | fallback (until KIP-10 mainnet) |

### Required Environment Variables

**API Server:**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `NETWORK` | Yes | `testnet` or `mainnet` |
| `TREASURY_PRIVATE_KEY` | Yes | Hex, 64 chars |
| `TREASURY_CHANGE_ADDRESS` | Yes | Kaspa address matching network |
| `ORACLE_PRIVATE_KEY` | Yes | Hex, 64 chars |
| `CORS_ORIGIN` | Yes (prod) | Comma-separated allowed origins |
| `PORT` | No | Default 8787 |
| `DATABASE_SSL` | No | Default `true` |
| `DATABASE_POOL_MAX` | No | Default 20 |
| `SKIP_KEY_VALIDATION` | No | Default `false` (dev only) |
| `SKIP_DB_MIGRATIONS` | No | Default `false` |

**Frontend (build-time):**

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend URL (e.g., `https://api.kas-racing.up.railway.app`) |
| `VITE_NETWORK` | Yes | `testnet` or `mainnet` |

**Ponder Indexer:**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Same Postgres as API |
| `RPC_URL` | Yes | Kaspa RPC endpoint |
| `START_BLOCK` | No | Block to start indexing from |

---

## Implementation Priority (T-200 → T-210)

| Order | Ticket | What | Blocked By |
|---|---|---|---|
| 1 | T-200 | This ADR + scope lock | — |
| 2 | T-201 | Contract workspace bootstrap | T-200 |
| 3 | T-202 | Escrow/settlement contract implementation | T-201 |
| 4 | T-203 | Contract testnet deployment + verification | T-202 |
| 5 | T-205 | Postgres schema v2 + migration | T-200 |
| 6 | T-204 | Ponder indexer setup | T-203 |
| 7 | T-206 | Backend refactor to contract orchestrator | T-203, T-205 |
| 8 | T-207 | Frontend Web3 refactor | T-203, T-206 |
| 9 | T-208 | Frontend realtime integration (indexer-fed) | T-204, T-207 |
| 10 | T-209 | Deploy blueprint (Vercel + Railway + Postgres) | T-204, T-206, T-207 |
| 11 | T-210 | Demo readiness pack | T-209 |

**Critical path**: T-200 → T-201 → T-202 → T-203 → T-206 → T-207 → T-209 → T-210

**Parallelizable**: T-205 can run alongside T-201–T-203. T-204 can start once T-203 lands.

---

## Consequences

### What Changes

1. **Contract workspace** (`apps/contracts` or `packages/contracts`) is added to the monorepo.
2. **DB schema** evolves: `deposits` and `settlements` are promoted to first-class tables; `chain_events` is added.
3. **Ponder indexer** is a new Railway service.
4. **Settlement service** routes through covenant TX builder on testnet, falls back to treasury payout on mainnet.
5. **Frontend** renders state from indexer-backed API, not from server-side simulations.

### What Stays the Same

1. **Free Run reward payout** — unchanged (server → treasury key → broadcast).
2. **Session policy engine** — unchanged (cooldown, max events, idempotency).
3. **Speed-Visualizer SDK** — unchanged (TxLifecycleTimeline, KaspaRPMGauge).
4. **Deploy platforms** — Vercel (FE) + Railway (BE) — unchanged.
5. **Wallet provider abstraction** — unchanged (IWalletProvider, Kasware, Mock).

### Risks

| Risk | Mitigation |
|---|---|
| Testnet 12 RPC instability | Keep fallback mode always functional; demo can switch |
| Ponder compatibility with Kaspa | Evaluate early in T-204; if blocked, use custom polling indexer |
| Postgres schema migration breaks existing data | Use `CREATE TABLE IF NOT EXISTS` + additive migrations |
| Demo time pressure | Scope lock above defines minimum; anything beyond is stretch |

---

## References

- [KIP-10: Script Engine Enhancements](https://github.com/kaspanet/kips/blob/master/kip-0010.md)
- [Ponder Documentation](https://ponder.sh/docs)
- [Kaspa Testnet 12 Covenants](https://ourcryptotalk.com/news/kaspa-testnet-12-covenants-launch/)
- [docs/COVENANT_FEASIBILITY.md](./COVENANT_FEASIBILITY.md)
- [docs/ESCROW_SCRIPT_TEMPLATE.md](./ESCROW_SCRIPT_TEMPLATE.md)
