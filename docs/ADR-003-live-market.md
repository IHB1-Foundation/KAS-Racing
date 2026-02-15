# ADR-003: Live Race Market — Real-time Odds + Bet/Cancel Rules

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-02-16 |
| Deciders | Core team |
| Depends on | ADR-002 (EVM Pivot) |

---

## Context

T-390 established the **Duel Realtime Baseline**: auto-start, auto-score-submit, and auto-settle after both players' deposits are funded. The current duel is a fixed-stake 1v1 where each player deposits the same amount and the winner takes all.

The next evolution is a **Live Race Market** — a real-time betting layer where spectators (or additional participants) can place bets on race outcomes while the race is in progress. This requires:

1. A market state machine governing when bets are accepted/rejected.
2. Real-time odds calculation based on race telemetry.
3. Clear cancellation boundaries.
4. A well-defined boundary between off-chain market operations and on-chain settlement.

### Design Constraints

- **No over-engineering**: The market engine runs off-chain; only final payouts go on-chain.
- **No spam**: Odds ticks are throttled and only broadcast on meaningful change.
- **Fail-closed**: If any component is uncertain, reject the bet rather than accept it.
- **Idempotent**: Every bet/cancel request uses an idempotency key to prevent double-execution.

---

## Decision

### 1. Market State Machine

Each race creates exactly **one market**. The market progresses through the following states:

```
             create
               │
               ▼
     ┌───── OPEN ──────┐
     │   (bets accepted) │
     │   (cancels OK)    │
     └────────┬─────────┘
              │ race countdown hits lock threshold
              │ OR manual lock trigger
              ▼
     ┌───── LOCKED ─────┐
     │  (no new bets)    │
     │  (no cancels)     │
     │  (odds frozen)    │
     └────────┬─────────┘
              │ race result confirmed
              ▼
     ┌──── SETTLED ─────┐         ┌─── CANCELLED ──┐
     │  (payouts calc'd) │         │  (all refunded) │
     │  (on-chain tx)    │         │  (no payouts)   │
     └──────────────────┘         └─────────────────┘
              ▲                            ▲
              │                            │
         normal finish              abort conditions
```

**State transitions:**

| From | To | Trigger | Reversible? |
|---|---|---|---|
| — | `OPEN` | Market created (race match is `funded`) | No |
| `OPEN` | `LOCKED` | Lock timer fires (default: 3s before race end) | No |
| `OPEN` | `CANCELLED` | Race aborted / player disconnect / admin cancel | No |
| `LOCKED` | `SETTLED` | Race result confirmed + payouts calculated | No |
| `LOCKED` | `CANCELLED` | Exceptional abort (system failure, dispute) | No |

**Invariants:**
- A market can only move forward; no backward transitions.
- `SETTLED` and `CANCELLED` are terminal states.
- Once `LOCKED`, no bet or cancel mutations are accepted.

### 2. Cancellation Rules

| Rule | Definition | Example |
|---|---|---|
| **State gate** | Cancel is allowed only when `market.state === OPEN` | Market in `LOCKED` → cancel rejected with `MARKET_LOCKED` |
| **Ownership** | Only the bet creator can cancel their own bet | Player A cannot cancel Player B's bet |
| **Idempotency** | Duplicate cancel requests return the existing cancel result | Second `POST /cancel` with same idempotency key → 200 with existing result |
| **Settlement finality** | Once `SETTLED`, no cancellation possible even for unsettled bets | All bets are either won or lost at settlement |

**Cancellation examples:**

```
Timeline (30-second race):
──────────────────────────────────────────────────────►
t=0         t=5          t=15         t=27      t=30
OPEN        bet placed   cancel OK    LOCKED    SETTLED
            ↑                         ↑
            bet A placed at t=5       lock at t=27 (3s before end)

Scenario 1: Cancel at t=15 → ALLOWED (market OPEN, owner matches)
Scenario 2: Cancel at t=28 → REJECTED (market LOCKED)
Scenario 3: Cancel at t=31 → REJECTED (market SETTLED)
```

### 3. Odds Calculation & Update Frequency

#### Input Signals (Race Telemetry)

| Signal | Source | Weight | Update Rate |
|---|---|---|---|
| Distance traveled | DuelScene `raceEnd` / progress events | High | Per game tick (~60fps, sampled at 200ms) |
| Current speed | DuelScene velocity | Medium | Sampled at 200ms |
| Time remaining | Countdown timer | High | Derived from elapsed |
| Obstacle hits | Collision events | Low | Event-driven |

#### Odds Engine Parameters

| Parameter | Default | Range | Description |
|---|---|---|---|
| `ODDS_TICK_INTERVAL_MS` | 300 | 100–500 | Minimum interval between odds broadcasts |
| `ODDS_CHANGE_THRESHOLD` | 0.02 | 0.01–0.10 | Minimum probability change to trigger a tick (2%) |
| `ODDS_INITIAL` | [0.50, 0.50] | — | Equal odds at race start (2-player) |
| `ODDS_LOCK_BEFORE_END_MS` | 3000 | 1000–5000 | Lock market N ms before race ends |

#### Odds Normalization

- Probabilities are always normalized to sum to 1.0 (two-outcome market).
- Displayed as decimal odds: `odds = 1 / probability`.
- Example: Player A at 60% → decimal odds 1.67; Player B at 40% → decimal odds 2.50.
- Odds are stored as integer basis points (0–10000) internally to avoid floating-point drift.
  - 6000 bps = 60.00% probability = 1.67 decimal odds.

#### Tick Publishing Rules

1. Engine samples telemetry every `ODDS_TICK_INTERVAL_MS`.
2. Compute new probabilities from current race state.
3. If `|newProb - lastPublishedProb| >= ODDS_CHANGE_THRESHOLD`, emit tick.
4. If threshold not met, skip (no broadcast).
5. On `LOCKED` transition, emit one final tick with frozen odds.
6. Store every emitted tick in `odds_ticks` table with monotonic sequence number.

### 4. Settlement Source Boundary (Off-chain vs On-chain)

```
┌─────────────────────────────────────────────────────────────┐
│                    OFF-CHAIN (Server)                        │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │   Odds Engine         │  │   Market Order Service        │ │
│  │                        │  │                                │ │
│  │  • Telemetry intake    │  │  • Place bet (validate/store)  │ │
│  │  • Probability calc    │  │  • Cancel bet (state check)    │ │
│  │  • Tick publishing     │  │  • Idempotency enforcement     │ │
│  │  • Threshold filtering │  │  • Exposure calculation        │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │   Settlement Calculator                                   ││
│  │                                                            ││
│  │  • Winner determination (from race result)                 ││
│  │  • Payout calculation per bet (stake × odds at placement)  ││
│  │  • Fee deduction (platform fee, if any)                    ││
│  │  • Settlement record creation                              ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│          │ settlement records (who gets how much)             │
│          ▼                                                    │
├─────────────────────────────────────────────────────────────┤
│                    ON-CHAIN (EVM Contract)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │   Market Settlement Contract (or RewardVault extension)   ││
│  │                                                            ││
│  │  • Receive payout batch from server                        ││
│  │  • Execute transfers to winners                            ││
│  │  • Emit settlement events (for indexer)                    ││
│  │  • Verify total payouts ≤ total pool (invariant)           ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why this boundary?**

| Concern | Off-chain | On-chain | Rationale |
|---|---|---|---|
| Odds calculation | Yes | No | High frequency, low latency required; no reason to pay gas |
| Bet placement | Yes | No | Must be instant (<100ms); on-chain would add latency |
| Bet cancellation | Yes | No | Same as above |
| Payout execution | No | Yes | Must be verifiable; players need proof of payment |
| Pool accounting | Yes (primary) | Yes (invariant check) | Server tracks pool; contract verifies total out ≤ total in |

**Pool funding model:**

- Bets are placed with **off-chain balance** (pre-deposited to platform wallet or session deposit).
- Server maintains a virtual pool per market.
- On settlement, server batches payouts via on-chain transaction(s).
- If the market is `CANCELLED`, all virtual balances are restored (no on-chain tx needed unless funds were already on-chain).

### 5. Bet Order Lifecycle

```
place bet
    │
    ▼
┌─ PENDING ──┐     cancel request
│  (accepted  │ ────────────────► CANCELLED
│   by server)│                   (refund to balance)
└─────┬──────┘
      │ market settles
      ▼
┌─── WON ────┐     or     ┌─── LOST ───┐
│ payout calc │            │ stake lost  │
│ on-chain tx │            │ no payout   │
└─────────────┘            └─────────────┘
```

**Order fields:**

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique order ID |
| `marketId` | UUID | FK to `race_markets` |
| `userId` | UUID | FK to `users` |
| `side` | enum(`A`, `B`) | Which player the bet is on |
| `stakeWei` | bigint | Bet amount in wei |
| `oddsAtPlacement` | int (bps) | Odds locked at time of placement |
| `status` | enum | `pending` / `won` / `lost` / `cancelled` |
| `payoutWei` | bigint | null | Calculated payout (null until settled) |
| `idempotencyKey` | string | Client-provided dedup key |
| `createdAt` | timestamp | |
| `settledAt` | timestamp | null | |

### 6. Risk Controls (Brief)

| Control | Rule | Default |
|---|---|---|
| Max bet per order | `stakeWei ≤ MAX_BET_WEI` | 1 KAS |
| Max exposure per user per market | Sum of active bets ≤ `MAX_EXPOSURE_WEI` | 5 KAS |
| Max pool per market | Total pool ≤ `MAX_POOL_WEI` | 50 KAS |
| Min bet | `stakeWei ≥ MIN_BET_WEI` | 0.01 KAS |
| Rate limit | Max 5 bet requests per user per second | — |

---

## Consequences

### What This Enables

1. **T-401**: Schema for `race_markets`, `odds_ticks`, `bet_orders`, `bet_cancels`, `market_settlements`.
2. **T-402**: Odds engine implementation with defined parameters and tick rules.
3. **T-403**: Bet/Cancel API with clear validation rules and state gates.
4. **T-404**: WS protocol with defined event types (`marketTick`, `betAccepted`, etc.).
5. **T-405**: Frontend can build against frozen rules (odds display, bet panel, cancel button).
6. **T-406**: Settlement bridge knows exactly what data to send on-chain.

### Risks

| Risk | Mitigation |
|---|---|
| Odds model inaccuracy | Start with simple distance-ratio model; iterate post-demo |
| Virtual balance complexity | MVP: single deposit covers duel + market bets; no separate balance |
| Pool insolvency | Server enforces `total_payouts ≤ total_pool` invariant before settlement |
| High-frequency WS load | Tick throttling + change threshold prevent broadcast spam |

### What We Explicitly Do NOT Do

- No order book / limit orders — all bets are at current market odds.
- No partial fills — bet is fully accepted or rejected.
- No leverage / margin — bet amount = max loss.
- No cross-market positions — each market is independent.
- No real-money regulatory compliance — this is a testnet demo.

---

## References

- [ADR-002: EVM Pivot](./ADR-002-evm-pivot.md)
