/**
 * Chain Watcher
 *
 * Polls Kaspa REST API for UTXO changes on watched addresses.
 * Detects deposits, settlements, and refund transactions.
 *
 * Kaspa uses a DAG, so we track by address UTXOs rather than
 * linear block scanning. DAA scores provide ordering.
 */

import { randomUUID } from 'crypto';
import type { IndexerConfig, ChainEvent, AddressUtxo, KaspaTransaction } from './types.js';
import { IndexerStore } from './store.js';

export class ChainWatcher {
  private config: IndexerConfig;
  private store: IndexerStore;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private knownUtxos = new Map<string, Set<string>>(); // address → set of outpoint keys

  constructor(config: IndexerConfig, store: IndexerStore) {
    this.config = config;
    this.store = store;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log(`[indexer] Starting chain watcher (${this.config.network})`);
    console.log(`[indexer] Watching ${this.config.watchAddresses.length} addresses`);
    console.log(`[indexer] Poll interval: ${this.config.pollIntervalMs}ms`);

    // Initialize known UTXOs
    await this.initializeKnownUtxos();

    // Update state with current watch addresses
    await this.store.updateState({
      watchedAddresses: this.config.watchAddresses,
      lastRunAt: new Date(),
    });

    // Start polling loop
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[indexer] Chain watcher stopped');
  }

  /**
   * Add an address to watch list at runtime.
   */
  async addWatchAddress(address: string): Promise<void> {
    if (!this.config.watchAddresses.includes(address)) {
      this.config.watchAddresses.push(address);
      console.log(`[indexer] Added watch address: ${address}`);
      await this.store.updateState({
        watchedAddresses: this.config.watchAddresses,
      });
    }
  }

  /**
   * Initialize known UTXOs for all watched addresses.
   */
  private async initializeKnownUtxos(): Promise<void> {
    for (const address of this.config.watchAddresses) {
      try {
        const utxos = await this.fetchUtxos(address);
        const keys = new Set(utxos.map(u => `${u.outpoint.transactionId}:${u.outpoint.index}`));
        this.knownUtxos.set(address, keys);
        console.log(`[indexer] Initialized ${keys.size} UTXOs for ${address.substring(0, 24)}...`);
      } catch (err: unknown) {
        console.warn(`[indexer] Failed to init UTXOs for ${address}: ${String(err)}`);
        this.knownUtxos.set(address, new Set());
      }
    }
  }

  /**
   * Main polling loop.
   */
  private poll(): void {
    if (!this.running) return;

    this.pollOnce()
      .then((hasActivity) => {
        const interval = hasActivity
          ? this.config.pollIntervalMs
          : this.config.idlePollIntervalMs;
        this.timer = setTimeout(() => this.poll(), interval);
      })
      .catch((err) => {
        console.error('[indexer] Poll error:', err);
        this.timer = setTimeout(() => this.poll(), this.config.idlePollIntervalMs);
      });
  }

  /**
   * Single poll iteration.
   * Returns true if there was activity (new events found).
   */
  async pollOnce(): Promise<boolean> {
    let hasActivity = false;

    // 1. Check for new UTXOs on watched addresses
    for (const address of this.config.watchAddresses) {
      try {
        const newEvents = await this.checkAddressUtxos(address);
        if (newEvents > 0) {
          hasActivity = true;
          console.log(`[indexer] Found ${newEvents} new event(s) for ${address.substring(0, 24)}...`);
        }
      } catch (err: unknown) {
        console.warn(`[indexer] Error checking ${address}: ${String(err)}`);
      }
    }

    // 2. Update status of unconfirmed events
    const unconfirmed = await this.store.getUnconfirmedEvents();
    for (const event of unconfirmed) {
      try {
        await this.updateEventStatus(event);
      } catch {
        // Silently skip status update failures
      }
    }

    // 3. Update indexer state
    await this.store.updateState({
      lastRunAt: new Date(),
      eventsProcessed: await this.store.getEventCount(),
    });

    return hasActivity;
  }

  /**
   * Check for new UTXOs at an address and create chain events.
   */
  private async checkAddressUtxos(address: string): Promise<number> {
    const utxos = await this.fetchUtxos(address);
    const known = this.knownUtxos.get(address) ?? new Set<string>();
    let newEvents = 0;

    for (const utxo of utxos) {
      const key = `${utxo.outpoint.transactionId}:${utxo.outpoint.index}`;
      if (known.has(key)) continue;

      // New UTXO detected — classify and store
      const event = await this.classifyUtxo(utxo, address);
      if (event) {
        const inserted = await this.store.insertEvent(event);
        if (inserted) newEvents++;
      }

      known.add(key);
    }

    this.knownUtxos.set(address, known);
    return newEvents;
  }

  /**
   * Classify a UTXO into a chain event type.
   */
  private async classifyUtxo(utxo: AddressUtxo, watchedAddress: string): Promise<ChainEvent | null> {
    const txid = utxo.outpoint.transactionId;
    const amount = BigInt(utxo.utxoEntry.amount);
    const daaScore = Number(utxo.utxoEntry.blockDaaScore);

    // Fetch full transaction to determine sender
    let fromAddress = 'unknown';
    try {
      const tx = await this.fetchTransaction(txid);
      if (tx?.inputs?.[0]?.script_public_key_address) {
        fromAddress = tx.inputs[0].script_public_key_address;
      }
    } catch {
      // Unable to fetch full tx details
    }

    // Classify event type based on address role
    const eventType = this.detectEventType(fromAddress, watchedAddress);

    return {
      id: randomUUID(),
      txid,
      eventType,
      matchId: null, // Will be enriched by API server
      sessionId: null,
      fromAddress,
      toAddress: watchedAddress,
      amountSompi: amount,
      daaScore,
      acceptedAt: new Date(), // UTXO exists = accepted
      includedAt: null,
      confirmedAt: null,
      confirmations: 0,
      payload: null,
      indexedAt: new Date(),
    };
  }

  /**
   * Detect event type based on from/to addresses.
   * This is a heuristic — the API server enriches with match/session context.
   */
  private detectEventType(
    _fromAddress: string,
    toAddress: string
  ): ChainEvent['eventType'] {
    // If the watched address is a P2SH (escrow) address, it's a deposit
    if (toAddress.includes(':p')) {
      return 'deposit';
    }
    // Default to deposit; server will reclassify based on match context
    return 'deposit';
  }

  /**
   * Update the status of an existing chain event.
   */
  private async updateEventStatus(event: ChainEvent): Promise<void> {
    try {
      const resp = await fetch(
        `${this.config.apiBaseUrl}/transactions/${event.txid}`
      );
      if (!resp.ok) return;

      const tx = await resp.json() as KaspaTransaction;

      const updates: Parameters<IndexerStore['updateEventStatus']>[2] = {};

      if (tx.is_accepted && !event.acceptedAt) {
        updates.acceptedAt = new Date();
      }

      if (tx.accepting_block_blue_score) {
        updates.daaScore = tx.accepting_block_blue_score;
        if (!event.includedAt) {
          updates.includedAt = new Date();
        }
      }

      // Check confirmations via blockdag info
      if (tx.accepting_block_blue_score) {
        const dagResp = await fetch(`${this.config.apiBaseUrl}/info/blockdag`);
        if (dagResp.ok) {
          const dag = await dagResp.json() as { virtualDaaScore?: number };
          if (dag.virtualDaaScore) {
            const confirmations = dag.virtualDaaScore - tx.accepting_block_blue_score;
            updates.confirmations = Math.max(0, confirmations);
            if (confirmations >= 10 && !event.confirmedAt) {
              updates.confirmedAt = new Date();
            }
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.store.updateEventStatus(event.txid, event.toAddress, updates);
      }
    } catch {
      // Status update failed — will retry next poll
    }
  }

  /**
   * Fetch UTXOs for an address from the Kaspa REST API.
   */
  private async fetchUtxos(address: string): Promise<AddressUtxo[]> {
    const resp = await fetch(
      `${this.config.apiBaseUrl}/addresses/${address}/utxos`
    );
    if (!resp.ok) {
      throw new Error(`UTXO fetch failed: ${resp.status}`);
    }
    return await resp.json() as AddressUtxo[];
  }

  /**
   * Fetch full transaction details.
   */
  private async fetchTransaction(txid: string): Promise<KaspaTransaction | null> {
    try {
      const resp = await fetch(
        `${this.config.apiBaseUrl}/transactions/${txid}`
      );
      if (!resp.ok) return null;
      return await resp.json() as KaspaTransaction;
    } catch {
      return null;
    }
  }
}
