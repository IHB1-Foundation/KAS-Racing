/**
 * Indexer Types
 *
 * Event types for the Kaspa chain indexer.
 * Kaspa uses a DAG (BlockDAG) with DAA scores instead of linear block heights.
 */

export type ChainEventType =
  | 'deposit'
  | 'settlement'
  | 'refund'
  | 'reward_payout';

export interface ChainEvent {
  id: string;
  txid: string;
  eventType: ChainEventType;
  matchId: string | null;
  sessionId: string | null;
  fromAddress: string;
  toAddress: string;
  amountSompi: bigint;
  daaScore: number | null;
  acceptedAt: Date | null;
  includedAt: Date | null;
  confirmedAt: Date | null;
  confirmations: number;
  payload: string | null;
  indexedAt: Date;
}

export interface IndexerState {
  lastProcessedDaaScore: number;
  lastRunAt: Date;
  watchedAddresses: string[];
  eventsProcessed: number;
}

export interface IndexerConfig {
  databaseUrl: string;
  network: 'mainnet' | 'testnet';
  apiBaseUrl: string;
  pollIntervalMs: number;
  idlePollIntervalMs: number;
  startDaaScore: number;
  watchAddresses: string[];
}

export interface KaspaTransaction {
  transaction_id: string;
  inputs: Array<{
    previous_outpoint_hash: string;
    previous_outpoint_index: number;
    script_public_key_address?: string;
  }>;
  outputs: Array<{
    amount: number;
    script_public_key_address: string;
    script_public_key_type?: string;
  }>;
  block_hash?: string[];
  accepting_block_hash?: string;
  accepting_block_blue_score?: number;
  is_accepted?: boolean;
}

export interface AddressUtxo {
  address: string;
  outpoint: {
    transactionId: string;
    index: number;
  };
  utxoEntry: {
    amount: string;
    scriptPublicKey: {
      scriptPublicKey: string;
    };
    blockDaaScore: string;
    isCoinbase: boolean;
  };
}
