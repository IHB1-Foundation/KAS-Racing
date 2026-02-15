# KAS Racing Local Run Guide (KASPLEX zkEVM Testnet)

## 0) Network Baseline

| Item | Value |
|------|------|
| Chain ID | `167012` |
| RPC | `https://rpc.kasplextest.xyz` |
| Explorer | `https://zkevm.kasplex.org` |
| Native Token | KAS (18 decimals) |

Current deployed contracts:
- `MatchEscrow`: `0xd731DB9644049F010bF595f94c91851D2e7765dD`
- `RewardVault`: `0xE2769EE0c03bA6b9aD881f4e02b3225aD1033889`
- Deployment block: `18827035`

## 1) Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (local Postgres)
- MetaMask (recommended) or Rabby

## 2) Environment Files

```bash
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env.local
cp apps/indexer-evm/.env.example apps/indexer-evm/.env
cp apps/contracts-evm/.env.example apps/contracts-evm/.env
```

Required manual inputs:
- `apps/server/.env`: `OPERATOR_PRIVATE_KEY`
- `apps/contracts-evm/.env`: `OPERATOR_PRIVATE_KEY`

Optional key reuse:
- `TREASURY_PRIVATE_KEY` and `ORACLE_PRIVATE_KEY` may reuse the same key as `OPERATOR_PRIVATE_KEY`.

## 3) Start Postgres

```bash
docker run --name kas-racing-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kas_racing \
  -p 5432:5432 \
  -d postgres:16
```

## 4) Deploy Contracts (If Needed)

```bash
set -a; source .env; set +a
pnpm --filter @kas-racing/contracts-evm deploy:testnet
pnpm --filter @kas-racing/contracts-evm verify
```

After deployment, `deploy/addresses.kasplex.testnet.json` is updated.

## 5) Run Locally

Terminal 1 (API):
```bash
pnpm --filter @kas-racing/server dev
```

Terminal 2 (Indexer):
```bash
pnpm --filter @kas-racing/indexer-evm dev
```

Terminal 3 (Client):
```bash
pnpm --filter @kas-racing/client dev
```

## 6) Verification Checklist

- API health: `http://localhost:8787/api/health`
- Client: `http://localhost:5173`
- DB tables: `chain_events_evm`, `indexer_cursor`
- MetaMask network: Chain ID `167012`
