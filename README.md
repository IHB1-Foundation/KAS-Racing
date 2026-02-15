# KAS Racing

> A web-based 3-lane runner game with real-time KASPLEX zkEVM integration, demonstrating sub-second transaction UX.

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)
[![Built with Kaspa](https://img.shields.io/badge/Built%20with-Kaspa-00d4aa)](https://kaspa.org)

## What is KAS Racing?

KAS Racing is a fast-paced endless runner game that integrates **real KASPLEX zkEVM transactions** (Kaspa ecosystem) into gameplay. When you collect checkpoint capsules, you receive instant kFUEL rewards — and you can watch the entire transaction lifecycle unfold in real-time through our HUD.

**Key Features:**
- **Real Blockchain Integration**: No mocks, no simulations — actual on-chain transactions
- **Transaction Lifecycle Visualization**: Watch rewards progress through `submitted → mined → confirmed`
- **Speed-Visualizer SDK**: Reusable React components for any Kaspa/KASPLEX-integrated app
- **1v1 Duel Mode**: Bet against friends with transparent settlement

## Why KAS Racing?

"Blockchain is slow" is a common misconception. KAS Racing proves otherwise by:

1. **Showing, not telling**: See transactions confirm in real-time as you play
2. **Measuring with precision**: Every stage is timestamped in milliseconds
3. **Providing proof**: Explorer links for every transaction

We don't claim "sub-second finality" — we let the HUD speak for itself.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client (Web)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Phaser Game   │  │   HUD/SDK       │  │  Wallet Connect │ │
│  │  (3-lane runner)│  │  (Timeline)     │  │  (MetaMask)     │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Server (Node.js)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Session Manager │  │  TX Engine      │  │  Event Bridge   │ │
│  │ (Policy Engine) │  │    (EVM)        │  │  (Indexer)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     KASPLEX zkEVM                               │
│                   RPC + Explorer                                │
└─────────────────────────────────────────────────────────────────┘
```

## Quickstart

### Prerequisites

- Node.js 20+
- pnpm 9+
- [MetaMask](https://metamask.io/) (or any injected EVM wallet)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/kas-racing.git
cd kas-racing

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

- **Game**: http://localhost:5173
- **API**: http://localhost:8787/api/health

### Configuration

For real transaction broadcasts, copy `.env.example` to `.env` and fill in:

```bash
NETWORK=testnet
EVM_CHAIN_ID=167012
EVM_RPC_URL=https://rpc.kasplextest.xyz
OPERATOR_PRIVATE_KEY=your_64_hex_private_key
ESCROW_CONTRACT_ADDRESS=0x...
REWARD_CONTRACT_ADDRESS=0x...
FUEL_TOKEN_ADDRESS=0x...
VITE_KFUEL_TOKEN_ADDRESS=0x...
```

## Game Modes

### Free Run (Arcade to Earn)

1. Connect your EVM wallet (MetaMask)
2. Press SPACE to start
3. Use LEFT/RIGHT arrows to dodge obstacles
4. Collect checkpoint capsules to earn kFUEL rewards
5. Watch the TX Timeline update in real-time

**Controls:**
- Desktop: ←/→ keys, SPACE to start
- Mobile: Swipe left/right, Tap to start

### Ghost-Wheel Duel (1v1 Betting)

1. Create a match and choose bet amount
2. Share the join code with your opponent
3. Both players deposit kFUEL
4. Race for 30 seconds — highest distance wins
5. Winner receives the pot automatically

## Speed-Visualizer SDK

The SDK provides reusable React components for Kaspa transaction visualization:

```tsx
import { TxLifecycleTimeline, KaspaRPMGauge } from '@kas-racing/speed-visualizer-sdk';

// Transaction lifecycle timeline
<TxLifecycleTimeline
  txid="abc123..."
  status="accepted"
  timestamps={{
    broadcasted: 1700000000000,
    accepted: 1700000001200,
  }}
  network="mainnet"
/>

// Network pulse gauge
<KaspaRPMGauge bps={1.5} maxBps={10} />
```

### Components

| Component | Description |
|-----------|-------------|
| `TxLifecycleTimeline` | Shows transaction progress through network stages |
| `KaspaRPMGauge` | Displays network blocks-per-second as a gauge |

## Proof Page

Visit `/proof` to verify any KAS Racing transaction:

1. Enter a transaction ID
2. See the decoded payload (game event, session, sequence)
3. Verify the transaction is genuine on-chain proof of gameplay

Payload format: `KASRACE1|network|mode|sessionId|event|seq|commit`

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/v3/session/start` | POST | Start game session |
| `/api/v3/session/event` | POST | Submit checkpoint event |
| `/api/v3/tx/:txHash/status` | GET | Get transaction status |
| `/api/v3/match/create` | POST | Create duel match |
| `/api/v3/match/join` | POST | Join match by code |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `subscribe` | Client→Server | Subscribe to session updates |
| `subscribeMatch` | Client→Server | Subscribe to match updates |
| `evmRewardUpdate` | Server→Client | RewardVault event updates (tx lifecycle) |
| `evmMatchUpdate` | Server→Client | MatchEscrow event updates |

## Project Structure

```
kas-racing/
├── apps/
│   ├── client/          # Phaser game + React UI
│   └── server/          # Express API + WebSocket
├── packages/
│   └── speed-visualizer-sdk/  # Reusable components
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ADR-002-evm-pivot.md
│   └── ADR-003-live-market.md
```

## Deployment

### Client (Vercel)

```bash
vercel --prod
```

Set `VITE_API_URL` in Vercel to your Railway server URL (example: `https://<service>.up.railway.app`).

### Server (Railway)

- This repo includes `railway.json` which deploys `apps/server/Dockerfile`.
- Create a Railway service from this repo, add Railway Postgres, then set Variables:
  - `NETWORK` (payload labeling)
  - `EVM_CHAIN_ID`, `EVM_RPC_URL`
  - `OPERATOR_PRIVATE_KEY`
  - `ESCROW_CONTRACT_ADDRESS`, `REWARD_CONTRACT_ADDRESS`, `FUEL_TOKEN_ADDRESS`
  - `CORS_ORIGIN` (your Vercel URL)
  - `DATABASE_URL` (Railway Postgres connection string)
  - `DATABASE_SSL=true`
- Verify health check: `GET /api/health` returns 200 on the Railway public URL.

### Server (Fly.io) (Legacy)

```bash
cd apps/server
fly launch --no-deploy
fly volumes create kas_racing_data --region sea --size 1
fly secrets set NETWORK=mainnet TREASURY_PRIVATE_KEY=... ...
fly deploy
```

## Security

- Treasury/Oracle keys are server-side only
- API keys are never exposed to clients
- Rate limiting protects against abuse
- See [SECURITY.md](SECURITY.md) for full details

## AI Usage Disclosure

This project was developed with AI assistance. See [AI_USAGE.md](AI_USAGE.md) for details on:
- Which parts used AI assistance
- What tools were used
- How AI contributions were reviewed

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Proprietary, all rights reserved. See [LICENSE](LICENSE) for details.

## Links

- [Kaspa](https://kaspa.org)
- [MetaMask](https://metamask.io/)
- [KASPLEX Explorer](https://zkevm.kasplex.org)

---

Built for the Kaspa Hackathon 2026
