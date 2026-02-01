/**
 * Transaction Module
 *
 * Handles Kaspa transaction building, signing, and broadcasting.
 */

export {
  sendRewardPayout,
  kasToSompi,
  sompiToKas,
  isAboveDust,
  SOMPI_PER_KAS,
  DEFAULT_PRIORITY_FEE_SOMPI,
  MIN_OUTPUT_SOMPI,
} from './rewardPayout.js';

export type { PayoutRequest, PayoutResult } from './rewardPayout.js';

export {
  getKaspaClient,
  getKaspaWasm,
  disconnectKaspa,
  isKaspaConnected,
  getRpcUrl,
} from './kaspaClient.js';

export type { UtxoEntry, IKaspaRpc } from './kaspaClient.js';
