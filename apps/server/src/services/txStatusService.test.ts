/**
 * TX Status Service Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { rewardEvents, sessions } from '../db/schema.js';
import type { TxStatus } from '../types/index.js';

// Mock the db module - must be before imports
vi.mock('../db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('../db/schema.js');

  const sqlite = new Database(':memory:');

  // Setup schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      user_address TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'free_run',
      status TEXT NOT NULL DEFAULT 'active',
      reward_cooldown_ms INTEGER NOT NULL DEFAULT 2000,
      reward_max_per_session INTEGER NOT NULL DEFAULT 10,
      event_count INTEGER NOT NULL DEFAULT 0,
      last_event_at INTEGER,
      created_at INTEGER NOT NULL,
      ended_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reward_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      seq INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'checkpoint',
      reward_amount REAL NOT NULL,
      txid TEXT,
      tx_status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      broadcasted_at INTEGER,
      accepted_at INTEGER,
      included_at INTEGER,
      confirmed_at INTEGER
    );

    CREATE UNIQUE INDEX IF NOT EXISTS reward_events_session_seq_idx
      ON reward_events(session_id, seq);
  `);

  const db = drizzle(sqlite);

  return {
    db,
    sqlite,
    users: schema.users,
    sessions: schema.sessions,
    rewardEvents: schema.rewardEvents,
  };
});

// Mock the WebSocket emit
vi.mock('../ws/index.js', () => ({
  emitTxStatusUpdated: vi.fn(),
}));

// Mock the config
vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    network: 'mainnet',
    treasuryPrivateKey: 'mock-key',
    treasuryChangeAddress: 'kaspa:mock',
    oraclePrivateKey: 'mock-oracle',
  }),
}));

// Import after mocks
import { db } from '../db/index.js';
import {
  fetchTxStatus,
  updateTxStatus,
  getTrackableEvents,
  getTxStatusFromDb,
} from './txStatusService.js';
import { emitTxStatusUpdated } from '../ws/index.js';

describe('txStatusService', () => {
  beforeEach(async () => {
    // Clear tables using the mocked db
    const { sqlite } = await import('../db/index.js') as { sqlite: Database.Database };
    sqlite.exec('DELETE FROM reward_events');
    sqlite.exec('DELETE FROM sessions');
    sqlite.exec('DELETE FROM users');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTxStatus', () => {
    it('should simulate accepted status for stub tx after 500ms', async () => {
      const broadcastedAt = new Date(Date.now() - 600);
      const result = await fetchTxStatus('stub_test_001', broadcastedAt);

      expect(result.accepted).toBe(true);
      expect(result.included).toBe(false);
    });

    it('should simulate included status for stub tx after 2000ms', async () => {
      const broadcastedAt = new Date(Date.now() - 2500);
      const result = await fetchTxStatus('stub_test_002', broadcastedAt);

      expect(result.accepted).toBe(true);
      expect(result.included).toBe(true);
      expect(result.confirmations).toBe(1);
    });

    it('should simulate confirmed status for stub tx after 4000ms', async () => {
      const broadcastedAt = new Date(Date.now() - 5000);
      const result = await fetchTxStatus('stub_test_003', broadcastedAt);

      expect(result.accepted).toBe(true);
      expect(result.included).toBe(true);
      expect(result.confirmations).toBe(10);
    });

    it('should handle test-txid- prefix as stub', async () => {
      const broadcastedAt = new Date(Date.now() - 3000);
      const result = await fetchTxStatus('test-txid-1', broadcastedAt);

      expect(result.accepted).toBe(true);
      expect(result.included).toBe(true);
    });
  });

  describe('updateTxStatus', () => {
    it('should update status from broadcasted to accepted', async () => {
      // Create test session
      const sessionId = 'session-status-1';
      const eventId = 'event-status-1';
      const txid = 'stub_status_' + Date.now().toString(36);

      await db.insert(sessions).values({
        id: sessionId,
        userAddress: 'kaspa:test',
        mode: 'free_run',
        status: 'active',
        rewardCooldownMs: 2000,
        rewardMaxPerSession: 10,
        eventCount: 1,
        createdAt: new Date(),
      });

      await db.insert(rewardEvents).values({
        id: eventId,
        sessionId,
        seq: 1,
        type: 'checkpoint',
        rewardAmount: 0.02,
        txid,
        txStatus: 'broadcasted',
        createdAt: new Date(),
        broadcastedAt: new Date(Date.now() - 1000), // 1 second ago
      });

      // Get the event
      const events = await db.select().from(rewardEvents);
      const event = events[0];

      // Update status
      const result = await updateTxStatus(event);

      expect(result.updated).toBe(true);
      expect(result.oldStatus).toBe('broadcasted');
      expect(result.newStatus).toBe('accepted');

      // Verify WebSocket was called
      expect(emitTxStatusUpdated).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          txid,
          status: 'accepted',
        })
      );
    });

    it('should skip already confirmed events', async () => {
      const sessionId = 'session-status-2';
      const eventId = 'event-status-2';

      await db.insert(sessions).values({
        id: sessionId,
        userAddress: 'kaspa:test',
        mode: 'free_run',
        status: 'active',
        rewardCooldownMs: 2000,
        rewardMaxPerSession: 10,
        eventCount: 1,
        createdAt: new Date(),
      });

      await db.insert(rewardEvents).values({
        id: eventId,
        sessionId,
        seq: 1,
        type: 'checkpoint',
        rewardAmount: 0.02,
        txid: 'stub_confirmed_tx',
        txStatus: 'confirmed',
        createdAt: new Date(),
        broadcastedAt: new Date(),
        confirmedAt: new Date(),
      });

      const events = await db.select().from(rewardEvents);
      const event = events[0];

      const result = await updateTxStatus(event);

      expect(result.updated).toBe(false);
      expect(result.oldStatus).toBe('confirmed');
      expect(result.newStatus).toBe('confirmed');
    });

    it('should skip events without txid', async () => {
      const sessionId = 'session-status-3';
      const eventId = 'event-status-3';

      await db.insert(sessions).values({
        id: sessionId,
        userAddress: 'kaspa:test',
        mode: 'free_run',
        status: 'active',
        rewardCooldownMs: 2000,
        rewardMaxPerSession: 10,
        eventCount: 1,
        createdAt: new Date(),
      });

      await db.insert(rewardEvents).values({
        id: eventId,
        sessionId,
        seq: 1,
        type: 'checkpoint',
        rewardAmount: 0.02,
        txid: null,
        txStatus: 'pending',
        createdAt: new Date(),
      });

      const events = await db.select().from(rewardEvents);
      const event = events[0];

      const result = await updateTxStatus(event);

      expect(result.updated).toBe(false);
    });
  });

  describe('getTrackableEvents', () => {
    it('should return only trackable events', async () => {
      const sessionId = 'session-trackable';

      await db.insert(sessions).values({
        id: sessionId,
        userAddress: 'kaspa:test',
        mode: 'free_run',
        status: 'active',
        rewardCooldownMs: 2000,
        rewardMaxPerSession: 10,
        eventCount: 4,
        createdAt: new Date(),
      });

      // Insert events with different statuses
      const statuses: TxStatus[] = ['pending', 'broadcasted', 'accepted', 'included', 'confirmed', 'failed'];
      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        await db.insert(rewardEvents).values({
          id: `event-track-${i}`,
          sessionId,
          seq: i + 1,
          type: 'checkpoint',
          rewardAmount: 0.02,
          txid: `stub_track_${i}`,
          txStatus: status,
          createdAt: new Date(),
          broadcastedAt: status !== 'pending' ? new Date() : null,
        });
      }

      const trackable = await getTrackableEvents();

      // Should only return broadcasted, accepted, included (not pending, confirmed, failed)
      expect(trackable).toHaveLength(3);
      const trackableStatuses = trackable.map(e => e.txStatus);
      expect(trackableStatuses).toContain('broadcasted');
      expect(trackableStatuses).toContain('accepted');
      expect(trackableStatuses).toContain('included');
      expect(trackableStatuses).not.toContain('pending');
      expect(trackableStatuses).not.toContain('confirmed');
      expect(trackableStatuses).not.toContain('failed');
    });
  });

  describe('getTxStatusFromDb', () => {
    it('should return event by txid', async () => {
      const sessionId = 'session-get-tx';
      const txid = 'stub_get_tx_123';

      await db.insert(sessions).values({
        id: sessionId,
        userAddress: 'kaspa:test',
        mode: 'free_run',
        status: 'active',
        rewardCooldownMs: 2000,
        rewardMaxPerSession: 10,
        eventCount: 1,
        createdAt: new Date(),
      });

      await db.insert(rewardEvents).values({
        id: 'event-get-tx',
        sessionId,
        seq: 1,
        type: 'checkpoint',
        rewardAmount: 0.05,
        txid,
        txStatus: 'broadcasted',
        createdAt: new Date(),
        broadcastedAt: new Date(),
      });

      const result = await getTxStatusFromDb(txid);

      expect(result).not.toBeNull();
      expect(result!.txid).toBe(txid);
      expect(result!.rewardAmount).toBe(0.05);
    });

    it('should return null for non-existent txid', async () => {
      const result = await getTxStatusFromDb('non-existent-txid');
      expect(result).toBeNull();
    });
  });
});
