# KAS Racing — Architecture

## System Overview

```mermaid
graph TB
    subgraph Client["Client (Web Browser)"]
        PHASER[Phaser Game Engine]
        HUD[HUD Components]
        WALLET[Wallet Provider]
        SDK[Speed-Visualizer SDK]
    end

    subgraph Server["Server (Node.js)"]
        API[REST API]
        WS[WebSocket Server]
        POLICY[Session Policy Engine]
        REWARD[Reward Payout Engine]
        TRACKER[Tx Status Tracker]
        DB[(Database)]
    end

    subgraph Kaspa["Kaspa Network"]
        NODE[Kaspa Node / RPC]
        EXPLORER[Block Explorer]
    end

    PHASER --> HUD
    HUD --> SDK
    WALLET --> |Deposit TX| NODE

    PHASER --> |Events| API
    API --> POLICY
    POLICY --> REWARD
    REWARD --> |Broadcast| NODE

    TRACKER --> |Query| NODE
    TRACKER --> |Push Status| WS
    WS --> SDK

    SDK --> |Link| EXPLORER

    API --> DB
    REWARD --> DB
    TRACKER --> DB
```

## Component Breakdown

### Client (`apps/client`)

| Component | Responsibility |
|-----------|----------------|
| Phaser Game | 3-lane infinite runner, checkpoint capsules, collision |
| HUD | Distance, speed, checkpoints, tx panel |
| Wallet Provider | Abstract interface for Kasware/other wallets |
| Speed-Visualizer SDK | TxLifecycleTimeline, KaspaRPMGauge components |

### Server (`apps/server`)

| Component | Responsibility |
|-----------|----------------|
| REST API | Session start, event submission, tx status query |
| WebSocket | Real-time tx status push to clients |
| Session Policy | Cooldown (2s), max events (10), timestamp validation |
| Reward Payout | Treasury UTXO → User payout tx (1-in, 2-out) |
| Tx Status Tracker | Poll node/indexer, update state machine |
| Database | Sessions, reward_events, matches (unique: sessionId+seq) |

### SDK (`packages/speed-visualizer-sdk`)

| Component | Responsibility |
|-----------|----------------|
| TxLifecycleTimeline | broadcasted → accepted → included → confirmations |
| KaspaRPMGauge | Network pulse / estimated BPS visualization |
| NetworkPulsePanel | (Optional) Additional network stats |

## Data Flow

### Free Run: Checkpoint → Payout

```mermaid
sequenceDiagram
    participant P as Player
    participant G as Game (Client)
    participant S as Server
    participant K as Kaspa Network

    P->>G: Collect Checkpoint Capsule
    G->>S: POST /api/session/event {sessionId, seq, type}
    S->>S: Policy Check (cooldown, max, active)
    alt Policy OK
        S->>S: Create Reward TX (treasury → user)
        S->>K: Broadcast TX
        K-->>S: txid
        S-->>G: {rewardAmount, txid, status: broadcasted}
        G->>G: Show txid in HUD
        loop Status Polling
            S->>K: Query TX status
            K-->>S: accepted/included/confirmations
            S-->>G: WebSocket push {txid, status, timestamps}
            G->>G: Update TxLifecycleTimeline
        end
    else Policy Violation
        S-->>G: {error: COOLDOWN_ACTIVE / MAX_REACHED}
    end
```

### Duel: Deposit → Race → Settlement

```mermaid
sequenceDiagram
    participant A as Player A
    participant B as Player B
    participant S as Server
    participant K as Kaspa Network

    A->>S: POST /api/match/create
    S-->>A: {matchId, joinCode, escrowAddress}
    B->>S: POST /api/match/join {joinCode}
    S-->>B: {matchId, escrowAddress}

    A->>K: Deposit TX (wallet sign)
    B->>K: Deposit TX (wallet sign)
    A->>S: Register deposit txid
    B->>S: Register deposit txid

    S->>K: Verify deposits (accepted/included)
    S-->>A: Match READY
    S-->>B: Match READY

    Note over A,B: 30-second Race

    A->>S: Final distance
    B->>S: Final distance
    S->>S: Determine winner
    S->>S: Create Settlement TX (escrow → winner)
    S->>K: Broadcast Settlement TX
    S-->>A: Result + settle txid
    S-->>B: Result + settle txid
```

## Transaction Types

| Type | Inputs | Outputs | Signer |
|------|--------|---------|--------|
| Reward Payout | Treasury UTXO | User (reward) + Treasury (change) | Server (treasury key) |
| Deposit | User UTXO | Escrow address | User wallet |
| Settlement | Escrow UTXO(s) | Winner (or split if draw) | Server (oracle key) |

## Key Design Decisions

1. **No Claim/Withdraw Button**: Rewards are pushed automatically on checkpoint
2. **Server-side TX Creation**: Treasury key never leaves server
3. **Idempotent Events**: (sessionId, seq) is unique; duplicate requests return existing txid
4. **Output Minimum**: 0.02 KAS minimum output to avoid dust
5. **Rate Limiting**: 2s cooldown, 10 events max per session

## Directory Structure

```
kas-racing/
├── apps/
│   ├── client/          # Phaser game + React UI
│   └── server/          # Express/Nest API + WebSocket
├── packages/
│   └── speed-visualizer-sdk/  # Reusable HUD components
├── docs/
│   ├── ARCHITECTURE.md  # This file
│   └── ...
├── PROJECT.md           # Product specification
├── TICKET.md            # Task tracking
└── WORKLOG.md           # Progress log
```

## Security Boundaries

- **Server-only secrets**: `TREASURY_PRIVATE_KEY`, `ORACLE_PRIVATE_KEY`
- **Never log**: Private keys, seeds, sensitive user data
- **Never expose**: API keys to client (indexer calls go through server)
- **Validate**: All client events against session state and policy
