# KAS Racing — Intern Deploy Checklist (Testnet)

> **Goal**: Deploy 4 services — **Postgres** + **API server** + **Chain Indexer** on Railway, and **Client (FE)** on Vercel — from scratch, using this document alone.

---

## 0) Prerequisites

| Item | Where to get it |
|------|----------------|
| Railway account | <https://railway.com> (free Hobby tier is fine) |
| Vercel account | <https://vercel.app> |
| GitHub access | Fork or collaborator access to this repo |
| Kaspa testnet faucet KAS | <https://faucet.kaspanet.io/> |
| Treasury / Oracle private keys | Generate with `kaspa-wasm` or any Kaspa wallet (64 hex chars each) |
| Treasury change address | The testnet address for the treasury wallet |

---

## 1) Railway Project Setup

### 1-A. Create Project

- [ ] Log in to Railway → **New Project** → **Empty Project**
- [ ] Give it a name (e.g. `kas-racing-testnet`)

### 1-B. Add Postgres

- [ ] Inside the project, click **+ New** → **Database** → **PostgreSQL**
- [ ] Note the service name (default: `Postgres`). If you rename it, update `${{Postgres.DATABASE_URL}}` references in env templates accordingly.
- [ ] No extra config needed — Railway provisions the DB automatically.

### 1-C. Deploy API Service

- [ ] **+ New** → **GitHub Repo** → select this repo
- [ ] Service name: `api`
- [ ] Settings → **Root Directory**: leave blank (root)
- [ ] Settings → **Config path**: `railway.json` (already in repo root, points to `apps/server/Dockerfile`)
- [ ] Go to **Variables** tab and paste every line from `deploy/railway.api.env.template`, replacing placeholders:
  - `TREASURY_PRIVATE_KEY` — your 64 hex char key
  - `TREASURY_CHANGE_ADDRESS` — `kaspatest:qz...`
  - `ORACLE_PRIVATE_KEY` — your 64 hex char key
  - `CORS_ORIGIN` — will be set after Vercel deploy (come back to fill this)
  - `DATABASE_URL` — use `${{Postgres.DATABASE_URL}}` (Railway template variable)
- [ ] Deploy and wait for health check: `GET /api/health` returns `200`
- [ ] Copy the Railway public domain (e.g. `https://api-production-xxxx.up.railway.app`)

### 1-D. Deploy Indexer Service

- [ ] **+ New** → **GitHub Repo** → select this repo (same repo, second service)
- [ ] Service name: `indexer`
- [ ] Settings → **Root Directory**: leave blank
- [ ] Settings → **Config path**: `deploy/railway.indexer.json`
- [ ] Go to **Variables** tab and paste every line from `deploy/railway.indexer.env.template`, replacing placeholders:
  - `DATABASE_URL` — use `${{Postgres.DATABASE_URL}}`
  - `WATCH_ADDRESSES` — treasury address + any escrow addresses (comma-separated)
- [ ] Deploy and check logs: should see `[indexer] Indexer running.`

---

## 2) Vercel (Client / FE)

- [ ] Log in to Vercel → **Add New** → **Project** → **Import Git Repository** → select this repo
- [ ] Framework Preset: **Vite** (should auto-detect from `vercel.json`)
- [ ] Root Directory: leave as `/` (Vercel reads `vercel.json` from root)
- [ ] Go to **Settings → Environment Variables** and add each variable from `deploy/vercel.env.template`:
  - `VITE_API_URL` — paste the Railway API domain from step 1-C
  - `VITE_NETWORK` — `testnet`
  - `VITE_EXPLORER_URL` — `https://explorer-tn11.kaspa.org`
  - `VITE_COVENANT_ENABLED` — `true`
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
- [ ] Connect wallet (testnet)
- [ ] Start **Free Run** → collect checkpoint → server call succeeds (check Network tab / HUD)
- [ ] Go to `/proof` → txid lookup works
- [ ] (Optional) Start a **Duel** → deposit → settle → check HUD timeline

---

## 5) Automated Smoke Test

After both services are up, run:

```bash
bash deploy/smoke-test.sh \
  https://<railway-api-domain> \
  https://<vercel-domain> \
  https://<railway-api-domain>
```

> Third argument (indexer URL) is optional if indexer shares the same host.
> All items must show `PASS`.

---

## 6) Handover Report Template

Copy-paste this and fill in:

```text
[KAS Racing Deploy Report — Testnet]
Date: YYYY-MM-DD
Deployer: your-name

Railway Project: https://railway.com/project/...
- API URL:     https://...
- Indexer:     (same project, check logs)
- Postgres:    (managed by Railway)

Vercel URL:    https://...

Smoke Test Results:
- Health Check:       PASS / FAIL
- Session API:        PASS / FAIL
- CORS:               PASS / FAIL
- FE Reachability:    PASS / FAIL
- Indexer Log Check:  PASS / FAIL

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
| **Kasware** (primary) | Chrome extension | Best supported; install from Chrome Web Store |
| **KaspaNet Web Wallet** | Web-based (backup) | Use if Kasware has issues; <https://wallet.kaspanet.io/> |
| **CLI wallet** (fallback) | kaspa-wasm Node script | For manual tx if all GUI wallets fail |

**Setup Steps:**
- [ ] Install Kasware extension in Chrome/Brave
- [ ] Create or import a **testnet** wallet
- [ ] Verify network setting: Kasware → Settings → Network → **Testnet**
- [ ] Note down the wallet address (`kaspatest:qz...`)
- [ ] Back up seed phrase securely (do NOT store digitally on demo machine)

### 7-B. Funding Checklist

| Item | Minimum | Recommended | How |
|------|---------|-------------|-----|
| Treasury wallet | 1 KAS | 5 KAS | Faucet: <https://faucet.kaspanet.io/> |
| Demo player wallet | 0.5 KAS | 2 KAS | Faucet or transfer from treasury |
| Second player wallet (Duel) | 0.5 KAS | 1 KAS | Faucet or transfer |

**Pre-Demo Funding Verification:**
- [ ] Treasury address has sufficient balance: check via `https://explorer-tn11.kaspa.org/addresses/<address>`
- [ ] Player wallet(s) funded and confirmed on-chain
- [ ] Faucet is working (request a small amount as test)
- [ ] `MIN_REWARD_KAS` env var matches expected payout (default: 0.02 KAS)
- [ ] Calculate: `MIN_REWARD_KAS × rewardMaxPerSession (10) = 0.2 KAS` minimum per full session

### 7-C. Environment Variable Verification

Before demo, confirm all services have correct env vars:

```bash
# API service — check via Railway dashboard or:
curl -s https://<api-url>/api/health | grep -q '"status":"ok"' && echo "API OK" || echo "API FAIL"

# Client — open browser console:
# > import.meta.env.VITE_API_URL   → should show API URL
# > import.meta.env.VITE_NETWORK   → should show "testnet"

# Indexer — check Railway logs for:
# "[indexer] Indexer running."
```

---

## 8) Incident Response Runbook

### 8-A. Wallet Errors

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| Kasware not connecting | Extension disabled or wrong network | 1. Check extension is enabled 2. Switch to testnet 3. Refresh page |
| "Insufficient balance" on deposit | Wallet underfunded | Transfer KAS from treasury or use faucet |
| Kasware popup doesn't appear | Browser popup blocker | Allow popups for the Vercel domain |
| Wallet shows wrong address | Multiple accounts | Switch to correct account in Kasware |
| **Kasware completely broken** | Extension crash | Switch to KaspaNet Web Wallet (backup) |

### 8-B. RPC / Network Failures

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| TX stuck at "Broadcasted" | RPC node unreachable | 1. Check Kaspa testnet status 2. Wait 30s and retry 3. If persistent, restart API service |
| API returns 500 on reward | Treasury UTXO spent or locked | 1. Check treasury balance via explorer 2. Wait for pending tx to confirm 3. Restart API to refresh UTXO set |
| "Network error" in browser | API service down | 1. Check Railway dashboard 2. Check API logs 3. Redeploy if needed |
| Slow block times (>10s) | Testnet congestion | Acknowledge to audience; show "Included" step may take longer; this demonstrates the timeline's value |

### 8-C. Indexer Issues

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| TX timeline not updating | Indexer not running | 1. Check Railway logs 2. Verify `DATABASE_URL` and `WATCH_ADDRESSES` 3. Redeploy indexer |
| Stale data / old txids | Indexer fell behind | 1. Restart indexer service 2. It will catch up from last checkpoint |
| DB connection error | Postgres unreachable | 1. Check Railway Postgres status 2. Verify `DATABASE_URL` template variable |

### 8-D. Emergency Redeployment (< 5 minutes)

If a service is completely broken during demo:

```bash
# 1. Railway — redeploy specific service:
#    Railway Dashboard → service → Deployments → Redeploy (latest)

# 2. Vercel — redeploy client:
#    Vercel Dashboard → project → Deployments → Redeploy

# 3. Smoke test after redeploy:
bash deploy/smoke-test.sh https://<api-url> https://<vercel-url>
```

### 8-E. Demo Pivot Strategies

If a critical system is down and cannot be recovered quickly:

1. **TX not broadcasting** → Show a previously completed tx on Explorer; explain the flow using Proof page
2. **Wallet broken** → Use SKIP_KEY_VALIDATION mode; demonstrate UI flow without on-chain tx
3. **Indexer down** → Free Run still works (server-side tx); skip real-time timeline updates
4. **Full outage** → Switch to pre-recorded backup video (keep one ready)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API `/health` returns 500 | Check `DATABASE_URL` is correctly linked. Check Railway logs for migration errors. |
| CORS error in browser | Ensure `CORS_ORIGIN` in API service matches exact Vercel domain (include `https://`). |
| Indexer exits immediately | Check `DATABASE_URL` and `WATCH_ADDRESSES` env vars are set. |
| FE shows "connecting..." | Verify `VITE_API_URL` points to Railway API domain. Redeploy Vercel after changing env vars. |
| Wallet won't connect | Ensure wallet is on **testnet**. Check `VITE_NETWORK=testnet`. |
| No tx events in Proof page | Ensure indexer is running and `WATCH_ADDRESSES` includes the relevant address. |
