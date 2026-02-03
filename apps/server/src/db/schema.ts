import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  address: text('address').notNull().unique(), // Kaspa address
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// Sessions table
export const sessions = sqliteTable('sessions', {
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
  lastEventAt: integer('last_event_at', { mode: 'timestamp_ms' }),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
});

// Reward events table
export const rewardEvents = sqliteTable('reward_events', {
  id: text('id').primaryKey(), // UUID
  sessionId: text('session_id').notNull().references(() => sessions.id),
  seq: integer('seq').notNull(), // Sequence number within session
  type: text('type').notNull().default('checkpoint'),

  // Reward details
  rewardAmount: real('reward_amount').notNull(), // in KAS

  // Transaction status
  txid: text('txid'),
  txStatus: text('tx_status', {
    enum: ['pending', 'broadcasted', 'accepted', 'included', 'confirmed', 'failed']
  }).notNull().default('pending'),

  // Timestamps for tx lifecycle
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  broadcastedAt: integer('broadcasted_at', { mode: 'timestamp_ms' }),
  acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
  includedAt: integer('included_at', { mode: 'timestamp_ms' }),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }),
}, (table) => ({
  // Unique constraint: only one reward event per (sessionId, seq)
  sessionSeqIdx: uniqueIndex('reward_events_session_seq_idx').on(table.sessionId, table.seq),
}));

// Matches table (for duel mode)
export const matches = sqliteTable('matches', {
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
  betAmount: real('bet_amount').notNull(), // in KAS

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
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
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
