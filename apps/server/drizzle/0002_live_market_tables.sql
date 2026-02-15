-- T-401: Live Market Schema
-- Tables: race_markets, odds_ticks, bet_orders, bet_cancels, market_settlements

CREATE TABLE IF NOT EXISTS "race_markets" (
  "id" text PRIMARY KEY NOT NULL,
  "match_id" text NOT NULL REFERENCES "matches_v3"("id"),
  "state" text DEFAULT 'open' NOT NULL,
  "player1_address" text NOT NULL,
  "player2_address" text NOT NULL,
  "total_pool_wei" text DEFAULT '0' NOT NULL,
  "odds_ticks" integer DEFAULT 0 NOT NULL,
  "lock_before_end_ms" integer DEFAULT 3000 NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "locked_at" timestamp with time zone,
  "settled_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "race_markets_match_idx" ON "race_markets" ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "race_markets_state_idx" ON "race_markets" ("state");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "odds_ticks" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "market_id" text NOT NULL REFERENCES "race_markets"("id"),
  "seq" integer NOT NULL,
  "prob_a_bps" integer NOT NULL,
  "prob_b_bps" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "odds_ticks_market_seq_idx" ON "odds_ticks" ("market_id", "seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "odds_ticks_market_latest_idx" ON "odds_ticks" ("market_id", "created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bet_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "market_id" text NOT NULL REFERENCES "race_markets"("id"),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "side" text NOT NULL,
  "stake_wei" text NOT NULL,
  "odds_at_placement_bps" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "payout_wei" text,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "settled_at" timestamp with time zone
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "bet_orders_idempotency_idx" ON "bet_orders" ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bet_orders_market_status_idx" ON "bet_orders" ("market_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bet_orders_user_market_idx" ON "bet_orders" ("user_id", "market_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bet_cancels" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "order_id" text NOT NULL REFERENCES "bet_orders"("id"),
  "reason" text DEFAULT 'user_requested' NOT NULL,
  "cancelled_at" timestamp with time zone NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "bet_cancels_order_idx" ON "bet_cancels" ("order_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "market_settlements" (
  "id" text PRIMARY KEY NOT NULL,
  "market_id" text NOT NULL REFERENCES "race_markets"("id"),
  "winner_side" text NOT NULL,
  "total_pool_wei" text NOT NULL,
  "total_payout_wei" text NOT NULL,
  "platform_fee_wei" text DEFAULT '0' NOT NULL,
  "tx_hash" text,
  "tx_status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "mined_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "market_settlements_market_idx" ON "market_settlements" ("market_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_settlements_tx_status_idx" ON "market_settlements" ("tx_status");
