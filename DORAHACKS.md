# KAS Racing (Speed-Visualizer SDK)

## Summary
A web-based 3‑lane runner that triggers real Kaspa on‑chain transactions during gameplay and visualizes each transaction stage in real time. It proves blockchain speed by UX, not claims, and ships a reusable HUD SDK.

## Problem
“Blockchain is slow” is a persistent perception. Most demos are abstract or mocked, so users never feel the real network latency and lifecycle.

## Solution
KAS Racing turns on‑chain activity into immediate, visible gameplay feedback. Each checkpoint reward is a real Kaspa transaction, and the HUD shows `broadcasted → accepted → included → confirmed` with timestamps and explorer links.

## Key Features
- **Free Run (Arcade‑to‑Earn):** checkpoint capsules trigger real reward payouts.
- **Ghost‑Wheel Duel (1v1):** matched deposits + settlement flow with escrow logic and fallback.
- **Speed‑Visualizer SDK:** reusable React components for transaction lifecycle visualization.
- **Proof Page:** decode payloads to show on‑chain proof of gameplay events.

## Tech Stack
- **Client:** React + Phaser 3
- **Server:** Node.js (Express) + WebSocket (socket.io)
- **DB:** SQLite (Drizzle ORM)
- **Blockchain:** Kaspa (kaspa‑wasm + REST API)
- **Deploy:** Vercel (client), Railway (server)

## How It Works (High‑Level)
1. Player starts a session and collects a checkpoint.
2. Server validates policy (cooldown/max events) and builds a real payout transaction.
3. HUD updates live as the transaction progresses through Kaspa network states.
4. Optional Proof Page parses payloads to verify events on‑chain.

## Links
- **Repository:** <REPO_URL>
- **Live Demo:** <LIVE_DEMO_URL>
- **Demo Video:** <VIDEO_URL>

## Quickstart
```bash
pnpm install
pnpm dev
```
- Client: `http://localhost:5173`
- API: `http://localhost:8787/api/health`

For real broadcasts, set `.env` using `.env.example` (server keys required).

## What’s Next
- Full covenant escrow settlement on mainnet
- Expanded SDK docs/examples
- Additional game modes using the same on‑chain telemetry

## AI Usage
See `AI_USAGE.md` for disclosure.

## License
MIT
