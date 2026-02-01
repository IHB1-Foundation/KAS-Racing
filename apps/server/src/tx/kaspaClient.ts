/**
 * Kaspa RPC Client
 *
 * Provides connection to Kaspa node for UTXO queries and transaction broadcast.
 *
 * NOTE: This is a skeleton implementation. Full kaspa-wasm integration
 * will be completed when testnet environment is ready.
 */

import { getConfig } from '../config/index.js';

// UTXO Entry type definition (matches kaspa-wasm structure)
export interface UtxoEntry {
  address: string;
  outpoint: {
    transactionId: string;
    index: number;
  };
  utxoEntry: {
    amount: string;
    scriptPublicKey: string;
    blockDaaScore: string;
    isCoinbase: boolean;
  };
}

// RPC Client interface (will be implemented with kaspa-wasm)
export interface KaspaRpcClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getUtxosByAddresses(addresses: string[]): Promise<{ entries: UtxoEntry[] }>;
  submitTransaction(params: {
    transaction: unknown;
    allowOrphan: boolean;
  }): Promise<{ transactionId: string }>;
}

// Placeholder client for development
class PlaceholderRpcClient implements KaspaRpcClient {
  private connected = false;

  connect(): Promise<void> {
    console.log('[kaspa] Placeholder RPC client connected (not real)');
    this.connected = true;
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.connected = false;
    console.log('[kaspa] Placeholder RPC client disconnected');
    return Promise.resolve();
  }

  getUtxosByAddresses(addresses: string[]): Promise<{ entries: UtxoEntry[] }> {
    if (!this.connected) {
      return Promise.reject(new Error('RPC client not connected'));
    }
    // Return empty for now - will be implemented with real RPC
    console.warn(`[kaspa] getUtxosByAddresses(${addresses.length} addresses): returning mock data`);
    return Promise.resolve({ entries: [] });
  }

  submitTransaction(params: {
    transaction: unknown;
    allowOrphan: boolean;
  }): Promise<{ transactionId: string }> {
    if (!this.connected) {
      return Promise.reject(new Error('RPC client not connected'));
    }
    // Generate mock txid for development
    console.warn(`[kaspa] submitTransaction(allowOrphan=${params.allowOrphan}): returning mock txid`);
    const mockTxid = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return Promise.resolve({ transactionId: mockTxid });
  }
}

// Singleton client
let rpcClient: KaspaRpcClient | null = null;

/**
 * Get the RPC endpoint URL based on network
 */
export function getRpcUrl(network: 'mainnet' | 'testnet'): string {
  if (network === 'mainnet') {
    return 'wss://api.kaspa.org';
  }
  return 'wss://api-tn.kaspa.org';
}

/**
 * Get or create RPC client connection
 *
 * NOTE: Currently returns placeholder. Real kaspa-wasm client
 * will be integrated when testnet keys are available.
 */
export async function getKaspaClient(): Promise<KaspaRpcClient> {
  if (rpcClient) {
    return rpcClient;
  }

  const config = getConfig();
  const url = getRpcUrl(config.network);

  console.log(`[kaspa] Connecting to ${config.network} RPC at ${url}...`);

  // TODO: Replace with real kaspa-wasm RpcClient when ready
  // const kaspa = await import('kaspa-wasm');
  // rpcClient = new kaspa.RpcClient({ ... });

  rpcClient = new PlaceholderRpcClient();
  await rpcClient.connect();

  return rpcClient;
}

/**
 * Disconnect from RPC
 */
export async function disconnectKaspa(): Promise<void> {
  if (rpcClient) {
    await rpcClient.disconnect();
    rpcClient = null;
    console.log('[kaspa] Disconnected');
  }
}
