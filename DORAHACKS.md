# KAS Racing (Speed‑Visualizer SDK)

## One‑Line Summary
A 3‑lane runner where **real KASPLEX zkEVM transactions fire during gameplay** and a live HUD visualizes every state change in‑game—proving speed by UX, not claims—plus a reusable Speed‑Visualizer SDK.

## Track Target
**Primary:** Gaming & Interactive  
**Secondary:** Real‑Time Data, Payments & Commerce

## Impact
- **Turns “blockchain is slow” into a felt experience:** players see tx progress instantly as they play.
- **Demonstrates real‑time PoW UX on Kaspa’s ecosystem:** on‑chain rewards and escrowed duels feel immediate.
- **Reusable SDK:** other builders can drop the Speed‑Visualizer into any Kaspa/KASPLEX app.

## Fun / Experience
- **Arcade‑to‑Earn loop:** collect a capsule → reward tx fires → HUD shows the lifecycle in‑game.
- **Ghost‑Wheel Duel (1v1):** deposits, funding, and settlement are wired directly to the race outcome—no off‑chain escrow.

## Why It’s Special
- **No mocks—real on‑chain transactions in the game loop.**
- **Lifecycle visualization in milliseconds** (submitted → mined → confirmed).
- **Proof page** that reconstructs and verifies game events against on‑chain logs (RewardPaid + ProofRecorded).

## Key Features
- **Free Run:** checkpoint capsules trigger real kFUEL rewards.
- **Ghost‑Wheel Duel:** MatchEscrow‑backed deposits + winner‑take‑all settlement.
- **Speed‑Visualizer SDK:** reusable React HUD components.
- **Proof Page:** validate game events against chain data + payload hashes.

## Tech Stack
- **Client:** React + Phaser 3
- **Wallet:** wagmi + viem (MetaMask / injected)
- **Server:** Node.js (Express) + Socket.IO
- **DB:** PostgreSQL (Drizzle ORM)
- **Chain:** KASPLEX zkEVM (RewardVault + MatchEscrow)
- **Deploy:** Vercel (client), Railway (server)

## How It Works (High‑Level)
1. Player connects an EVM wallet and starts a **Free Run** session.
2. Each checkpoint calls the server, which pays rewards via **RewardVault** (kFUEL).
3. The server builds a deterministic payload string:  
   `KASRACE1|<network>|<mode>|<sessionId>|checkpoint|<seq>`  
   then hashes it for **ProofRecorded**.
4. Indexer captures **RewardPaid** + **ProofRecorded** events and streams timestamps to the HUD in real time.
5. The **Proof Page** recomputes payloads, matches hashes, and shows the exact tx + block for every checkpoint.
6. In **Ghost‑Wheel Duel**, players create/join a lobby, both deposit into **MatchEscrow**, race, then the winner is settled on‑chain with a single payout.

## Links
- **Repository:** <REPO_URL>
- **Live Demo:** <LIVE_DEMO_URL>
- **Demo Video:** <VIDEO_URL>

## What’s Next
- Mainnet‑ready deployment on KASPLEX
- Expanded SDK docs + examples
- More game modes using the same on‑chain telemetry

## License
Proprietary (all rights reserved)
