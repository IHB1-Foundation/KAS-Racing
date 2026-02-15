# KAS Racing (Speed‑Visualizer SDK)

## One‑Line Summary

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/1.png?raw=true">

A 3‑lane runner that fires **real Kaspa on‑chain transactions during gameplay** and visualizes each stage in real time—proving speed by UX, not claims—plus a reusable Speed‑Visualizer HUD SDK.

## Track Targets

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/2.png?raw=true">

- **Gaming & Interactive:** on‑chain transactions directly drive gameplay rewards and 1v1 outcomes.
- **Payments & Commerce:** instant‑feeling micro‑payouts at checkpoints with a transparent lifecycle.
- **Real‑Time Data:** live transaction‑state telemetry streamed into the HUD as the action happens.

## Impact

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/3.png?raw=true">

- **Flips the “blockchain is slow” perception:** users *feel* speed through instant, visible feedback.
- **Shows what real‑time PoW unlocks:** game economies and settlement loops that respond immediately.
- **Reusable SDK:** other builders can plug the Speed‑Visualizer into any Kaspa app.

## Fun / Experience

- **Instant reward loop:** collect a capsule → a real payout tx fires → HUD pops through states.
- **Ghost‑Wheel 1v1:** deposit → match → settle flows are hard‑wired to the game outcome.

## Why It’s Special

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/4.png?raw=true">

- **No mocks—real transactions in the game loop.**
- **Millisecond lifecycle visualization** (`broadcasted → accepted → included → confirmed`).
- **On‑chain proof page** to decode payloads and verify game events.

## Key Features

- **Free Run (Arcade‑to‑Earn):** checkpoint capsules trigger real rewards.
- **Ghost‑Wheel Duel (1v1):** matched deposits + settlement flow.
- **Speed‑Visualizer SDK:** reusable React HUD components.
- **Proof Page:** decode payloads for on‑chain verification.

## Tech Stack

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/6.png?raw=true">

- **Client:** React + Phaser 3
- **Server:** Node.js (Express) + WebSocket (socket.io)
- **DB:** PostgreSQL (Drizzle ORM)
- **Blockchain:** Kaspa (kaspa‑wasm + REST API)
- **Deploy:** Vercel (client), Railway (server)

## How It Works (High‑Level)

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/5.png?raw=true"

1. Player starts a session and hits a checkpoint.
2. Server validates policy (cooldown/max events) and builds a real payout transaction.
3. HUD updates live as the tx progresses through Kaspa network states.
4. Proof Page parses payloads to verify events on‑chain.

## What’s Next

- Full covenant escrow settlement on mainnet
- Expanded SDK docs/examples
- Additional game modes using the same on‑chain telemetry