# KAS Racing — Intern Deploy Checklist (KASPLEX Testnet)

> **Goal**: Deploy 3 services — **Postgres** + **API server** on Railway, and **Client (FE)** on Vercel — from scratch, using this document alone.

---

## 0) Prerequisites

| Item | Where to get it |
|------|----------------|
| Railway account | <https://railway.com> (free Hobby tier is fine) |
| Vercel account | <https://vercel.app> |
| GitHub access | Fork or collaborator access to this repo |
| KASPLEX Testnet KAS | KASPLEX Discord faucet / team request |
| Operator private key | Any EVM wallet (0x-prefixed hex, 66 chars) |
| Deployed contract addresses | From `deploy/addresses.kasplex.testnet.json` or `pnpm --filter @kas-racing/contracts-evm deploy:testnet` |

---

## 1) Railway Project Setup

### 1-A. Create Project

- [ ] Log in to Railway → **New Project** → **Empty Project**
- [ ] Give it a name (e.g. `kas-racing-testnet`)

### 1-B. Add Postgres

- [ ] Inside the project, click **+ New** → **Database** → **PostgreSQL**
- [ ] Note the service name (default: `Postgres`). If you rename it, update `${{Postgres.DATABASE_URL}}` references accordingly.

### 1-C. Deploy API Service

- [ ] **+ New** → **GitHub Repo** → select this repo
- [ ] Service name: `api`
- [ ] Settings → **Root Directory**: leave blank (root)
- [ ] Settings → **Config path**: `railway.json`
- [ ] Go to **Variables** tab and paste every line from `deploy/railway.api.env.template`, replacing placeholders:
  - `OPERATOR_PRIVATE_KEY` — your 0x-prefixed operator key
  - `ESCROW_CONTRACT_ADDRESS` — deployed MatchEscrow address
  - `REWARD_CONTRACT_ADDRESS` — deployed RewardVault address
  - `CORS_ORIGIN` — will be set after Vercel deploy (come back to fill this)
  - `DATABASE_URL` — use `${{Postgres.DATABASE_URL}}` (Railway template variable)
- [ ] Deploy and wait for health check: `GET /api/health` returns `200`
- [ ] Copy the Railway public domain (e.g. `https://api-production-xxxx.up.railway.app`)

---

## 2) Vercel (Client / FE)

- [ ] Log in to Vercel → **Add New** → **Project** → **Import Git Repository** → select this repo
- [ ] Framework Preset: **Vite** (should auto-detect from `vercel.json`)
- [ ] Root Directory: leave as `/`
- [ ] Go to **Settings → Environment Variables** and add each variable from `deploy/vercel.env.template`:
  - `VITE_API_URL` — paste the Railway API domain from step 1-C
  - `VITE_EXPLORER_URL` — `https://zkevm.kasplex.org`
- [ ] Deploy
- [ ] Copy the Vercel domain (e.g. `https://kas-racing.vercel.app`)

---

## 3) Post-deploy Wiring

- [ ] Go back to Railway → `api` service → **Variables**
- [ ] Set `CORS_ORIGIN` to the Vercel domain from step 2
- [ ] Redeploy the `api` service (or it auto-deploys on variable change)

---

## 4) Integration Checks (Manual)

- [ ] Open browser → Vercel URL → Home page loads
- [ ] Connect MetaMask wallet (KASPLEX Testnet, Chain ID 167012)
- [ ] Start **Free Run** → collect checkpoint → reward tx appears in timeline
- [ ] Go to `/proof` → tx hash lookup works
- [ ] (Optional) Start a **Duel** → deposit via MetaMask → settle → check HUD timeline

---

## 5) Automated Smoke Test

After both services are up, run:

```bash
bash deploy/smoke-test.sh \
  https://<railway-api-domain> \
  https://<vercel-domain>
```

> All items must show `PASS`.

---

## 6) Handover Report Template

Copy-paste this and fill in:

```text
[KAS Racing Deploy Report — KASPLEX Testnet]
Date: YYYY-MM-DD
Deployer: your-name

Railway Project: https://railway.com/project/...
- API URL:     https://...
- Postgres:    (managed by Railway)

Vercel URL:    https://...

Contract Addresses:
- MatchEscrow:  0x...
- RewardVault:  0x...

Smoke Test Results:
- Health Check:       PASS / FAIL
- Session API:        PASS / FAIL
- CORS:               PASS / FAIL
- FE Reachability:    PASS / FAIL

Manual Tests:
- Free Run:           PASS / FAIL
- Proof Page:         PASS / FAIL
- Duel (optional):    PASS / FAIL
```

---

## 7) Demo Wallet & Funding Preparation

### 7-A. Recommended Wallets

| Wallet | Type | Notes |
|--------|------|-------|
| **MetaMask** (primary) | Chrome extension | Add KASPLEX Testnet network manually |
| **Rabby** (backup) | Chrome extension | Alternative if MetaMask has issues |

**Setup Steps:**
- [ ] Install MetaMask extension in Chrome/Brave
- [ ] Add KASPLEX Testnet network (see LOCAL.md for values)
- [ ] Create or import account
- [ ] Note down the wallet address (`0x...`)
- [ ] Get testnet KAS from KASPLEX faucet

### 7-B. Funding Checklist

| Item | Minimum | Recommended | How |
|------|---------|-------------|-----|
| Operator wallet | 0.5 KAS | 2 KAS | For gas on contract calls |
| RewardVault contract | 1 KAS | 5 KAS | Fund via operator transfer |
| Demo player wallet | 0.5 KAS | 2 KAS | Faucet or transfer |
| Second player wallet (Duel) | 0.5 KAS | 1 KAS | Faucet or transfer |

**Pre-Demo Funding Verification:**
- [ ] Operator address has gas: check via `https://zkevm.kasplex.org/address/<address>`
- [ ] RewardVault has balance for rewards
- [ ] Player wallet(s) funded
- [ ] Calculate: `MIN_REWARD_KAS × rewardMaxPerSession (10) = 0.2 KAS` minimum per full session

---

## 8) Incident Response Runbook

### 8-A. Wallet Errors

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| MetaMask not connecting | Extension disabled or wrong network | 1. Check extension enabled 2. Switch to KASPLEX Testnet (167012) 3. Refresh page |
| "Insufficient balance" on deposit | Wallet underfunded | Transfer KAS from faucet or operator |
| MetaMask popup doesn't appear | Browser popup blocker | Allow popups for the Vercel domain |
| "Wrong network" banner in app | Chain ID mismatch | Click "Switch Network" button in app |

### 8-B. RPC / Network Failures

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| TX stuck at "Submitted" | RPC node unreachable | 1. Check KASPLEX RPC status 2. Wait 30s and retry |
| API returns 500 on reward | RewardVault underfunded or operator out of gas | 1. Fund RewardVault 2. Fund operator 3. Restart API |
| "Network error" in browser | API service down | Check Railway dashboard and logs |

### 8-C. Emergency Redeployment (< 5 minutes)

```bash
# 1. Railway — redeploy specific service
#    Railway Dashboard → service → Deployments → Redeploy

# 2. Vercel — redeploy client
#    Vercel Dashboard → project → Deployments → Redeploy

# 3. Smoke test after redeploy
bash deploy/smoke-test.sh https://<api-url> https://<vercel-url>
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API `/health` returns 500 | Check `DATABASE_URL` is correctly linked. Check logs for migration errors. |
| CORS error in browser | Ensure `CORS_ORIGIN` matches exact Vercel domain (include `https://`). |
| FE shows "connecting..." | Verify `VITE_API_URL` points to Railway API domain. Redeploy Vercel after changing env vars. |
| Wallet won't connect | Ensure MetaMask is on KASPLEX Testnet (Chain ID 167012). |
| No events in Proof page | Ensure indexer events are being written to chain_events_evm table. |
