# KAS Racing — Cutover & Rollback Plan (UTXO → EVM)

| Field | Value |
|-------|-------|
| Created | 2026-02-15 |
| Status | Ready for execution |
| Related | ADR-002, T-300–T-352 |

---

## 1. Overview

This document defines the procedure for switching KAS Racing from the legacy **Kaspa UTXO** path to the **KASPLEX zkEVM** path, and how to roll back if the switch fails.

**Scope:**
- 3 deployed services: Railway API, Railway Indexer, Vercel Frontend
- 2 smart contracts: MatchEscrow, RewardVault
- Environment variables, database schema, wallet configuration

**Key constraint:** The UTXO code is preserved in the repo (not deleted). Rollback means reverting env vars and re-deploying, not re-writing code.

---

## 2. Pre-Cutover Prerequisites

All of these must be true **before** starting the cutover:

### 2-A. Contracts

- [ ] MatchEscrow deployed to KASPLEX Testnet
- [ ] RewardVault deployed to KASPLEX Testnet
- [ ] Both addresses recorded in `deploy/addresses.kasplex.testnet.json`
- [ ] Contract tests pass: `pnpm --filter @kas-racing/contracts-evm test`
- [ ] RewardVault funded with at least 1 KAS
- [ ] Operator wallet has at least 0.5 KAS for gas

### 2-B. Backend

- [ ] Server builds: `pnpm --filter @kas-racing/server build`
- [ ] Server tests pass: `pnpm --filter @kas-racing/server test`
- [ ] EVM env vars template ready: `deploy/railway.api.env.template`
- [ ] Indexer env vars template ready: `deploy/railway.indexer.env.template`
- [ ] DB schema v3 tables created (auto-migrate on server start)

### 2-C. Frontend

- [ ] Client builds: `pnpm --filter @kas-racing/client build`
- [ ] Client tests pass: `pnpm --filter @kas-racing/client test`
- [ ] wagmi/viem wallet integration working (MetaMask on KASPLEX Testnet)
- [ ] Vercel env template ready: `deploy/vercel.env.template`

### 2-D. E2E Validation

- [ ] Smoke test passes locally: `bash deploy/smoke-test.sh http://localhost:8787 http://localhost:5173`
- [ ] E2E rehearsal completed (T-352)
- [ ] At least 2 successful tx hashes recorded for fallback demo

---

## 3. Cutover Procedure (Step by Step)

> Estimated total time: 15–30 minutes

### Phase 1: Snapshot Current State (5 min)

```bash
# 1. Record current Railway env vars (screenshot or export)
#    Railway Dashboard → api service → Variables → copy all

# 2. Record current Vercel env vars
#    Vercel Dashboard → project → Settings → Environment Variables → copy all

# 3. Note current git commit
git rev-parse HEAD
# Save this hash — it's the rollback point

# 4. Record current API health
curl -sf https://<current-api-url>/api/health | python3 -m json.tool
```

**Checkpoint:** Save all values in a text file. This is your rollback reference.

### Phase 2: Update Railway API Variables (5 min)

Go to Railway Dashboard → `api` service → Variables.

**Replace/Add these variables:**

| Variable | Action | Value |
|----------|--------|-------|
| `EVM_CHAIN_ID` | Add | `167012` |
| `EVM_RPC_URL` | Add | `https://rpc.kasplextest.xyz` |
| `OPERATOR_PRIVATE_KEY` | Add | `0x<your-operator-key>` |
| `ESCROW_CONTRACT_ADDRESS` | Add | `0x<deployed-escrow>` |
| `REWARD_CONTRACT_ADDRESS` | Add | `0x<deployed-reward-vault>` |
| `MIN_REWARD_KAS` | Add | `0.02` |
| `TX_POLL_INTERVAL_MS` | Add | `2000` |

**Remove/ignore legacy variables (if present):**

| Variable | Action |
|----------|--------|
| `TREASURY_PRIVATE_KEY` | Remove (replaced by OPERATOR_PRIVATE_KEY) |
| `TREASURY_CHANGE_ADDRESS` | Remove (not needed for EVM) |
| `ORACLE_PRIVATE_KEY` | Remove (merged into OPERATOR_PRIVATE_KEY) |
| `KASPA_RPC_URL` | Remove (replaced by EVM_RPC_URL) |

**Deploy the api service** (Railway will auto-deploy on variable change, or manually trigger).

### Phase 3: Deploy/Update Railway Indexer (3 min)

If indexer service doesn't exist yet:
- Railway → **+ New** → GitHub Repo → select this repo
- Config path: `deploy/railway.indexer.json`

Set variables from `deploy/railway.indexer.env.template`:

| Variable | Value |
|----------|-------|
| `EVM_CHAIN_ID` | `167012` |
| `EVM_RPC_URL` | `https://rpc.kasplextest.xyz` |
| `ESCROW_CONTRACT_ADDRESS` | Same as API |
| `REWARD_CONTRACT_ADDRESS` | Same as API |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `POLL_INTERVAL_MS` | `3000` |

Deploy.

### Phase 4: Update Vercel Frontend (3 min)

Vercel Dashboard → project → Settings → Environment Variables.

**Verify/Update:**

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://<railway-api-domain>` (same as before if domain unchanged) |
| `VITE_EXPLORER_URL` | `https://zkevm.kasplex.org` |

**Remove legacy variables (if present):**

| Variable | Action |
|----------|--------|
| `VITE_NETWORK` | Remove (replaced by VITE_CHAIN_ID in code) |
| `VITE_KASPA_RPC` | Remove |

Trigger a redeploy (Vercel → Deployments → Redeploy).

### Phase 5: Validation (5 min)

```bash
# 1. Smoke test
bash deploy/smoke-test.sh https://<railway-api-url> https://<vercel-url>
# Expected: 5/5 PASS

# 2. API health
curl -sf https://<railway-api-url>/api/health | python3 -m json.tool
# Expected: {"ok":true, ...}

# 3. V3 session start
curl -sf https://<railway-api-url>/api/v3/session/start \
  -X POST -H 'content-type: application/json' \
  -d '{"userAddress":"0x0000000000000000000000000000000000000001","mode":"free_run"}'
# Expected: {"sessionId":"..."}

# 4. Frontend loads
curl -sf -o /dev/null -w "%{http_code}" https://<vercel-url>
# Expected: 200

# 5. Manual test: open browser, connect MetaMask, play Free Run, collect checkpoint
#    → Verify tx hash appears in HUD
#    → Verify tx shows on https://zkevm.kasplex.org
```

### Phase 6: Announce Cutover Complete

- [ ] All 5 smoke tests pass
- [ ] Manual Free Run test successful (tx on-chain)
- [ ] Manual Proof page test successful (events decoded)
- [ ] (Optional) Manual Duel test successful

**Cutover is complete. Record the timestamp and commit hash.**

---

## 4. Rollback Procedure

> Use this if the cutover causes critical failures that cannot be fixed in 10 minutes.

### When to Rollback

| Symptom | Wait time before rollback |
|---------|--------------------------|
| API returns 500 on all endpoints | 5 min (try restart first) |
| KASPLEX RPC unreachable | 10 min (RPC may recover) |
| Contracts not responding | 10 min (check contract address) |
| Frontend blank/crash | 5 min (check Vercel build log) |
| Tx stuck permanently (>5 min) | 10 min |
| Data corruption in DB | Immediate rollback |

### Rollback Steps

#### Option A: Revert Environment Variables (Fast — 10 min)

This restores the UTXO path by reverting to legacy env vars.

**Railway API:**

1. Go to Railway Dashboard → `api` service → Variables
2. Remove EVM-specific variables:
   - `EVM_CHAIN_ID`, `EVM_RPC_URL`, `OPERATOR_PRIVATE_KEY`
   - `ESCROW_CONTRACT_ADDRESS`, `REWARD_CONTRACT_ADDRESS`
3. Restore legacy variables from your Phase 1 snapshot:
   - `TREASURY_PRIVATE_KEY`, `TREASURY_CHANGE_ADDRESS`, `ORACLE_PRIVATE_KEY`
   - `KASPA_RPC_URL` (if was set)
4. Deploy

**Railway Indexer:**

1. If the EVM indexer is a new service, disable it (Railway → service → Settings → Disable)
2. Re-enable the legacy indexer service if it was disabled

**Vercel:**

1. Restore `VITE_NETWORK` and remove `VITE_EXPLORER_URL` if it was changed
2. Redeploy

**Verify:** Run smoke test with legacy endpoints.

#### Option B: Revert to Previous Git Commit (Slower — 20 min)

Only if Option A fails or if code changes broke things.

```bash
# 1. Note the rollback commit hash (from Phase 1)
ROLLBACK_HASH="<hash-from-phase-1-snapshot>"

# 2. On Railway, set the deploy branch/commit to the rollback hash
#    Railway → service → Settings → Deploy → set specific commit

# 3. On Vercel, redeploy from the specific commit
#    Vercel → Deployments → find the old deployment → Redeploy
```

> **Important:** Do NOT run `git reset --hard` or `git push --force`. Use the platform's deployment controls to roll back.

#### Option C: Maintenance Mode (Immediate — 2 min)

If you need to stop all traffic immediately while investigating:

```bash
# Railway: scale API to 0 replicas
# Railway Dashboard → api service → Settings → Scale → 0

# Vercel: Password-protect or disable
# Vercel Dashboard → Settings → Deployment Protection → Enable
```

Then investigate, fix, and re-enable.

---

## 5. Database Considerations

### Forward Migration (UTXO → EVM)

- EVM tables (`chain_events_evm`, `matches_v3`, `deposits_v3`, `settlements_v3`, `reward_events_v3`) are created automatically on server start via `CREATE TABLE IF NOT EXISTS`.
- Legacy tables (`matches`, `deposits`, `settlements`, `reward_events`) are **not dropped** — they remain for reference.
- No data migration needed — EVM tables start empty.

### Rollback Migration (EVM → UTXO)

- Legacy tables are untouched during cutover, so rollback requires no DB changes.
- If you want to clean up EVM tables after rollback:

```sql
-- Only run if you're sure you want to remove EVM data
DROP TABLE IF EXISTS chain_events_evm;
DROP TABLE IF EXISTS matches_v3;
DROP TABLE IF EXISTS deposits_v3;
DROP TABLE IF EXISTS settlements_v3;
DROP TABLE IF EXISTS reward_events_v3;
DROP TABLE IF EXISTS indexer_cursor;
```

> **Recommendation:** Do not drop EVM tables on rollback. They don't interfere with UTXO operations and the data may be useful for debugging.

---

## 6. Operation Day Checklist

> Print this page and check off items during the actual cutover.

### T-60 min (Preparation)

- [ ] Read this entire document
- [ ] Open Railway Dashboard in browser tab
- [ ] Open Vercel Dashboard in browser tab
- [ ] Open KASPLEX Explorer: `https://zkevm.kasplex.org`
- [ ] Have `deploy/smoke-test.sh` ready to run
- [ ] Prepare text file for recording timestamps and observations
- [ ] MetaMask installed and connected to KASPLEX Testnet
- [ ] Player wallets funded (check on Explorer)
- [ ] RewardVault funded (check on Explorer)
- [ ] Operator wallet has gas (check on Explorer)
- [ ] Backup video file ready (in case demo is needed during cutover)

### T-30 min (Pre-flight)

- [ ] Record Phase 1 snapshot (current env vars + commit hash)
- [ ] Run current smoke test to confirm pre-cutover state is healthy
- [ ] Notify team: "Cutover starting in 30 minutes"

### T-0 (Execute)

- [ ] **Phase 2:** Update Railway API variables → deploy
- [ ] **Phase 3:** Deploy/update Railway Indexer → deploy
- [ ] **Phase 4:** Update Vercel variables → redeploy
- [ ] **Phase 5:** Run validation suite

### T+5 min (Verify)

- [ ] Smoke test: 5/5 PASS?
- [ ] Manual Free Run test: tx on-chain?
- [ ] Manual Proof page: events decoded?
- [ ] All services responding?

### T+10 min (Decision)

- [ ] **All green?** → Announce cutover complete. Record timestamp.
- [ ] **Failures?** → Attempt fix for 10 min max. If not resolved → execute Rollback.

### Post-Cutover (within 24 hours)

- [ ] Monitor Railway logs for errors
- [ ] Run smoke test again after 1 hour
- [ ] Run smoke test again after 24 hours
- [ ] Record final status in team channel

---

## 7. Contacts & Escalation

| Role | Responsibility | Escalation |
|------|---------------|------------|
| Deployer | Execute cutover steps | If blocked for >10 min → rollback |
| Lead dev | Approve rollback decision | Available on Slack during cutover |
| Infra (Railway/Vercel) | Platform issues | Railway status: status.railway.com |
| KASPLEX team | RPC/chain issues | KASPLEX Discord |

---

## 8. Post-Cutover Cleanup (Optional, Not Urgent)

These can be done days/weeks after successful cutover:

- [ ] Remove legacy env var references from documentation
- [ ] Archive `apps/contracts/` to `legacy/contracts-utxo/`
- [ ] Remove `kaspa-wasm` from server dependencies
- [ ] Update README to reflect EVM-only architecture
- [ ] Remove `TREASURY_PRIVATE_KEY`/`ORACLE_PRIVATE_KEY` from any env templates
