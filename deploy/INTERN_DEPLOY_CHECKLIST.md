# Intern Deploy Checklist (Testnet)

## 1) 사전 준비

- [ ] `deploy/railway.env.template` 값 준비
- [ ] `deploy/vercel.env.template` 값 준비
- [ ] 테스트넷 KAS를 `TREASURY_CHANGE_ADDRESS`로 송금
- [ ] Railway 프로젝트 생성 + 이 레포 연결
- [ ] Vercel 프로젝트 생성 + 이 레포 연결

## 2) Railway (Server)

- [ ] Railway Service가 `railway.json` + `apps/server/Dockerfile`로 빌드되는지 확인
- [ ] Railway Postgres를 프로젝트에 추가/연결
- [ ] `DATABASE_URL=${{Postgres.DATABASE_URL}}` 형식으로 연결했는지 확인 (서비스명 다르면 `Postgres` 교체)
- [ ] `deploy/railway.env.template`의 변수를 Railway Variables에 입력
- [ ] 배포 후 `https://<railway-domain>/api/health`가 `200`인지 확인

## 3) Vercel (Client)

- [ ] `deploy/vercel.env.template`의 변수를 Vercel Variables에 입력
- [ ] 프로덕션 배포 수행
- [ ] Vercel 도메인을 Railway의 `CORS_ORIGIN`에 반영했는지 재확인

## 4) 통합 확인

- [ ] 브라우저에서 FE 접속 가능
- [ ] 지갑 연결 가능 (testnet)
- [ ] Free Run 시작 후 checkpoint에서 서버 호출 성공
- [ ] `/proof` 페이지에서 txid 조회 가능

## 5) 자동 스모크 테스트

배포가 끝나면 아래 실행:

```bash
bash deploy/smoke-test.sh \
  https://<railway-domain> \
  https://<vercel-domain>
```

모든 항목이 `PASS`여야 완료로 간주.

## 6) 핸드오버 보고 템플릿

아래 형식으로 보고:

```text
[KAS Racing Deploy Report]
- Railway URL: https://...
- Vercel URL: https://...
- Health Check: PASS/FAIL
- Session API Smoke: PASS/FAIL
- CORS Check: PASS/FAIL
- FE Reachability: PASS/FAIL
- Free Run Manual Test: PASS/FAIL
- Proof Page Manual Test: PASS/FAIL
```
