# Live Market — SLO & Load Test Plan

## 1. Service Level Objectives (SLO)

### 1.1 Latency Targets

| Operation | P50 Target | P95 Target | P99 Target |
|---|---|---|---|
| Place bet (API response) | < 50ms | < 150ms | < 300ms |
| Cancel bet (API response) | < 50ms | < 150ms | < 300ms |
| Odds tick (WS delivery) | < 100ms | < 300ms | < 500ms |
| Market lock event (WS) | < 100ms | < 200ms | < 400ms |
| Settlement result (WS) | < 200ms | < 500ms | < 1000ms |
| Telemetry ingestion | < 20ms | < 50ms | < 100ms |

### 1.2 Throughput Targets

| Metric | Target |
|---|---|
| Concurrent WS connections (per market) | 100 |
| Bet orders per second (per market) | 50 |
| Odds ticks per second (per market) | 3–5 |
| Markets active simultaneously | 10 |

### 1.3 Reliability Targets

| Metric | Target |
|---|---|
| WS message delivery rate | > 99.5% |
| Bet acceptance rate (valid requests) | > 99.9% |
| Settlement accuracy | 100% (no incorrect payouts) |
| Reconnection recovery time | < 3s |
| Data consistency (WS vs API poll) | 100% after reconciliation |

### 1.4 Error Budget

| Window | Allowed downtime |
|---|---|
| Per race (30s) | 0 (fail-closed: cancel market if degraded) |
| Per hour | < 30s cumulative |
| Per day | < 5min cumulative |

---

## 2. Load Test Scenarios

### 2.1 Scenario A — Single Market, Moderate Load

| Parameter | Value |
|---|---|
| Concurrent viewers (WS subscribers) | 50 |
| Active bettors | 20 |
| Bet rate | 2 bets/sec total |
| Cancel rate | 0.5 cancels/sec |
| Telemetry rate | 5 updates/sec (both players) |
| Duration | 30s (one race) |
| Expected odds ticks | ~10-15 (filtered by threshold) |

**Pass criteria:**
- All bets receive response within P95 target
- All WS subscribers receive all odds ticks
- Settlement completes within 2s of race end

### 2.2 Scenario B — Single Market, Peak Load

| Parameter | Value |
|---|---|
| Concurrent viewers | 200 |
| Active bettors | 50 |
| Bet rate | 10 bets/sec total |
| Cancel rate | 2 cancels/sec |
| Telemetry rate | 10 updates/sec |
| Duration | 30s |

**Pass criteria:**
- Rate limiter correctly blocks excess requests (429 response)
- No bet duplication (idempotency enforced)
- WS delivery rate > 99%
- No settlement inconsistency

### 2.3 Scenario C — Multi-Market Concurrent

| Parameter | Value |
|---|---|
| Active markets | 5 simultaneous |
| Viewers per market | 30 |
| Bettors per market | 10 |
| Bet rate per market | 2/sec |
| Duration | 30s each, staggered start |

**Pass criteria:**
- Cross-market isolation (events don't leak between markets)
- DB query latency stays within target despite higher load
- Worker poll interval maintained

---

## 3. Bottleneck Analysis & Tuning

### 3.1 Known Bottlenecks

| Bottleneck | Component | Mitigation |
|---|---|---|
| DB writes on bet placement | Postgres INSERT | Batch inserts if > 20 bets/sec; connection pooling |
| WS fanout on odds tick | Socket.IO broadcast | Room-based routing (already implemented); consider Redis adapter for multi-process |
| Odds computation frequency | oddsTickWorker | Threshold filtering reduces unnecessary ticks; 300ms minimum interval |
| Pool balance calculation | SUM query on bet_orders | Cache in `race_markets.total_pool_wei` (already implemented) |
| Rate limiter memory | In-memory Map | Periodic cleanup via `cleanupRateWindows()` |

### 3.2 Index Coverage

| Query Pattern | Index | Status |
|---|---|---|
| Active bets by market | `bet_orders_market_status_idx` | Covered |
| User bets per market | `bet_orders_user_market_idx` | Covered |
| Idempotency lookup | `bet_orders_idempotency_idx` (unique) | Covered |
| Latest odds tick | `odds_ticks_market_latest_idx` | Covered |
| Market by match | `race_markets_match_idx` (unique) | Covered |
| Open markets for worker | `race_markets_state_idx` | Covered |

### 3.3 Tuning Parameters

| Parameter | Default | Tuning Range | Env Var |
|---|---|---|---|
| Odds tick interval | 300ms | 100–500ms | `ODDS_TICK_INTERVAL_MS` |
| Odds change threshold | 200 bps (2%) | 100–500 bps | `ODDS_CHANGE_THRESHOLD_BPS` |
| Lock before end | 3000ms | 1000–5000ms | `ODDS_LOCK_BEFORE_END_MS` |
| Rate limit per sec | 5 | 3–10 | `MARKET_RATE_LIMIT_PER_SEC` |
| Circuit breaker threshold | 3000 bps (30%) | 2000–5000 bps | `MARKET_CIRCUIT_BREAKER_BPS` |
| Max bet | 1 KAS | 0.1–10 KAS | `MAX_BET_WEI` |
| Max exposure | 5 KAS | 1–50 KAS | `MAX_EXPOSURE_WEI` |
| Max pool | 50 KAS | 10–500 KAS | `MAX_POOL_WEI` |

---

## 4. Monitoring & Alerts

### 4.1 Metrics to Track

| Metric | Source | Alert Threshold |
|---|---|---|
| Bet API P95 latency | metricsService | > 200ms for 1min |
| WS delivery latency P95 | client latency records | > 500ms for 1min |
| Active WS connections | Socket.IO stats | > 500 total |
| Bet rate (per market) | audit log count | > 30/sec sustained |
| Circuit breaker trips | audit log | Any occurrence |
| Settlement failure | marketSettlementService | Any occurrence |
| DB connection pool usage | pg pool stats | > 80% |

### 4.2 Alert Escalation

| Severity | Condition | Action |
|---|---|---|
| Warning | P95 latency > 200ms | Log, monitor |
| Critical | P95 latency > 500ms | Auto-lock new markets, page on-call |
| Emergency | Settlement failure | Halt all markets, manual review |

---

## 5. Test Execution

### 5.1 Prerequisites

- Local Postgres running with market tables migrated
- Server running with `pnpm dev`
- Test script at `apps/server/scripts/market-load-test.ts`

### 5.2 Run

```bash
# Run odds engine + risk service unit tests first
pnpm --filter @kas-racing/server test -- src/services/oddsEngineService.test.ts
pnpm --filter @kas-racing/server test -- src/services/marketRiskService.test.ts

# Full server test suite
pnpm --filter @kas-racing/server test
```

### 5.3 Results Template

| Scenario | Status | P50 | P95 | P99 | Notes |
|---|---|---|---|---|---|
| A (moderate) | | | | | |
| B (peak) | | | | | |
| C (multi-market) | | | | | |

> Fill in after running load tests against staging environment.
