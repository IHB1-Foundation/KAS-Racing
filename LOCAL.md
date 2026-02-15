# KAS Racing 로컬 실행 가이드 (KASPLEX zkEVM Testnet)

## 0) 기준 네트워크

| 항목 | 값 |
|------|------|
| Chain ID | `167012` |
| RPC | `https://rpc.kasplextest.xyz` |
| Explorer | `https://zkevm.kasplex.org` |
| Native Token | KAS (18 decimals) |

현재 배포 기준 컨트랙트:
- `MatchEscrow`: `0xd731DB9644049F010bF595f94c91851D2e7765dD`
- `RewardVault`: `0xE2769EE0c03bA6b9aD881f4e02b3225aD1033889`
- 배포 블록: `18827035`

## 1) 준비물

- Node.js 20+
- pnpm 9+
- Docker (로컬 Postgres)
- MetaMask (권장) 또는 Rabby

## 2) env 준비

```bash
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env.local
cp apps/indexer-evm/.env.example apps/indexer-evm/.env
cp apps/contracts-evm/.env.example apps/contracts-evm/.env
```

필수 수동 입력:
- `apps/server/.env`: `OPERATOR_PRIVATE_KEY` (필수)
- `apps/contracts-evm/.env`: `OPERATOR_PRIVATE_KEY` (필수)

지갑 재사용 권장:
- `TREASURY_PRIVATE_KEY`, `ORACLE_PRIVATE_KEY`는 `OPERATOR_PRIVATE_KEY`와 같은 키 사용 가능

## 3) Postgres 실행

```bash
docker run --name kas-racing-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kas_racing \
  -p 5432:5432 \
  -d postgres:16
```

## 4) 컨트랙트 배포(필요 시)

```bash
set -a; source .env; set +a
pnpm --filter @kas-racing/contracts-evm deploy:testnet
pnpm --filter @kas-racing/contracts-evm verify
```

배포 후 `deploy/addresses.kasplex.testnet.json`이 자동 갱신됩니다.

## 5) 로컬 실행

터미널 1 (API):
```bash
pnpm --filter @kas-racing/server dev
```

터미널 2 (Indexer):
```bash
pnpm --filter @kas-racing/indexer-evm dev
```

터미널 3 (Client):
```bash
pnpm --filter @kas-racing/client dev
```

## 6) 확인 포인트

- API Health: `http://localhost:8787/api/health`
- Client: `http://localhost:5173`
- DB에 `chain_events_evm`, `indexer_cursor` 테이블 생성 확인
- MetaMask 네트워크: Chain ID `167012`
