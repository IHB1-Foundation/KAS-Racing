# KAS Racing

A web-based 3-lane runner game that integrates real KASPLEX zkEVM transactions into gameplay and visualizes each step of the transaction lifecycle in real time.

## Overview

KAS Racing connects a fast arcade loop with real on-chain reward payouts. Every checkpoint capsule triggers a live transaction and the HUD streams its lifecycle from submission to confirmation.

## Highlights

- Real blockchain integration (no mocks)
- Live transaction lifecycle visualization
- Reusable Speed-Visualizer React SDK
- 1v1 duel mode with transparent settlement

## Architecture (High Level)

- Client: Phaser game + React UI + wallet integration
- Server: Node.js API + WebSocket updates
- Indexer: event ingestion and timeline updates
- Chain: KASPLEX zkEVM RPC + explorer

## Quickstart

### Prerequisites

- Node.js 20+
- pnpm 9+
- MetaMask or another injected EVM wallet

### Install and run

```bash
git clone https://github.com/your-username/kas-racing.git
cd kas-racing
pnpm install
pnpm dev
```

- Game: http://localhost:5173
- API: http://localhost:8787/api/health

## Configuration

For real transaction broadcasts, copy `.env.example` to `.env` and fill in values. Do not commit secrets.

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

1. Connect your EVM wallet
2. Press SPACE to start
3. Use LEFT/RIGHT arrows to dodge obstacles
4. Collect checkpoint capsules to earn kFUEL rewards
5. Watch the transaction timeline update in real time

Controls:
- Desktop: Left/Right arrows, SPACE to start
- Mobile: Swipe left/right, tap to start

### Ghost-Wheel Duel (1v1 Betting)

1. Create a match and choose a bet amount
2. Share the join code with an opponent
3. Both players deposit kFUEL into escrow
4. Race for 30 seconds
5. Winner receives the pot automatically

## Speed-Visualizer SDK

Reusable React components for Kaspa transaction visualization.

```tsx
import { TxLifecycleTimeline, KaspaRPMGauge } from '@kas-racing/speed-visualizer-sdk';

<TxLifecycleTimeline
  txid="abc123..."
  status="accepted"
  timestamps={{
    broadcasted: 1700000000000,
    accepted: 1700000001200,
  }}
  network="mainnet"
/>

<KaspaRPMGauge bps={1.5} maxBps={10} />
```

Components:
- `TxLifecycleTimeline`: shows transaction progress through network stages
- `KaspaRPMGauge`: displays blocks-per-second as a gauge

## Proof Page

Visit `/proof` to verify any KAS Racing transaction:

1. Enter a transaction ID
2. See the decoded payload (game event, session, sequence)
3. Verify the transaction on-chain

Payload format:

```
KASRACE1|network|mode|sessionId|event|seq|commit
```

## API Reference (Summary)

REST:
- `GET /api/health`
- `POST /api/v3/session/start`
- `POST /api/v3/session/event`
- `GET /api/v3/tx/:txHash/status`
- `POST /api/v3/match/create`
- `POST /api/v3/match/join`

WebSocket events:
- `subscribe` (client -> server)
- `subscribeMatch` (client -> server)
- `evmRewardUpdate` (server -> client)
- `evmMatchUpdate` (server -> client)

## Project Structure

```
kas-racing/
+-- apps/
|   +-- client/          # Phaser game + React UI
|   +-- server/          # Express API + WebSocket
+-- packages/
|   +-- speed-visualizer-sdk/
+-- README.md            # Main documentation
+-- DORAHACKS.md         # Hackathon submission
```

## Deployment

### Client (Vercel)

```bash
vercel --prod
```

Set `VITE_API_URL` in Vercel to your Railway server URL.

### Server (Railway)

- `railway.json` deploys `apps/server/Dockerfile`.
- Create a Railway service, add Postgres, then set variables:
  - `NETWORK`
  - `EVM_CHAIN_ID`, `EVM_RPC_URL`
  - `OPERATOR_PRIVATE_KEY`
  - `ESCROW_CONTRACT_ADDRESS`, `REWARD_CONTRACT_ADDRESS`, `FUEL_TOKEN_ADDRESS`
  - `CORS_ORIGIN`
  - `DATABASE_URL`
  - `DATABASE_SSL=true`
- Verify health check: `GET /api/health` returns 200 on the Railway public URL.

## Security Notes

- Operator keys are server-side only
- Rate limiting protects gameplay endpoints

## AI Usage

AI tools were used for scaffolding and documentation. All core gameplay, contract logic, and integration flows were reviewed and validated by the team.

## License

Proprietary. See `LICENSE` for details.
