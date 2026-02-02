import { describe, expect, it, beforeAll } from 'vitest';
import {
  PAYLOAD_VERSION,
  initPayloadSeed,
  generatePayload,
  parsePayload,
  generateCommit,
  isPayloadValid,
  MAX_PAYLOAD_LENGTH,
} from './index.js';

describe('Payload Module', () => {
  beforeAll(() => {
    // Initialize with a test seed
    initPayloadSeed('test-seed-for-unit-tests');
  });

  describe('generatePayload', () => {
    it('generates valid payload string', () => {
      const payload = generatePayload({
        network: 'mainnet',
        mode: 'free_run',
        sessionId: 'abc12345-6789',
        event: 'checkpoint',
        seq: 5,
        seed: 'test-seed',
      });

      expect(payload).toBeDefined();
      expect(payload.startsWith(PAYLOAD_VERSION)).toBe(true);
      expect(payload.split('|').length).toBe(7);
    });

    it('uses short codes for network and mode', () => {
      const payload = generatePayload({
        network: 'testnet',
        mode: 'duel',
        sessionId: 'test1234',
        event: 'settle',
        seq: 1,
        seed: 'test-seed',
      });

      const parts = payload.split('|');
      expect(parts[1]).toBe('t'); // testnet
      expect(parts[2]).toBe('d'); // duel
      expect(parts[4]).toBe('s'); // settle
    });

    it('truncates sessionId to 8 chars', () => {
      const payload = generatePayload({
        network: 'mainnet',
        mode: 'free_run',
        sessionId: 'verylongsessionid12345',
        event: 'checkpoint',
        seq: 1,
        seed: 'test-seed',
      });

      const parts = payload.split('|');
      expect(parts[3]).toBe('verylong');
      expect(parts[3]?.length).toBe(8);
    });

    it('generates commit of 16 chars', () => {
      const payload = generatePayload({
        network: 'mainnet',
        mode: 'free_run',
        sessionId: 'test1234',
        event: 'checkpoint',
        seq: 1,
        seed: 'test-seed',
      });

      const parts = payload.split('|');
      expect(parts[6]?.length).toBe(16);
    });
  });

  describe('parsePayload', () => {
    it('parses valid payload', () => {
      const original = generatePayload({
        network: 'mainnet',
        mode: 'free_run',
        sessionId: 'session1',
        event: 'checkpoint',
        seq: 3,
        seed: 'test-seed',
      });

      const parsed = parsePayload(original);

      expect(parsed).not.toBeNull();
      expect(parsed?.version).toBe(PAYLOAD_VERSION);
      expect(parsed?.network).toBe('mainnet');
      expect(parsed?.mode).toBe('free_run');
      expect(parsed?.event).toBe('checkpoint');
      expect(parsed?.seq).toBe(3);
    });

    it('returns null for invalid payload', () => {
      expect(parsePayload('invalid')).toBeNull();
      expect(parsePayload('a|b|c')).toBeNull();
      expect(parsePayload('WRONG|m|f|sess|c|1|abcd1234abcd1234')).toBeNull();
    });

    it('parses all event types', () => {
      const events = ['checkpoint', 'settle', 'deposit'] as const;

      for (const event of events) {
        const payload = generatePayload({
          network: 'mainnet',
          mode: 'free_run',
          sessionId: 'test',
          event,
          seq: 1,
          seed: 'test-seed',
        });

        const parsed = parsePayload(payload);
        expect(parsed?.event).toBe(event);
      }
    });
  });

  describe('generateCommit', () => {
    it('generates deterministic commit for same inputs', () => {
      const commit1 = generateCommit('session1', 1, 'checkpoint', 'seed1');
      const commit2 = generateCommit('session1', 1, 'checkpoint', 'seed1');

      expect(commit1).toBe(commit2);
    });

    it('generates different commit for different inputs', () => {
      const commit1 = generateCommit('session1', 1, 'checkpoint', 'seed1');
      const commit2 = generateCommit('session2', 1, 'checkpoint', 'seed1');
      const commit3 = generateCommit('session1', 2, 'checkpoint', 'seed1');
      const commit4 = generateCommit('session1', 1, 'settle', 'seed1');

      expect(commit1).not.toBe(commit2);
      expect(commit1).not.toBe(commit3);
      expect(commit1).not.toBe(commit4);
    });

    it('generates 16-char hex string', () => {
      const commit = generateCommit('session1', 1, 'checkpoint', 'seed1');

      expect(commit.length).toBe(16);
      expect(/^[0-9a-f]+$/.test(commit)).toBe(true);
    });
  });

  describe('isPayloadValid', () => {
    it('returns true for valid payload within size limit', () => {
      const payload = generatePayload({
        network: 'mainnet',
        mode: 'free_run',
        sessionId: 'test1234',
        event: 'checkpoint',
        seq: 1,
        seed: 'test-seed',
      });

      expect(isPayloadValid(payload)).toBe(true);
    });

    it('returns false for payload exceeding size limit', () => {
      const longPayload = 'x'.repeat(MAX_PAYLOAD_LENGTH + 1);
      expect(isPayloadValid(longPayload)).toBe(false);
    });
  });
});
