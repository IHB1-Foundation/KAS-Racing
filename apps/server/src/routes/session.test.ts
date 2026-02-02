import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app, httpServer } from '../app.js';
import { db, sessions, rewardEvents } from '../db/index.js';
import type { StartSessionResponse, SessionEventResult } from '../types/index.js';

// Mock rewardService to avoid config validation in tests
vi.mock('../services/rewardService.js', () => ({
  processRewardRequest: vi.fn().mockImplementation(async (req: { sessionId: string; seq: number; rewardAmountKas: number }) => ({
    eventId: 'test-event-id',
    sessionId: req.sessionId,
    seq: req.seq,
    rewardAmount: req.rewardAmountKas,
    txid: `test-txid-${req.seq}`,
    txStatus: 'broadcasted',
    isNew: true,
  })),
}));

describe('Session Policy Engine', () => {
  beforeAll(() => {
    return new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(async () => {
    // Clean up test data from DB
    await db.delete(rewardEvents);
    await db.delete(sessions);
  });

  describe('Cooldown Policy', () => {
    it('rejects event within cooldown period', async () => {
      // Create session
      const startRes = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:cooldown_test',
        mode: 'free_run',
      });
      const { sessionId } = startRes.body as StartSessionResponse;

      // First event should succeed
      const event1 = await request(app).post('/api/session/event').send({
        sessionId,
        type: 'checkpoint',
        seq: 1,
        timestamp: Date.now(),
      });
      expect((event1.body as SessionEventResult).accepted).toBe(true);

      // Second event immediately should fail (cooldown)
      const event2 = await request(app).post('/api/session/event').send({
        sessionId,
        type: 'checkpoint',
        seq: 2,
        timestamp: Date.now(),
      });
      const result = event2.body as SessionEventResult;
      expect(result.accepted).toBe(false);
      expect(result.rejectReason).toBe('COOLDOWN_ACTIVE');
    });
  });

  describe('Max Events Policy', () => {
    it('rejects events after max limit reached', async () => {
      // Create session
      const startRes = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:max_events_test',
        mode: 'free_run',
      });
      const { sessionId, policy } = startRes.body as StartSessionResponse;

      // Manually set eventCount to max in DB
      await db
        .update(sessions)
        .set({ eventCount: policy.rewardMaxPerSession })
        .where(eq(sessions.id, sessionId));

      // Next event should fail
      const event = await request(app).post('/api/session/event').send({
        sessionId,
        type: 'checkpoint',
        seq: 1,
        timestamp: Date.now(),
      });
      const result = event.body as SessionEventResult;
      expect(result.accepted).toBe(false);
      expect(result.rejectReason).toBe('MAX_EVENTS_REACHED');
    });
  });

  describe('Session Status Policy', () => {
    it('rejects events for ended session', async () => {
      // Create session
      const startRes = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:status_test',
        mode: 'free_run',
      });
      const { sessionId } = startRes.body as StartSessionResponse;

      // End the session
      await request(app).post(`/api/session/${sessionId}/end`);

      // Event should fail
      const event = await request(app).post('/api/session/event').send({
        sessionId,
        type: 'checkpoint',
        seq: 1,
        timestamp: Date.now(),
      });
      const result = event.body as SessionEventResult;
      expect(result.accepted).toBe(false);
      expect(result.rejectReason).toBe('SESSION_ENDED');
    });
  });

  describe('Timestamp Sanity Check', () => {
    it('rejects events with timestamp too far in the future', async () => {
      // Create session
      const startRes = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:timestamp_test',
        mode: 'free_run',
      });
      const { sessionId } = startRes.body as StartSessionResponse;

      // Event with timestamp 1 minute in the future
      const futureTimestamp = Date.now() + 60000;
      const event = await request(app).post('/api/session/event').send({
        sessionId,
        type: 'checkpoint',
        seq: 1,
        timestamp: futureTimestamp,
      });
      const result = event.body as SessionEventResult;
      expect(result.accepted).toBe(false);
      expect(result.rejectReason).toBe('TIMESTAMP_INVALID');
    });

    it('rejects events with timestamp too far in the past', async () => {
      // Create session
      const startRes = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:timestamp_test2',
        mode: 'free_run',
      });
      const { sessionId } = startRes.body as StartSessionResponse;

      // Event with timestamp 1 minute in the past
      const pastTimestamp = Date.now() - 60000;
      const event = await request(app).post('/api/session/event').send({
        sessionId,
        type: 'checkpoint',
        seq: 1,
        timestamp: pastTimestamp,
      });
      const result = event.body as SessionEventResult;
      expect(result.accepted).toBe(false);
      expect(result.rejectReason).toBe('TIMESTAMP_INVALID');
    });

    it('accepts events with valid timestamp within drift tolerance', async () => {
      // Create session
      const startRes = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:timestamp_test3',
        mode: 'free_run',
      });
      const { sessionId } = startRes.body as StartSessionResponse;

      // Event with timestamp 10 seconds ago (within 30s tolerance)
      const validTimestamp = Date.now() - 10000;
      const event = await request(app).post('/api/session/event').send({
        sessionId,
        type: 'checkpoint',
        seq: 1,
        timestamp: validTimestamp,
      });
      const result = event.body as SessionEventResult;
      expect(result.accepted).toBe(true);
    });
  });

  describe('Policy Response at Session Start', () => {
    it('returns policy with session', async () => {
      const res = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:policy_test',
        mode: 'free_run',
      });
      const body = res.body as StartSessionResponse;

      expect(body.policy).toBeDefined();
      expect(body.policy.rewardCooldownMs).toBe(2000);
      expect(body.policy.rewardMaxPerSession).toBe(10);
      expect(body.policy.rewardAmounts).toEqual([0.02, 0.05, 0.1]);
    });
  });
});
