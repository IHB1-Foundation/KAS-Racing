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
  getKaspaRestClient,
  getRestApiUrl,
  KaspaRestClient,
} from './kaspaRestClient.js';

export type {
  RestUtxoEntry,
  SubmitTxRequest,
  TxAcceptanceResponse,
  FeeEstimateResponse,
} from './kaspaRestClient.js';
