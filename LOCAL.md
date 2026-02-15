# KAS Racing 로컬 실행 가이드 (Postgres + KASPLEX 기준)

## 0) 먼저 확인

- 현재 코드의 실제 트랜잭션 경로(보상/입금/정산)는 **Kaspa UTXO testnet(TN11)** 기반입니다.
- 따라서 서버/인덱서는 `NETWORK=testnet`, `kaspatest:` 주소를 사용해야 정상 동작합니다.
- **KASPLEX zkEVM Testnet** 값은 지갑/네트워크 참고값으로 함께 정리합니다.

KASPLEX zkEVM Testnet (공식 문서 기준)
- Chain ID: `167012`
- RPC: `https://rpc.kasplextest.xyz`
- Explorer: `https://zkevm.kasplex.org`

## 1) 필수 준비물

- Node.js 20+
- pnpm 9+
- Docker (로컬 Postgres 용)
- Kasware 지갑 (testnet 계정)

## 2) env 파일 준비

```bash
cp apps/server/.env.example apps/server/.env
cp apps/indexer/.env.example apps/indexer/.env
cp apps/client/.env.example apps/client/.env.local
```

필수로 직접 채워야 하는 값
- `apps/server/.env`
  - `TREASURY_PRIVATE_KEY`
  - `TREASURY_CHANGE_ADDRESS` (`kaspatest:` 주소)
  - `ORACLE_PRIVATE_KEY`
- `apps/indexer/.env`
  - `WATCH_ADDRESSES` (최소 treasury 주소 포함)

이미 채워둔 기본값
- DB: `postgresql://postgres:postgres@localhost:5432/kas_racing`
- API: `http://localhost:8787`
- Client Network: `testnet`
- Explorer: `https://explorer-tn11.kaspa.org`

## 3) Postgres 실행

```bash
docker run --name kas-racing-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kas_racing \
  -p 5432:5432 \
  -d postgres:16
```

## 4) 실행

터미널 1 (Server)
```bash
pnpm --filter @kas-racing/server dev
```

터미널 2 (Indexer)
```bash
pnpm --filter @kas-racing/indexer dev
```

터미널 3 (Client)
```bash
pnpm --filter @kas-racing/client dev
```

## 5) 정상 동작 확인

- API Health: `http://localhost:8787/api/health`
- Client: `http://localhost:5173`
- Indexer 로그에 `Indexer running` 출력 확인

## 6) 트러블슈팅

- 서버 시작 시 config 에러:
  - `TREASURY_PRIVATE_KEY`, `TREASURY_CHANGE_ADDRESS`, `ORACLE_PRIVATE_KEY` 확인
- 지갑 네트워크 mismatch:
  - Kasware를 testnet으로 전환
- 보상 tx 실패:
  - Treasury 잔고 확인 (테스트넷 faucet으로 충전)
