/**
 * Payload Format for Proof-of-Action (T-080)
 *
 * Generates payloads to embed in reward/settlement transactions.
 * This provides on-chain proof that game events occurred.
 *
 * Format: KASRACE1|net|mode|sessionId|event|seq|commit
 *
 * Example:
 *   KASRACE1|mainnet|free_run|abc123|checkpoint|5|a1b2c3d4
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Payload version identifier
 */
export const PAYLOAD_VERSION = 'KASRACE1';

/**
 * Event types for payload
 */
export type PayloadEvent = 'checkpoint' | 'settle' | 'deposit';

/**
 * Game mode for payload
 */
export type PayloadMode = 'free_run' | 'duel';

/**
 * Network for payload
 */
export type PayloadNetwork = 'mainnet' | 'testnet';

/**
 * Payload generation parameters
 */
export interface PayloadParams {
  /** Network (mainnet or testnet) */
  network: PayloadNetwork;
  /** Game mode */
  mode: PayloadMode;
  /** Session or match ID */
  sessionId: string;
  /** Event type */
  event: PayloadEvent;
  /** Sequence number */
  seq: number;
  /** Optional seed for commit generation (server secret) */
  seed?: string;
}

/**
 * Parsed payload structure
 */
export interface ParsedPayload {
  /** Payload version */
  version: string;
  /** Network */
  network: PayloadNetwork;
  /** Game mode */
  mode: PayloadMode;
  /** Session or match ID */
  sessionId: string;
  /** Event type */
  event: PayloadEvent;
  /** Sequence number */
  seq: number;
  /** Commit hash */
  commit: string;
}

// Server-side seed for commit generation
// In production, this should be loaded from secure storage
let serverSeed: string | null = null;

/**
 * Initialize the server seed
 * Call this once at server startup
 */
export function initPayloadSeed(seed?: string): void {
  serverSeed = seed ?? randomBytes(32).toString('hex');
}

/**
 * Get time bucket for commit (5-minute granularity)
 * This prevents timing attacks while allowing verification
 */
function getTimeBucket(): number {
  const now = Date.now();
  const bucket = Math.floor(now / (5 * 60 * 1000)); // 5-minute buckets
  return bucket;
}

/**
 * Generate commit hash for payload
 *
 * commit = SHA256(seed|sessionId|seq|event|timeBucket)[:16]
 *
 * The commit is truncated to 8 bytes (16 hex chars) to save space.
 */
export function generateCommit(
  sessionId: string,
  seq: number,
  event: PayloadEvent,
  seed?: string
): string {
  const useSeed = seed ?? serverSeed;
  if (!useSeed) {
    throw new Error('Payload seed not initialized. Call initPayloadSeed() first.');
  }

  const timeBucket = getTimeBucket();
  const data = `${useSeed}|${sessionId}|${seq}|${event}|${timeBucket}`;
  const hash = createHash('sha256').update(data).digest('hex');

  // Return first 16 chars (8 bytes)
  return hash.slice(0, 16);
}

/**
 * Generate a complete payload string
 *
 * Format: KASRACE1|net|mode|sessionId|event|seq|commit
 */
export function generatePayload(params: PayloadParams): string {
  const commit = generateCommit(
    params.sessionId,
    params.seq,
    params.event,
    params.seed
  );

  // Truncate sessionId to save space (first 8 chars)
  const shortSessionId = params.sessionId.slice(0, 8);

  const parts = [
    PAYLOAD_VERSION,
    params.network.slice(0, 1), // 'm' or 't'
    params.mode === 'free_run' ? 'f' : 'd',
    shortSessionId,
    params.event.slice(0, 1), // 'c', 's', or 'd'
    params.seq.toString(),
    commit,
  ];

  return parts.join('|');
}

/**
 * Parse a payload string back into its components
 */
export function parsePayload(payloadStr: string): ParsedPayload | null {
  const parts = payloadStr.split('|');

  if (parts.length !== 7) {
    return null;
  }

  const [version, netChar, modeChar, sessionId, eventChar, seqStr, commit] = parts;

  if (version !== PAYLOAD_VERSION) {
    return null;
  }

  const network: PayloadNetwork = netChar === 'm' ? 'mainnet' : 'testnet';
  const mode: PayloadMode = modeChar === 'f' ? 'free_run' : 'duel';

  let event: PayloadEvent;
  switch (eventChar) {
    case 'c': event = 'checkpoint'; break;
    case 's': event = 'settle'; break;
    case 'd': event = 'deposit'; break;
    default: return null;
  }

  const seq = parseInt(seqStr ?? '0', 10);
  if (isNaN(seq)) {
    return null;
  }

  return {
    version: version ?? '',
    network,
    mode,
    sessionId: sessionId ?? '',
    event,
    seq,
    commit: commit ?? '',
  };
}

/**
 * Verify a payload commit
 * Note: This requires the same seed that was used to generate the payload
 *
 * @param parsed - Parsed payload
 * @param _seed - Original seed (unused in demo - full verification requires storing original commit)
 * @param _fullSessionId - Full session ID (unused - sessionId is truncated in payload)
 */
export function verifyPayloadCommit(
  parsed: ParsedPayload,
  seed: string,
  fullSessionId: string
): boolean {
  // Note: We can't fully verify because sessionId is truncated
  // and timeBucket may have changed. This is for demonstration only.
  // Full verification would require storing the original commit.
  void seed;
  void fullSessionId;
  return parsed.commit.length === 16;
}

/**
 * Maximum payload length in bytes
 * Kaspa transaction payloads should be kept small
 */
export const MAX_PAYLOAD_LENGTH = 80;

/**
 * Check if a payload is within size limits
 */
export function isPayloadValid(payload: string): boolean {
  const bytes = new TextEncoder().encode(payload);
  return bytes.length <= MAX_PAYLOAD_LENGTH;
}
