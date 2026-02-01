# KAS Racing (KAS Racing / Speed-Visualizer SDK) — PROJECT.md

## 1) 프로젝트 한 줄 요약
KAS Racing은 **웹 기반 초고속 러너/레이싱 게임**이며, 플레이 중 발생하는 특정 액션(체크포인트 획득, 결승 통과 등)을 **실제 Kaspa 온체인 트랜잭션(지급/정산)과 동기화**하여 “블록체인이 느리다”는 편견을 **UX로 증명**하는 데모 제품이다.

또한 게임 HUD로 쓰이는 “트랜잭션 생명주기 시각화(accepted → included → confirmations)”를 **Speed-Visualizer SDK**로 분리해, 게임 외 애플리케이션에서도 재사용 가능한 컴포넌트로 제공한다.

---

## 2) 목적(해커톤/제품 관점)

### 2.1 해커톤(단기) 목적
- **Kaspa 통합이 “진짜”인 데모**: 서명/브로드캐스트/온체인 상태변화를 실제로 보여준다(※ Mock 금지).
- “빠르다”를 말로 주장하지 않고, **HUD 타임라인(ms 단위)과 Explorer 링크로 실측 증거**를 보여준다.
- 제출 요건 충족:
    - 공개 GitHub + OSI 라이선스
    - 영문 README/설치법/데모 영상(영문 또는 영문 자막)
    - AI 사용 공개(어디에/어떻게 사용했는지)

### 2.2 제품(중기) 목적
- Kaspa 기반 “실시간 결제/정산 UX” 레퍼런스 구현.
- Speed-Visualizer SDK + Reward Stream 모듈을 **B2B(다른 앱/게임/대시보드)**에 납품 가능한 형태로 분리.

---

## 3) 핵심 원칙(중요: 과장 금지, UX로 증명)

### 3.1 “1초 미만 finality” 같은 문구 금지
- 마케팅 문구는 아래로 통일:
    - “(체감) sub-second~1-2초 내 accepted/네트워크 반응”
    - “included/confirmations는 네트워크 상태에 따라 변동”
- 실제 UX는 HUD에서 “브로드캐스트 → accepted → included → confirmations” 단계가 흐르는 것을 보여주는 방식으로 증명.

### 3.2 온체인 스팸 금지(이벤트 기반 트리거)
- “코인 1개마다 tx” 금지.
- 체크포인트(큰 이벤트) 기반으로 tx 빈도를 제한:
    - 세션당 reward tx 최대 N회(기본 10회)
    - 쿨다운(기본 2초)
    - 출력 최소 금액(min output) 준수(기본 0.02 KAS 이상; 네트워크 정책/수수료 정책에 맞춰 설정)

### 3.3 베팅/정산은 “완전 자동” 과장 금지
- MVP는 **오라클(서버) 판정**을 사용하되,
- “서버가 돈을 훔칠 수 없게(theft-resistant)” 만드는 스크립트/에스크로를 목표로 한다.
- 단, 네트워크 기능 지원 여부(KIP-10/14 등)에 따라:
    - 1) **Fallback(서버 보관 후 지급)** 듀얼을 먼저 완성해서 데모를 확보
    - 2) 가능하면 **Covenant 기반 theft-resistant escrow**를 추가하여 기술점수/신뢰 확보

---

## 4) 사용자 경험(UX) 설계

### 4.1 모드 구성
1) **Free Run (A2E Reward Stream) — 필수**
- 웹에서 즉시 플레이.
- 체크포인트 캡슐 획득 시 서버가 즉시 지급 트랜잭션을 생성/서명/브로드캐스트.
- HUD에 즉시 TXID 표시 + 생명주기 상태가 실시간 업데이트.

2) **Ghost-Wheel Duel (1v1 베팅) — 필수**
- 방 만들기/코드 공유로 간단한 매칭.
- 양쪽 입금(deposit) tx는 유저 지갑이 직접 서명/브로드캐스트.
- 경기 종료 시 정산(settle) tx 브로드캐스트.
- 가능하면 covenant/에스크로로 “제3자 주소로는 못 나감”을 테스트로 증명.

3) **Speed-Visualizer SDK — 필수**
- HUD 컴포넌트를 패키지로 분리:
    - TxLifecycleTimeline
    - KaspaRPMGauge
    - NetworkPulsePanel(선택)

### 4.2 “지갑 푸시 알림” 의존 금지
- 모바일 지갑 푸시는 통제 불가(지갑/OS/인덱서 종속).
- 데모의 핵심 증거는 **우리 UI의 상태 타임라인 + Explorer 링크**.

---

## 5) 게임 디자인(구현 난이도 낮고 데모 안정성 높은 방향)

### 5.1 장르/엔진(권장)
- 장르: 3레인 초고속 무한 러너(사이버펑크 스킨)
- 엔진: **Phaser.js**(웹 배포/로딩/데모 안정성 우수)
- (옵션) Unity WebGL은 로딩/호환 리스크가 있어 해커톤 MVP에 비추천

### 5.2 조작
- 데스크톱: ←/→ 레인 변경, Space 대시, Esc 일시정지
- 모바일: 좌/우 스와이프 레인 변경, 탭 대시

### 5.3 온체인 트리거(체크포인트)
- 체크포인트 캡슐: 2~3초에 1개 체감 빈도(정확 빈도는 난이도에 따라 가변)
- tx 정책:
    - rewardCooldownMs = 2000
    - rewardMaxPerSession = 10
    - rewardAmounts = [0.02, 0.05, 0.1] KAS (프리셋)

---

## 6) 온체인/결제 설계

### 6.1 트랜잭션 타입
- Reward Payout TX (서버 → 유저)
    - 입력: treasury UTXO
    - 출력: userAddress(rewardAmount) + treasuryChange(change)
    - 출력 수는 기본 2개로 고정(질량/수수료/정책 리스크 감소)

- Deposit TX (유저 → 에스크로 주소)
    - 유저 지갑에서 직접 서명/브로드캐스트

- Settlement TX (에스크로 → 승자)
    - 입력: escrow UTXO 2개(양측 deposit)
    - 출력: winnerAddress(총합-수수료)
    - 무승부면 2출력(각자 반환)

### 6.2 Proof-of-Action(옵션이지만 점수용 강력)
- 트랜잭션 payload(가능하면)로 이벤트 커밋을 넣어,
    - “게임 이벤트가 온체인에 기록됨”을 증명하는 페이지(Proof Page) 제공
- payload 내용은 개인정보/치팅 유도 정보 최소화:
    - `KASRACE1|net|mode|sessionId|event|seq|commit`

---

## 7) Ghost-Wheel Duel(에스크로) 설계

### 7.1 Threat Model(정직한 정의)
- 방지 목표: 서버(오라클)가 상금을 **자기 주소/제3자 주소로 빼돌리는 행위**
- MVP에서 완벽히 못 막는 것: 서버가 **승패 판정 조작**(공정성 문제)
    - 대신 로그/리플레이/commit scheme으로 “검증 가능성”을 제시

### 7.2 아키텍처(권장)
- 매치마다 에스크로 주소 2개(각 플레이어 deposit용) 생성
- 스크립트는:
    - 오라클 정산 분기(oracle 서명 + 출력 주소 제한)
    - 타임락 이후 환불 분기(각 플레이어 원금 회수)

### 7.3 Fallback 정책(필수)
- covenant 구현이 네트워크/SDK/시간상 막히면:
    - 서버가 deposit을 직접 받는 방식(서버 보관)으로 듀얼을 완성(데모 확보)
    - 단, 문서/발표에 “fallback”임을 명시하고 covenant 버전은 로드맵/부분 구현으로 분리

---

## 8) 시스템 아키텍처(권장안)

### 8.1 구성
- Client (Web)
    - Phaser 게임
    - Wallet Connect UI (우선: 브라우저 확장 지갑)
    - HUD(=Speed-Visualizer SDK 컴포넌트 포함)

- Server (Backend)
    - Node.js (Express 또는 Nest)
    - WebSocket (tx 상태/타임라인 push)
    - DB (Postgres 권장, 해커톤 MVP는 SQLite도 가능)
    - Worker(옵션): tx 브로드캐스트/상태 추적

- Kaspa Integration
    - 서버: treasury/oracle 키로 tx 생성/서명/브로드캐스트
    - tx 상태 추적:
        - (권장) 서버가 인덱싱 API 또는 노드 RPC 사용
        - API Key가 필요한 서비스는 **클라이언트 노출 금지**

### 8.2 저장소 구조(강제)
- monorepo
    - `apps/client` : Phaser 게임
    - `apps/server` : API + WS + tx 엔진
    - `packages/speed-visualizer-sdk` : 재사용 컴포넌트
    - `docs/` : 아키텍처 다이어그램, 데모 시나리오, 운영 문서
    - `.github/` : CI, 린트, 테스트

---

## 9) 보안/운영 원칙

### 9.1 비밀키 관리
- treasury/oracle 키는 서버에만 존재
- `.env`는 커밋 금지
- 로그에 키/시드/민감정보 출력 금지

### 9.2 중복 지급 방지(필수)
- `(sessionId, seq)` unique
- reward 이벤트를 “pending → txid 기록 → 상태 업데이트”로 엄격히 상태 머신 관리
- 재시도는 tx 재생성이 아니라 “상태 재조회/브로드캐스트 재시도” 위주

### 9.3 관측성(데모 안정성)
- 모든 event/tx에 timestamp(ms) 기록
- HUD에는 “내 tx가 어디서 멈췄는지”가 보이게

---

## 10) 품질 기준(Definition of Done)

### 10.1 Free Run DoD
- 체크포인트 획득 → 서버가 실제 지급 tx 생성/브로드캐스트
- 클라이언트 HUD에서 TXID 즉시 표시
- accepted/included/confirmations가 실시간 업데이트
- Claim/Withdraw 버튼 없음

### 10.2 Duel DoD
- 유저가 deposit tx를 지갑에서 서명/브로드캐스트
- 경기 종료 시 정산 tx가 브로드캐스트되고 결과가 HUD/매치 페이지에 표시
- (가능하면) covenant 기반 theft-resistant escrow 테스트 통과

### 10.3 SDK DoD
- `packages/speed-visualizer-sdk`를 다른 앱에서 import하여 동작
- SDK 문서(영문) 제공

### 10.4 해커톤 제출물 DoD
- 공개 GitHub + OSI license
- 영문 README(설치/실행/데모)
- 영문(또는 영문자막) 데모 영상
- AI 사용 공개 문서

---

## 11) 로드맵(요약)
- P0: Repo/CI/환경 구축
- P1: Free Run + Reward Stream 완성
- P2: Tx 상태 추적 + Speed-Visualizer SDK 완성
- P3: Duel fallback 완성(서버 보관 정산)
- P4: Covenant escrow + payload proof 적용(가능한 범위까지)
- P5: 제출물(README/영상/썸네일/AI disclosure) 완성
