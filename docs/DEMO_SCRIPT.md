# KAS Racing Demo Video Script

> Target: 2-3 minute one-take demo video

## Pre-Recording Checklist

### Environment Setup
- [ ] Browser: Chrome/Firefox, clean profile (no extensions visible except Kasware)
- [ ] Screen resolution: 1920x1080 or 2560x1440
- [ ] Kasware wallet connected with testnet/mainnet KAS balance
- [ ] Server running with valid treasury keys (`pnpm dev`)
- [ ] No notifications/popups enabled
- [ ] Explorer tab open in background (explorer.kaspa.org)

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

## Scene 1: Introduction (0:00 - 0:20)

### Visual
- Home page with game title and "Play Free Run" button
- Kasware wallet icon showing connected state

### Script (Voiceover)
> "KAS Racing is a web game that integrates real Kaspa blockchain transactions into gameplay.
> Every checkpoint you collect triggers an actual on-chain reward — and you can watch it happen in real-time."

### Actions
1. Show the home page
2. Hover over wallet connection (show address)
3. Click "Play Free Run"

---

## Scene 2: Free Run Gameplay (0:20 - 1:10)

### Visual
- 3-lane runner game in action
- HUD panel showing stats + TX Timeline

### Script
> "In Free Run mode, collecting checkpoint capsules sends KAS to your wallet instantly.
> Watch the right panel — you'll see each transaction progress through the network:
> Broadcasted... Accepted... Included... Confirmed.
> No simulations, no mocks — these are real transactions on Kaspa."

### Actions
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

### Key Moments to Capture
- [ ] First checkpoint collection + immediate txid display
- [ ] TX Timeline progressing from Broadcasted → Accepted
- [ ] Explorer link showing real transaction
- [ ] Timestamp difference (e.g., "850ms to accepted")

---

## Scene 3: Duel Mode (1:10 - 2:00)

### Visual
- Duel Lobby page
- Two browser windows side by side (or explain single-player demo)

### Script
> "Duel mode lets you bet against a friend.
> Both players deposit KAS, race for 30 seconds, and the winner takes all — settled automatically on-chain."

### Actions
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

### Key Moments to Capture
- [ ] Match creation with join code
- [ ] Deposit transaction confirmation
- [ ] Both deposits confirmed → READY state
- [ ] Settlement transaction to winner

---

## Scene 4: Proof Page (2:00 - 2:30)

### Visual
- Proof page with txid input

### Script
> "Every game transaction includes a payload that proves the game event.
> On the Proof page, you can verify any transaction — see the session, event type, and cryptographic commit."

### Actions
1. Navigate to /proof
2. Paste a txid from the game
3. Show the decoded payload:
   - Network (mainnet/testnet)
   - Mode (free_run/duel)
   - Event type (checkpoint)
   - Session ID
   - Sequence number
4. Show TX lifecycle timeline

### Key Moments to Capture
- [ ] Txid input and verification
- [ ] Decoded payload display
- [ ] "This transaction is a valid KAS Racing event"

---

## Scene 5: SDK Highlight (2:30 - 2:45)

### Visual
- Code editor or README showing SDK usage

### Script
> "The visualization components are available as a standalone SDK.
> Any Kaspa app can use TxLifecycleTimeline to show transaction progress."

### Actions
1. Show SDK import code
2. (Optional) Show component in Storybook or demo page

---

## Scene 6: Closing (2:45 - 3:00)

### Visual
- Home page or GitHub README

### Script
> "KAS Racing — proving that blockchain can be fast, one checkpoint at a time.
> Thanks for watching."

### Actions
1. Return to home page
2. Show GitHub link / MIT license badge
3. Fade out

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

### If Demo Fails
- Have a backup recording ready
- Keep explorer tabs open to show past transactions
- Use `SKIP_KEY_VALIDATION=true` and show simulated TX flow if needed

### Network Considerations
- Testnet may have delayed block times
- Mainnet recommended for smooth demo
- Have treasury funded with sufficient KAS (at least 1 KAS)

### Troubleshooting
- TX stuck at "Broadcasted": Check network connectivity
- Kasware not connecting: Refresh page, ensure wallet is unlocked
- Server errors: Check logs with `pnpm dev`
