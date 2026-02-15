import { pgTable, text, integer, bigint, doublePrecision, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

// ── Users ──

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  address: text('address').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

// ── Sessions ──

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  userAddress: text('user_address').notNull(),
  mode: text('mode', { enum: ['free_run', 'duel'] }).notNull(),
  status: text('status', { enum: ['active', 'ended'] }).notNull().default('active'),
  rewardCooldownMs: integer('reward_cooldown_ms').notNull().default(2000),
  rewardMaxPerSession: integer('reward_max_per_session').notNull().default(10),
  eventCount: integer('event_count').notNull().default(0),
  lastEventAt: timestamp('last_event_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
});

// ── Idempotency Keys (v2: prevents duplicate TX submissions) ──

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  txid: text('txid'),
  result: text('result'), // JSON stringified result
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
});

// ── EVM Chain Events (v3: indexed from KASPLEX zkEVM contracts) ──

export const chainEventsEvm = pgTable('chain_events_evm', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  txHash: text('tx_hash').notNull(),
  logIndex: integer('log_index').notNull(),
  contract: text('contract').notNull(),
  eventName: text('event_name').notNull(),
  args: text('args').notNull().default('{}'), // JSON stringified
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
  txLogIdx: uniqueIndex('chain_events_evm_tx_log_idx').on(table.txHash, table.logIndex),
  contractEventIdx: index('chain_events_evm_contract_event_idx').on(table.contract, table.eventName),
  blockIdx: index('chain_events_evm_block_idx').on(table.blockNumber),
}));

// ── Matches v3 (EVM: contract-backed matches) ──

export const matchesV3 = pgTable('matches_v3', {
  id: text('id').primaryKey(), // internal UUID
  joinCode: text('join_code').unique(), // lobby join code
  matchIdOnchain: text('match_id_onchain').unique(), // bytes32 from contract (null until on-chain)
  player1Address: text('player1_address').notNull(),
  player2Address: text('player2_address'), // nullable: unknown until player2 joins
  depositAmountWei: text('deposit_amount_wei').notNull(), // stored as string for precision
  timeoutBlock: bigint('timeout_block', { mode: 'bigint' }), // nullable: set when on-chain match created
  state: text('state', {
    enum: ['lobby', 'created', 'funded', 'settled', 'refunded', 'cancelled']
  }).notNull().default('lobby'),
  player1Deposited: integer('player1_deposited').notNull().default(0), // 0/1 boolean
  player2Deposited: integer('player2_deposited').notNull().default(0),
  winnerAddress: text('winner_address'),
  settleTxHash: text('settle_tx_hash'),
  createTxHash: text('create_tx_hash'), // tx hash of createMatch call
  player1Score: integer('player1_score'),
  player2Score: integer('player2_score'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  fundedAt: timestamp('funded_at', { withTimezone: true, mode: 'date' }),
  settledAt: timestamp('settled_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  stateIdx: index('matches_v3_state_idx').on(table.state),
  player1Idx: index('matches_v3_player1_idx').on(table.player1Address),
  player2Idx: index('matches_v3_player2_idx').on(table.player2Address),
}));

// ── Deposits v3 (EVM: individual deposit tracking) ──

export const depositsV3 = pgTable('deposits_v3', {
  id: text('id').primaryKey(),
  matchIdOnchain: text('match_id_onchain').notNull(),
  playerAddress: text('player_address').notNull(),
  amountWei: text('amount_wei').notNull(),
  txHash: text('tx_hash'),
  txStatus: text('tx_status', {
    enum: ['pending', 'submitted', 'mined', 'confirmed', 'failed']
  }).notNull().default('pending'),
  blockNumber: bigint('block_number', { mode: 'bigint' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  minedAt: timestamp('mined_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  matchPlayerIdx: uniqueIndex('deposits_v3_match_player_idx').on(table.matchIdOnchain, table.playerAddress),
  txStatusIdx: index('deposits_v3_tx_status_idx').on(table.txStatus),
}));

// ── Settlements v3 (EVM: settlement tracking) ──

export const settlementsV3 = pgTable('settlements_v3', {
  id: text('id').primaryKey(),
  matchIdOnchain: text('match_id_onchain').notNull().unique(),
  settlementType: text('settlement_type', {
    enum: ['winner', 'draw', 'refund']
  }).notNull(),
  winnerAddress: text('winner_address'),
  payoutWei: text('payout_wei').notNull(),
  txHash: text('tx_hash'),
  txStatus: text('tx_status', {
    enum: ['pending', 'submitted', 'mined', 'confirmed', 'failed']
  }).notNull().default('pending'),
  blockNumber: bigint('block_number', { mode: 'bigint' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  minedAt: timestamp('mined_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  txStatusIdx: index('settlements_v3_tx_status_idx').on(table.txStatus),
}));

// ── Reward Events v3 (EVM: contract-backed reward payouts) ──

export const rewardEventsV3 = pgTable('reward_events_v3', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  seq: integer('seq').notNull(),
  recipientAddress: text('recipient_address').notNull(),
  amountWei: text('amount_wei').notNull(),
  proofHash: text('proof_hash'),
  txHash: text('tx_hash'),
  txStatus: text('tx_status', {
    enum: ['pending', 'submitted', 'mined', 'confirmed', 'failed']
  }).notNull().default('pending'),
  blockNumber: bigint('block_number', { mode: 'bigint' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  minedAt: timestamp('mined_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  sessionSeqIdx: uniqueIndex('reward_events_v3_session_seq_idx').on(table.sessionId, table.seq),
  txStatusIdx: index('reward_events_v3_tx_status_idx').on(table.txStatus),
}));

// ── Race Markets (v3: live betting market per race) ──

export const raceMarkets = pgTable('race_markets', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id').notNull().references(() => matchesV3.id),
  state: text('state', {
    enum: ['open', 'locked', 'settled', 'cancelled'],
  }).notNull().default('open'),
  player1Address: text('player1_address').notNull(),
  player2Address: text('player2_address').notNull(),
  totalPoolWei: text('total_pool_wei').notNull().default('0'), // sum of all active bets
  oddsTicks: integer('odds_ticks').notNull().default(0), // tick counter
  lockBeforeEndMs: integer('lock_before_end_ms').notNull().default(3000),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }),
  settledAt: timestamp('settled_at', { withTimezone: true, mode: 'date' }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  matchIdx: uniqueIndex('race_markets_match_idx').on(table.matchId),
  stateIdx: index('race_markets_state_idx').on(table.state),
}));

// ── Odds Ticks (v3: historical odds snapshots) ──

export const oddsTicks = pgTable('odds_ticks', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  marketId: text('market_id').notNull().references(() => raceMarkets.id),
  seq: integer('seq').notNull(), // monotonic within market
  probABps: integer('prob_a_bps').notNull(), // 0–10000 basis points
  probBBps: integer('prob_b_bps').notNull(), // 0–10000 basis points
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
  marketSeqIdx: uniqueIndex('odds_ticks_market_seq_idx').on(table.marketId, table.seq),
  marketLatestIdx: index('odds_ticks_market_latest_idx').on(table.marketId, table.createdAt),
}));

// ── Bet Orders (v3: user bets on race outcomes) ──

export const betOrders = pgTable('bet_orders', {
  id: text('id').primaryKey(), // UUID
  marketId: text('market_id').notNull().references(() => raceMarkets.id),
  userId: text('user_id').notNull().references(() => users.id),
  side: text('side', { enum: ['A', 'B'] }).notNull(), // which player the bet is on
  stakeWei: text('stake_wei').notNull(), // string for bigint precision
  oddsAtPlacementBps: integer('odds_at_placement_bps').notNull(), // locked odds
  status: text('status', {
    enum: ['pending', 'won', 'lost', 'cancelled'],
  }).notNull().default('pending'),
  payoutWei: text('payout_wei'), // null until settled
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  idempotencyIdx: uniqueIndex('bet_orders_idempotency_idx').on(table.idempotencyKey),
  marketStatusIdx: index('bet_orders_market_status_idx').on(table.marketId, table.status),
  userMarketIdx: index('bet_orders_user_market_idx').on(table.userId, table.marketId),
}));

// ── Bet Cancels (v3: cancellation records) ──

export const betCancels = pgTable('bet_cancels', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  orderId: text('order_id').notNull().references(() => betOrders.id),
  reason: text('reason').notNull().default('user_requested'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
  orderIdx: uniqueIndex('bet_cancels_order_idx').on(table.orderId),
}));

// ── Market Settlements (v3: settlement records for markets) ──

export const marketSettlements = pgTable('market_settlements', {
  id: text('id').primaryKey(), // UUID
  marketId: text('market_id').notNull().references(() => raceMarkets.id),
  winnerSide: text('winner_side', { enum: ['A', 'B', 'draw'] }).notNull(),
  totalPoolWei: text('total_pool_wei').notNull(),
  totalPayoutWei: text('total_payout_wei').notNull(),
  platformFeeWei: text('platform_fee_wei').notNull().default('0'),
  txHash: text('tx_hash'),
  txStatus: text('tx_status', {
    enum: ['pending', 'submitted', 'mined', 'confirmed', 'failed'],
  }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  minedAt: timestamp('mined_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  marketIdx: uniqueIndex('market_settlements_market_idx').on(table.marketId),
  txStatusIdx: index('market_settlements_tx_status_idx').on(table.txStatus),
}));

// ── Type Exports ──

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;

// v3 EVM types
export type ChainEventEvm = typeof chainEventsEvm.$inferSelect;
export type NewChainEventEvm = typeof chainEventsEvm.$inferInsert;

export type MatchV3 = typeof matchesV3.$inferSelect;
export type NewMatchV3 = typeof matchesV3.$inferInsert;

export type DepositV3 = typeof depositsV3.$inferSelect;
export type NewDepositV3 = typeof depositsV3.$inferInsert;

export type SettlementV3 = typeof settlementsV3.$inferSelect;
export type NewSettlementV3 = typeof settlementsV3.$inferInsert;

export type RewardEventV3 = typeof rewardEventsV3.$inferSelect;
export type NewRewardEventV3 = typeof rewardEventsV3.$inferInsert;

// v3 Market types
export type RaceMarket = typeof raceMarkets.$inferSelect;
export type NewRaceMarket = typeof raceMarkets.$inferInsert;

export type OddsTick = typeof oddsTicks.$inferSelect;
export type NewOddsTick = typeof oddsTicks.$inferInsert;

export type BetOrder = typeof betOrders.$inferSelect;
export type NewBetOrder = typeof betOrders.$inferInsert;

export type BetCancel = typeof betCancels.$inferSelect;
export type NewBetCancel = typeof betCancels.$inferInsert;

export type MarketSettlement = typeof marketSettlements.$inferSelect;
export type NewMarketSettlement = typeof marketSettlements.$inferInsert;
