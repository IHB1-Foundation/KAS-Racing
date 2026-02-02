/**
 * Kaspa REST API Client
 *
 * Provides UTXO queries and transaction submission via REST API.
 * Uses api.kaspa.org (mainnet) or api-tn11.kaspa.org (testnet).
 */

import type { Network } from '../config/index.js';

// UTXO response from REST API
export interface RestUtxoEntry {
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

// Transaction submission request
export interface SubmitTxRequest {
  transaction: {
    version: number;
    inputs: Array<{
      previousOutpoint: {
        transactionId: string;
        index: number;
      };
      signatureScript: string;
      sequence: number;
      sigOpCount: number;
    }>;
    outputs: Array<{
      amount: number;
      scriptPublicKey: {
        version: number;
        scriptPublicKey: string;
      };
    }>;
    lockTime: number;
    subnetworkId: string;
  };
  allowOrphan: boolean;
}

// Transaction acceptance response
export interface TxAcceptanceResponse {
  transactionId: string;
  accepted: boolean;
  acceptingBlockHash?: string;
  acceptingBlueScore?: number;
  acceptingTimestamp?: number;
}

// Fee estimate response
export interface FeeEstimateResponse {
  priorityBucket: {
    feerate: number;
    estimatedSeconds: number;
  };
  normalBuckets: Array<{
    feerate: number;
    estimatedSeconds: number;
  }>;
  lowBuckets: Array<{
    feerate: number;
    estimatedSeconds: number;
  }>;
}

/**
 * Get REST API base URL for network
 */
export function getRestApiUrl(network: Network): string {
  if (network === 'mainnet') {
    return 'https://api.kaspa.org';
  }
  // Testnet-11
  return 'https://api-tn11.kaspa.org';
}

/**
 * Kaspa REST API Client
 */
export class KaspaRestClient {
  private baseUrl: string;
  private network: Network;

  constructor(network: Network) {
    this.network = network;
    this.baseUrl = getRestApiUrl(network);
  }

  /**
   * Fetch with error handling
   */
  private async fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    console.log(`[kaspa-rest] ${options?.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`REST API error: ${response.status} ${response.statusText} - ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get UTXOs for an address
   */
  async getUtxosByAddress(address: string): Promise<RestUtxoEntry[]> {
    return this.fetchJson<RestUtxoEntry[]>(`/addresses/${address}/utxos`);
  }

  /**
   * Get UTXOs for multiple addresses
   */
  async getUtxosByAddresses(addresses: string[]): Promise<RestUtxoEntry[]> {
    return this.fetchJson<RestUtxoEntry[]>('/addresses/utxos', {
      method: 'POST',
      body: JSON.stringify({ addresses }),
    });
  }

  /**
   * Submit a transaction
   */
  async submitTransaction(request: SubmitTxRequest): Promise<{ transactionId?: string; error?: string }> {
    return this.fetchJson('/transactions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get transaction acceptance status
   */
  async getTransactionAcceptance(transactionIds: string[]): Promise<TxAcceptanceResponse[]> {
    return this.fetchJson('/transactions/acceptance', {
      method: 'POST',
      body: JSON.stringify({ transactionIds }),
    });
  }

  /**
   * Get fee estimate
   */
  async getFeeEstimate(): Promise<FeeEstimateResponse> {
    return this.fetchJson('/info/fee-estimate');
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string): Promise<{ address: string; balance: number }> {
    return this.fetchJson(`/addresses/${address}/balance`);
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<unknown> {
    return this.fetchJson(`/transactions/${txid}`);
  }

  /**
   * Check API health
   */
  async healthCheck(): Promise<{ kaspadServers: unknown[]; database: unknown }> {
    return this.fetchJson('/info/health');
  }

  /**
   * Get network info
   */
  getNetwork(): Network {
    return this.network;
  }
}

// Singleton instance
let restClient: KaspaRestClient | null = null;

/**
 * Get or create REST API client
 */
export function getKaspaRestClient(network: Network): KaspaRestClient {
  if (!restClient || restClient.getNetwork() !== network) {
    restClient = new KaspaRestClient(network);
  }
  return restClient;
}
