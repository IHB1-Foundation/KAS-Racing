/**
 * Transaction Module
 *
 * Handles Kaspa transaction building, signing, and broadcasting.
 */

export {
  sendRewardPayout,
  kasToSompi,
  sompiToKas,
  SOMPI_PER_KAS,
  DEFAULT_FEE_SOMPI,
} from './rewardPayout.js';

export type { PayoutRequest, PayoutResult } from './rewardPayout.js';

export {
  getKaspaClient,
  disconnectKaspa,
  getRpcUrl,
} from './kaspaClient.js';

export type { UtxoEntry, KaspaRpcClient } from './kaspaClient.js';
