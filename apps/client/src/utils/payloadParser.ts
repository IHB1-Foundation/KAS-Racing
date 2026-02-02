/**
 * Payload Parser for Proof-of-Action
 *
 * Parses KAS Racing payload strings embedded in transactions.
 * Format: KASRACE1|net|mode|sessionId|event|seq|commit
 */

export const PAYLOAD_VERSION = 'KASRACE1';

export type PayloadEvent = 'checkpoint' | 'settle' | 'deposit';
export type PayloadMode = 'free_run' | 'duel';
export type PayloadNetwork = 'mainnet' | 'testnet';

export interface ParsedPayload {
  version: string;
  network: PayloadNetwork;
  mode: PayloadMode;
  sessionId: string;
  event: PayloadEvent;
  seq: number;
  commit: string;
}

/**
 * Human-readable labels for payload fields
 */
export const LABELS = {
  network: {
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  mode: {
    free_run: 'Free Run',
    duel: 'Duel (1v1)',
  },
  event: {
    checkpoint: 'Checkpoint Collected',
    settle: 'Match Settlement',
    deposit: 'Bet Deposit',
  },
};

/**
 * Parse a payload string into its components
 */
export function parsePayload(payloadStr: string): ParsedPayload | null {
  // Check if string starts with our version prefix
  if (!payloadStr.startsWith(PAYLOAD_VERSION)) {
    return null;
  }

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
    case 'c':
      event = 'checkpoint';
      break;
    case 's':
      event = 'settle';
      break;
    case 'd':
      event = 'deposit';
      break;
    default:
      return null;
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
 * Check if a string looks like a KAS Racing payload
 */
export function isKasRacingPayload(str: string): boolean {
  return str.startsWith(PAYLOAD_VERSION);
}
