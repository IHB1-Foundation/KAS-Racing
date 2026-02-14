# KAS Racing Demo Script v2

> Target: 2-3 minute demo video, with 15-min and 5-min live rehearsal variants

---

## Wallet & Funding Preparation

### Recommended Wallets

| Priority | Wallet | Type | Install |
|----------|--------|------|---------|
| Primary | **Kasware** | Chrome extension | Chrome Web Store → "Kasware" |
| Backup | **KaspaNet Web Wallet** | Browser-based | <https://wallet.kaspanet.io/> |
| Fallback | **CLI (kaspa-wasm)** | Node.js script | For manual tx recovery only |

### Wallet Setup

1. Install Kasware in Chrome or Brave
2. Create a new wallet (or import existing seed)
3. **Switch to testnet**: Kasware → Settings → Network → Testnet
4. Note the address (`kaspatest:qz...`)
5. Back up seed phrase offline — never store on demo machine

### Funding Checklist

| Wallet | Minimum Balance | Recommended | Source |
|--------|----------------|-------------|--------|
| Treasury (server) | 1 KAS | 5 KAS | Faucet: <https://faucet.kaspanet.io/> |
| Player 1 (demo) | 0.5 KAS | 2 KAS | Faucet or treasury transfer |
| Player 2 (Duel) | 0.5 KAS | 1 KAS | Faucet or treasury transfer |

**Verification:**
- [ ] Check treasury balance: `https://explorer-tn11.kaspa.org/addresses/<treasury-address>`
- [ ] Check player wallet balance in Kasware
- [ ] Confirm faucet is operational (request 0.1 KAS test)
- [ ] Verify `MIN_REWARD_KAS` (0.02) × `rewardMaxPerSession` (10) = 0.2 KAS < treasury balance

---

## Pre-Recording Checklist

### Environment Setup
- [ ] Browser: Chrome/Brave, clean profile (no extensions visible except Kasware)
- [ ] Screen resolution: 1920x1080 or 2560x1440
- [ ] Kasware wallet connected to **testnet** with sufficient balance
- [ ] Services running (deployed or local `pnpm dev`)
- [ ] Smoke test passed: `bash deploy/smoke-test.sh <api-url> <fe-url>`
- [ ] No notifications/popups enabled
- [ ] Explorer tab open in background: `https://explorer-tn11.kaspa.org`
- [ ] Backup recording prepared (in case of live failure)

### Browser Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Game (800x600)            │  HUD Panel (360px)            │
│  ┌─────────────────────┐   │  ┌─────────────────────────┐  │
│  │                     │   │  │  Speed: 450 km/h        │  │
│  │    GAME CANVAS      │   │  │  Distance: 12,500m      │  │
│  │                     │   │  │  Checkpoints: 3         │  │
│  │                     │   │  │                         │  │
│  │                     │   │  │  TX Timeline:           │  │
│  │                     │   │  │  [✓] Broadcasted 0ms    │  │
│  │                     │   │  │  [✓] Accepted +850ms    │  │
│  │                     │   │  │  [ ] Included           │  │
│  │                     │   │  │  [ ] Confirmed          │  │
│  └─────────────────────┘   │  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Video Script (2-3 Minutes)

### Scene 1: Introduction (0:00 - 0:20)

**Visual:** Home page with game title and "Play Free Run" button

**Script (Voiceover):**
> "KAS Racing is a web game that integrates real Kaspa blockchain transactions into gameplay.
> Every checkpoint you collect triggers an actual on-chain reward — and you can watch it happen in real-time."

**Actions:**
1. Show the home page
2. Hover over wallet connection (show address)
3. Click "Play Free Run"

---

### Scene 2: Free Run Gameplay (0:20 - 1:10)

**Visual:** 3-lane runner game in action, HUD panel showing stats + TX Timeline

**Script:**
> "In Free Run mode, collecting checkpoint capsules sends KAS to your wallet instantly.
> Watch the right panel — you'll see each transaction progress through the network:
> Broadcasted... Accepted... Included... Confirmed.
> No simulations, no mocks — these are real transactions on Kaspa."

**Actions:**
1. Start the game (SPACE)
2. Play for ~30 seconds, collecting 2-3 checkpoints
3. PAUSE when a checkpoint is collected to highlight the TX Timeline
4. Point out:
   - "Broadcasted" stage appears instantly
   - "Accepted" typically within 1 second
   - Timestamps showing milliseconds
5. Click explorer link to show the transaction on-chain
6. Resume and collect one more checkpoint
7. Game over (intentionally hit obstacle)

**Key Moments to Capture:**
- [ ] First checkpoint collection + immediate txid display
- [ ] TX Timeline progressing from Broadcasted → Accepted
- [ ] Explorer link showing real transaction
- [ ] Timestamp difference (e.g., "850ms to accepted")

---

### Scene 3: Duel Mode (1:10 - 2:00)

**Visual:** Duel Lobby page, two browser windows side by side (or explain single-player demo)

**Script:**
> "Duel mode lets you bet against a friend.
> Both players deposit KAS, race for 30 seconds, and the winner takes all — settled automatically on-chain."

**Actions:**
1. Click "Duel" from home page
2. Create a match with 0.1 KAS bet
3. Show the join code
4. (If two players) Join from second browser
5. Show deposit flow:
   - Click "Deposit" → Kasware confirmation
   - TX appears in timeline
6. Show match status change to "READY"
7. (Optional) Play brief race
8. Show settlement TX after race ends

**Key Moments to Capture:**
- [ ] Match creation with join code
- [ ] Deposit transaction confirmation
- [ ] Both deposits confirmed → READY state
- [ ] Settlement transaction to winner

---

### Scene 4: Proof Page (2:00 - 2:30)

**Visual:** Proof page with txid input

**Script:**
> "Every game transaction includes a payload that proves the game event.
> On the Proof page, you can verify any transaction — see the session, event type, and cryptographic commit."

**Actions:**
1. Navigate to /proof
2. Paste a txid from the game
3. Show the decoded payload:
   - Network (mainnet/testnet)
   - Mode (free_run/duel)
   - Event type (checkpoint)
   - Session ID
   - Sequence number
4. Show TX lifecycle timeline

**Key Moments to Capture:**
- [ ] Txid input and verification
- [ ] Decoded payload display
- [ ] "This transaction is a valid KAS Racing event"

---

### Scene 5: SDK Highlight (2:30 - 2:45)

**Visual:** Code editor or README showing SDK usage

**Script:**
> "The visualization components are available as a standalone SDK.
> Any Kaspa app can use TxLifecycleTimeline to show transaction progress."

**Actions:**
1. Show SDK import code
2. (Optional) Show component in Storybook or demo page

---

### Scene 6: Closing (2:45 - 3:00)

**Visual:** Home page or GitHub README

**Script:**
> "KAS Racing — proving that blockchain can be fast, one checkpoint at a time.
> Thanks for watching."

**Actions:**
1. Return to home page
2. Show GitHub link / MIT license badge
3. Fade out

---

## Rehearsal Scenario: 15-Minute Version

> For live presentations, investor demos, or detailed technical walkthroughs.

### Timeline

| Time | Activity | Notes |
|------|----------|-------|
| 0:00–2:00 | **Intro & Context** | Explain Kaspa, "fast L1" narrative, why this demo matters |
| 2:00–5:00 | **Free Run Demo** | Play 2-3 rounds, show multiple checkpoints, explore TX Timeline in detail |
| 5:00–8:00 | **Duel Demo** | Full duel flow: create → deposit → race → settle. Use two browser windows |
| 8:00–10:00 | **Proof Page Deep Dive** | Look up 2-3 txids, explain payload structure, show Explorer verification |
| 10:00–12:00 | **SDK & Architecture** | Show SDK code, component API, monorepo structure, architecture diagram |
| 12:00–14:00 | **Q&A / Technical Discussion** | Common questions: security model, covenant feasibility, scaling |
| 14:00–15:00 | **Closing & Next Steps** | Roadmap, open-source links, contact |

### Preparation Checklist (15-min)
- [ ] All items from Pre-Recording Checklist above
- [ ] Architecture diagram printed or on second screen (`docs/ARCHITECTURE.md`)
- [ ] 2-3 previously completed txids noted for Proof page demo
- [ ] Two browser windows prepared for Duel demo
- [ ] Second wallet (Player 2) funded and ready
- [ ] Talking points for Q&A prepared (see FAQ below)

### FAQ Preparation

| Question | Answer Key Points |
|----------|-------------------|
| "Is this mainnet?" | Currently testnet; mainnet-ready with config switch |
| "How fast is confirmation?" | Accepted: sub-second to ~2s; Included: varies by network; we show real measurements, not marketing claims |
| "Can the server steal funds?" | MVP uses server-custody with audit logs; covenant-based theft-resistant escrow is on roadmap |
| "What about cheating?" | Server judges, but game events are committed on-chain with cryptographic hashes for verifiability |
| "Can I use the SDK?" | Yes — `@kas-racing/speed-visualizer-sdk` is MIT-licensed, works with any React app |

---

## Rehearsal Scenario: 5-Minute Version

> For hackathon judging, lightning talks, or quick stakeholder updates.

### Timeline

| Time | Activity | Notes |
|------|----------|-------|
| 0:00–0:30 | **Hook** | "What if blockchain transactions were so fast you could use them in a game?" |
| 0:30–2:30 | **Free Run Demo** | Play one round, collect 2 checkpoints, highlight TX Timeline |
| 2:30–3:30 | **Duel Quick Show** | Show pre-created match, deposit flow, settlement result (skip actual race) |
| 3:30–4:30 | **Proof + SDK** | Quick txid lookup, mention SDK availability |
| 4:30–5:00 | **Closing** | Open-source, MIT, Kaspa testnet — try it yourself |

### Preparation Checklist (5-min)
- [ ] All items from Pre-Recording Checklist above
- [ ] Pre-create a Duel match before the demo starts (have join code ready)
- [ ] Pre-fund both Duel wallets with deposit amounts
- [ ] One txid ready to paste into Proof page
- [ ] Practice the flow at least twice — timing is tight

### Speed Tips
- Skip wallet connection during demo (connect beforehand)
- Don't pause to read TX timeline details — just point at it while narrating
- Use keyboard shortcuts (SPACE for dash, ESC for pause) — no mouse clicks in game
- If anything breaks, pivot immediately (see Incident Response below)

---

## Incident Response During Demo

### Decision Tree

```
Problem detected during demo
│
├─ TX not broadcasting?
│  ├─ Check: Is API healthy? → curl /api/health
│  ├─ Fix: Restart API service (Railway → Redeploy)
│  └─ Pivot: Show a previously completed tx on Explorer
│
├─ Wallet won't connect?
│  ├─ Fix: Refresh page, check testnet setting
│  ├─ Backup: Switch to KaspaNet Web Wallet
│  └─ Pivot: Use SKIP_KEY_VALIDATION mode, narrate the expected flow
│
├─ Indexer not updating timeline?
│  ├─ Fix: Check Railway indexer logs, restart if needed
│  └─ Pivot: Free Run still works; show reward tx via Explorer directly
│
├─ Full outage (API + Indexer down)?
│  ├─ Fix: Emergency redeploy (< 5 min)
│  └─ Pivot: Switch to backup recording
│
└─ Game crashes / white screen?
   ├─ Fix: Hard refresh (Ctrl+Shift+R)
   └─ Pivot: Show Proof page + Explorer with pre-recorded txids
```

### Recovery Scripts

```bash
# Quick health check
curl -sf https://<api-url>/api/health && echo "API OK" || echo "API DOWN"

# Check treasury balance (requires jq)
curl -s "https://api.kaspa.org/addresses/<treasury-addr>/balance" | jq '.balance'

# Emergency: run local if deployed services fail
cd /path/to/kas-racing
pnpm dev  # starts both client and server locally
```

### Keep Ready at All Times
- [ ] Explorer tab with treasury address open
- [ ] 2-3 txid strings copied to clipboard/notepad
- [ ] Backup video file accessible (USB or local folder)
- [ ] Second browser profile with KaspaNet Web Wallet as backup

---

## Post-Recording Checklist

### Video
- [ ] Resolution: 1080p or higher
- [ ] Audio: Clear voiceover, no background noise
- [ ] Length: Under 3 minutes

### Subtitles (Optional)
- [ ] English SRT file generated
- [ ] Timing synced with voiceover

### Thumbnail
- [ ] Screenshot from gameplay with TX Timeline visible
- [ ] KAS Racing logo/title overlay
- [ ] Resolution: 1280x720 minimum

---

## Technical Notes

### Network Considerations
- Testnet may have delayed block times
- Mainnet recommended for final recording
- Have treasury funded with sufficient KAS (at least 5 KAS for safety margin)
- Faucet rate limits: request tokens well in advance (1+ hours before demo)

### Backup Recording Tips
- Record a clean run during rehearsal
- Keep the backup video under 3 minutes
- Store on local disk (not cloud) to avoid download delays
