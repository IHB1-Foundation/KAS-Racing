import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app, httpServer } from './app.js';
import type { StartSessionResponse, SessionEventResult, TxStatusResponse } from './types/index.js';

// Mock rewardService to avoid config validation in tests
vi.mock('./services/rewardService.js', () => ({
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

describe('server API', () => {
  beforeAll(() => {
    // Start server on a random port for tests
    return new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  describe('GET /api/health', () => {
    it('returns ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      const body = res.body as { ok: boolean; name: string };
      expect(body.ok).toBe(true);
      expect(body.name).toBe('kas-racing-server');
    });
  });

  describe('POST /api/session/start', () => {
    it('creates a new session', async () => {
      const res = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:test123',
        mode: 'free_run',
      });
      expect(res.status).toBe(200);
      const body = res.body as StartSessionResponse;
      expect(body.sessionId).toBeDefined();
      expect(body.policy).toBeDefined();
      expect(body.policy.rewardCooldownMs).toBe(2000);
      expect(body.policy.rewardMaxPerSession).toBe(10);
    });

    it('rejects without userAddress', async () => {
      const res = await request(app).post('/api/session/start').send({});
      expect(res.status).toBe(400);
      const body = res.body as { error: string };
      expect(body.error).toContain('userAddress');
    });
  });

  describe('POST /api/session/event', () => {
    let sessionId: string;

    beforeAll(async () => {
      const res = await request(app).post('/api/session/start').send({
        userAddress: 'kaspa:test456',
        mode: 'free_run',
      });
      const body = res.body as StartSessionResponse;
      sessionId = body.sessionId;
    });

    it('accepts a valid checkpoint event', async () => {
      const res = await request(app).post('/api/session/event').send({
        sessionId,
        type: 'checkpoint',
        seq: 1,
        timestamp: Date.now(),
      });
      expect(res.status).toBe(200);
      const body = res.body as SessionEventResult;
      expect(body.accepted).toBe(true);
      expect(body.rewardAmount).toBeDefined();
      expect(body.txid).toBeDefined();
    });

    it('rejects unknown session', async () => {
      const res = await request(app).post('/api/session/event').send({
        sessionId: 'unknown-session',
        type: 'checkpoint',
        seq: 1,
        timestamp: Date.now(),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tx/:txid/status', () => {
    it('returns status for stub txid', async () => {
      // Create a stub txid
      const stubTxid = `stub_test_1_${Date.now().toString(36)}`;

      const res = await request(app).get(`/api/tx/${stubTxid}/status`);
      expect(res.status).toBe(200);
      const body = res.body as TxStatusResponse;
      expect(body.txid).toBe(stubTxid);
      expect(body.status).toBeDefined();
      expect(body.timestamps).toBeDefined();
    });

    it('returns 404 for unknown txid', async () => {
      const res = await request(app).get('/api/tx/unknown_tx/status');
      expect(res.status).toBe(404);
    });
  });
});
