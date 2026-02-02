import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { db, matches } from '../db/index.js';
import { randomUUID } from 'crypto';

// Mock dependencies
vi.mock('../tx/rewardPayout.js', () => ({
  sendRewardPayout: vi.fn(),
  kasToSompi: vi.fn((kas: number) => BigInt(Math.floor(kas * 100_000_000))),
}));

vi.mock('../ws/index.js', () => ({
  emitMatchUpdated: vi.fn(),
}));

import { sendRewardPayout } from '../tx/rewardPayout.js';
import { emitMatchUpdated } from '../ws/index.js';
import { processSettlement } from './settlementService.js';

const mockedSendRewardPayout = vi.mocked(sendRewardPayout);
const mockedEmitMatchUpdated = vi.mocked(emitMatchUpdated);

describe('Settlement Service', () => {
  beforeEach(async () => {
    await db.delete(matches);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processSettlement', () => {
    it('settles match with player A as winner', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'SETTLE',
        playerAAddress: 'kaspa:winner_a',
        playerBAddress: 'kaspa:loser_b',
        betAmount: 1.0,
        status: 'finished',
        winnerId: 'A',
        playerAScore: 5000,
        playerBScore: 3000,
        playerADepositTxid: 'deposit-a',
        playerADepositStatus: 'confirmed',
        playerBDepositTxid: 'deposit-b',
        playerBDepositStatus: 'confirmed',
        createdAt: new Date(),
        finishedAt: new Date(),
      });

      mockedSendRewardPayout.mockResolvedValue({
        txid: 'settle-tx-123',
        amountSompi: BigInt(200_000_000), // 2 KAS
        feeSompi: BigInt(5000),
      });

      const result = await processSettlement(matchId);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe('A');
      expect(result.winnerAddress).toBe('kaspa:winner_a');
      expect(result.settleTxid).toBe('settle-tx-123');
      expect(mockedSendRewardPayout).toHaveBeenCalledWith({
        toAddress: 'kaspa:winner_a',
        amountSompi: BigInt(200_000_000),
        payload: `KASRACE|settle|${matchId}`,
      });
      expect(mockedEmitMatchUpdated).toHaveBeenCalled();
    });

    it('settles match with player B as winner', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'SETTB',
        playerAAddress: 'kaspa:loser_a',
        playerBAddress: 'kaspa:winner_b',
        betAmount: 0.5,
        status: 'finished',
        winnerId: 'B',
        playerAScore: 2000,
        playerBScore: 4000,
        createdAt: new Date(),
        finishedAt: new Date(),
      });

      mockedSendRewardPayout.mockResolvedValue({
        txid: 'settle-tx-456',
        amountSompi: BigInt(100_000_000),
        feeSompi: BigInt(5000),
      });

      const result = await processSettlement(matchId);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe('B');
      expect(result.winnerAddress).toBe('kaspa:winner_b');
      expect(result.settleTxid).toBe('settle-tx-456');
    });

    it('handles draw without payout', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'DRAW01',
        playerAAddress: 'kaspa:player_a',
        playerBAddress: 'kaspa:player_b',
        betAmount: 1.0,
        status: 'finished',
        winnerId: 'draw',
        playerAScore: 3000,
        playerBScore: 3000,
        createdAt: new Date(),
        finishedAt: new Date(),
      });

      const result = await processSettlement(matchId);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe('draw');
      expect(result.settleTxid).toBeNull();
      expect(mockedSendRewardPayout).not.toHaveBeenCalled();
    });

    it('returns existing settlement if already settled', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'ALRDY',
        playerAAddress: 'kaspa:winner',
        playerBAddress: 'kaspa:loser',
        betAmount: 1.0,
        status: 'finished',
        winnerId: 'A',
        settleTxid: 'existing-settle-tx',
        settleStatus: 'confirmed',
        createdAt: new Date(),
        finishedAt: new Date(),
      });

      const result = await processSettlement(matchId);

      expect(result.success).toBe(true);
      expect(result.settleTxid).toBe('existing-settle-tx');
      expect(mockedSendRewardPayout).not.toHaveBeenCalled();
    });

    it('fails for non-existent match', async () => {
      const result = await processSettlement('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Match not found');
    });

    it('fails for match not finished', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'NOTFIN',
        playerAAddress: 'kaspa:a',
        playerBAddress: 'kaspa:b',
        betAmount: 1.0,
        status: 'playing',
        createdAt: new Date(),
      });

      const result = await processSettlement(matchId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not finished');
    });

    it('handles broadcast failure', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'FAIL01',
        playerAAddress: 'kaspa:winner',
        playerBAddress: 'kaspa:loser',
        betAmount: 1.0,
        status: 'finished',
        winnerId: 'A',
        createdAt: new Date(),
        finishedAt: new Date(),
      });

      mockedSendRewardPayout.mockRejectedValue(new Error('Insufficient funds'));

      const result = await processSettlement(matchId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');

      // Check that status is marked as failed
      const updated = await db.select().from(matches).limit(1);
      expect(updated[0]?.settleStatus).toBe('failed');
    });
  });
});
