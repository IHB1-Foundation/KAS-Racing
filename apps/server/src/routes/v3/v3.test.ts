/**
 * V3 API Route Tests — EVM Contract-first
 *
 * Tests the V3 session, match, and tx routes.
 * Uses pg-mem for in-memory Postgres, mocks EVM contract calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { db } from '../../db/index.js';
import { sessions, matchesV3, rewardEventsV3, chainEventsEvm } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

// Mock EVM contract calls
vi.mock('../../tx/evmContracts.js', () => ({
  createMatchOnchain: vi.fn().mockResolvedValue({
    hash: '0xmockcreatetx1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    receipt: null,
    success: true,
  }),
  settleMatch: vi.fn().mockResolvedValue({
    hash: '0xmocksettletx1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    receipt: null,
    success: true,
  }),
  settleMatchDraw: vi.fn().mockResolvedValue({
    hash: '0xmockdrawtx1234567890abcdef1234567890abcdef1234567890abcdef123456789',
    receipt: null,
    success: true,
  }),
  // Dynamic: return unique hash per input to avoid unique constraint violation
  toMatchId: vi.fn().mockImplementation((id: string) => {
    const hex = Buffer.from(id).toString('hex').slice(0, 60).padEnd(64, '0');
    return `0x${hex}`;
  }),
  toSessionId: vi.fn().mockImplementation((id: string) => {
    const hex = Buffer.from(id).toString('hex').slice(0, 60).padEnd(64, '0');
    return `0x${hex}`;
  }),
  buildProofHash: vi.fn().mockReturnValue('0xproofhash0000000000000000000000000000000000000000000000000000001'),
  payRewardOnchain: vi.fn().mockResolvedValue({
    hash: '0xmockrewardtx1234567890abcdef1234567890abcdef1234567890abcdef1234567',
    receipt: null,
    success: true,
  }),
  isRewardPaid: vi.fn().mockResolvedValue(false),
  getVaultBalance: vi.fn().mockResolvedValue(1000000000000000000n),
}));

// Mock EVM client for tx status checks
vi.mock('../../tx/evmClient.js', () => ({
  getPublicClient: vi.fn().mockReturnValue({
    getBlockNumber: vi.fn().mockResolvedValue(100n),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
  }),
  loadOperatorAccount: vi.fn(),
  sendContractTx: vi.fn(),
  getOperatorBalance: vi.fn().mockResolvedValue({ wei: 0n, formatted: '0' }),
  parseEther: vi.fn((v: string) => BigInt(v)),
  formatEther: vi.fn((v: bigint) => v.toString()),
}));

describe('V3 API Routes', () => {
  // ── Session Routes ──

  describe('POST /api/v3/session/start', () => {
    it('creates a new session', async () => {
      const res = await request(app)
        .post('/api/v3/session/start')
        .send({ userAddress: '0x1234567890abcdef1234567890abcdef12345678' })
        .expect(200);

      expect(res.body.sessionId).toBeDefined();
      expect(res.body.policy).toBeDefined();
      expect(res.body.policy.rewardCooldownMs).toBe(2000);
    });

    it('rejects missing userAddress', async () => {
      const res = await request(app)
        .post('/api/v3/session/start')
        .send({})
        .expect(400);

      expect(res.body.error).toContain('userAddress');
    });

    it('rejects invalid mode', async () => {
      const res = await request(app)
        .post('/api/v3/session/start')
        .send({ userAddress: '0xabc', mode: 'invalid' })
        .expect(400);

      expect(res.body.error).toContain('mode');
    });
  });

  describe('GET /api/v3/session/:id', () => {
    it('returns session info', async () => {
      // Create session first
      const createRes = await request(app)
        .post('/api/v3/session/start')
        .send({ userAddress: '0xgettest' })
        .expect(200);

      const sessionId = createRes.body.sessionId;

      const res = await request(app)
        .get(`/api/v3/session/${sessionId}`)
        .expect(200);

      expect(res.body.id).toBe(sessionId);
      expect(res.body.status).toBe('active');
      expect(res.body.eventCount).toBe(0);
    });

    it('returns 404 for unknown session', async () => {
      await request(app)
        .get('/api/v3/session/nonexistent')
        .expect(404);
    });
  });

  describe('POST /api/v3/session/:id/end', () => {
    it('ends a session', async () => {
      const createRes = await request(app)
        .post('/api/v3/session/start')
        .send({ userAddress: '0xendtest' })
        .expect(200);

      const sessionId = createRes.body.sessionId;

      const res = await request(app)
        .post(`/api/v3/session/${sessionId}/end`)
        .expect(200);

      expect(res.body.ok).toBe(true);
    });
  });

  describe('GET /api/v3/session/:id/events', () => {
    it('returns empty events for new session', async () => {
      const createRes = await request(app)
        .post('/api/v3/session/start')
        .send({ userAddress: '0xeventstest' })
        .expect(200);

      const res = await request(app)
        .get(`/api/v3/session/${createRes.body.sessionId}/events`)
        .expect(200);

      expect(res.body.events).toEqual([]);
      expect(res.body.total).toBe(0);
    });
  });

  // ── Match Routes ──

  describe('POST /api/v3/match/create', () => {
    it('creates a match lobby', async () => {
      const res = await request(app)
        .post('/api/v3/match/create')
        .send({
          playerAddress: '0xplayer1',
          betAmountWei: '1000000000000000',
        })
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.joinCode).toBeDefined();
      expect(res.body.state).toBe('lobby');
      expect(res.body.players.player1.address).toBe('0xplayer1');
      expect(res.body.players.player2.address).toBeFalsy();
      expect(res.body.depositAmountWei).toBe('1000000000000000');
    });

    it('rejects missing playerAddress', async () => {
      await request(app)
        .post('/api/v3/match/create')
        .send({ betAmountWei: '1000' })
        .expect(400);
    });

    it('rejects invalid betAmountWei', async () => {
      await request(app)
        .post('/api/v3/match/create')
        .send({ playerAddress: '0xabc', betAmountWei: '0' })
        .expect(400);
    });
  });

  describe('POST /api/v3/match/join', () => {
    it('joins a match and creates on-chain match', async () => {
      // Create lobby
      const createRes = await request(app)
        .post('/api/v3/match/create')
        .send({ playerAddress: '0xplayer1join', betAmountWei: '1000000000000000' })
        .expect(200);

      const joinCode = createRes.body.joinCode;

      // Join
      const res = await request(app)
        .post('/api/v3/match/join')
        .send({ joinCode, playerAddress: '0xplayer2join' })
        .expect(200);

      expect(res.body.state).toBe('created');
      expect(res.body.matchIdOnchain).toBeDefined();
      expect(res.body.players.player2.address).toBe('0xplayer2join');
    });

    it('rejects self-join', async () => {
      const createRes = await request(app)
        .post('/api/v3/match/create')
        .send({ playerAddress: '0xselfjoin', betAmountWei: '1000' })
        .expect(200);

      const res = await request(app)
        .post('/api/v3/match/join')
        .send({ joinCode: createRes.body.joinCode, playerAddress: '0xselfjoin' })
        .expect(400);

      expect(res.body.code).toBe('SELF_JOIN');
    });

    it('rejects invalid join code', async () => {
      await request(app)
        .post('/api/v3/match/join')
        .send({ joinCode: 'INVALID', playerAddress: '0xabc' })
        .expect(404);
    });
  });

  describe('GET /api/v3/match/:id', () => {
    it('returns unified match state', async () => {
      const createRes = await request(app)
        .post('/api/v3/match/create')
        .send({ playerAddress: '0xgetmatch', betAmountWei: '2000' })
        .expect(200);

      const res = await request(app)
        .get(`/api/v3/match/${createRes.body.id}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.deposits).toBeDefined();
      expect(res.body.chainEvents).toBeDefined();
      expect(res.body.contract).toBeDefined();
    });

    it('returns 404 for unknown match', async () => {
      await request(app)
        .get('/api/v3/match/nonexistent')
        .expect(404);
    });
  });

  describe('GET /api/v3/match/code/:joinCode', () => {
    it('finds match by join code', async () => {
      const createRes = await request(app)
        .post('/api/v3/match/create')
        .send({ playerAddress: '0xcodelookup', betAmountWei: '5000' })
        .expect(200);

      const res = await request(app)
        .get(`/api/v3/match/code/${createRes.body.joinCode}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.id);
    });
  });

  describe('POST /api/v3/match/:id/submit-score', () => {
    it('submits score for a player', async () => {
      // Create + join
      const createRes = await request(app)
        .post('/api/v3/match/create')
        .send({ playerAddress: '0xscorep1', betAmountWei: '1000' })
        .expect(200);

      await request(app)
        .post('/api/v3/match/join')
        .send({ joinCode: createRes.body.joinCode, playerAddress: '0xscorep2' })
        .expect(200);

      // Submit score
      const res = await request(app)
        .post(`/api/v3/match/${createRes.body.id}/submit-score`)
        .send({ playerAddress: '0xscorep1', score: 100 })
        .expect(200);

      expect(res.body.players.player1.score).toBe(100);
    });

    it('rejects non-player address', async () => {
      const createRes = await request(app)
        .post('/api/v3/match/create')
        .send({ playerAddress: '0xscoreauth1', betAmountWei: '1000' })
        .expect(200);

      await request(app)
        .post('/api/v3/match/join')
        .send({ joinCode: createRes.body.joinCode, playerAddress: '0xscoreauth2' })
        .expect(200);

      const res = await request(app)
        .post(`/api/v3/match/${createRes.body.id}/submit-score`)
        .send({ playerAddress: '0xintruder', score: 999 })
        .expect(400);

      expect(res.body.code).toBe('NOT_PLAYER');
    });
  });

  // ── Tx Routes ──

  describe('GET /api/v3/tx/:txHash/status', () => {
    it('returns pending for unknown tx', async () => {
      const res = await request(app)
        .get('/api/v3/tx/0xunknowntx/status')
        .expect(200);

      expect(res.body.status).toBe('pending');
      expect(res.body.confirmations).toBe(0);
    });
  });

  describe('GET /api/v3/tx/:txHash', () => {
    it('returns 404 for unknown tx', async () => {
      await request(app)
        .get('/api/v3/tx/0xnotfound')
        .expect(404);
    });
  });

  describe('GET /api/v3/tx/proof/:sessionId/:seq', () => {
    it('returns unverified proof for non-existent event', async () => {
      const res = await request(app)
        .get('/api/v3/tx/proof/nonexistent/0')
        .expect(200);

      expect(res.body.verified).toBe(false);
      expect(res.body.proofHash).toBeNull();
    });
  });
});
