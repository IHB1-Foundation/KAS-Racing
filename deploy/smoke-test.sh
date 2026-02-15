#!/usr/bin/env bash
set -euo pipefail

RAILWAY_URL="${RAILWAY_URL:-${1:-}}"
VERCEL_URL="${VERCEL_URL:-${2:-}}"

if [[ -z "${RAILWAY_URL}" || -z "${VERCEL_URL}" ]]; then
  echo "Usage: bash deploy/smoke-test.sh <RAILWAY_API_URL> <VERCEL_URL>"
  echo "Example: bash deploy/smoke-test.sh https://api.up.railway.app https://kas-racing.vercel.app"
  exit 1
fi

trim_trailing_slash() {
  local url="$1"
  echo "${url%/}"
}

RAILWAY_URL="$(trim_trailing_slash "${RAILWAY_URL}")"
VERCEL_URL="$(trim_trailing_slash "${VERCEL_URL}")"

TOTAL=0
PASSED=0

pass() {
  echo "PASS: $1"
  PASSED=$((PASSED + 1))
  TOTAL=$((TOTAL + 1))
}

fail() {
  echo "FAIL: $1"
  TOTAL=$((TOTAL + 1))
}

fail_exit() {
  echo "FAIL: $1"
  exit 1
}

# --- 1) Railway API health ---
echo "[1/5] Railway API health check"
health_code="$(curl -sS -o /tmp/kas_racing_health.json -w "%{http_code}" "${RAILWAY_URL}/api/health" || true)"
if [[ "${health_code}" != "200" ]]; then
  fail_exit "GET /api/health returned ${health_code}"
fi
if ! grep -q '"ok"' /tmp/kas_racing_health.json; then
  fail_exit "Health response does not contain ok field"
fi
pass "Railway API health endpoint"

# --- 2) V3 Session API smoke ---
echo "[2/5] V3 Session API smoke test"
session_resp="$(curl -sS "${RAILWAY_URL}/api/v3/session/start" \
  -X POST \
  -H 'content-type: application/json' \
  -d '{"userAddress":"0x0000000000000000000000000000000000000001","mode":"free_run"}' || true)"
if ! echo "${session_resp}" | grep -q '"sessionId"'; then
  echo "Response: ${session_resp}"
  fail "POST /api/v3/session/start did not return sessionId"
else
  pass "V3 Session start endpoint"
fi

# --- 3) CORS check ---
echo "[3/5] CORS check from Vercel origin"
cors_headers="$(curl -sSI -H "Origin: ${VERCEL_URL}" "${RAILWAY_URL}/api/health" | tr -d '\r')"
if ! echo "${cors_headers}" | grep -qi '^access-control-allow-origin:'; then
  echo "${cors_headers}"
  fail "Missing access-control-allow-origin header"
else
  pass "CORS header present"
fi

# --- 4) Vercel FE reachability ---
echo "[4/5] Vercel reachability"
vercel_code="$(curl -sS -o /tmp/kas_racing_vercel.html -w "%{http_code}" "${VERCEL_URL}" || true)"
if [[ "${vercel_code}" != "200" ]]; then
  fail "Vercel root returned ${vercel_code}"
else
  pass "Vercel root page"
fi

# --- 5) V3 Match API smoke ---
echo "[5/5] V3 Match API smoke test"
match_resp="$(curl -sS "${RAILWAY_URL}/api/v3/match/create" \
  -X POST \
  -H 'content-type: application/json' \
  -d '{"playerAddress":"0x0000000000000000000000000000000000000001","betAmountWei":"100000000000000000"}' || true)"
if ! echo "${match_resp}" | grep -q '"id"'; then
  echo "Response: ${match_resp}"
  fail "POST /api/v3/match/create did not return match id"
else
  pass "V3 Match create endpoint"
fi

echo ""
echo "========================================="
echo "Results: ${PASSED}/${TOTAL} passed"
echo "========================================="
echo "Railway API: ${RAILWAY_URL}"
echo "Vercel:      ${VERCEL_URL}"

if [[ "${PASSED}" -lt "${TOTAL}" ]]; then
  echo ""
  echo "Some checks FAILED. Review output above."
  exit 1
fi

echo ""
echo "All smoke checks passed."
