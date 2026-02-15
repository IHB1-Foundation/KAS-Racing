# KAS Racing — Architecture (EVM/KASPLEX)

## Overview
KAS Racing is an EVM-first game stack on KASPLEX zkEVM. Gameplay events trigger **real on-chain transactions** and the UI visualizes the full lifecycle in real time.

## Components

### Client (`apps/client`)
- **Phaser Game**: 3-lane runner + duel race loop
- **React UI**: HUD, timelines, proof view, lobby UX
- **EVM Wallet**: wagmi/viem + MetaMask (KASPLEX Testnet)
- **Realtime Sync**: Socket.IO + reconciliation polling

### Server (`apps/server`)
- **REST API**: `/api/v3/*` session, match, proof, tx, market
- **WebSocket**: push on-chain updates to the client
- **EVM Tx Engine**: operator-signed contract calls via viem
- **DB**: Postgres + Drizzle (v3 tables)

### Indexer (`apps/indexer-evm`)
- Watches MatchEscrow + RewardVault events
- Writes `chain_events_evm` for bridge processing

### Contracts (`apps/contracts-evm`)
- **MatchEscrow**: duel escrow + settlement
- **RewardVault**: Free Run payouts + proof registry
- **KasRacingFuel (kFUEL)**: optional ERC-20 for in-game rewards

## Data Flow

### Free Run (Rewards)
1. Client starts session → `/api/v3/session/start`
2. Checkpoint event → `/api/v3/session/event`
3. Server calls `RewardVault.payReward()`
4. Indexer writes `RewardPaid`/`ProofRecorded`
5. EVM event bridge emits `evmRewardUpdate`
6. HUD updates `submitted → mined → confirmed`

### Duel (1v1)
1. Player creates lobby → `/api/v3/match/create`
2. Opponent joins → `MatchEscrow.createMatch()`
3. Players deposit via wallet → `MatchEscrow.deposit()`
4. Indexer writes `Deposited`/`MatchFunded`
5. Race ends → `/api/v3/match/:id/submit-score`
6. Server calls `settle` / `settleDraw`
7. Indexer writes `Settled` / `Draw`
8. UI shows final settlement tx

## WebSocket Events
- `evmMatchUpdate` — MatchEscrow events (Deposited, MatchFunded, Settled, Draw)
- `evmRewardUpdate` — RewardVault events (RewardPaid, ProofRecorded)

## Runtime Requirements
- Postgres
- KASPLEX RPC + contracts deployed
- Operator key for server-side contract writes
