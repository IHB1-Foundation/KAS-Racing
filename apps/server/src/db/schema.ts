import { pgTable, text, integer, doublePrecision, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(), // UUID
  address: text('address').notNull().unique(), // Kaspa address
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

// Sessions table
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').references(() => users.id),
  userAddress: text('user_address').notNull(),
  mode: text('mode', { enum: ['free_run', 'duel'] }).notNull(),
  status: text('status', { enum: ['active', 'ended'] }).notNull().default('active'),

  // Policy snapshot at session start
  rewardCooldownMs: integer('reward_cooldown_ms').notNull().default(2000),
  rewardMaxPerSession: integer('reward_max_per_session').notNull().default(10),

  // Counters
  eventCount: integer('event_count').notNull().default(0),
  lastEventAt: timestamp('last_event_at', { withTimezone: true, mode: 'date' }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
});

// Reward events table
export const rewardEvents = pgTable('reward_events', {
  id: text('id').primaryKey(), // UUID
  sessionId: text('session_id').notNull().references(() => sessions.id),
  seq: integer('seq').notNull(), // Sequence number within session
  type: text('type').notNull().default('checkpoint'),

  // Reward details
  rewardAmount: doublePrecision('reward_amount').notNull(), // in KAS

  // Transaction status
  txid: text('txid'),
  txStatus: text('tx_status', {
    enum: ['pending', 'broadcasted', 'accepted', 'included', 'confirmed', 'failed']
  }).notNull().default('pending'),

  // Timestamps for tx lifecycle
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  broadcastedAt: timestamp('broadcasted_at', { withTimezone: true, mode: 'date' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
  includedAt: timestamp('included_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  // Unique constraint: only one reward event per (sessionId, seq)
  sessionSeqIdx: uniqueIndex('reward_events_session_seq_idx').on(table.sessionId, table.seq),
}));

// Matches table (for duel mode)
export const matches = pgTable('matches', {
  id: text('id').primaryKey(), // UUID
  joinCode: text('join_code').notNull().unique(),

  // Players
  playerAId: text('player_a_id').references(() => users.id),
  playerAAddress: text('player_a_address'),
  playerAPubkey: text('player_a_pubkey'), // x-only pubkey for covenant escrow
  playerASessionId: text('player_a_session_id').references(() => sessions.id),

  playerBId: text('player_b_id').references(() => users.id),
  playerBAddress: text('player_b_address'),
  playerBPubkey: text('player_b_pubkey'), // x-only pubkey for covenant escrow
  playerBSessionId: text('player_b_session_id').references(() => sessions.id),

  // Bet details
  betAmount: doublePrecision('bet_amount').notNull(), // in KAS

  // Match status
  status: text('status', {
    enum: ['waiting', 'deposits_pending', 'ready', 'playing', 'finished', 'cancelled']
  }).notNull().default('waiting'),

  // Deposit tracking
  playerADepositTxid: text('player_a_deposit_txid'),
  playerADepositStatus: text('player_a_deposit_status'),
  playerBDepositTxid: text('player_b_deposit_txid'),
  playerBDepositStatus: text('player_b_deposit_status'),

  // Escrow addresses
  escrowAddressA: text('escrow_address_a'),
  escrowAddressB: text('escrow_address_b'),

  // Covenant escrow details (T-072)
  escrowMode: text('escrow_mode', { enum: ['covenant', 'fallback'] }).default('fallback'),
  escrowScriptA: text('escrow_script_a'), // Script hex for player A escrow
  escrowScriptB: text('escrow_script_b'), // Script hex for player B escrow
  refundLocktimeBlocks: integer('refund_locktime_blocks'), // DAA blocks until refund
  oraclePublicKey: text('oracle_public_key'), // Oracle pubkey used for this match

  // Results
  winnerId: text('winner_id'), // 'A', 'B', 'draw', or null
  playerAScore: integer('player_a_score'),
  playerBScore: integer('player_b_score'),

  // Settlement
  settleTxid: text('settle_txid'),
  settleStatus: text('settle_status'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
});

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type RewardEvent = typeof rewardEvents.$inferSelect;
export type NewRewardEvent = typeof rewardEvents.$inferInsert;

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
