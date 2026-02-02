import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, httpServer } from '../app.js';
import { db, matches } from '../db/index.js';

describe('Match API (Matchmaking)', () => {
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
    await db.delete(matches);
  });

  describe('POST /api/match/create', () => {
    it('creates a match with valid input', async () => {
      const res = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:test_player_a',
        betAmount: 0.5,
      });

      expect(res.status).toBe(200);
      expect(res.body.matchId).toBeDefined();
      expect(res.body.joinCode).toBeDefined();
      expect(res.body.joinCode).toHaveLength(6);
      expect(res.body.betAmount).toBe(0.5);
      expect(res.body.status).toBe('waiting');
    });

    it('rejects missing playerAddress', async () => {
      const res = await request(app).post('/api/match/create').send({
        betAmount: 0.5,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('playerAddress is required');
    });

    it('rejects invalid betAmount', async () => {
      const res = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:test',
        betAmount: -1,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('betAmount must be a positive number');
    });

    it('rejects betAmount below minimum', async () => {
      const res = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:test',
        betAmount: 0.05, // Below 0.1 KAS minimum
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('betAmount must be at least 0.1 KAS');
    });
  });

  describe('POST /api/match/join', () => {
    it('joins an existing match', async () => {
      // Create a match first
      const createRes = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:player_a',
        betAmount: 1.0,
      });
      const { joinCode } = createRes.body;

      // Join the match
      const joinRes = await request(app).post('/api/match/join').send({
        joinCode,
        playerAddress: 'kaspa:player_b',
      });

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.id).toBeDefined();
      expect(joinRes.body.status).toBe('deposits_pending');
      expect(joinRes.body.playerA.address).toBe('kaspa:player_a');
      expect(joinRes.body.playerB.address).toBe('kaspa:player_b');
    });

    it('accepts lowercase join code', async () => {
      const createRes = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:player_a',
        betAmount: 1.0,
      });
      const { joinCode } = createRes.body;

      // Join with lowercase code
      const joinRes = await request(app).post('/api/match/join').send({
        joinCode: joinCode.toLowerCase(),
        playerAddress: 'kaspa:player_b',
      });

      expect(joinRes.status).toBe(200);
    });

    it('rejects non-existent join code', async () => {
      const res = await request(app).post('/api/match/join').send({
        joinCode: 'XXXXXX',
        playerAddress: 'kaspa:player_b',
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Match not found');
    });

    it('rejects joining own match', async () => {
      const createRes = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:same_player',
        betAmount: 1.0,
      });
      const { joinCode } = createRes.body;

      const joinRes = await request(app).post('/api/match/join').send({
        joinCode,
        playerAddress: 'kaspa:same_player',
      });

      expect(joinRes.status).toBe(400);
      expect(joinRes.body.error).toBe('Cannot join your own match');
    });

    it('rejects joining already joined match', async () => {
      // Create and join a match
      const createRes = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:player_a',
        betAmount: 1.0,
      });
      const { joinCode } = createRes.body;

      await request(app).post('/api/match/join').send({
        joinCode,
        playerAddress: 'kaspa:player_b',
      });

      // Try to join again
      const joinRes = await request(app).post('/api/match/join').send({
        joinCode,
        playerAddress: 'kaspa:player_c',
      });

      expect(joinRes.status).toBe(400);
      expect(joinRes.body.error).toBe('Match is not available for joining');
    });
  });

  describe('GET /api/match/:id', () => {
    it('returns match by ID', async () => {
      const createRes = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:player_a',
        betAmount: 0.5,
      });
      const { matchId } = createRes.body;

      const res = await request(app).get(`/api/match/${matchId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(matchId);
      expect(res.body.status).toBe('waiting');
      expect(res.body.betAmount).toBe(0.5);
    });

    it('returns 404 for non-existent match', async () => {
      const res = await request(app).get('/api/match/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Match not found');
    });
  });

  describe('GET /api/match/code/:joinCode', () => {
    it('returns match by join code', async () => {
      const createRes = await request(app).post('/api/match/create').send({
        playerAddress: 'kaspa:player_a',
        betAmount: 0.5,
      });
      const { joinCode, matchId } = createRes.body;

      const res = await request(app).get(`/api/match/code/${joinCode}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(matchId);
      expect(res.body.joinCode).toBe(joinCode);
    });

    it('returns 404 for non-existent join code', async () => {
      const res = await request(app).get('/api/match/code/XXXXXX');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Match not found');
    });
  });
});
