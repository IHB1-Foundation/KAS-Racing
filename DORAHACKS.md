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
- **Ghost‑Wheel 1v1:** create/join → both deposit into escrow → race → single on‑chain settle to the winner.

## Why It’s Special

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/4.png?raw=true">

- **No mocks—real transactions in the game loop.**
- **Millisecond lifecycle visualization** (`broadcasted → accepted → included → confirmed`).
- **On‑chain proof page** that recomputes payload hashes and verifies RewardPaid + ProofRecorded logs.

## Key Features

- **Free Run (Arcade‑to‑Earn):** checkpoint capsules trigger real rewards.
- **Ghost‑Wheel Duel (1v1):** MatchEscrow holds both deposits, then settles a single payout tx.
- **Speed‑Visualizer SDK:** reusable React HUD components.
- **Proof Page:** recompute payloads, match hashes, and show tx + block evidence.

## Tech Stack

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/6.png?raw=true">

- **Client:** React + Phaser 3
- **Server:** Node.js (Express) + WebSocket (socket.io)
- **DB:** PostgreSQL (Drizzle ORM)
- **Blockchain:** Kaspa (kaspa‑wasm + REST API)
- **Deploy:** Vercel (client), Railway (server)

## How It Works (High‑Level)

<img src="https://github.com/IHB1-Foundation/KAS-Racing/blob/main/picture/5.png?raw=true">

1. Player starts a session, then hits a checkpoint.
2. The server validates policy (cooldown + max events) and builds a payout call.
3. For every checkpoint it builds a deterministic payload:  
   `KASRACE1|<network>|<mode>|<sessionId>|checkpoint|<seq>`  
   and hashes it into the on‑chain proof.
4. The indexer ingests **RewardPaid** + **ProofRecorded** logs and streams lifecycle timestamps to the HUD.
5. The **Proof Page** recomputes the payload + hash and cross‑checks the tx hash, block, and logs to prove the event.
6. In **Ghost‑Wheel Duel**, both players deposit into MatchEscrow → when funded, the race runs → a single settle tx pays the winner.

## What’s Next

- Full covenant escrow settlement on mainnet
- Expanded SDK docs/examples
- Additional game modes using the same on‑chain telemetry

## AI Usage

- AI tools were used for scaffolding and documentation.
- All core gameplay, contract logic, and integration flows were reviewed and validated by the team.
