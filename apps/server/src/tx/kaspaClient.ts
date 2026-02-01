/**
 * Kaspa RPC Client
 *
 * Provides connection to Kaspa node for UTXO queries and transaction broadcast.
 * Uses kaspa-wasm library for actual blockchain interaction.
 */

import { getConfig, type Network } from '../config/index.js';

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

// Internal type for RPC response parsing
interface RpcUtxoItem {
  address?: unknown;
  outpoint?: {
    transactionId?: unknown;
    index?: unknown;
  };
  utxoEntry?: {
    amount?: unknown;
    scriptPublicKey?: { script?: unknown };
    blockDaaScore?: unknown;
    isCoinbase?: unknown;
  };
}

// Our wrapper interface for RPC operations
export interface IKaspaRpc {
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getUtxosByAddresses(addresses: string[]): Promise<{ entries: UtxoEntry[] }>;
  submitTransaction(tx: unknown): Promise<string>;
}

// Module-level kaspa-wasm types (loaded dynamically)
let kaspaWasm: typeof import('kaspa-wasm') | null = null;

/**
 * Setup WebSocket for Node.js environment
 * Required by kaspa-wasm for RPC connections
 */
async function setupWebSocket(): Promise<void> {
  if (typeof globalThis.WebSocket === 'undefined') {
    // Use isomorphic-ws which provides W3C compatible WebSocket
    const isomorphicWs = await import('isomorphic-ws');
    // @ts-expect-error - isomorphic-ws is compatible with W3C WebSocket
    globalThis.WebSocket = isomorphicWs.default;
    console.log('[kaspa] WebSocket shim installed');
  }
}

/**
 * Load kaspa-wasm module with WebSocket shim
 */
async function loadKaspaWasm(): Promise<typeof import('kaspa-wasm')> {
  if (!kaspaWasm) {
    await setupWebSocket();
    kaspaWasm = await import('kaspa-wasm');
  }
  return kaspaWasm;
}

/**
 * Get the RPC endpoint URL based on network
 */
export function getRpcUrl(network: Network): string {
  // Public wRPC endpoints - just the host, kaspa-wasm adds the protocol
  if (network === 'mainnet') {
    return 'wrpc.kaspa.org';
  }
  // Testnet (TN11)
  return 'wrpc-tn11.kaspa.org';
}

/**
 * Real Kaspa RPC Client using kaspa SDK
 */
class KaspaRpcClientWrapper implements IKaspaRpc {
  private client: InstanceType<typeof import('kaspa-wasm').RpcClient> | null = null;
  private network: Network;
  private url: string;
  private connected = false;

  constructor(network: Network) {
    this.network = network;
    this.url = getRpcUrl(network);
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    const kaspa = await loadKaspaWasm();

    console.log(`[kaspa] Connecting to ${this.network} RPC at ${this.url}...`);

    try {
      // Use NetworkType enum for network
      const networkType = this.network === 'mainnet'
        ? kaspa.NetworkType.Mainnet
        : kaspa.NetworkType.Testnet;

      // Get default port for Borsh encoding
      const port = kaspa.RpcClient.defaultPort(kaspa.Encoding.Borsh, networkType);
      const fullUrl = `wss://${this.url}:${port}`;
      console.log(`[kaspa] Full URL: ${fullUrl}`);

      // Create RPC client with Borsh encoding
      this.client = new kaspa.RpcClient(fullUrl, kaspa.Encoding.Borsh, networkType);
      console.log('[kaspa] RpcClient created, connecting...');

      // Connect - pass undefined for default settings
      await this.client.connect(undefined);

      this.connected = true;
      console.log(`[kaspa] Connected to ${this.network} RPC`);
    } catch (error) {
      console.error('[kaspa] Connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.connected = false;
      console.log('[kaspa] Disconnected');
    }
  }

  async getUtxosByAddresses(addresses: string[]): Promise<{ entries: UtxoEntry[] }> {
    if (!this.client || !this.connected) {
      throw new Error('RPC client not connected');
    }

    console.log(`[kaspa] getUtxosByAddresses(${addresses.length} addresses)`);

    const response: unknown = await this.client.getUtxosByAddresses(addresses);

    // Transform response to our format
    const entries: UtxoEntry[] = [];

    if (response && Array.isArray(response)) {
      for (const item of response as RpcUtxoItem[]) {
        if (item.address && item.outpoint && item.utxoEntry) {
          // kaspa-wasm returns objects with toString() methods
          // We need to safely convert them to primitive strings
          const toStr = (val: unknown): string => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') return val;
            if (typeof val === 'number' || typeof val === 'bigint') return val.toString();
            if (typeof val === 'object' && 'toString' in val) {
              return (val as { toString(): string }).toString();
            }
            return '';
          };

          entries.push({
            address: toStr(item.address),
            outpoint: {
              transactionId: toStr(item.outpoint.transactionId),
              index: Number(item.outpoint.index ?? 0),
            },
            utxoEntry: {
              amount: toStr(item.utxoEntry.amount) || '0',
              scriptPublicKey: toStr(item.utxoEntry.scriptPublicKey?.script),
              blockDaaScore: toStr(item.utxoEntry.blockDaaScore) || '0',
              isCoinbase: Boolean(item.utxoEntry.isCoinbase),
            },
          });
        }
      }
    }

    console.log(`[kaspa] Found ${entries.length} UTXOs`);
    return { entries };
  }

  async submitTransaction(tx: unknown): Promise<string> {
    if (!this.client || !this.connected) {
      throw new Error('RPC client not connected');
    }

    console.log('[kaspa] Submitting transaction...');

    const result: unknown = await this.client.submitTransaction(tx, false);
    const resultObj = result as { transactionId?: string } | string;
    const txid = typeof resultObj === 'string'
      ? resultObj
      : resultObj?.transactionId ?? '';
    console.log(`[kaspa] Transaction submitted: ${txid}`);

    return txid;
  }

  /**
   * Get the underlying RPC client (for advanced operations)
   */
  getClient(): InstanceType<typeof import('kaspa-wasm').RpcClient> | null {
    return this.client;
  }
}

// Singleton RPC wrapper
let rpcWrapper: KaspaRpcClientWrapper | null = null;

/**
 * Get or create RPC client connection
 */
export async function getKaspaClient(): Promise<IKaspaRpc> {
  if (rpcWrapper && rpcWrapper.isConnected()) {
    return rpcWrapper;
  }

  const config = getConfig();
  rpcWrapper = new KaspaRpcClientWrapper(config.network);
  await rpcWrapper.connect();

  return rpcWrapper;
}

/**
 * Get the kaspa-wasm module (for transaction building)
 */
export async function getKaspaWasm(): Promise<typeof import('kaspa-wasm')> {
  return loadKaspaWasm();
}

/**
 * Disconnect from RPC
 */
export async function disconnectKaspa(): Promise<void> {
  if (rpcWrapper) {
    await rpcWrapper.disconnect();
    rpcWrapper = null;
  }
}

/**
 * Check if RPC is connected
 */
export function isKaspaConnected(): boolean {
  return rpcWrapper?.isConnected() ?? false;
}
