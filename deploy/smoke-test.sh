#!/usr/bin/env bash
set -euo pipefail

RAILWAY_URL="${RAILWAY_URL:-${1:-}}"
VERCEL_URL="${VERCEL_URL:-${2:-}}"

if [[ -z "${RAILWAY_URL}" || -z "${VERCEL_URL}" ]]; then
  echo "Usage: bash deploy/smoke-test.sh <RAILWAY_URL> <VERCEL_URL>"
  echo "Example: bash deploy/smoke-test.sh https://api.up.railway.app https://kas-racing.vercel.app"
  exit 1
fi

trim_trailing_slash() {
  local url="$1"
  echo "${url%/}"
}

RAILWAY_URL="$(trim_trailing_slash "${RAILWAY_URL}")"
VERCEL_URL="$(trim_trailing_slash "${VERCEL_URL}")"

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1"
  exit 1
}

echo "[1/4] Railway health check"
health_code="$(curl -sS -o /tmp/kas_racing_health.json -w "%{http_code}" "${RAILWAY_URL}/api/health" || true)"
if [[ "${health_code}" != "200" ]]; then
  fail "GET /api/health returned ${health_code}"
fi
if ! rg -q '"ok"\s*:\s*true' /tmp/kas_racing_health.json; then
  fail "Health response does not contain ok:true"
fi
pass "Railway health endpoint"

echo "[2/4] Session API smoke test"
session_resp="$(curl -sS "${RAILWAY_URL}/api/session/start" \
  -X POST \
  -H 'content-type: application/json' \
  -d '{"userAddress":"kaspatest:qp8r5l8x4l2q8k4v9pw0testsmokeaddress000","mode":"free_run"}' || true)"
if ! echo "${session_resp}" | rg -q '"sessionId"\s*:'; then
  echo "Response: ${session_resp}"
  fail "POST /api/session/start did not return sessionId"
fi
pass "Session start endpoint"

echo "[3/4] CORS check from Vercel origin"
cors_headers="$(curl -sSI -H "Origin: ${VERCEL_URL}" "${RAILWAY_URL}/api/health" | tr -d '\r')"
if ! echo "${cors_headers}" | rg -qi '^access-control-allow-origin:'; then
  echo "${cors_headers}"
  fail "Missing access-control-allow-origin header"
fi
pass "CORS header present"

echo "[4/4] Vercel reachability"
vercel_code="$(curl -sS -o /tmp/kas_racing_vercel.html -w "%{http_code}" "${VERCEL_URL}" || true)"
if [[ "${vercel_code}" != "200" ]]; then
  fail "Vercel root returned ${vercel_code}"
fi
pass "Vercel root page"

echo
echo "All smoke checks passed."
echo "Railway: ${RAILWAY_URL}"
echo "Vercel:  ${VERCEL_URL}"

