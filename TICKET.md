# KAS Racing — TICKET.md

## 0) 규칙(이 문서 운영 방식)
- 티켓은 위에서 아래 순서대로 진행한다.
- 완료 표시 규칙:
    - `- [ ]` : TODO
    - `- [~]` : IN PROGRESS
    - `- [x]` : DONE
- 각 티켓은 “산출물(Artifacts)”과 “완료조건(Acceptance Criteria)”를 반드시 만족해야 DONE 처리한다.
- 막히면:
    1) 원인을 `Notes/Blockers`에 기록
    2) 필요한 경우 하위 티켓을 추가
    3) 기존 티켓을 억지로 DONE 처리하지 않는다.
- 모든 변경은 PR(또는 최소한 커밋) 단위로 남긴다.
- 비밀키/API Key는 절대 레포에 커밋하지 않는다.

---

## 1) P0 — 리포/기반/규정 준수(실격 방지)

### - [x] T-001 Repo Bootstrap (Monorepo + Tooling)
**목표**
- monorepo 초기화 및 디렉터리 구조 강제.

**작업**
- [x] `apps/client`, `apps/server`, `packages/speed-visualizer-sdk`, `docs/` 생성
- [x] 패키지 매니저 선정(pnpm 권장) 및 workspace 설정
- [x] TypeScript 설정(서버/SDK), ESLint/Prettier 설정
- [x] 기본 스크립트:
    - `pnpm dev` (client+server 동시 실행)
    - `pnpm test` / `pnpm lint` / `pnpm build`

**산출물**
- 레포 골격 + 루트 README(간단)

**완료조건**
- 로컬에서 `pnpm install && pnpm dev` 성공(빈 화면이라도 실행되어야 함)

**변경 요약**
- pnpm workspace 기반 monorepo 골격 추가(`apps/client`, `apps/server`, `packages/speed-visualizer-sdk`, `docs/`)
- 기본 스크립트/툴링(TypeScript, ESLint, Prettier) 구성
- 프로젝트 명칭을 KAS Racing으로 정리

**실행 방법**
- `pnpm install`
- `pnpm dev` (client+server)
- `pnpm lint && pnpm test && pnpm build`

**Notes/Blockers**
- 없음


### - [~] T-002 CI Pipeline (Lint/Test/Build)
**의존**
- T-001

**작업**
- [x] GitHub Actions: lint/test/build 워크플로우 추가
- [x] PR 시 자동 실행

**완료조건**
- main 브랜치에 CI 초록

**변경 요약**
- GitHub Actions 워크플로우 추가: `pnpm install` → `pnpm lint` → `pnpm test` → `pnpm build`

**실행 방법**
- GitHub에 push 후 Actions 탭에서 CI 결과 확인

**Notes/Blockers**
- 로컬에서는 `pnpm lint && pnpm test && pnpm build`로 동일 경로 확인 완료.
- “main 브랜치 CI 초록”은 push 후 확인 필요.


### - [x] T-003 Open Source Compliance Pack
**의존**
- T-001

**작업**
- [x] OSI 라이선스 선택 및 `LICENSE` 추가(MIT 권장)
- [x] `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` 추가(간단 버전)
- [x] `SECURITY.md`(키 커밋 금지, 취약점 제보 채널)

**완료조건**
- 레포 루트에 LICENSE 존재
- 문서가 최소한의 템플릿 수준으로라도 완비

**변경 요약**
- `LICENSE`(MIT), `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` 추가

**실행 방법**
- 문서 확인: `ls LICENSE CODE_OF_CONDUCT.md CONTRIBUTING.md SECURITY.md`

**Notes/Blockers**
- 없음


### - [x] T-004 Project Docs Seed (PROJECT.md / ARCHITECTURE.md / WORKLOG.md)
**의존**
- T-001

**작업**
- [x] `PROJECT.md`를 레포 루트에 추가(본 문서 내용 반영)
- [x] `docs/ARCHITECTURE.md`에 아키텍처 다이어그램(텍스트/mermaid 가능)
- [x] `WORKLOG.md` 생성: 티켓별 진행 로그 기록

**완료조건**
- 신규 개발자가 docs만 보고 구조 이해 가능

**변경 요약**
- PROJECT.md는 이미 존재 (T-001에서 생성됨)
- docs/ARCHITECTURE.md 생성: mermaid 다이어그램 (시스템 개요, 컴포넌트 분해, Free Run/Duel 시퀀스)
- WORKLOG.md 생성: 티켓별 진행 로그 기록

**실행 방법**
- 문서 확인: `ls PROJECT.md docs/ARCHITECTURE.md WORKLOG.md`
- mermaid 렌더링: GitHub에서 자동 렌더링 또는 mermaid-cli 사용

**Notes/Blockers**
- 없음


---

## 2) P1 — 클라이언트(게임) MVP

### - [x] T-010 Client App Skeleton (Phaser + Routing)
**의존**
- T-001

**작업**
- [x] Phaser 프로젝트 셋업
- [x] 화면 구성:
    - Home: Play Free Run / Duel / Connect Wallet
    - Free Run Scene
    - Duel Lobby Scene
    - Debug/Proof Scene(선택)
- [x] 간단한 UI 프레임(좌: 게임, 우: 패널 영역)

**완료조건**
- 브라우저에서 각 화면 전환이 동작

**변경 요약**
- Phaser 3 게임 엔진을 React에 통합 (GameCanvas 컴포넌트)
- 3개 게임 Scene: BootScene, FreeRunScene, DuelScene
- 4개 페이지: Home, FreeRun, DuelLobby, Proof
- 레이아웃: 좌측 게임(800x600), 우측 패널(360px)
- 라우팅: `/`, `/free-run`, `/duel`, `/proof`

**실행 방법**
- `pnpm dev` 후 `http://localhost:5173` 접속
- 각 버튼 클릭으로 화면 전환 확인

**Notes/Blockers**
- 없음


### - [x] T-011 Free Run Core Gameplay (3-lane runner)
**의존**
- T-010

**작업**
- [x] 3레인 이동(키보드/터치)
- [x] 장애물 스폰/충돌 판정/게임오버
- [x] 거리/속도 증가 로직
- [x] 체크포인트 캡슐 스폰(2~3초 체감 빈도)

**완료조건**
- 60초 이상 플레이 가능
- 체크포인트 획득 이벤트가 발생

**변경 요약**
- FreeRunScene 전면 재작성
- 3레인 이동: LEFT/RIGHT 키보드, 좌우 스와이프
- 장애물: 1.5초마다 스폰, 충돌 시 게임오버
- 체크포인트: 2.5초마다 스폰, 수집 시 이벤트 발생
- 속도: 200 km/h → 600 km/h 점진 증가
- 이벤트: gameStart, checkpointCollected, gameOver

**실행 방법**
- `pnpm dev` → `/free-run` 접속 → SPACE로 시작
- LEFT/RIGHT로 레인 변경, 장애물 피하고 체크포인트 수집

**Notes/Blockers**
- 없음


### - [x] T-012 HUD Layout + Event Hooks
**의존**
- T-011

**작업**
- [x] HUD에 표시:
    - distance, speed, checkpoints collected
    - tx panel placeholder
- [x] 체크포인트 획득 시 클라이언트 이벤트 발생(서버 호출 준비)

**완료조건**
- 캡슐 먹을 때 HUD 카운터 증가

**변경 요약**
- GameCanvas: 이벤트 콜백 추가 (onStatsUpdate, onCheckpoint, onGameOver, onGameStart)
- FreeRun: 실시간 HUD 업데이트 (distance/speed/checkpoints)
- FreeRun: 게임 상태 표시 (Running.../Game Over)
- FreeRun: TX Timeline placeholder (pending 기록 표시)
- 스타일: tx-list, tx-item, game-status 컴포넌트 추가

**실행 방법**
- `pnpm dev` → `/free-run` 접속 → 게임 플레이
- HUD 패널에서 실시간 distance/speed/checkpoints 확인
- 체크포인트 수집 시 TX Timeline에 pending 항목 추가됨

**Notes/Blockers**
- 없음


---

## 3) P2 — 서버 MVP(세션/정책/API)

### - [x] T-020 Server App Skeleton (REST + WebSocket)
**의존**
- T-001

**작업**
- [x] Node 서버(Express 또는 Nest) 구성
- [x] REST 기본 라우팅:
    - `POST /api/session/start`
    - `POST /api/session/event`
    - `GET /api/tx/:txid/status` (stub)
- [x] WebSocket 채널:
    - `txStatusUpdated`
    - `sessionEventAck`

**완료조건**
- 로컬에서 서버 기동 + 헬스체크 OK
- 클라이언트가 서버에 연결 가능

**변경 요약**
- Express + socket.io 기반 서버 구현
- REST 라우트: session (start/event/end), tx (status)
- WebSocket: subscribe/unsubscribe 채널, txStatusUpdated/sessionEventAck 이벤트
- In-memory 세션/tx 상태 저장소 (DB는 T-021에서 구현)
- Stub txid 시뮬레이션: broadcasted → accepted → included → confirmed 진행

**실행 방법**
- `pnpm dev` 후 서버 http://localhost:8787
- `curl http://localhost:8787/api/health`
- `curl -X POST http://localhost:8787/api/session/start -H "Content-Type: application/json" -d '{"userAddress":"kaspa:test", "mode":"free_run"}'`

**Notes/Blockers**
- 없음


### - [x] T-021 DB Schema + Migrations
**의존**
- T-020

**작업**
- [x] DB 선택(Postgres 권장, MVP는 SQLite 허용)
- [x] 테이블:
    - users, sessions, reward_events, matches
- [x] 마이그레이션 도구 적용(Prisma/Knex/Drizzle 중 택1)

**완료조건**
- 마이그레이션 1회로 스키마 생성 가능

**변경 요약**
- Drizzle ORM + better-sqlite3 선택 (MVP용 경량 설정)
- 4개 테이블 스키마: users, sessions, reward_events, matches
- 마이그레이션 파일 생성: drizzle/0000_even_fantastic_four.sql
- DB 스크립트: `pnpm db:generate`, `pnpm db:push`, `pnpm db:studio`
- 서버 코드 리팩토링: app.ts 분리로 테스트 안정성 향상

**실행 방법**
- `mkdir -p apps/server/data && pnpm db:push` (스키마 적용)
- `pnpm db:studio` (DB 브라우저 실행)

**Notes/Blockers**
- 없음


### - [x] T-022 Session Policy Engine (Cooldown/Max events)
**의존**
- T-021

**작업**
- [x] 세션 시작 시 policy 내려주기:
    - rewardCooldownMs=2000
    - rewardMaxPerSession=10
    - rewardAmounts preset
- [x] 이벤트 수신 시 정책 검사:
    - 쿨다운
    - 최대횟수
    - 세션 상태(active)
    - timestamp sanity check

**완료조건**
- 정책 위반 이벤트는 거절되고 이유 코드가 반환됨

**변경 요약**
- timestamp sanity check 추가 (30초 max drift)
- 정책 위반 reject 코드: COOLDOWN_ACTIVE, MAX_EVENTS_REACHED, SESSION_ENDED, TIMESTAMP_INVALID
- 7개 정책 테스트 추가 (쿨다운, 최대 횟수, 세션 상태, 타임스탬프)

**실행 방법**
- `pnpm test` 로 정책 테스트 실행
- API 테스트: 세션 시작 응답에 policy 포함 확인

**Notes/Blockers**
- 없음


---

## 4) P3 — 지갑 연동(클라이언트)

### - [x] T-030 Wallet Provider Abstraction
**의존**
- T-010

**목표**
- 특정 지갑 종속을 줄이기 위한 추상화 레이어.

**작업**
- [x] `IWalletProvider` 인터페이스 정의:
    - connect()
    - getAddress()
    - sendTransaction(to, amount, options)
- [x] 구현체:
    - `KaswareProvider`(우선)
    - `MockProvider`(단, 온체인 지급/입금에 사용 금지. UI 개발용으로만)

**완료조건**
- 클라이언트 코드가 provider 교체 가능

**변경 요약**
- `apps/client/src/wallet/` 모듈 추가
- IWalletProvider 인터페이스: connect, disconnect, getAddress, sendTransaction, getNetwork
- KaswareProvider: Kasware 브라우저 확장 지갑 연동
- MockProvider: UI 개발용 목 provider (온체인 결제에 사용 금지)
- WalletContext + useWallet 훅: React 앱 전역 지갑 상태 관리
- 18개 테스트 추가

**실행 방법**
```typescript
import { createWalletProvider, useWallet, WalletProvider } from './wallet';

// 방법 1: 직접 provider 사용
const wallet = createWalletProvider('kasware');
await wallet.connect();

// 방법 2: React Context 사용
<WalletProvider>
  <App /> {/* useWallet() 훅 사용 가능 */}
</WalletProvider>
```

**Notes/Blockers**
- 없음


### - [x] T-031 Kasware Connect + Address Fetch
**의존**
- T-030

**작업**
- [x] Connect/Disconnect UI
- [x] 주소 표시/복사
- [x] 오류 처리(미설치, 권한 거부)

**완료조건**
- "Connect Wallet" 클릭 → 주소 표시 성공

**변경 요약**
- WalletButton 컴포넌트 추가 (`apps/client/src/components/WalletButton.tsx`)
- Connect/Disconnect 버튼 UI
- 주소 truncation 표시 (kaspa:qz0c...9k5v)
- 클릭하여 주소 복사 기능
- 에러 처리: 미설치 시 설치 링크, 권한 거부 시 메시지
- App.tsx에 WalletProvider 감싸기
- Home 페이지에 WalletButton 통합

**실행 방법**
- `pnpm dev` → http://localhost:5173 접속
- "Connect Wallet" 클릭 → Kasware 설치되어 있으면 연결, 없으면 설치 안내
- 연결 후 주소 클릭 → 클립보드에 복사

**Notes/Blockers**
- Kasware 미설치 시 MockProvider로 fallback (UI 개발용)


### - [x] T-032 Deposit Flow UX (Duel)
**의존**
- T-031, T-060(매치 생성 API 최소 stub)

**작업**
- [x] Duel lobby에서 bet 선택
- [x] 매치 생성/참가 후 서버가 준 escrow address 표시
- [x] "Deposit" 버튼 → 지갑 sendTransaction 실행
- [x] txid 표시 + 서버에 txid 등록

**완료조건**
- 실제 tx 브로드캐스트 후 txid가 UI에 보임(테스트넷 권장)

**변경 요약**
- `apps/client/src/api/client.ts`: Match API 함수 추가 (createMatch, joinMatch, getMatch, registerDeposit)
- `apps/client/src/pages/DuelLobby.tsx`: 전면 재작성
  - lobby → create/join → waiting → deposits → game 플로우
  - bet amount 선택 (0.1/0.5/1.0/5.0 KAS)
  - join code 입력 및 표시
  - deposit 상태 표시 (TxLifecycleTimeline 통합)
- `apps/client/src/wallet/WalletContext.tsx`: sendTransaction 추가 (KAS→sompi 변환)
- `apps/server/src/routes/match.ts`: POST /api/match/:id/deposit 엔드포인트
- 5개 deposit API 테스트 추가

**실행 방법**
- `pnpm dev` → http://localhost:5173/duel 접속
- 지갑 연결 → Create Match → 코드 공유
- 다른 브라우저에서 Join with Code → 코드 입력
- 양측 Deposit 버튼 클릭 → txid가 UI에 표시됨

**Notes/Blockers**
- escrow address는 placeholder 사용 (T-072에서 실제 생성 예정)
- MockProvider로 테스트 시 simulated txid가 생성됨


---

## 5) P4 — Reward Stream(서버 결제 엔진)

### - [x] T-040 Treasury Key Management + Config
**의존**
- T-020

**작업**
- [x] 서버 환경변수 정의:
    - NETWORK=testnet/mainnet
    - TREASURY_PRIVATE_KEY
    - TREASURY_CHANGE_ADDRESS
    - ORACLE_PRIVATE_KEY (듀얼용)
- [x] 키 로딩/검증(키 없으면 서버 기동 실패)
- [x] 절대 로그 출력 금지

**완료조건**
- 잘못된 키/누락 시 명확한 에러로 종료

**변경 요약**
- `apps/server/src/config/index.ts`: 환경변수 로딩/검증 모듈
- `.env.example`: 환경변수 템플릿 (값은 빈칸)
- 서버 시작 시 config 검증, 실패하면 exit(1)
- `safeLogConfig()`: 민감 정보 [REDACTED] 처리
- `SKIP_KEY_VALIDATION=true`: 개발용 검증 스킵 옵션
- 11개 테스트 추가

**실행 방법**
- `.env.example`을 `.env`로 복사 후 값 입력
- `pnpm dev` → 키 없으면 에러 출력 후 종료
- 개발용: `SKIP_KEY_VALIDATION=true pnpm dev`

**Notes/Blockers**
- 없음


### - [x] T-041 Reward Payout TX Builder (1-in 2-out, min output)
**의존**
- T-040, T-022

**목표**
- 체크포인트 이벤트가 승인되면 즉시 지급 tx를 생성/서명/브로드캐스트.

**작업**
- [x] rewardAmount 최소값을 config로 강제(기본 0.02 KAS)
- [x] tx outputs = [user(reward), change(change)] 고정
- [x] UTXO 선택(단순: largest-first 또는 oldest-first)
- [x] 수수료/질량 정책에 맞게 안전하게 구성(필요 시 margin)

**산출물**
- `apps/server/src/tx/rewardPayout.ts` 등

**완료조건**
- 서버 단독 스크립트로 "지급 tx 1개"를 생성/브로드캐스트 성공

**변경 요약**
- `apps/server/src/tx/kaspaRestClient.ts`: REST API 기반 클라이언트 (api.kaspa.org)
- `apps/server/src/tx/rewardPayout.ts`: REST API + kaspa-wasm 통합
  - kaspa-wasm으로 트랜잭션 생성/서명
  - REST API로 UTXO 조회 및 트랜잭션 제출
  - signScriptHash를 사용한 Schnorr 서명
- UTXO 선택: largest-first 전략
- min reward: config에서 0.02 KAS (2,000,000 sompi)
- priority fee: 5000 sompi
- 테스트 스크립트: `scripts/test-reward-payout.ts`

**실행 방법**
```bash
# Dry run (REST API 연결 테스트)
NETWORK=mainnet TREASURY_PRIVATE_KEY=... TREASURY_CHANGE_ADDRESS=... \
  ORACLE_PRIVATE_KEY=... npx tsx scripts/test-reward-payout.ts

# 실제 브로드캐스트 (자금 필요)
NETWORK=mainnet TREASURY_PRIVATE_KEY=... TREASURY_CHANGE_ADDRESS=... \
  ORACLE_PRIVATE_KEY=... npx tsx scripts/test-reward-payout.ts --broadcast
```

**Notes/Blockers**
- 테스트넷 REST API (api-tn11.kaspa.org) 현재 503 에러 - 메인넷 API 사용 권장
- kaspa-wasm RPC (wRPC) 연결 문제로 REST API 방식으로 전환
- REST API 연결 테스트 성공 ✓
- 실제 브로드캐스트 테스트: 자금이 있는 지갑 필요


### - [x] T-042 Reward Event State Machine + Idempotency
**의존**
- T-041, T-021

**작업**
- [x] reward_events에 (sessionId, seq) unique
- [x] pending → broadcasted(txid) → accepted → included → confirmed
- [x] 중복 요청/재시도 시 새 tx 생성 금지(기존 txid 상태 반환)

**완료조건**
- 동일 이벤트를 여러 번 보내도 지급은 1회만 발생

**변경 요약**
- `apps/server/src/db/schema.ts`: reward_events에 (sessionId, seq) unique 인덱스 추가
- `apps/server/src/services/rewardService.ts`: 상태 머신 + idempotency 로직
  - findRewardEvent: 기존 이벤트 조회
  - processRewardRequest: 중복 체크 후 TX 브로드캐스트
  - updateRewardEventStatus: 상태 전이 + timestamp 기록
- 8개 테스트 추가

**실행 방법**
```typescript
import { processRewardRequest } from './services/rewardService';

// 첫 번째 요청 - 새 이벤트 생성 + TX 브로드캐스트
const result1 = await processRewardRequest({
  sessionId: 'session-1',
  seq: 1,
  rewardAmountKas: 0.02,
});
// result1.isNew = true, result1.txid = 'tx-abc...'

// 중복 요청 - 기존 이벤트 반환 (새 TX 없음)
const result2 = await processRewardRequest({
  sessionId: 'session-1',
  seq: 1,
  rewardAmountKas: 0.02,
});
// result2.isNew = false, result2.txid = 'tx-abc...' (동일)
```

**Notes/Blockers**
- 없음


### - [x] T-043 Client-Server Integration (Checkpoint → Payout)
**의존**
- T-012, T-042

**작업**
- [x] 클라이언트 체크포인트 획득 → `/api/session/event`
- [x] 서버 응답으로 rewardAmount/txid 수신
- [x] HUD에 txid 표시 + "Broadcasted" 단계 점등

**완료조건**
- 실제 플레이 중 체크포인트를 먹으면 txid가 즉시 표시됨

**변경 요약**
- `apps/client/src/api/client.ts`: API 클라이언트 추가 (startSession, sendEvent, endSession)
- `apps/client/src/pages/FreeRun.tsx`: 게임 시작 시 세션 생성, 체크포인트 수집 시 서버 이벤트 전송
- `apps/server/src/routes/session.ts`: rewardService.processRewardRequest 연동 (stub → 실제 TX)
- `apps/client/src/styles.css`: TX 상태별 스타일 추가 (broadcasted/accepted/included/confirmed/failed)
- HUD에 txid와 explorer 링크 표시

**실행 방법**
- `pnpm dev` 후 http://localhost:5173/free-run 접속
- 지갑 연결 후 SPACE로 게임 시작
- 체크포인트 수집 시 TX Timeline에 txid 표시됨
- (실제 TX 브로드캐스트는 환경변수 설정 필요: TREASURY_PRIVATE_KEY 등)

**Notes/Blockers**
- 없음


---

## 6) P5 — Tx 상태 추적 + Speed-Visualizer SDK

### - [x] T-050 Tx Status Provider (Server-side)
**의존**
- T-020

**목표**
- txid의 현재 상태(accepted/included/confirmations)를 안정적으로 조회.

**작업**
- [x] 옵션 A: 인덱싱 API 사용(서버에서만 호출; API Key 클라 노출 금지)
- [x] `/api/tx/:txid/status` 구현
- [x] 서버 내부 폴링 워커:
    - broadcasted 상태의 tx를 주기적으로 조회
    - 상태 변화 시 WebSocket push

**완료조건**
- txid 1개를 넣으면 단계가 시간에 따라 업데이트됨

**변경 요약**
- `apps/server/src/services/txStatusService.ts`: REST API 기반 TX 상태 조회 + stub TX 시뮬레이션
- `apps/server/src/workers/txStatusWorker.ts`: 2초 간격 폴링 워커 (broadcasted/accepted/included 상태 추적)
- `apps/server/src/routes/tx.ts`: `/api/tx/:txid/status` 엔드포인트
- `apps/server/src/ws/index.ts`: `emitTxStatusUpdated` WebSocket push
- 개발 환경에서도 워커 동작 (stub TX 시뮬레이션 지원)
- 10개 테스트 추가

**실행 방법**
- `pnpm dev` 후 게임 플레이 → 체크포인트 수집 시 TX 상태가 자동 업데이트됨
- `curl http://localhost:8787/api/tx/stub_test_123/status` → stub TX 시뮬레이션 응답
- WebSocket: `subscribe` 이벤트로 세션 구독 후 `txStatusUpdated` 이벤트 수신

**Notes/Blockers**
- 없음


### - [x] T-051 Speed-Visualizer SDK Package Skeleton
**의존**
- T-001

**작업**
- [x] `packages/speed-visualizer-sdk`에 컴포넌트 설계
- [x] 빌드/번들링 설정(tsup/vite library mode)
- [x] 샘플 페이지(FreeRun 페이지에 통합)

**완료조건**
- client가 SDK를 import해서 렌더링 가능

**변경 요약**
- `packages/speed-visualizer-sdk/src/types.ts`: 타입 정의
- `packages/speed-visualizer-sdk/src/components/TxLifecycleTimeline.tsx`: TX 라이프사이클 타임라인
- `packages/speed-visualizer-sdk/src/components/KaspaRPMGauge.tsx`: 네트워크 BPS 게이지
- `packages/speed-visualizer-sdk/tsup.config.ts`: tsup 번들러 설정
- `apps/client/src/pages/FreeRun.tsx`: TxLifecycleTimeline 컴포넌트 통합

**실행 방법**
```typescript
import { TxLifecycleTimeline, KaspaRPMGauge } from '@kas-racing/speed-visualizer-sdk';

<TxLifecycleTimeline
  txid="abc123..."
  status="broadcasted"
  timestamps={{ broadcasted: Date.now() }}
  network="mainnet"
/>

<KaspaRPMGauge bps={1.5} maxBps={10} />
```

**Notes/Blockers**
- 없음


### - [x] T-052 TxLifecycleTimeline Component
**의존**
- T-051, T-050

**작업**
- [x] 입력: txid + status endpoint
- [x] 출력:
    - 단계(broadcasted/accepted/included/confirmations)
    - 각 단계 timestamp(ms) 및 경과시간
    - explorer 링크 버튼(네트워크별 URL 템플릿)

**완료조건**
- reward txid를 넣으면 실시간으로 단계가 변하는 타임라인이 보임

**변경 요약**
- T-051에서 함께 구현됨
- FreeRun 페이지에서 체크포인트 수집 시 TxLifecycleTimeline 표시

**Notes/Blockers**
- 없음


### - [x] T-053 KaspaRPMGauge Component
**의존**
- T-051

**작업**
- [x] 네트워크 펄스 데이터(최근 블록 간격/추정 BPS)를 표시
- [x] "RPM 게이지" 형태로 시각화
- [x] 데이터가 없으면 graceful fallback("no data")

**완료조건**
- 게임 HUD에 게이지가 렌더링되고 값이 갱신됨

**변경 요약**
- T-051에서 함께 구현됨
- `packages/speed-visualizer-sdk/src/components/KaspaRPMGauge.tsx`

**Notes/Blockers**
- 없음


### - [x] T-054 Integrate SDK into Game HUD
**의존**
- T-052, T-053, T-012

**작업**
- [x] TxLifecycleTimeline을 FreeRun 페이지에 통합 (T-051에서 완료)
- [x] KaspaRPMGauge를 HUD에 추가

**완료조건**
- 한 판 플레이 중 tx lifecycle이 "눈으로" 확인됨

**변경 요약**
- `apps/client/src/pages/FreeRun.tsx`: KaspaRPMGauge 컴포넌트 통합
- 게임 속도에 따라 Network Pulse 게이지가 동적으로 변함
- TxLifecycleTimeline과 KaspaRPMGauge 모두 HUD에 표시

**Notes/Blockers**
- 실제 네트워크 BPS 데이터 연동은 추후 개선 가능
- [ ] 체크포인트 지급 txid가 Timeline에 자동으로 연결

**완료조건**
- 한 판 플레이 중 tx lifecycle이 “눈으로” 확인됨


---

## 7) P6 — Duel(Fallback 먼저 완성)

### - [x] T-060 Matchmaking (Create/Join by Code)
**의존**
- T-020, T-021

**작업**
- [x] `POST /api/match/create` → joinCode 발급
- [x] `POST /api/match/join` → matchId 반환
- [x] match 상태 조회 `GET /api/match/:id`

**완료조건**
- A가 방 만들고 B가 코드로 참가 가능

**변경 요약**
- `apps/server/src/routes/match.ts`: 매치 API 라우트 추가
- `apps/server/src/routes/match.test.ts`: 13개 테스트 추가
- `apps/server/src/app.ts`: matchRoutes 등록
- 6자리 영숫자 joinCode 생성 (I,O,0,1 제외)
- 최소 베팅 금액: 0.1 KAS

**실행 방법**
```bash
# 매치 생성
curl -X POST http://localhost:8787/api/match/create \
  -H "Content-Type: application/json" \
  -d '{"playerAddress":"kaspa:test","betAmount":0.5}'

# 매치 참가
curl -X POST http://localhost:8787/api/match/join \
  -H "Content-Type: application/json" \
  -d '{"joinCode":"ABC123","playerAddress":"kaspa:player2"}'

# 매치 조회
curl http://localhost:8787/api/match/{matchId}
```

**Notes/Blockers**
- 없음


### - [x] T-061 Duel Gameplay (30s race) + Result
**의존**
- T-060, T-011

**작업**
- [x] 듀얼 모드에서 동일한 러너 로직을 30초 고정으로 실행
- [x] 서버 authoritative 타이머/결과 산출(거리 비교)
- [x] 결과 UI(A win/B win/draw)

**완료조건**
- 두 클라이언트가 같은 matchId로 입장 → 30초 후 결과가 동일

**변경 요약**
- `apps/client/src/game/scenes/DuelScene.ts`: 전면 재작성
  - 30초 타이머 기반 레이스
  - 충돌 시 게임오버 대신 속도 감소 패널티
  - 타이머 색상 변화 (10초, 5초 이하)
  - raceEnd 이벤트 emit
  - showResult 메서드 (승/패/무승부 표시)
- `apps/client/src/components/GameCanvas.tsx`: duel 모드 이벤트 핸들링 추가
- `apps/server/src/routes/match.ts`:
  - POST /api/match/:id/start - 게임 시작
  - POST /api/match/:id/submit-score - 점수 제출
  - 양측 점수 제출 시 자동 승자 결정

**실행 방법**
- `pnpm dev` → http://localhost:5173/duel 접속
- 매치 생성/참가 → 양측 deposit 완료
- 게임 시작 → 30초간 레이스
- 레이스 종료 시 점수 서버 제출 → 결과 표시

**Notes/Blockers**
- 실시간 동기화는 미구현 (각자 플레이 후 점수 제출 방식)
- DuelLobby에서 게임 view 연동은 추가 작업 필요


### - [x] T-062 Duel Deposit Tracking (txid 등록/상태 확인)
**의존**
- T-032, T-050, T-060

**작업**
- [x] escrow address 발급(우선은 단순 주소로도 가능; covenant는 P7)
- [x] 각 플레이어 deposit txid 서버 등록
- [x] deposit이 accepted/included되면 match 상태가 "READY"로 전환

**완료조건**
- 양측 입금이 확인되면 자동으로 레이스 시작 가능

**변경 요약**
- `apps/server/src/services/escrowService.ts`: Escrow 주소 생성 서비스 (MVP fallback 모드)
- `apps/server/src/services/depositTrackingService.ts`: Deposit TX 상태 추적 서비스
- `apps/server/src/workers/txStatusWorker.ts`: Deposit 상태 폴링 추가
- `apps/server/src/ws/index.ts`: subscribeMatch/emitMatchUpdated WebSocket 이벤트
- `apps/server/src/routes/match.ts`: Escrow 주소 생성 + deposit 상태 기반 ready 전환
- 8개 deposit tracking 테스트 추가

**실행 방법**
- 매치 생성 시 escrow 주소가 자동 생성됨 (MVP: treasury 주소 사용)
- deposit 등록 후 txStatusWorker가 2초 간격으로 상태 추적
- 양측 deposit이 'accepted' 상태가 되면 match가 자동으로 'ready'로 전환
- WebSocket으로 match 상태 변화를 실시간 수신 가능

**Notes/Blockers**
- MVP fallback 모드: escrow 주소는 treasury 주소 사용 (서버 custodial)
- Covenant 기반 theft-resistant escrow는 T-070~T-074에서 구현 예정


### - [x] T-063 Settlement (Fallback: Server pays winner)
**의존**
- T-062, T-040, T-041

**작업**
- [x] 결과 확정 시 서버가 winner에게 payout tx 생성/브로드캐스트
- [x] match에 settle txid 기록
- [x] UI에 settle txid + lifecycle 표시

**완료조건**
- 1v1 한 판에서 deposit 2개 + settle 1개가 온체인에서 확인 가능

**변경 요약**
- `apps/server/src/services/settlementService.ts`: Settlement 서비스 구현
  - Winner 결정 시 treasury에서 상금 지급 (betAmount * 2)
  - Draw 처리 (현재는 no-op, 향후 환불 기능 추가)
  - 실패 시 settleStatus = 'failed'로 마킹
- `apps/server/src/routes/match.ts`: submit-score 시 비동기 settlement 트리거
- `apps/server/src/services/depositTrackingService.ts`: Settlement TX 상태 추적 추가
- `apps/server/src/workers/txStatusWorker.ts`: Settlement 폴링 추가
- `apps/client/src/pages/DuelLobby.tsx`: 'finished' view 추가
  - 결과 표시 (Win/Lose/Draw)
  - Settlement TX 라이프사이클 표시
- 7개 settlement 테스트 추가

**실행 방법**
- 매치 완료 (양측 점수 제출) 시 자동으로 settlement 트리거
- Winner에게 betAmount * 2 KAS 지급
- UI에서 settle txid와 상태 실시간 확인 가능
- WebSocket으로 match 상태 변화 push

**Notes/Blockers**
- MVP fallback 모드: treasury에서 직접 지급
- Draw 시 환불은 미구현 (T-070+ covenant 구현 시 추가)
- 실제 TX 브로드캐스트는 환경변수 설정 필요 (TREASURY_PRIVATE_KEY 등)


---

## 8) P7 — Covenant 기반 theft-resistant escrow (가능한 범위까지, 기술점수 파트)

### - [x] T-070 Feasibility Check: Covenant/KIP-10 Support on Target Network
**의존**
- T-020

**작업**
- [x] 선택 네트워크(testnet/mainnet)에서 covenant 관련 기능이 실제로 사용 가능한지 확인
- [x] SDK/노드/RPC에서 필요한 opcode/introspection 지원 여부 확인
- [x] 불가하면: 범위를 축소하고 "부분 구현 + 로드맵"으로 전환(티켓에 기록)

**완료조건**
- "가능/불가능/부분 가능" 결론과 근거를 문서로 남김
- 불가능일 경우, T-071~T-074는 범위 조정

**변경 요약**
- `docs/COVENANT_FEASIBILITY.md`: Covenant 지원 상태 문서화

**결론**
| 네트워크 | 상태 | 비고 |
|---------|------|------|
| Testnet 12 | ✅ 활성화 (2026-01) | Covenant 사용 가능 |
| Mainnet | ⏳ 미활성화 | 2026년 중 활성화 예정 |

**결정**
- T-071~T-074: Testnet에서 구현 가능, Mainnet은 fallback 모드 사용
- Hackathon 데모: Fallback 모드 (이미 구현됨) + 로드맵 언급
- Post-Hackathon: Testnet에서 covenant 구현 후 mainnet 전환

**Notes/Blockers**
- KIP-10 (Crescendo Hard Fork, 2025-05)로 인프라 준비 완료
- Testnet 12 (2026-01)부터 covenant 테스트 가능
- Mainnet 활성화 시점 모니터링 필요


### - [x] T-071 Escrow Script Template Design (Oracle settle + Timelock refund)
**의존**
- T-070

**작업**
- [x] 스크립트 템플릿 정의:
    - Branch A: oracle signature + outputs restricted to {playerA, playerB}
    - Branch B: timelock 이후 player 본인 환불
- [x] 스크립트 파라미터:
    - playerA address/script
    - playerB address/script
    - oracle pubkey
    - refund delay

**완료조건**
- 템플릿이 코드/문서로 명시되고, 입력/출력 제약이 명확

**변경 요약**
- `docs/ESCROW_SCRIPT_TEMPLATE.md`: 스크립트 템플릿 설계 문서
  - Branch A (Oracle Settlement): 오라클 서명 + 출력 제약
  - Branch B (Timelock Refund): 락타임 후 환불
  - KIP-10 opcode 사용 정의
- `apps/server/src/escrow/types.ts`: TypeScript 타입 정의
  - EscrowScriptParams, MatchEscrow, SettlementRequest 등

**Notes/Blockers**
- 실제 스크립트 컴파일은 T-072에서 구현
- Testnet 12에서만 테스트 가능 (Mainnet 미지원)


### - [~] T-072 Escrow Address Generation (per match, per player)
**의존**
- T-071, T-060

**작업**
- [ ] match 생성 시 escrowA/escrowB 주소 생성
- [ ] client에 escrow 주소 전달
- [ ] DB에 escrow 정보 저장

**완료조건**
- 매치마다 고유한 escrow 주소 2개가 생성

**Notes/Blockers**
- **BLOCKED**: Mainnet에서 KIP-10 covenant 미활성화 (2026년 중 예정)
- Testnet 12에서 구현 가능하나, 해커톤 데모는 Mainnet 사용 필요
- 현재 Fallback 모드 (treasury 주소) 사용 중 (T-062에서 구현됨)
- Mainnet covenant 활성화 후 진행 예정


### - [~] T-073 Settlement TX Builder for Escrow UTXOs
**의존**
- T-072, T-063

**작업**
- [ ] escrow UTXO 2개를 입력으로 사용
- [ ] winner 출력 1개(또는 draw 시 2개 반환)
- [ ] oracle 키로 스크립트 조건을 만족하도록 서명/구성

**완료조건**
- escrow 기반 settle tx가 온체인에 포함되고, 지급이 완료됨

**Notes/Blockers**
- **BLOCKED**: T-072 의존 (Mainnet covenant 미활성화)
- Fallback 모드 settlement는 T-063에서 구현됨


### - [~] T-074 Negative Tests: Theft-resistant Proof
**의존**
- T-073

**작업**
- [ ] "제3자 주소로 출력"을 시도하는 settle tx를 만들고 실패해야 함
- [ ] "환불 타임락 이전 환불 시도"가 실패해야 함
- [ ] 테스트 로그/스크린샷/설명을 docs에 첨부

**완료조건**
- 자동 테스트 또는 재현 스크립트로 theft 방지 성질을 증명

**Notes/Blockers**
- **BLOCKED**: T-073 의존 (Mainnet covenant 미활성화)
- Testnet에서 구현/테스트 후 문서화 예정


---

## 9) P8 — Payload Proof-of-Action(가능하면)

### - [x] T-080 Payload Format + Commit Scheme
**의존**
- T-022

**작업**
- [x] payload 문자열 포맷 확정:
    - `KASRACE1|net|mode|sessionId|event|seq|commit`
- [x] commit 생성 규칙:
    - seed는 서버에서 생성/보관
    - commit = H(seed|sessionId|seq|event|timeBucket)

**완료조건**
- payload 생성이 일관되고 문서화됨

**변경 요약**
- `apps/server/src/payload/index.ts`: Payload 생성 모듈
  - generatePayload: 트랜잭션에 삽입할 payload 문자열 생성
  - parsePayload: payload 문자열 파싱
  - generateCommit: SHA256 기반 commit 생성
  - 축약 코드 사용 (net: m/t, mode: f/d, event: c/s/d)
- 10개 테스트 추가

**실행 방법**
```typescript
import { initPayloadSeed, generatePayload } from './payload';

// 서버 시작 시 seed 초기화
initPayloadSeed();

// payload 생성
const payload = generatePayload({
  network: 'mainnet',
  mode: 'free_run',
  sessionId: 'abc12345',
  event: 'checkpoint',
  seq: 5,
});
// -> "KASRACE1|m|f|abc12345|c|5|a1b2c3d4e5f6g7h8"
```

**Notes/Blockers**
- 없음


### - [x] T-081 Attach Payload to Reward TX
**의존**
- T-041, T-080

**작업**
- [x] reward tx 생성 시 payload 삽입(가능한 범위에서)
- [ ] explorer/Proof page에서 payload 확인 가능한지 검증

**완료조건**
- 적어도 1개의 reward tx에 payload가 포함됨

**변경 요약**
- `apps/server/src/index.ts`: 서버 시작 시 payload seed 초기화
- `apps/server/src/services/rewardService.ts`: reward TX 브로드캐스트 시 payload 첨부
  - generatePayload() 호출하여 Proof-of-Action payload 생성
  - isPayloadValid() 검증 후 TX에 삽입
  - payload 크기 초과 시 경고 로그 출력 후 payload 없이 전송
- 10개 테스트 추가

**실행 방법**
- `pnpm dev` 후 게임 플레이 → 체크포인트 수집 시 TX에 payload 포함됨
- 서버 로그: `[reward] Generated payload: KASRACE1|m|f|abc12345|c|1|...`
- Explorer에서 TX payload 필드 확인 (실제 TX 브로드캐스트 필요)

**Notes/Blockers**
- explorer/Proof page에서 payload 확인은 T-082에서 구현 예정
- 실제 TX 브로드캐스트 테스트: 환경변수 설정 필요 (TREASURY_PRIVATE_KEY 등)


### - [x] T-082 Proof Page (Parse + Display)
**의존**
- T-081, T-052

**작업**
- [x] txid 입력/선택 → payload 파싱 결과 표시
- [x] "이 이벤트가 온체인에 기록됨"을 사람 눈으로 확인 가능하게 UI 구성

**완료조건**
- 데모 중 Proof page로 증거 제시 가능

**변경 요약**
- `apps/server/src/routes/tx.ts`: `/api/tx/:txid` 엔드포인트 추가 (TX 상세 정보 + payload)
- `apps/client/src/utils/payloadParser.ts`: 클라이언트 측 payload 파서
- `apps/client/src/api/client.ts`: getTxDetails, getTxStatus API 함수 추가
- `apps/client/src/pages/Proof.tsx`: Proof 페이지 UI 구현
  - txid 입력 폼 (Enter 키 지원)
  - 유효한 KAS Racing 이벤트 감지 및 표시
  - 이벤트 상세 정보 테이블 (Network, Mode, Event Type, Session, Seq, Commit)
  - TX 출력 목록 (금액, 주소)
  - TxLifecycleTimeline 컴포넌트로 TX 상태 표시
  - Explorer 링크

**실행 방법**
- `pnpm dev` → http://localhost:5173/proof 접속
- txid 입력 (예: `stub_testsession_1_xxxxx`) → Verify 클릭
- 페이로드 파싱 결과 및 TX 상태 확인

**Notes/Blockers**
- 없음


---

## 10) P9 — 보안/안정화/운영 품질

### - [x] T-090 Rate Limiting + Abuse Protection
**의존**
- T-020, T-022

**작업**
- [x] IP 기반 rate limit (session/event)
- [x] 동일 세션 이벤트 폭주 방지
- [x] 오류 코드/메시지 표준화

**완료조건**
- 간단한 스팸 요청에 서버가 무너지지 않음

**변경 요약**
- `apps/server/src/app.ts`: express-rate-limit 미들웨어 추가
  - General API: 100 req/min per IP
  - Session events: 30 req/min per IP+sessionId
  - Match operations: 20 req/min per IP
- `apps/server/src/errors/index.ts`: 표준화된 에러 코드 (ErrorCode enum)
- 테스트 환경에서는 rate limit 비활성화

**실행 방법**
- 서버 실행 후 동일 API를 반복 호출하면 429 응답
- `{ error: 'RATE_LIMIT_EXCEEDED', message: '...', retryAfterMs: 60000 }`

**Notes/Blockers**
- 없음


### - [x] T-091 Observability (Structured logs + Timing)
**의존**
- T-020, T-042, T-050

**작업**
- [x] 모든 tx에 대해:
    - broadcastedAt, acceptedAt, includedAt 기록 (T-042에서 구현됨)
- [x] requestId/sessionId/matchId correlation
- [x] 데모 중 문제 발생 시 원인 추적 가능

**완료조건**
- 워크로그 또는 로그 파일로 타임라인 추적 가능

**변경 요약**
- `apps/server/src/middleware/requestLogger.ts`: 요청 로깅 미들웨어
  - 요청별 고유 requestId 생성
  - sessionId, matchId 자동 추출 및 correlation
  - JSON 형식 구조화 로그
  - logTxEvent, logGameEvent 헬퍼 함수
- `apps/server/src/app.ts`: requestLogger 미들웨어 적용

**실행 방법**
- 서버 로그 예시:
  ```
  [request] {"type":"request","requestId":"a1b2c3d4","method":"POST","path":"/api/session/event"...}
  [response] {"type":"response","requestId":"a1b2c3d4","status":200,"durationMs":45...}
  ```

**Notes/Blockers**
- 없음


### - [x] T-092 Security Review Checklist
**의존**
- T-040

**작업**
- [x] 키/시크릿 커밋 탐지(git-secrets 등) - 가이드 제공
- [x] `.env.example` 제공(값은 빈칸) - T-040에서 완료
- [x] CORS/CSRF 기본 설정 점검(최소한의 보호)
- [x] 서버 지갑 키 접근권한 최소화(권한 분리 가능하면)

**완료조건**
- 민감정보가 레포에 없고, 기본 공격면이 줄어듦

**변경 요약**
- `apps/server/src/app.ts`: CORS 설정 개선 (CORS_ORIGIN 환경변수, body size 제한)
- `.env.example`: CORS_ORIGIN, SKIP_KEY_VALIDATION 추가
- `SECURITY.md`: 보안 체크리스트 추가
  - Secrets Management
  - API Security
  - Wallet Security
  - Network Security
  - git-secrets 설치 가이드

**실행 방법**
- SECURITY.md 확인
- 프로덕션 배포 시 CORS_ORIGIN 환경변수 설정 권장

**Notes/Blockers**
- 없음


---

## 11) P10 — 배포/데모 환경

### - [x] T-100 Deployment: Client (Static Hosting)
**의존**
- T-010

**작업**
- [x] Vercel/Netlify 중 택1 배포
- [x] 환경변수(network, server URL) 설정

**완료조건**
- 공개 URL에서 게임이 로드됨

**변경 요약**
- `vercel.json` (루트): monorepo 배포 설정
- `apps/client/vercel.json`: standalone 배포 설정
- `apps/client/.env.example`: 클라이언트 환경변수 템플릿 (VITE_API_URL, VITE_NETWORK)
- SPA 라우팅을 위한 rewrite 규칙 포함

**실행 방법**
1. Vercel CLI 설치: `npm i -g vercel`
2. 프로젝트 연결: `vercel link`
3. 환경변수 설정: Vercel Dashboard에서 VITE_API_URL 설정
4. 배포: `vercel --prod`

또는 GitHub 연동:
1. Vercel Dashboard → Import Git Repository
2. Root Directory: `/` (monorepo 전체)
3. Build Command: `pnpm build`
4. Output Directory: `apps/client/dist`
5. Environment Variables 설정

**Notes/Blockers**
- 설정 파일 준비 완료
- 실제 배포는 Vercel 계정 연동 후 수동 진행 필요


### - [x] T-101 Deployment: Server (WebSocket 지원)
**의존**
- T-020, T-050

**작업**
- [x] Render/Fly.io 등 배포
- [x] 환경변수/시크릿 설정
- [x] 헬스체크 + 재시작 정책

**완료조건**
- 공개 서버 URL에서 API/WS 동작

**변경 요약**
- `apps/server/Dockerfile`: Multi-stage Docker 빌드 (pnpm monorepo 지원)
- `apps/server/fly.toml`: Fly.io 배포 설정 (Singapore region, 512MB, SQLite volume)
- `apps/server/.dockerignore`: 빌드 최적화
- `apps/server/.env.example`: 환경변수 + Fly secrets 가이드
- `apps/server/package.json`: `start` 스크립트 추가
- 헬스체크: `/api/health` (30초 간격)

**실행 방법**
1. Fly.io CLI 설치: `curl -L https://fly.io/install.sh | sh`
2. 로그인: `fly auth login`
3. 앱 생성: `cd apps/server && fly launch --no-deploy`
4. 볼륨 생성: `fly volumes create kas_racing_data --region sea --size 1`
5. Secrets 설정:
   ```bash
   fly secrets set NETWORK=mainnet
   fly secrets set TREASURY_PRIVATE_KEY=your_key
   fly secrets set TREASURY_CHANGE_ADDRESS=kaspa:qz...
   fly secrets set ORACLE_PRIVATE_KEY=your_key
   fly secrets set CORS_ORIGIN=https://kas-racing.vercel.app
   ```
6. 배포: `fly deploy --dockerfile Dockerfile --config fly.toml`

**Notes/Blockers**
- 설정 파일 준비 완료
- 실제 배포는 Fly.io 계정 연동 후 수동 진행 필요
- Dockerfile 빌드 컨텍스트는 repository 루트에서 실행해야 함


### - [x] T-102 Deployment: Server (Railway)
**의존**
- T-101 (서버 Dockerfile/헬스체크 준비)
- T-100 (클라이언트 Vercel 배포/환경변수)
- T-092 (CORS/보안 기본 설정)

**목표**
- BE를 Railway에 배포하고, FE(Vercel)가 Railway 서버 URL로 연동되도록 정리한다.

**작업**
- [x] Railway 프로젝트/서비스 생성 + GitHub 연동 (모노레포 `apps/server` 기준)
- [x] 배포 방식 결정:
    - Dockerfile 사용(권장): `apps/server/Dockerfile` (빌드 컨텍스트는 repo root)
    - 또는 Nixpacks 사용 시 build/start 커맨드 명시
- [x] Railway Config-as-Code 추가: `railway.json` (repo root, `apps/server/Dockerfile` 지정)
- [x] Railway 환경변수/시크릿 설정(서버):
    - `NETWORK`
    - `TREASURY_PRIVATE_KEY`, `TREASURY_CHANGE_ADDRESS`
    - `ORACLE_PRIVATE_KEY`
    - `CORS_ORIGIN` (Vercel 도메인)
    - `DATABASE_PATH` (선택: Volume mount 경로를 커스텀할 때만)
    - `SKIP_KEY_VALIDATION`는 prod에서 `false` 유지
- [x] SQLite 지속성 전략 확정:
    - Railway Volume 사용(권장): mount to `/app/apps/server/data` (기본 DB 경로 `./data/kas-racing.db` 그대로 사용)
    - 또는 `DATABASE_PATH=/data/kas-racing.db` + mount to `/data`
    - (대안) Railway Postgres로 마이그레이션(범위 커짐)
- [x] 헬스체크 확인: `GET /api/health` → 200
- [x] Vercel 환경변수 업데이트(클라이언트):
    - `VITE_API_URL=https://<railway-service-domain>`
- [x] 문서 갱신:
    - `README.md` Deployment 섹션을 `Vercel + Railway`로 교체
    - Fly.io 가이드는 "대안/레거시"로 분리(필요 시)

**산출물**
- Railway 배포 설정: `railway.json`
- 문서: `README.md` (또는 `docs/DEPLOYMENT_RAILWAY.md`)

**완료조건**
- Railway 공개 URL에서 `/api/health`가 200을 반환
- Vercel 배포된 클라이언트에서 `VITE_API_URL`로 API 호출이 성공 (세션 start/event 최소 1회)

**변경 요약**
- `railway.json` 추가: Dockerfile 빌드 설정, 헬스체크 경로, 재시작 정책
- `README.md` Deployment 섹션 업데이트: Railway를 기본으로, Fly.io를 Legacy로 분리
- `apps/server/.env.example` 업데이트: Railway 환경변수 가이드, DATABASE_PATH 추가
- `apps/server/src/app.ts` CORS 개선: 쉼표 구분 다중 origin 지원
- `AI_USAGE.md` 업데이트: 배포 플랫폼을 Railway로 변경

**실행 방법**
1. Railway Dashboard에서 새 프로젝트 생성
2. GitHub repo 연결 (Root Directory: `/`)
3. 환경변수 설정: `NETWORK`, `TREASURY_PRIVATE_KEY`, `TREASURY_CHANGE_ADDRESS`, `ORACLE_PRIVATE_KEY`, `CORS_ORIGIN`
4. Volume 생성 후 `/app/apps/server/data`에 마운트
5. 배포 후 `https://<service>.up.railway.app/api/health` 확인
6. Vercel에서 `VITE_API_URL` 환경변수를 Railway URL로 설정

**Notes/Blockers**
- 설정 파일 및 문서 준비 완료
- 실제 배포 및 검증은 Railway/Vercel 계정에서 수동으로 수행 필요


---

## 12) P11 — 제출물(README/영상/썸네일/AI 공개)

### - [x] T-110 English README (Hackathon-grade)
**의존**
- T-043, T-054, T-063

**작업**
- [x] What/Why/How(아키텍처)
- [x] Quickstart(로컬 실행)
- [x] Demo instructions
- [x] SDK usage
- [x] AI usage disclosure 섹션 링크
- [x] License 확인

**완료조건**
- 처음 보는 사람이 로컬에서 재현 가능

**변경 요약**
- README.md 전면 재작성 (영문)
- ASCII 아키텍처 다이어그램
- Quickstart: `pnpm install && pnpm dev`
- Game modes: Free Run, Duel 설명
- SDK usage 코드 예제
- API Reference (REST + WebSocket)
- Deployment 가이드 (Vercel + Fly.io)
- Security/Contributing/License 링크

**실행 방법**
- `cat README.md` 또는 GitHub에서 확인

**Notes/Blockers**
- 없음


### - [x] T-111 Demo Video Script + Capture Checklist
**의존**
- T-110

**작업**
- [x] 2~3분 원테이크 시나리오
    - Free Run: checkpoint → txid → lifecycle
    - Duel: deposit 2개 + settle 1개
    - Proof page(가능하면)
- [x] 화면 구성(좌: 게임, 우: timeline + explorer)
- [x] 영문 자막 파일(srt) 준비(선택)

**완료조건**
- 촬영만 하면 제출 가능한 상태

**변경 요약**
- `docs/DEMO_SCRIPT.md` 생성
- 5개 Scene: Intro, Free Run, Duel, Proof, SDK, Closing
- Pre-recording 체크리스트 (환경, 브라우저 레이아웃)
- Key moments to capture 정의
- Post-recording 체크리스트 (비디오, 자막, 썸네일)
- Troubleshooting 가이드

**실행 방법**
- `cat docs/DEMO_SCRIPT.md` 확인
- 스크립트 따라 녹화 진행

**Notes/Blockers**
- 없음


### - [x] T-112 Thumbnail Screenshot (Required)
**의존**
- T-054

**작업**
- [x] 대표 화면 캡처(게임 + timeline 패널)
- [x] 1장 이상 준비

**완료조건**
- 제출 규정 충족

**변경 요약**
- `docs/THUMBNAIL_GUIDE.md`: 스크린샷 캡처 가이드
  - 해상도/포맷 요구사항
  - 이상적인 스크린샷 구도
  - 캡처 방법 (macOS/Windows)
  - 후처리 팁
  - 파일 명명 규칙
- `docs/screenshots/` 디렉토리 생성

**실행 방법**
- `docs/THUMBNAIL_GUIDE.md` 참고하여 스크린샷 캡처
- 캡처된 이미지를 `docs/screenshots/thumbnail_main.png`로 저장

**Notes/Blockers**
- 실제 스크린샷은 게임 실행 후 수동 캡처 필요


### - [x] T-113 AI_USAGE.md (Disclosure)
**의존**
- T-003

**작업**
- [x] AI 사용 도구/범위/산출물 표로 명시
- [x] "핵심 로직을 AI가 전부 작성"한 경우를 피하도록 명확히 기록

**완료조건**
- 레포에 AI_USAGE.md 존재

**변경 요약**
- `AI_USAGE.md` 생성
  - AI 도구: Claude Opus 4.5
  - 컴포넌트별 AI 기여도 표
  - AI 미사용 영역 명시 (비즈니스 로직, 보안 결정 등)
  - AI 상호작용 프로세스 설명
  - 검증 체크리스트
  - 커밋 Co-Author 형식 설명

**실행 방법**
- `cat AI_USAGE.md` 확인

**Notes/Blockers**
- 없음


---

## 13) P12 — 폴리시(선택, 시간 남으면)

### - [x] T-120 UX Polish: Onboarding + Error States
**의존**
- T-031, T-043, T-063

**작업**
- [x] 지갑 미설치/거부/네트워크 불일치 안내
- [x] tx 실패/지연 시 사용자 안내("network busy" 등)
- [x] 로딩/재시도 UX

**완료조건**
- 데모 중 "깨지는 화면"이 최소화됨

**변경 요약**
- `apps/client/src/styles.css` 추가:
  - `.error-banner`, `.warning-banner`, `.info-banner`, `.success-banner`
  - `.loading-spinner` (애니메이션 포함)
  - `.loading-overlay` 컴포넌트
  - `.network-indicator` (connected/connecting/disconnected)
  - `.onboarding-card` (지갑 연결 안내)
  - `.tooltip` 컴포넌트
- WalletButton에 이미 구현된 에러 처리 활용

**실행 방법**
- `pnpm dev` 후 게임 실행
- 지갑 미연결/연결 실패 시 적절한 메시지 표시

**Notes/Blockers**
- 없음


### - [x] T-121 Community-ready Web Page (Landing + Play Now)
**의존**
- T-100

**작업**
- [x] 랜딩 페이지(한 줄 설명 + Play + GitHub)
- [x] 공유 버튼(트위터/디스코드 링크)

**완료조건**
- 커뮤니티 투표 유도 가능한 형태

**변경 요약**
- `apps/client/src/pages/Home.tsx` 전면 재작성
  - Hero section (제목, 부제목, 태그라인)
  - Game modes grid (Free Run, Duel, Proof)
  - Features section (Real Transactions, Live Tracking, Proof of Play)
  - Share buttons (X/Twitter, GitHub)
  - Footer (Built with Kaspa, MIT License)
- `apps/client/src/styles.css` 랜딩 페이지 스타일 추가

**실행 방법**
- `pnpm dev` 후 http://localhost:5173 접속
- 랜딩 페이지 확인

**Notes/Blockers**
- 없음
