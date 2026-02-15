import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { db, matches } from '../db/index.js';
import { randomUUID } from 'crypto';

// Mock the txStatusService before importing depositTrackingService
vi.mock('./txStatusService.js', () => ({
  fetchTxStatus: vi.fn(),
}));

// Mock the ws module
vi.mock('../ws/index.js', () => ({
  emitMatchUpdated: vi.fn(),
  emitChainStateChanged: vi.fn(),
  emitMatchStateChanged: vi.fn(),
}));

// Now import the mocked modules and the service under test
import { fetchTxStatus } from './txStatusService.js';
import { emitMatchUpdated } from '../ws/index.js';
import {
  updateMatchDepositStatus,
  getMatchesWithPendingDeposits,
  updateAllPendingDeposits,
} from './depositTrackingService.js';

const mockedFetchTxStatus = vi.mocked(fetchTxStatus);
const mockedEmitMatchUpdated = vi.mocked(emitMatchUpdated);

describe('Deposit Tracking Service', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(matches);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('updateMatchDepositStatus', () => {
    it('updates deposit status from broadcasted to accepted', async () => {
      // Create a match with a broadcasted deposit
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'TEST01',
        playerAAddress: 'kaspa:player_a',
        playerBAddress: 'kaspa:player_b',
        betAmount: 1.0,
        status: 'deposits_pending',
        playerADepositTxid: 'txid-a',
        playerADepositStatus: 'broadcasted',
        createdAt: new Date(),
      });

      // Mock API response
      mockedFetchTxStatus.mockResolvedValue({
        accepted: true,
        included: false,
      });

      const result = await updateMatchDepositStatus(matchId, 'A', 'txid-a');

      expect(result.updated).toBe(true);
      expect(result.oldStatus).toBe('broadcasted');
      expect(result.newStatus).toBe('accepted');
      expect(mockedEmitMatchUpdated).toHaveBeenCalled();
    });

    it('updates deposit status from accepted to included', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'TEST02',
        playerAAddress: 'kaspa:player_a',
        playerBAddress: 'kaspa:player_b',
        betAmount: 1.0,
        status: 'deposits_pending',
        playerADepositTxid: 'txid-a',
        playerADepositStatus: 'accepted',
        createdAt: new Date(),
      });

      mockedFetchTxStatus.mockResolvedValue({
        accepted: true,
        included: true,
        confirmations: 1,
      });

      const result = await updateMatchDepositStatus(matchId, 'A', 'txid-a');

      expect(result.updated).toBe(true);
      expect(result.oldStatus).toBe('accepted');
      expect(result.newStatus).toBe('included');
    });

    it('transitions match to ready when both deposits are accepted', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'TEST03',
        playerAAddress: 'kaspa:player_a',
        playerBAddress: 'kaspa:player_b',
        betAmount: 1.0,
        status: 'deposits_pending',
        playerADepositTxid: 'txid-a',
        playerADepositStatus: 'accepted',
        playerBDepositTxid: 'txid-b',
        playerBDepositStatus: 'broadcasted',
        createdAt: new Date(),
      });

      mockedFetchTxStatus.mockResolvedValue({
        accepted: true,
        included: false,
      });

      const result = await updateMatchDepositStatus(matchId, 'B', 'txid-b');

      expect(result.updated).toBe(true);
      expect(result.newStatus).toBe('accepted');
      expect(result.matchReadyChanged).toBe(true);

      // Verify match status changed to ready
      const updatedMatch = await db.select().from(matches).limit(1);
      expect(updatedMatch[0]?.status).toBe('ready');
    });

    it('does not transition to ready if only one deposit is accepted', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'TEST04',
        playerAAddress: 'kaspa:player_a',
        playerBAddress: 'kaspa:player_b',
        betAmount: 1.0,
        status: 'deposits_pending',
        playerADepositTxid: 'txid-a',
        playerADepositStatus: 'broadcasted',
        // No player B deposit yet
        createdAt: new Date(),
      });

      mockedFetchTxStatus.mockResolvedValue({
        accepted: true,
        included: false,
      });

      const result = await updateMatchDepositStatus(matchId, 'A', 'txid-a');

      expect(result.updated).toBe(true);
      expect(result.matchReadyChanged).toBe(false);

      // Match should still be deposits_pending
      const updatedMatch = await db.select().from(matches).limit(1);
      expect(updatedMatch[0]?.status).toBe('deposits_pending');
    });

    it('skips update if deposit is already confirmed', async () => {
      const matchId = randomUUID();
      await db.insert(matches).values({
        id: matchId,
        joinCode: 'TEST05',
        playerAAddress: 'kaspa:player_a',
        playerBAddress: 'kaspa:player_b',
        betAmount: 1.0,
        status: 'deposits_pending',
        playerADepositTxid: 'txid-a',
        playerADepositStatus: 'confirmed',
        createdAt: new Date(),
      });

      const result = await updateMatchDepositStatus(matchId, 'A', 'txid-a');

      expect(result.updated).toBe(false);
      expect(mockedFetchTxStatus).not.toHaveBeenCalled();
    });

    it('throws error for non-existent match', async () => {
      await expect(
        updateMatchDepositStatus('non-existent-id', 'A', 'txid')
      ).rejects.toThrow('Match non-existent-id not found');
    });
  });

  describe('getMatchesWithPendingDeposits', () => {
    it('returns matches with pending deposits', async () => {
      // Create matches with various states
      await db.insert(matches).values([
        {
          id: randomUUID(),
          joinCode: 'PEND01',
          playerAAddress: 'kaspa:a',
          playerBAddress: 'kaspa:b',
          betAmount: 1.0,
          status: 'deposits_pending',
          playerADepositTxid: 'txid-1',
          playerADepositStatus: 'broadcasted',
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          joinCode: 'READY1',
          playerAAddress: 'kaspa:c',
          playerBAddress: 'kaspa:d',
          betAmount: 1.0,
          status: 'ready', // Already ready, should not be included
          playerADepositTxid: 'txid-2',
          playerADepositStatus: 'confirmed',
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          joinCode: 'WAIT01',
          playerAAddress: 'kaspa:e',
          betAmount: 1.0,
          status: 'waiting', // No deposits yet
          createdAt: new Date(),
        },
      ]);

      const pending = await getMatchesWithPendingDeposits();

      expect(pending.length).toBe(1);
      expect(pending[0]?.joinCode).toBe('PEND01');
    });
  });

  describe('updateAllPendingDeposits', () => {
    it('updates all pending deposits', async () => {
      await db.insert(matches).values({
        id: randomUUID(),
        joinCode: 'BATCH1',
        playerAAddress: 'kaspa:a',
        playerBAddress: 'kaspa:b',
        betAmount: 1.0,
        status: 'deposits_pending',
        playerADepositTxid: 'txid-a',
        playerADepositStatus: 'broadcasted',
        playerBDepositTxid: 'txid-b',
        playerBDepositStatus: 'broadcasted',
        createdAt: new Date(),
      });

      mockedFetchTxStatus.mockResolvedValue({
        accepted: true,
        included: false,
      });

      const result = await updateAllPendingDeposits();

      expect(result.matchesChecked).toBe(1);
      expect(result.depositsUpdated).toBe(2); // Both A and B updated
      expect(result.matchesReady).toBe(1); // Match transitioned to ready
    });
  });
});
