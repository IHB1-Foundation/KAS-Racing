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

// ── Reward Events ──

export const rewardEvents = pgTable('reward_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  seq: integer('seq').notNull(),
  type: text('type').notNull().default('checkpoint'),
  rewardAmount: doublePrecision('reward_amount').notNull(),
  txid: text('txid'),
  txStatus: text('tx_status', {
    enum: ['pending', 'broadcasted', 'accepted', 'included', 'confirmed', 'failed']
  }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  broadcastedAt: timestamp('broadcasted_at', { withTimezone: true, mode: 'date' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
  includedAt: timestamp('included_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  sessionSeqIdx: uniqueIndex('reward_events_session_seq_idx').on(table.sessionId, table.seq),
  txStatusIdx: index('reward_events_tx_status_idx').on(table.txStatus),
}));

// ── Matches (v2: escrow fields retained for backward compatibility) ──

export const matches = pgTable('matches', {
  id: text('id').primaryKey(),
  joinCode: text('join_code').notNull().unique(),
  playerAId: text('player_a_id').references(() => users.id),
  playerAAddress: text('player_a_address'),
  playerAPubkey: text('player_a_pubkey'),
  playerASessionId: text('player_a_session_id').references(() => sessions.id),
  playerBId: text('player_b_id').references(() => users.id),
  playerBAddress: text('player_b_address'),
  playerBPubkey: text('player_b_pubkey'),
  playerBSessionId: text('player_b_session_id').references(() => sessions.id),
  betAmount: doublePrecision('bet_amount').notNull(),
  status: text('status', {
    enum: ['waiting', 'deposits_pending', 'ready', 'playing', 'finished', 'cancelled']
  }).notNull().default('waiting'),
  playerADepositTxid: text('player_a_deposit_txid'),
  playerADepositStatus: text('player_a_deposit_status'),
  playerBDepositTxid: text('player_b_deposit_txid'),
  playerBDepositStatus: text('player_b_deposit_status'),
  escrowAddressA: text('escrow_address_a'),
  escrowAddressB: text('escrow_address_b'),
  escrowMode: text('escrow_mode', { enum: ['covenant', 'fallback'] }).default('fallback'),
  escrowScriptA: text('escrow_script_a'),
  escrowScriptB: text('escrow_script_b'),
  refundLocktimeBlocks: integer('refund_locktime_blocks'),
  oraclePublicKey: text('oracle_public_key'),
  winnerId: text('winner_id'),
  playerAScore: integer('player_a_score'),
  playerBScore: integer('player_b_score'),
  settleTxid: text('settle_txid'),
  settleStatus: text('settle_status'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  statusIdx: index('matches_status_idx').on(table.status),
}));

// ── Deposits (v2: first-class table for deposit tracking) ──

export const deposits = pgTable('deposits', {
  id: text('id').primaryKey(),
  matchId: text('match_id').notNull().references(() => matches.id),
  player: text('player', { enum: ['A', 'B'] }).notNull(),
  playerAddress: text('player_address').notNull(),
  escrowAddress: text('escrow_address').notNull(),
  amountSompi: bigint('amount_sompi', { mode: 'bigint' }).notNull(),
  txid: text('txid'),
  txStatus: text('tx_status', {
    enum: ['pending', 'broadcasted', 'accepted', 'included', 'confirmed', 'failed']
  }).notNull().default('pending'),
  daaScore: bigint('daa_score', { mode: 'bigint' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  broadcastedAt: timestamp('broadcasted_at', { withTimezone: true, mode: 'date' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
  includedAt: timestamp('included_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  matchPlayerIdx: uniqueIndex('deposits_match_player_idx').on(table.matchId, table.player),
  txStatusIdx: index('deposits_tx_status_idx').on(table.txStatus),
}));

// ── Settlements (v2: first-class table for settlement tracking) ──

export const settlements = pgTable('settlements', {
  id: text('id').primaryKey(),
  matchId: text('match_id').notNull().references(() => matches.id).unique(),
  settlementType: text('settlement_type', {
    enum: ['winner_A', 'winner_B', 'draw', 'refund']
  }).notNull(),
  txid: text('txid'),
  txStatus: text('tx_status', {
    enum: ['pending', 'broadcasted', 'accepted', 'included', 'confirmed', 'failed']
  }).notNull().default('pending'),
  winnerAddress: text('winner_address'),
  totalAmountSompi: bigint('total_amount_sompi', { mode: 'bigint' }).notNull(),
  feeSompi: bigint('fee_sompi', { mode: 'bigint' }).notNull(),
  daaScore: bigint('daa_score', { mode: 'bigint' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  broadcastedAt: timestamp('broadcasted_at', { withTimezone: true, mode: 'date' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
  includedAt: timestamp('included_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  txStatusIdx: index('settlements_tx_status_idx').on(table.txStatus),
}));

// ── Chain Events (v2: indexed events from chain watcher) ──

export const chainEvents = pgTable('chain_events', {
  id: text('id').primaryKey(),
  txid: text('txid').notNull(),
  eventType: text('event_type', {
    enum: ['deposit', 'settlement', 'refund', 'reward_payout']
  }).notNull(),
  matchId: text('match_id').references(() => matches.id),
  sessionId: text('session_id').references(() => sessions.id),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),
  amountSompi: bigint('amount_sompi', { mode: 'bigint' }).notNull(),
  daaScore: bigint('daa_score', { mode: 'bigint' }),
  confirmations: integer('confirmations').notNull().default(0),
  payload: text('payload'),
  indexedAt: timestamp('indexed_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
  txidToAddrIdx: uniqueIndex('chain_events_txid_to_addr_idx').on(table.txid, table.toAddress),
  eventTypeIdx: index('chain_events_event_type_idx').on(table.eventType),
  matchIdIdx: index('chain_events_match_id_idx').on(table.matchId),
  daaScoreIdx: index('chain_events_daa_score_idx').on(table.daaScore),
}));

// ── Idempotency Keys (v2: prevents duplicate TX submissions) ──

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  txid: text('txid'),
  result: text('result'), // JSON stringified result
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
});

// ── Type Exports ──

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type RewardEvent = typeof rewardEvents.$inferSelect;
export type NewRewardEvent = typeof rewardEvents.$inferInsert;

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

export type Deposit = typeof deposits.$inferSelect;
export type NewDeposit = typeof deposits.$inferInsert;

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;

export type ChainEvent = typeof chainEvents.$inferSelect;
export type NewChainEvent = typeof chainEvents.$inferInsert;

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
