/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the db module
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock tx module
vi.mock('../tx/index.js', () => ({
  sendRewardPayout: vi.fn(),
  kasToSompi: (kas: number) => BigInt(Math.floor(kas * 100_000_000)),
}));

// Mock config
vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    network: 'testnet',
    minRewardSompi: BigInt(2_000_000),
  }),
}));

// Mock payload module
vi.mock('../payload/index.js', () => ({
  generatePayload: vi.fn().mockReturnValue('KASRACE1|t|f|session-|c|1|a1b2c3d4e5f6g7h8'),
  isPayloadValid: vi.fn().mockReturnValue(true),
}));

import { db } from '../db/index.js';
import { sendRewardPayout } from '../tx/index.js';
import { generatePayload, isPayloadValid } from '../payload/index.js';
import {
  findRewardEvent,
  processRewardRequest,
  updateRewardEventStatus,
} from './rewardService.js';

describe('rewardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset payload mock defaults
    vi.mocked(generatePayload).mockReturnValue('KASRACE1|t|f|session-|c|1|a1b2c3d4e5f6g7h8');
    vi.mocked(isPayloadValid).mockReturnValue(true);
  });

  describe('findRewardEvent', () => {
    it('should return null when no event exists', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await findRewardEvent('session-1', 1);
      expect(result).toBeNull();
    });

    it('should return existing event', async () => {
      const existingEvent = {
        id: 'event-1',
        sessionId: 'session-1',
        seq: 1,
        rewardAmount: 0.02,
        txid: 'tx-123',
        txStatus: 'broadcasted',
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingEvent]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await findRewardEvent('session-1', 1);
      expect(result).toEqual(existingEvent);
    });
  });

  describe('processRewardRequest', () => {
    it('should return existing event for duplicate request (idempotency)', async () => {
      const existingEvent = {
        id: 'event-1',
        sessionId: 'session-1',
        seq: 1,
        rewardAmount: 0.02,
        txid: 'tx-123',
        txStatus: 'broadcasted',
      };

      // Mock findRewardEvent to return existing event
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingEvent]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await processRewardRequest({
        sessionId: 'session-1',
        seq: 1,
        rewardAmountKas: 0.02,
      });

      expect(result.isNew).toBe(false);
      expect(result.eventId).toBe('event-1');
      expect(result.txid).toBe('tx-123');
      expect(result.txStatus).toBe('broadcasted');
      // sendRewardPayout should NOT be called for duplicate
      expect(sendRewardPayout).not.toHaveBeenCalled();
    });

    it('should create new event and broadcast with payload for new request', async () => {
      const session = {
        id: 'session-1',
        userAddress: 'kaspa:qtest123',
        status: 'active',
        eventCount: 0,
        mode: 'free_run',
      };

      let selectCallCount = 0;
      // First call: findRewardEvent returns empty
      // Second call: getSession returns session
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return Promise.resolve([]); // No existing event
              }
              return Promise.resolve([session]); // Session found
            }),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      // Mock insert
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      // Mock update
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate);

      // Mock sendRewardPayout success
      vi.mocked(sendRewardPayout).mockResolvedValue({
        txid: 'new-tx-456',
        amountSompi: BigInt(2_000_000),
        feeSompi: BigInt(5000),
      });

      const result = await processRewardRequest({
        sessionId: 'session-1',
        seq: 1,
        rewardAmountKas: 0.02,
      });

      expect(result.isNew).toBe(true);
      expect(result.txid).toBe('new-tx-456');
      expect(result.txStatus).toBe('broadcasted');

      // Verify payload was generated
      expect(generatePayload).toHaveBeenCalledWith({
        network: 'testnet',
        mode: 'free_run',
        sessionId: 'session-1',
        event: 'checkpoint',
        seq: 1,
      });

      // Verify sendRewardPayout was called with payload
      expect(sendRewardPayout).toHaveBeenCalledWith({
        toAddress: 'kaspa:qtest123',
        amountSompi: BigInt(2_000_000),
        payload: 'KASRACE1|t|f|session-|c|1|a1b2c3d4e5f6g7h8',
      });
    });

    it('should mark as failed when broadcast fails', async () => {
      const session = {
        id: 'session-1',
        userAddress: 'kaspa:qtest123',
        status: 'active',
        eventCount: 0,
        mode: 'free_run',
      };

      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return Promise.resolve([]);
              }
              return Promise.resolve([session]);
            }),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate);

      // Mock sendRewardPayout failure
      vi.mocked(sendRewardPayout).mockRejectedValue(new Error('Network error'));

      const result = await processRewardRequest({
        sessionId: 'session-1',
        seq: 1,
        rewardAmountKas: 0.02,
      });

      expect(result.isNew).toBe(true);
      expect(result.txid).toBeNull();
      expect(result.txStatus).toBe('failed');
      expect(result.error).toBe('Network error');
    });

    it('should skip payload when it exceeds size limit', async () => {
      const session = {
        id: 'session-1',
        userAddress: 'kaspa:qtest123',
        status: 'active',
        eventCount: 0,
        mode: 'free_run',
      };

      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return Promise.resolve([]);
              }
              return Promise.resolve([session]);
            }),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate);

      // Mock payload too large
      vi.mocked(isPayloadValid).mockReturnValueOnce(false);

      vi.mocked(sendRewardPayout).mockResolvedValue({
        txid: 'new-tx-789',
        amountSompi: BigInt(2_000_000),
        feeSompi: BigInt(5000),
      });

      const result = await processRewardRequest({
        sessionId: 'session-1',
        seq: 1,
        rewardAmountKas: 0.02,
      });

      expect(result.txid).toBe('new-tx-789');
      // Verify sendRewardPayout was called without payload
      expect(sendRewardPayout).toHaveBeenCalledWith({
        toAddress: 'kaspa:qtest123',
        amountSompi: BigInt(2_000_000),
        payload: undefined,
      });
    });

    it('should reject when session is not active', async () => {
      const session = {
        id: 'session-1',
        userAddress: 'kaspa:qtest123',
        status: 'ended',
        eventCount: 5,
      };

      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return Promise.resolve([]);
              }
              return Promise.resolve([session]);
            }),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      await expect(
        processRewardRequest({
          sessionId: 'session-1',
          seq: 1,
          rewardAmountKas: 0.02,
        })
      ).rejects.toThrow('Session is not active');
    });
  });

  describe('updateRewardEventStatus', () => {
    it('should update status with timestamp', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate);

      await updateRewardEventStatus('event-1', 'accepted');

      expect(db.update).toHaveBeenCalled();
    });

    it('should update txid when provided', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate);

      await updateRewardEventStatus('event-1', 'broadcasted', 'tx-new');

      expect(db.update).toHaveBeenCalled();
    });
  });
});
