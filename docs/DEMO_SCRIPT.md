# KAS Racing Demo Script v3 (KASPLEX zkEVM)

> Target: 2-3 minute demo video, with 15-min and 5-min live rehearsal variants

---

## Wallet & Funding Preparation

### Recommended Wallets

| Priority | Wallet | Type | Install |
|----------|--------|------|---------|
| Primary | **MetaMask** | Chrome extension | Chrome Web Store → "MetaMask" |
| Backup | **Rabby** | Chrome extension | Chrome Web Store → "Rabby" |

### Wallet Setup

1. Install MetaMask in Chrome or Brave
2. Create a new wallet (or import existing seed)
3. **Add KASPLEX Testnet network**:
   - Network Name: `KASPLEX Testnet`
   - RPC URL: `https://rpc.kasplextest.xyz`
   - Chain ID: `167012`
   - Currency Symbol: `KAS`
   - Block Explorer URL: `https://zkevm.kasplex.org`
4. Note the address (`0x...`)
5. Back up seed phrase offline — never store on demo machine

### Funding Checklist

| Wallet | Minimum Balance | Recommended | Source |
|--------|----------------|-------------|--------|
| Operator (server) | 0.5 KAS | 2 KAS | KASPLEX faucet / team |
| RewardVault contract | 1 KAS | 5 KAS | Operator transfer |
| Player 1 (demo) | 0.5 KAS | 2 KAS | Faucet or transfer |
| Player 2 (Duel) | 0.5 KAS | 1 KAS | Faucet or transfer |

**Verification:**
- [ ] Check operator balance: `https://zkevm.kasplex.org/address/<operator-address>`
- [ ] Check RewardVault balance: `https://zkevm.kasplex.org/address/<reward-vault-address>`
- [ ] Check player wallet balance in MetaMask
- [ ] Verify `MIN_REWARD_KAS` (0.02) x `rewardMaxPerSession` (10) = 0.2 KAS < RewardVault balance

---

## Pre-Recording Checklist

### Environment Setup
- [ ] Browser: Chrome/Brave, clean profile (no extensions visible except MetaMask)
- [ ] Screen resolution: 1920x1080 or 2560x1440
- [ ] MetaMask connected to **KASPLEX Testnet** (Chain ID 167012) with sufficient balance
- [ ] Services running (deployed or local `pnpm dev`)
- [ ] Smoke test passed: `bash deploy/smoke-test.sh <api-url> <fe-url>`
- [ ] No notifications/popups enabled
- [ ] Explorer tab open in background: `https://zkevm.kasplex.org`
- [ ] Backup recording prepared (in case of live failure)

### Browser Layout
```
+-------------------------------------------------------------+
|  Game (800x600)            |  HUD Panel (360px)             |
|  +---------------------+  |  +-------------------------+   |
|  |                     |  |  |  Speed: 450 km/h        |   |
|  |    GAME CANVAS      |  |  |  Distance: 12,500m      |   |
|  |                     |  |  |  Checkpoints: 3         |   |
|  |                     |  |  |                         |   |
|  |                     |  |  |  TX Timeline:           |   |
|  |                     |  |  |  [v] Submitted 0ms      |   |
|  |                     |  |  |  [v] Mined +2s          |   |
|  |                     |  |  |  [ ] Confirmed           |   |
|  +---------------------+  |  +-------------------------+   |
+-------------------------------------------------------------+
```

---

## Video Script (2-3 Minutes)

### Scene 1: Introduction (0:00 - 0:20)

**Visual:** Home page with game title and "Play Free Run" button

**Script (Voiceover):**
> "KAS Racing is a web game that integrates real blockchain transactions into gameplay.
> Every checkpoint you collect triggers an on-chain reward via smart contract — and you can watch it happen in real-time."

**Actions:**
1. Show the home page
2. Hover over wallet connection (show MetaMask address)
3. Click "Play Free Run"

---

### Scene 2: Free Run Gameplay (0:20 - 1:10)

**Visual:** 3-lane runner game in action, HUD panel showing stats + TX Timeline

**Script:**
> "In Free Run mode, collecting checkpoint capsules triggers a reward via the RewardVault smart contract.
> Watch the right panel — you'll see each transaction progress:
> Submitted... Mined... Confirmed.
> No simulations, no mocks — these are real transactions on KASPLEX zkEVM."

**Actions:**
1. Start the game (SPACE)
2. Play for ~30 seconds, collecting 2-3 checkpoints
3. PAUSE when a checkpoint is collected to highlight the TX Timeline
4. Point out:
   - Tx hash appears instantly
   - "Mined" stage confirmation
   - Explorer link
5. Click explorer link to show the transaction on-chain
6. Resume and collect one more checkpoint
7. Game over (intentionally hit obstacle)

**Key Moments to Capture:**
- [ ] First checkpoint collection + immediate tx hash display
- [ ] TX Timeline progressing from Submitted -> Mined
- [ ] Explorer link showing real transaction
- [ ] Reward amount displayed in wei/KAS

---

### Scene 3: Duel Mode (1:10 - 2:00)

**Visual:** Duel Lobby page, two browser windows side by side

**Script:**
> "Duel mode uses the MatchEscrow smart contract.
> Both players deposit KAS directly to the contract, race for 30 seconds, and the winner's payout is settled on-chain."

**Actions:**
1. Click "Duel" from home page
2. Create a match with 0.1 KAS bet
3. Show the join code
4. (If two players) Join from second browser
5. Show deposit flow:
   - Click "Deposit" -> MetaMask confirmation
   - Contract deposit tx appears in timeline
6. Show match status change to "Funded"
7. (Optional) Play brief race
8. Show settlement TX after race ends

**Key Moments to Capture:**
- [ ] Match creation with join code
- [ ] Contract deposit via MetaMask
- [ ] Both deposits confirmed -> Funded state
- [ ] Settlement transaction to winner

---

### Scene 4: Proof Page (2:00 - 2:30)

**Visual:** Proof page with tx hash input

**Script:**
> "Every game transaction emits events on the smart contract.
> On the Proof page, you can verify any transaction — see decoded events, proof hashes, and receipt data."

**Actions:**
1. Navigate to /proof
2. Paste a tx hash from the game
3. Show the decoded events:
   - Event name (RewardPaid, ProofRecorded)
   - Contract address
   - Block number
   - Event arguments
4. Show TX lifecycle timeline
5. Switch to "By Session + Seq" mode
6. Show proof verification

**Key Moments to Capture:**
- [ ] Tx hash input and verification
- [ ] Decoded EVM events display
- [ ] Proof-of-action verification (verified: true)

---

### Scene 5: SDK Highlight (2:30 - 2:45)

**Visual:** Code editor or README showing SDK usage

**Script:**
> "The visualization components are available as a standalone SDK.
> Any EVM app can use TxLifecycleTimeline to show transaction progress."

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
| 0:00-2:00 | **Intro & Context** | Explain KASPLEX zkEVM, smart contract integration |
| 2:00-5:00 | **Free Run Demo** | Play 2-3 rounds, show multiple checkpoints, explore TX Timeline |
| 5:00-8:00 | **Duel Demo** | Full duel: create -> deposit (MetaMask) -> race -> settle |
| 8:00-10:00 | **Proof Page Deep Dive** | Look up 2-3 tx hashes, explain event decoding, show Explorer |
| 10:00-12:00 | **SDK & Architecture** | Show SDK code, component API, monorepo structure |
| 12:00-14:00 | **Q&A / Technical Discussion** | Common questions: security model, contract design |
| 14:00-15:00 | **Closing & Next Steps** | Roadmap, open-source links, contact |

### Step-by-Step Preparation (15-min) — T-30 minutes

> Complete these steps **exactly 30 minutes before** the presentation starts.

**A. Environment Verification (T-30)**

```bash
# 1. Run smoke test (replace URLs with your actual deployed URLs)
bash deploy/smoke-test.sh https://<railway-api-url> https://<vercel-url>
# Expected: 5/5 PASS

# 2. Check API health directly
curl -sf https://<railway-api-url>/api/health | python3 -m json.tool
# Expected: {"ok":true, ...}

# 3. Check Vercel frontend loads
curl -sf -o /dev/null -w "%{http_code}" https://<vercel-url>
# Expected: 200
```

**B. Wallet & Funding Verification (T-25)**

- [ ] Open Chrome with MetaMask extension
- [ ] Click MetaMask icon → verify network says **KASPLEX Testnet** (Chain ID 167012)
- [ ] Check Player 1 balance: at least **0.5 KAS** (MetaMask → account balance)
- [ ] Check Player 2 balance (second browser profile): at least **0.5 KAS**
- [ ] Open Explorer and verify:
  - Operator balance: `https://zkevm.kasplex.org/address/<operator-address>`
  - RewardVault balance: `https://zkevm.kasplex.org/address/<reward-vault-address>`
  - RewardVault balance must be > 0.2 KAS (= 0.02 KAS × 10 max rewards)

**C. Prepare Demo Artifacts (T-20)**

- [ ] Play one Free Run round to generate 2-3 tx hashes → copy them to a text file
- [ ] Create a Duel match → note the join code and match ID
- [ ] Copy one tx hash to clipboard for Proof page demo
- [ ] Open these tabs (in order, left to right):
  1. Vercel home page (`https://<vercel-url>`)
  2. Explorer (`https://zkevm.kasplex.org`)
  3. Text file with tx hashes and join code
  4. `docs/ARCHITECTURE.md` (for SDK/architecture section)
- [ ] Second browser window: open Vercel home page with Player 2 wallet connected

**D. Screen & Recording Setup (T-10)**

- [ ] Screen resolution: 1920×1080 or 2560×1440
- [ ] Close all notifications (Do Not Disturb mode)
- [ ] Hide browser bookmarks bar
- [ ] No extra Chrome extensions visible except MetaMask
- [ ] If recording: start screen recording tool, verify audio input
- [ ] Backup video file accessible (USB or Desktop folder)

**E. Final Go/No-Go (T-5)**

- [ ] Re-run: `curl -sf https://<api-url>/api/health && echo "GO" || echo "NO-GO"`
- [ ] MetaMask still connected? (click icon to verify)
- [ ] Player 2 browser still connected?
- [ ] If any NO-GO → see **Incident Response** section below

### FAQ Preparation

| Question | Answer Key Points |
|----------|-------------------|
| "Is this mainnet?" | Currently KASPLEX testnet; production-ready with config switch |
| "How fast is confirmation?" | Submitted -> Mined within seconds; we show real measurements, not marketing claims |
| "Can the server steal funds?" | MatchEscrow contract enforces winner-only payout; theft-resistance tested with 28 unit tests |
| "What about cheating?" | Server judges, but game events are committed on-chain with proof hashes for verifiability |
| "Can I use the SDK?" | Yes — `@kas-racing/speed-visualizer-sdk` is MIT-licensed, works with any React app |
| "What chain is this?" | KASPLEX zkEVM Testnet (Chain ID 167012), an EVM-compatible layer on Kaspa |
| "How many contracts?" | Two: MatchEscrow (duel lifecycle) + RewardVault (Free Run rewards) |

---

## Rehearsal Scenario: 5-Minute Version

> For hackathon judging, lightning talks, or quick stakeholder updates.

### Timeline

| Time | Activity | Notes |
|------|----------|-------|
| 0:00-0:30 | **Hook** | "What if blockchain transactions were so fast you could use them in a game?" |
| 0:30-2:30 | **Free Run Demo** | Play one round, collect 2 checkpoints, highlight TX Timeline |
| 2:30-3:30 | **Duel Quick Show** | Show pre-created match, deposit flow, settlement result |
| 3:30-4:30 | **Proof + SDK** | Quick tx hash lookup, mention SDK availability |
| 4:30-5:00 | **Closing** | Open-source, MIT, KASPLEX testnet — try it yourself |

### Step-by-Step Preparation (5-min) — T-15 minutes

> Complete these steps **exactly 15 minutes before** you begin.

**A. Quick Smoke (T-15)**

```bash
bash deploy/smoke-test.sh https://<api-url> https://<vercel-url>
# Must be 5/5 PASS — if not, see Incident Response
```

**B. Pre-stage Everything (T-12)**

- [ ] Connect MetaMask to KASPLEX Testnet in Chrome
- [ ] Play one Free Run round → collect 2 checkpoints → copy a tx hash
- [ ] Create a Duel match → note join code (you will show this, not play full duel)
- [ ] Deposit from Player 1 wallet (so match shows "Funded" during demo)

**C. Tab Layout (T-8)**

Open tabs in this exact order (left to right):
1. **Home page** — `https://<vercel-url>` (starting point)
2. **Explorer** — `https://zkevm.kasplex.org` (for showing on-chain tx)
3. **Notepad** — tx hash + join code (for quick copy-paste)

**D. Final Checks (T-3)**

- [ ] MetaMask connected? (click icon)
- [ ] `curl -sf https://<api-url>/api/health && echo "GO" || echo "NO-GO"`
- [ ] Clipboard: tx hash ready to paste into Proof page
- [ ] Timer ready (phone or browser timer for 5 minutes)

### Speed Tips
- Skip wallet connection during demo (connect beforehand)
- Don't pause to read TX timeline details — just point at it while narrating
- Use keyboard shortcuts (SPACE for dash, ESC for pause) — no mouse clicks in game
- If anything breaks, pivot immediately (see Incident Response below)
- For Duel: show the pre-funded match instead of depositing live (saves 30+ seconds)

---

## Incident Response During Demo

### Quick Decision Tree

```
Problem detected during demo
│
├─ TX not appearing in timeline?
│  ├─ Check: curl -sf <api-url>/api/health → "ok":true?
│  │  ├─ YES → RPC may be slow; wait 10s, try another checkpoint
│  │  └─ NO  → API is down → Pivot A (backup recording)
│  └─ Pivot: show a previously completed tx in Explorer tab
│
├─ MetaMask won't connect / wrong network?
│  ├─ Fix 1: Click MetaMask icon → switch to KASPLEX Testnet
│  ├─ Fix 2: Refresh page (F5)
│  ├─ Fix 3: Switch to Rabby wallet (second extension)
│  └─ Pivot: narrate the expected flow, show Explorer tx
│
├─ Deposit tx fails (Duel)?
│  ├─ "Insufficient funds" → switch to pre-funded match
│  ├─ MetaMask rejects → check gas, retry with higher gas limit
│  └─ Pivot: show pre-completed match settlement in Explorer
│
├─ RPC timeout / "network error" in browser console?
│  ├─ Check: can you reach RPC directly?
│  │  curl -sf https://rpc.kasplextest.xyz -X POST \
│  │    -H "Content-Type: application/json" \
│  │    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
│  ├─ RPC down → Pivot A (backup recording) or Pivot B (local fallback)
│  └─ RPC slow → wait 15s, narrate "network congestion" honestly
│
├─ Indexer delay (tx mined but timeline not updating)?
│  ├─ This is cosmetic — the tx IS on-chain
│  ├─ Show Explorer to prove the tx landed
│  ├─ Explain: "our indexer polls every few seconds; there's a brief lag"
│  └─ Continue demo — timeline will catch up
│
├─ Game crashes / white screen?
│  ├─ Fix: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
│  ├─ If persists → Pivot: skip to Proof page with pre-recorded tx hashes
│  └─ Narrate: "live demos — let me show the on-chain results instead"
│
└─ Full outage (nothing works)?
   ├─ Pivot A: Switch to backup recording immediately
   ├─ Pivot B: Run local (see Emergency Local Fallback below)
   └─ Say: "Let me switch to our recorded demo while we troubleshoot"
```

### Emergency Local Fallback

If deployed services are down and you have a laptop with the repo:

```bash
# Terminal 1: Start Postgres (if not running)
docker run -d --name kas-pg -e POSTGRES_PASSWORD=demo -p 5432:5432 postgres:16

# Terminal 2: Start server
cd /path/to/kas-racing
export DATABASE_URL="postgresql://postgres:demo@localhost:5432/postgres"
export OPERATOR_PRIVATE_KEY="0x..."  # your testnet key
pnpm --filter @kas-racing/server dev

# Terminal 3: Start client
cd /path/to/kas-racing
pnpm --filter @kas-racing/client dev

# Verify
curl -sf http://localhost:8787/api/health && echo "LOCAL API OK"
# Open http://localhost:5173 in browser
```

> Estimated switchover time: 2-3 minutes (if Docker + deps are pre-installed).

### RPC Health Check Script

```bash
# Check KASPLEX Testnet RPC status
curl -sf https://rpc.kasplextest.xyz \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | python3 -m json.tool

# Expected: {"jsonrpc":"2.0","id":1,"result":"0x..."}
# If no response or timeout: RPC is unreachable
```

### Wallet Recovery Steps

```
MetaMask Not Working:
1. Click MetaMask icon → is it locked? → enter password
2. Check network → must say "KASPLEX Testnet"
3. If wrong network → click network dropdown → select KASPLEX Testnet
4. If KASPLEX Testnet not listed → add manually:
   - RPC: https://rpc.kasplextest.xyz
   - Chain ID: 167012
   - Symbol: KAS
5. Still broken? → switch to Rabby wallet (second Chrome profile)

Rabby Not Working:
1. Same network check as MetaMask
2. If both wallets fail → skip wallet-dependent features
3. Show Proof page + Explorer (doesn't need wallet)
```

### Keep Ready at All Times
- [ ] Explorer tab with contract addresses open
- [ ] 2-3 tx hash strings copied to clipboard/notepad
- [ ] Backup video file accessible (USB or local folder)
- [ ] Second browser profile with Rabby wallet as backup
- [ ] This document open on a second screen or phone

---

## Rehearsal Log Template

> Copy this template for each rehearsal run. Fill in results and save to `docs/rehearsal-logs/`.

```markdown
# Rehearsal Log — [DATE] [15-min / 5-min / video]

## Environment
- Presenter: [name]
- API URL: [url]
- FE URL: [url]
- Smoke test result: [5/5 PASS / N failures]
- Network: KASPLEX Testnet (167012)
- Wallet: MetaMask / Rabby
- Player 1 balance: [X] KAS
- Player 2 balance: [X] KAS (if Duel)
- RewardVault balance: [X] KAS

## Rehearsal Results

| Step | Expected | Actual | Time | Pass? |
|------|----------|--------|------|-------|
| Smoke test | 5/5 PASS | | | |
| Home page loads | Shows title + Play button | | | |
| Wallet connects | MetaMask popup, address shown | | | |
| Free Run starts | Game canvas renders | | | |
| Checkpoint collected | TX hash in HUD within 2s | | | |
| TX timeline updates | Submitted → Mined progression | | | |
| Explorer link works | Shows tx on zkevm.kasplex.org | | | |
| Proof page lookup | Decoded events displayed | | | |
| Duel match created | Join code generated | | | |
| Duel deposit | MetaMask confirms, tx in timeline | | | |
| Duel settlement | Winner payout tx broadcast | | | |
| SDK component visible | TxLifecycleTimeline renders | | | |

## Incidents
<!-- Record any issues encountered -->

| Time | Issue | Resolution | Duration |
|------|-------|------------|----------|
| | | | |

## Timing
- Total rehearsal duration: [mm:ss]
- Longest pause/issue: [description, duration]
- Within target? [YES / NO — target is 15 min or 5 min]

## Notes
<!-- Improvements, observations, things to fix before actual demo -->

```

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
