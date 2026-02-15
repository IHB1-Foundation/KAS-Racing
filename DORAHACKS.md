# KAS Racing (Speed-Visualizer SDK)

## One-Line Summary

A 3-lane runner that fires real Kaspa on-chain transactions during gameplay and visualizes each stage in real time, plus a reusable Speed-Visualizer HUD SDK.

![KAS Racing Screenshot 1](https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/1.png?raw=true)

## Track Targets

- Gaming and interactive: on-chain transactions drive gameplay rewards and 1v1 outcomes
- Payments and commerce: instant-feeling micro-payouts at checkpoints with a transparent lifecycle
- Real-time data: live transaction-state telemetry streamed into the HUD

![KAS Racing Screenshot 2](https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/2.png?raw=true)

## Impact

- Flips the "blockchain is slow" perception by letting players feel speed
- Demonstrates what real-time PoW unlocks for game economies and settlement loops
- Reusable SDK lets other builders add the same telemetry to any Kaspa app

![KAS Racing Screenshot 3](https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/3.png?raw=true)

## Why It Is Special

- No mocks: real transactions in the game loop
- Millisecond lifecycle visualization (broadcasted -> accepted -> included -> confirmed)
- Proof page recomputes payload hashes and verifies RewardPaid and ProofRecorded logs

![KAS Racing Screenshot 4](https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/4.png?raw=true)

## Key Features

- Free Run (Arcade to Earn): checkpoint capsules trigger real rewards
- Ghost-Wheel Duel (1v1): MatchEscrow holds both deposits, then settles a single payout to the winner
- Speed-Visualizer SDK: reusable React HUD components
- Proof Page: recompute payloads, match hashes, and show on-chain evidence

## Tech Stack

- Client: React + Phaser 3
- Server: Node.js (Express) + WebSocket (socket.io)
- DB: PostgreSQL (Drizzle ORM)
- Blockchain: Kaspa (kaspa-wasm + REST API)
- Deploy: Vercel (client), Railway (server)

![KAS Racing Screenshot 6](https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/6.png?raw=true)

## How It Works (High Level)

1. Player starts a session, then hits a checkpoint.
2. The server validates policy (cooldown and max events) and builds a payout call.
3. For each checkpoint it builds a deterministic payload:
   `KASRACE1|<network>|<mode>|<sessionId>|checkpoint|<seq>`
   and hashes it into the on-chain proof.
4. The indexer ingests RewardPaid and ProofRecorded logs and streams lifecycle timestamps to the HUD.
5. The Proof Page recomputes the payload and hash to cross-check the tx hash, block, and logs.
6. In Ghost-Wheel Duel, both players deposit into MatchEscrow -> race -> a single settle tx pays the winner.

![KAS Racing Screenshot 5](https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/5.png?raw=true)

## What Is Next

- Full covenant escrow settlement on mainnet
- Expanded SDK docs and examples
- Additional game modes using the same on-chain telemetry

## AI Usage

AI tools were used for scaffolding and documentation. All core gameplay, contract logic, and integration flows were reviewed and validated by the team.
