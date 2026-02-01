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


### - [ ] T-032 Deposit Flow UX (Duel)
**의존**
- T-031, T-060(매치 생성 API 최소 stub)

**작업**
- [ ] Duel lobby에서 bet 선택
- [ ] 매치 생성/참가 후 서버가 준 escrow address 표시
- [ ] “Deposit” 버튼 → 지갑 sendTransaction 실행
- [ ] txid 표시 + 서버에 txid 등록

**완료조건**
- 실제 tx 브로드캐스트 후 txid가 UI에 보임(테스트넷 권장)


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


### - [ ] T-041 Reward Payout TX Builder (1-in 2-out, min output)
**의존**
- T-040, T-022

**목표**
- 체크포인트 이벤트가 승인되면 즉시 지급 tx를 생성/서명/브로드캐스트.

**작업**
- [ ] rewardAmount 최소값을 config로 강제(기본 0.02 KAS)
- [ ] tx outputs = [user(reward), change(change)] 고정
- [ ] UTXO 선택(단순: largest-first 또는 oldest-first)
- [ ] 수수료/질량 정책에 맞게 안전하게 구성(필요 시 margin)

**산출물**
- `apps/server/src/tx/rewardPayout.ts` 등

**완료조건**
- 서버 단독 스크립트로 “지급 tx 1개”를 생성/브로드캐스트 성공


### - [ ] T-042 Reward Event State Machine + Idempotency
**의존**
- T-041, T-021

**작업**
- [ ] reward_events에 (sessionId, seq) unique
- [ ] pending → broadcasted(txid) → accepted → included → confirmed
- [ ] 중복 요청/재시도 시 새 tx 생성 금지(기존 txid 상태 반환)

**완료조건**
- 동일 이벤트를 여러 번 보내도 지급은 1회만 발생


### - [ ] T-043 Client-Server Integration (Checkpoint → Payout)
**의존**
- T-012, T-042

**작업**
- [ ] 클라이언트 체크포인트 획득 → `/api/session/event`
- [ ] 서버 응답으로 rewardAmount/txid 수신
- [ ] HUD에 txid 표시 + “Broadcasted” 단계 점등

**완료조건**
- 실제 플레이 중 체크포인트를 먹으면 txid가 즉시 표시됨


---

## 6) P5 — Tx 상태 추적 + Speed-Visualizer SDK

### - [ ] T-050 Tx Status Provider (Server-side)
**의존**
- T-020

**목표**
- txid의 현재 상태(accepted/included/confirmations)를 안정적으로 조회.

**작업**
- [ ] 옵션 A: 인덱싱 API 사용(서버에서만 호출; API Key 클라 노출 금지)
- [ ] 옵션 B: 자체 노드/RPC 사용
- [ ] `/api/tx/:txid/status` 구현
- [ ] 서버 내부 폴링 워커:
    - broadcasted 상태의 tx를 주기적으로 조회
    - 상태 변화 시 WebSocket push

**완료조건**
- txid 1개를 넣으면 단계가 시간에 따라 업데이트됨


### - [ ] T-051 Speed-Visualizer SDK Package Skeleton
**의존**
- T-001

**작업**
- [ ] `packages/speed-visualizer-sdk`에 컴포넌트 설계
- [ ] 빌드/번들링 설정(tsup/vite library mode)
- [ ] 샘플 페이지(Storybook 또는 단순 demo route)

**완료조건**
- client가 SDK를 import해서 렌더링 가능


### - [ ] T-052 TxLifecycleTimeline Component
**의존**
- T-051, T-050

**작업**
- [ ] 입력: txid + status endpoint
- [ ] 출력:
    - 단계(broadcasted/accepted/included/confirmations)
    - 각 단계 timestamp(ms) 및 경과시간
    - explorer 링크 버튼(네트워크별 URL 템플릿)

**완료조건**
- reward txid를 넣으면 실시간으로 단계가 변하는 타임라인이 보임


### - [ ] T-053 KaspaRPMGauge Component
**의존**
- T-051

**작업**
- [ ] 네트워크 펄스 데이터(최근 블록 간격/추정 BPS)를 표시
- [ ] “RPM 게이지” 형태로 시각화
- [ ] 데이터가 없으면 graceful fallback(“no data”)

**완료조건**
- 게임 HUD에 게이지가 렌더링되고 값이 갱신됨


### - [ ] T-054 Integrate SDK into Game HUD
**의존**
- T-052, T-053, T-012

**작업**
- [ ] HUD 우측 패널에 Timeline + RPM 게이지 배치
- [ ] 체크포인트 지급 txid가 Timeline에 자동으로 연결

**완료조건**
- 한 판 플레이 중 tx lifecycle이 “눈으로” 확인됨


---

## 7) P6 — Duel(Fallback 먼저 완성)

### - [ ] T-060 Matchmaking (Create/Join by Code)
**의존**
- T-020, T-021

**작업**
- [ ] `POST /api/match/create` → joinCode 발급
- [ ] `POST /api/match/join` → matchId 반환
- [ ] match 상태 조회 `GET /api/match/:id`

**완료조건**
- A가 방 만들고 B가 코드로 참가 가능


### - [ ] T-061 Duel Gameplay (30s race) + Result
**의존**
- T-060, T-011

**작업**
- [ ] 듀얼 모드에서 동일한 러너 로직을 30초 고정으로 실행
- [ ] 서버 authoritative 타이머/결과 산출(거리 비교)
- [ ] 결과 UI(A win/B win/draw)

**완료조건**
- 두 클라이언트가 같은 matchId로 입장 → 30초 후 결과가 동일


### - [ ] T-062 Duel Deposit Tracking (txid 등록/상태 확인)
**의존**
- T-032, T-050, T-060

**작업**
- [ ] escrow address 발급(우선은 단순 주소로도 가능; covenant는 P7)
- [ ] 각 플레이어 deposit txid 서버 등록
- [ ] deposit이 accepted/included되면 match 상태가 “READY”로 전환

**완료조건**
- 양측 입금이 확인되면 자동으로 레이스 시작 가능


### - [ ] T-063 Settlement (Fallback: Server pays winner)
**의존**
- T-062, T-040, T-041

**작업**
- [ ] 결과 확정 시 서버가 winner에게 payout tx 생성/브로드캐스트
- [ ] match에 settle txid 기록
- [ ] UI에 settle txid + lifecycle 표시

**완료조건**
- 1v1 한 판에서 deposit 2개 + settle 1개가 온체인에서 확인 가능


---

## 8) P7 — Covenant 기반 theft-resistant escrow (가능한 범위까지, 기술점수 파트)

### - [ ] T-070 Feasibility Check: Covenant/KIP-10 Support on Target Network
**의존**
- T-020

**작업**
- [ ] 선택 네트워크(testnet/mainnet)에서 covenant 관련 기능이 실제로 사용 가능한지 확인
- [ ] SDK/노드/RPC에서 필요한 opcode/introspection 지원 여부 확인
- [ ] 불가하면: 범위를 축소하고 “부분 구현 + 로드맵”으로 전환(티켓에 기록)

**완료조건**
- “가능/불가능/부분 가능” 결론과 근거를 문서로 남김
- 불가능일 경우, T-071~T-074는 범위 조정


### - [ ] T-071 Escrow Script Template Design (Oracle settle + Timelock refund)
**의존**
- T-070

**작업**
- [ ] 스크립트 템플릿 정의:
    - Branch A: oracle signature + outputs restricted to {playerA, playerB}
    - Branch B: timelock 이후 player 본인 환불
- [ ] 스크립트 파라미터:
    - playerA address/script
    - playerB address/script
    - oracle pubkey
    - refund delay

**완료조건**
- 템플릿이 코드/문서로 명시되고, 입력/출력 제약이 명확


### - [ ] T-072 Escrow Address Generation (per match, per player)
**의존**
- T-071, T-060

**작업**
- [ ] match 생성 시 escrowA/escrowB 주소 생성
- [ ] client에 escrow 주소 전달
- [ ] DB에 escrow 정보 저장

**완료조건**
- 매치마다 고유한 escrow 주소 2개가 생성


### - [ ] T-073 Settlement TX Builder for Escrow UTXOs
**의존**
- T-072, T-063

**작업**
- [ ] escrow UTXO 2개를 입력으로 사용
- [ ] winner 출력 1개(또는 draw 시 2개 반환)
- [ ] oracle 키로 스크립트 조건을 만족하도록 서명/구성

**완료조건**
- escrow 기반 settle tx가 온체인에 포함되고, 지급이 완료됨


### - [ ] T-074 Negative Tests: Theft-resistant Proof
**의존**
- T-073

**작업**
- [ ] “제3자 주소로 출력”을 시도하는 settle tx를 만들고 실패해야 함
- [ ] “환불 타임락 이전 환불 시도”가 실패해야 함
- [ ] 테스트 로그/스크린샷/설명을 docs에 첨부

**완료조건**
- 자동 테스트 또는 재현 스크립트로 theft 방지 성질을 증명


---

## 9) P8 — Payload Proof-of-Action(가능하면)

### - [ ] T-080 Payload Format + Commit Scheme
**의존**
- T-022

**작업**
- [ ] payload 문자열 포맷 확정:
    - `KASRACE1|net|mode|sessionId|event|seq|commit`
- [ ] commit 생성 규칙:
    - seed는 서버에서 생성/보관
    - commit = H(seed|sessionId|seq|event|timeBucket)

**완료조건**
- payload 생성이 일관되고 문서화됨


### - [ ] T-081 Attach Payload to Reward TX
**의존**
- T-041, T-080

**작업**
- [ ] reward tx 생성 시 payload 삽입(가능한 범위에서)
- [ ] explorer/Proof page에서 payload 확인 가능한지 검증

**완료조건**
- 적어도 1개의 reward tx에 payload가 포함됨


### - [ ] T-082 Proof Page (Parse + Display)
**의존**
- T-081, T-052

**작업**
- [ ] txid 입력/선택 → payload 파싱 결과 표시
- [ ] “이 이벤트가 온체인에 기록됨”을 사람 눈으로 확인 가능하게 UI 구성

**완료조건**
- 데모 중 Proof page로 증거 제시 가능


---

## 10) P9 — 보안/안정화/운영 품질

### - [ ] T-090 Rate Limiting + Abuse Protection
**의존**
- T-020, T-022

**작업**
- [ ] IP 기반 rate limit (session/event)
- [ ] 동일 세션 이벤트 폭주 방지
- [ ] 오류 코드/메시지 표준화

**완료조건**
- 간단한 스팸 요청에 서버가 무너지지 않음


### - [ ] T-091 Observability (Structured logs + Timing)
**의존**
- T-020, T-042, T-050

**작업**
- [ ] 모든 tx에 대해:
    - broadcastedAt, acceptedAt, includedAt 기록
- [ ] requestId/sessionId/matchId correlation
- [ ] 데모 중 문제 발생 시 원인 추적 가능

**완료조건**
- 워크로그 또는 로그 파일로 타임라인 추적 가능


### - [ ] T-092 Security Review Checklist
**의존**
- T-040

**작업**
- [ ] 키/시크릿 커밋 탐지(git-secrets 등)
- [ ] `.env.example` 제공(값은 빈칸)
- [ ] CORS/CSRF 기본 설정 점검(최소한의 보호)
- [ ] 서버 지갑 키 접근권한 최소화(권한 분리 가능하면)

**완료조건**
- 민감정보가 레포에 없고, 기본 공격면이 줄어듦


---

## 11) P10 — 배포/데모 환경

### - [ ] T-100 Deployment: Client (Static Hosting)
**의존**
- T-010

**작업**
- [ ] Vercel/Netlify 중 택1 배포
- [ ] 환경변수(network, server URL) 설정

**완료조건**
- 공개 URL에서 게임이 로드됨


### - [ ] T-101 Deployment: Server (WebSocket 지원)
**의존**
- T-020, T-050

**작업**
- [ ] Render/Fly.io 등 배포
- [ ] 환경변수/시크릿 설정
- [ ] 헬스체크 + 재시작 정책

**완료조건**
- 공개 서버 URL에서 API/WS 동작


---

## 12) P11 — 제출물(README/영상/썸네일/AI 공개)

### - [ ] T-110 English README (Hackathon-grade)
**의존**
- T-043, T-054, T-063

**작업**
- [ ] What/Why/How(아키텍처)
- [ ] Quickstart(로컬 실행)
- [ ] Demo instructions
- [ ] SDK usage
- [ ] AI usage disclosure 섹션 링크
- [ ] License 확인

**완료조건**
- 처음 보는 사람이 로컬에서 재현 가능


### - [ ] T-111 Demo Video Script + Capture Checklist
**의존**
- T-110

**작업**
- [ ] 2~3분 원테이크 시나리오
    - Free Run: checkpoint → txid → lifecycle
    - Duel: deposit 2개 + settle 1개
    - Proof page(가능하면)
- [ ] 화면 구성(좌: 게임, 우: timeline + explorer)
- [ ] 영문 자막 파일(srt) 준비(선택)

**완료조건**
- 촬영만 하면 제출 가능한 상태


### - [ ] T-112 Thumbnail Screenshot (Required)
**의존**
- T-054

**작업**
- [ ] 대표 화면 캡처(게임 + timeline 패널)
- [ ] 1장 이상 준비

**완료조건**
- 제출 규정 충족


### - [ ] T-113 AI_USAGE.md (Disclosure)
**의존**
- T-003

**작업**
- [ ] AI 사용 도구/범위/산출물 표로 명시
- [ ] “핵심 로직을 AI가 전부 작성”한 경우를 피하도록 명확히 기록

**완료조건**
- 레포에 AI_USAGE.md 존재


---

## 13) P12 — 폴리시(선택, 시간 남으면)

### - [ ] T-120 UX Polish: Onboarding + Error States
**의존**
- T-031, T-043, T-063

**작업**
- [ ] 지갑 미설치/거부/네트워크 불일치 안내
- [ ] tx 실패/지연 시 사용자 안내(“network busy” 등)
- [ ] 로딩/재시도 UX

**완료조건**
- 데모 중 “깨지는 화면”이 최소화됨


### - [ ] T-121 Community-ready Web Page (Landing + Play Now)
**의존**
- T-100

**작업**
- [ ] 랜딩 페이지(한 줄 설명 + Play + GitHub)
- [ ] 공유 버튼(트위터/디스코드 링크)

**완료조건**
- 커뮤니티 투표 유도 가능한 형태
