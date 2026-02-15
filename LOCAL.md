# KAS Racing 로컬 실행 가이드 (KASPLEX zkEVM Testnet)

## 0) 체인 기준

현재 코드의 모든 트랜잭션 경로(보상/입금/정산)는 **KASPLEX zkEVM Testnet** 기반입니다.

| 항목 | 값 |
|------|------|
| Chain ID | `167012` |
| RPC | `https://rpc.kasplextest.xyz` |
| Explorer | `https://zkevm.kasplex.org` |
| Native Token | KAS (18 decimals) |
| Faucet | KASPLEX Discord / 팀 문의 |

## 1) 필수 준비물

- Node.js 20+
- pnpm 9+
- Docker (로컬 Postgres 용)
- MetaMask 지갑 (KASPLEX Testnet 설정)

### MetaMask 네트워크 추가

1. MetaMask → Settings → Networks → Add Network
2. 아래 값 입력:
   - Network Name: `KASPLEX Testnet`
   - RPC URL: `https://rpc.kasplextest.xyz`
   - Chain ID: `167012`
   - Currency Symbol: `KAS`
   - Block Explorer URL: `https://zkevm.kasplex.org`

## 2) env 파일 준비

```bash
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env.local
```

필수로 직접 채워야 하는 값:
- `apps/server/.env`
  - `OPERATOR_PRIVATE_KEY` — operator 계정 private key (0x 접두사 포함 hex)
  - `ESCROW_CONTRACT_ADDRESS` — 배포된 MatchEscrow 컨트랙트 주소
  - `REWARD_CONTRACT_ADDRESS` — 배포된 RewardVault 컨트랙트 주소

이미 채워둔 기본값:
- DB: `postgresql://postgres:postgres@localhost:5432/kas_racing`
- API: `http://localhost:8787`
- EVM RPC: `https://rpc.kasplextest.xyz`
- Chain ID: `167012`

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

터미널 2 (Client)
```bash
pnpm --filter @kas-racing/client dev
```

## 5) 정상 동작 확인

- API Health: `http://localhost:8787/api/health`
- Client: `http://localhost:5173`
- MetaMask에서 KASPLEX Testnet 연결 확인

## 6) 트러블슈팅

| 증상 | 해결 |
|------|------|
| 서버 시작 시 config 에러 | `OPERATOR_PRIVATE_KEY`, 컨트랙트 주소 확인 |
| MetaMask 네트워크 mismatch | KASPLEX Testnet으로 전환 (Chain ID 167012) |
| 보상 tx 실패 | RewardVault 잔고 확인, operator에 gas 충전 |
| deposit tx 실패 | 플레이어 지갑에 KAS 충전 (deposit + gas 필요) |
| "Wrong network" 배너 | MetaMask에서 네트워크 전환 버튼 클릭 |
